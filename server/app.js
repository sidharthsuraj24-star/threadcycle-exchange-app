const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const sharp = require('sharp');
const path = require('node:path');
const crypto = require('node:crypto');
const { User, Listing, Swap, Message, ActivityEvent } = require('./models');
const { initializeDatabase } = require('./database');
const { MongoRateLimitStore } = require('./rate-limit-store');
const { estimateValue, CATEGORIES, CONDITIONS, BRANDS } = require('./value');

const app = express();
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
if (isProduction && !process.env.MONGODB_URI) throw new Error('MONGODB_URI is required in production; application data and sessions must use MongoDB.');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:'], styleSrc: ["'self'"], scriptSrc: ["'self'"],
    connectSrc: ["'self'"], fontSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"], formAction: ["'self'"]
  } },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(express.json({ limit: '64kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 40 }));
app.use((_req, res, next) => {
  initializeDatabase().then(() => next()).catch(() => res.status(503).json({ error: 'Marketplace data is temporarily unavailable.' }));
});

const sessionSecret = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'test' ? 'test-session-secret-long-enough-to-meet-minimum-32-bytes' : '');
if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) throw new Error('SESSION_SECRET must contain at least 32 bytes.');
const sessionOptions = {
  name: isProduction ? '__Host-swap.sid' : 'swap.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, sameSite: 'strict', secure: isProduction, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 }
};
let sessionStore;
if (process.env.MONGODB_URI) {
  sessionStore = MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: 'sessions', ttl: 7 * 24 * 60 * 60, autoRemove: 'native' });
  sessionOptions.store = sessionStore;
}
app.use(session(sessionOptions));
app.locals.sessionStore = sessionStore;
app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, store: new MongoRateLimitStore('api', sessionSecret), standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests. Please try again in a minute.' } }));
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 8, store: new MongoRateLimitStore('auth', sessionSecret), standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please wait 15 minutes.' } });

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const sendError = (res, error) => {
  if (!error.status && process.env.NODE_ENV === 'test') console.error(`[test-only API diagnostic] ${error.name}: ${error.message}`);
  return res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong. Please try again.' });
};
const safeText = (value, max, field) => {
  if (typeof value !== 'string') throw new HttpError(400, `${field} is required.`);
  const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (!clean || clean.length > max) throw new HttpError(400, `${field} must be between 1 and ${max} characters.`);
  return clean;
};
const optionalText = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '';
const enumValue = (value, allowed, field) => { if (!allowed.includes(value)) throw new HttpError(400, `Choose a valid ${field}.`); return value; };
const parseId = (value, field = 'ID') => { if (!mongoose.isValidObjectId(value)) throw new HttpError(404, `${field} not found.`); return value; };
const userView = (user) => ({ id: String(user._id), name: user.name, email: user.isDemo ? undefined : user.email, city: user.city || '', bio: user.bio || '', role: user.role, isDemo: Boolean(user.isDemo), demoLabel: user.demoLabel || '' });
const listingView = (item, owner) => ({
  id: String(item._id), ownerId: String(item.owner?._id || item.owner), ownerName: owner?.name || item.owner?.name || 'Member', ownerCity: owner?.city || item.owner?.city || item.city,
  ownerIsDemo: Boolean(owner?.isDemo ?? item.owner?.isDemo ?? item.isDemo), demoLabel: (owner?.demoLabel || item.owner?.demoLabel || (item.isDemo ? 'Illustrative demo · not contactable' : '')),
  title: item.title, category: item.category, size: item.size, brand: item.brand, brandTier: item.brandTier, condition: item.condition, description: item.description, city: item.city,
  estimatedValue: item.estimatedValue, comparableRetailPrice: item.comparableRetailPrice ?? null, status: item.status, isDemo: Boolean(item.isDemo), imageCount: item.imageCount || 0,
  imageUrls: item.isDemo ? [`/images/demo-${item.demoImageNo}.webp`] : Array.from({ length: item.imageCount || 0 }, (_, index) => `/api/listings/${item._id}/images/${index}`),
  createdAt: item.createdAt
});
const csrfMatches = (req) => {
  const expected = req.session?.csrfToken;
  if (typeof expected !== 'string' || expected.length === 0) return false;
  return [req.body?._csrf, req.get('x-csrf-token')].some((candidate) => {
    if (typeof candidate !== 'string') return false;
    const expectedBytes = Buffer.from(expected);
    const candidateBytes = Buffer.from(candidate);
    return expectedBytes.length === candidateBytes.length && crypto.timingSafeEqual(expectedBytes, candidateBytes);
  });
};
function requireCsrf(req, res, next) {
  try {
    const origin = req.get('origin');
    if (origin) {
      const expected = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).origin : `${req.protocol}://${req.get('host')}`;
      if (new URL(origin).origin !== expected) throw new HttpError(403, 'This request origin is not allowed.');
    }
  } catch (e) { return sendError(res, e.status ? e : new HttpError(403, 'This request origin is not allowed.')); }
  if (!csrfMatches(req)) return res.status(403).json({ error: 'Session expired. Refresh the page and try again.' });
  next();
}
async function requireUser(req, res, next) {
  try {
    if (!req.session.userId) throw new HttpError(401, 'Please sign in to continue.');
    const user = await User.findById(req.session.userId).select('-passwordHash');
    if (!user || user.isDemo || user.suspended) {
      req.session.destroy(() => {});
      throw new HttpError(401, 'This account is unavailable. Sign in again or contact the marketplace administrator.');
    }
    req.user = user;
    next();
  } catch (e) { sendError(res, e); }
}
const requireAdmin = (req, res, next) => req.user?.role === 'admin' ? next() : sendError(res, new HttpError(403, 'Administrator access is required.'));
const isParticipant = (swap, userId) => String(swap.requester) === String(userId) || String(swap.recipient) === String(userId);
const completedStatuses = ['declined', 'withdrawn', 'completed'];
const transitionSwap = (swap, nextStatus, actor, at = new Date()) => {
  if (swap.status === nextStatus) return false;
  swap.statusHistory.push({ from: swap.status, to: nextStatus, actor, at });
  swap.status = nextStatus;
  swap.updatedAt = at;
  return true;
};
const recordActivity = (member, action) => ActivityEvent.create({ member, action });
const swapPrivateState = (swap, memberId) => {
  const currentAgreement = swap.agreements?.[swap.agreements.length - 1];
  const agreedMemberIds = new Set((currentAgreement?.confirmedBy || []).map((entry) => String(entry.member)));
  const participantIds = [swap.requester, swap.recipient].map((participant) => String(participant?._id || participant));
  return {
    statusHistory: (swap.statusHistory || []).map((entry) => ({ from: entry.from, to: entry.to, actorId: String(entry.actor), at: entry.at })),
    agreements: (swap.agreements || []).map((agreement) => ({
      revision: agreement.revision, terms: agreement.terms, proposedBy: String(agreement.proposedBy), proposedAt: agreement.proposedAt,
      confirmedBy: (agreement.confirmedBy || []).map((entry) => ({ memberId: String(entry.member), at: entry.at }))
    })),
    agreementConfirmed: Boolean(currentAgreement && participantIds.every((id) => agreedMemberIds.has(id))),
    myAgreementConfirmed: Boolean(currentAgreement && agreedMemberIds.has(String(memberId))),
    completionConfirmations: (swap.completionConfirmations || []).map((entry) => ({ memberId: String(entry.member), at: entry.at })),
    shipment: {
      serviceLabel: swap.shipment?.serviceLabel || '', trackingReference: swap.shipment?.trackingReference || '',
      status: swap.shipment?.status || 'not_started', updatedBy: swap.shipment?.updatedBy ? String(swap.shipment.updatedBy) : null,
      updatedAt: swap.shipment?.updatedAt || null,
      history: (swap.shipment?.history || []).map((entry) => ({ from: entry.from, to: entry.to, actorId: String(entry.actor), at: entry.at }))
    }
  };
};
const getSwapForUser = async (id, userId) => {
  const swap = await Swap.findById(parseId(id, 'Swap'));
  if (!swap || !isParticipant(swap, userId)) throw new HttpError(404, 'Swap not found.');
  return swap;
};
const validateImageBytes = (file) => {
  const b = file.buffer;
  let mime = null;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) mime = 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mime = 'image/png';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') mime = 'image/webp';
  if (!mime || mime !== file.mimetype) throw new HttpError(400, 'Use a valid JPEG, PNG, or WebP image file.');
  return { data: b, mime, bytes: b.length };
};
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 1_000_000, files: 4, fields: 16, fieldSize: 1200 }, fileFilter: (_req, file, cb) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(new HttpError(400, 'Photos must be JPEG, PNG, or WebP; SVG files are not accepted.'));
  cb(null, true);
} });
const imageFiles = async (req) => {
  const images = [];
  for (const file of req.files || []) {
    validateImageBytes(file);
    try {
      const data = await sharp(file.buffer, { limitInputPixels: 40_000_000 })
        .rotate()
        .webp({ quality: 82, alphaQuality: 100, effort: 4 })
        .toBuffer();
      if (data.length > 1_000_000) throw new HttpError(400, 'Each photo must be 1 MB or smaller after processing.');
      images.push({ data, mime: 'image/webp', bytes: data.length });
    } catch (error) {
      if (error.status) throw error;
      throw new HttpError(400, 'Use a valid JPEG, PNG, or WebP image file.');
    }
  }
  return images;
};
const optionalComparableRetailPrice = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') throw new HttpError(400, 'Enter a valid comparable retail price.');
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10000000) throw new HttpError(400, 'Comparable retail price must be a whole number of rupees from ₹1 to ₹10,000,000.');
  return amount;
};
const listingFilterFromBody = (body, city) => ({
  title: safeText(body.title, 90, 'Title'), category: enumValue(body.category, Object.keys(CATEGORIES), 'category'),
  size: safeText(body.size, 24, 'Size'), brand: safeText(body.brand, 60, 'Brand'), brandTier: enumValue(body.brandTier, Object.keys(BRANDS), 'brand tier'),
  condition: enumValue(body.condition, Object.keys(CONDITIONS), 'condition'),
  description: safeText(body.description, 800, 'Description'), city: safeText(city || body.city, 60, 'City'),
  comparableRetailPrice: optionalComparableRetailPrice(body.comparableRetailPrice),
  estimatedValue: estimateValue({ category: body.category, condition: body.condition, brandTier: body.brandTier })
});

// Session bootstrap: returns only a random CSRF token and the safe public member view.
app.get('/api/me', async (req, res) => {
  try {
    if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    let user = null;
    if (req.session.userId) {
      const found = await User.findById(req.session.userId).select('-passwordHash');
      if (found && !found.suspended && !found.isDemo) user = userView(found);
      else req.session.userId = null;
    }
    res.json({ user, csrfToken: req.session.csrfToken });
  } catch (e) { sendError(res, e); }
});

app.post('/api/register', authLimiter, requireCsrf, async (req, res) => {
  try {
    const name = safeText(req.body.name, 48, 'Name');
    const email = safeText(req.body.email, 254, 'Email').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
    const password = req.body.password;
    if (typeof password !== 'string' || Buffer.byteLength(password) < 12 || Buffer.byteLength(password) > 72) throw new HttpError(400, 'Password must be 12–72 bytes long.');
    const city = safeText(req.body.city, 60, 'City');
    if (await User.exists({ email })) throw new HttpError(409, 'An account already exists for that email.');
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), city });
    await logIn(req, user);
    await recordActivity(user._id, 'account_registered');
    res.status(201).json({ user: userView(user), csrfToken: req.session.csrfToken });
  } catch (e) {
    if (e.code === 11000) return sendError(res, new HttpError(409, 'An account already exists for that email.'));
    sendError(res, e);
  }
});
async function logIn(req, user) {
  await new Promise((resolve, reject) => req.session.regenerate((err) => err ? reject(err) : resolve()));
  req.session.userId = String(user._id);
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  await new Promise((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
}
app.post('/api/login', authLimiter, requireCsrf, async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || user.isDemo || !user.passwordHash || !await bcrypt.compare(password, user.passwordHash) || user.suspended) return sendError(res, new HttpError(401, 'Email or password was not recognized.'));
    await logIn(req, user);
    res.json({ user: userView(user), csrfToken: req.session.csrfToken });
  } catch (e) { sendError(res, e); }
});
app.post('/api/logout', requireCsrf, async (req, res) => {
  try {
    await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
    res.clearCookie(sessionOptions.name, { httpOnly: true, sameSite: 'strict', secure: isProduction, path: '/' });
    res.json({ ok: true });
  } catch (e) { sendError(res, e); }
});

app.get('/api/value/estimate', (req, res) => {
  try { res.json({ estimatedValue: estimateValue({ category: req.query.category, condition: req.query.condition, brandTier: req.query.brandTier }), formula: 'category guide × condition factor × brand tier; rounded to ₹50' }); }
  catch { res.status(400).json({ error: 'Choose a category and condition to see the estimate.' }); }
});

app.get('/api/listings', async (req, res) => {
  try {
    const query = { status: 'available' };
    if (req.query.category) query.category = enumValue(req.query.category, Object.keys(CATEGORIES), 'category');
    if (req.query.size) query.size = new RegExp(`^${String(req.query.size).slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (req.query.city) query.city = new RegExp(`^${String(req.query.city).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (req.query.q) { const text = String(req.query.q).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); query.$or = [{ title: new RegExp(text, 'i') }, { brand: new RegExp(text, 'i') }, { description: new RegExp(text, 'i') }]; }
    const page = Math.max(1, Math.min(50, Number(req.query.page) || 1));
    const [items, count] = await Promise.all([
      Listing.find(query).select('-images').sort({ createdAt: -1 }).skip((page - 1) * 24).limit(24).populate('owner', 'name city isDemo demoLabel'),
      Listing.countDocuments(query)
    ]);
    res.json({ items: items.map((item) => listingView(item)), total: count, page });
  } catch (e) { sendError(res, e); }
});
app.get('/api/listings/:id', async (req, res) => {
  try {
    const item = await Listing.findOne({ _id: parseId(req.params.id, 'Item'), status: 'available' }).select('-images').populate('owner', 'name city isDemo demoLabel');
    if (!item) throw new HttpError(404, 'Item not found.');
    res.json({ item: listingView(item) });
  } catch (e) { sendError(res, e); }
});
app.get('/api/listings/:id/images/:index', async (req, res) => {
  try {
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index > 3) throw new HttpError(404, 'Photo not found.');
    const item = await Listing.findById(parseId(req.params.id, 'Item')).select('+images');
    if (!item || item.status === 'removed' || item.status === 'hidden' || !item.images[index]) throw new HttpError(404, 'Photo not found.');
    res.set({ 'Content-Type': item.images[index].mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' }).send(item.images[index].data);
  } catch (e) { sendError(res, e); }
});

app.post('/api/listings', requireUser, requireCsrf, (req, res, next) => upload.array('images', 4)(req, res, (err) => err ? sendError(res, err instanceof multer.MulterError ? new HttpError(400, err.code === 'LIMIT_FILE_SIZE' ? 'Each photo must be 1 MB or smaller.' : 'Upload up to 4 photos.') : err) : next()), async (req, res) => {
  try {
    const fields = listingFilterFromBody(req.body, req.user.city);
    const images = await imageFiles(req);
    const item = await Listing.create({ ...fields, owner: req.user._id, images, imageCount: images.length });
    await recordActivity(req.user._id, 'listing_created');
    res.status(201).json({ item: listingView(item, req.user) });
  } catch (e) { sendError(res, e); }
});
app.patch('/api/listings/:id', requireUser, requireCsrf, (req, res, next) => upload.array('images', 4)(req, res, (err) => err ? sendError(res, new HttpError(400, 'Check the selected photo type, size, and count.')) : next()), async (req, res) => {
  try {
    const item = await Listing.findById(parseId(req.params.id, 'Item'));
    if (!item || String(item.owner) !== String(req.user._id) || item.isDemo) throw new HttpError(404, 'Item not found.');
    if (item.status !== 'available') throw new HttpError(409, 'Only available items can be edited.');
    Object.assign(item, listingFilterFromBody(req.body, req.user.city));
    const images = await imageFiles(req);
    if (images.length) { item.images = images; item.imageCount = images.length; }
    item.updatedAt = new Date();
    await item.save();
    await recordActivity(req.user._id, 'listing_updated');
    res.json({ item: listingView(item, req.user) });
  } catch (e) { sendError(res, e); }
});
app.delete('/api/listings/:id', requireUser, requireCsrf, async (req, res) => {
  try {
    const item = await Listing.findById(parseId(req.params.id, 'Item'));
    if (!item || String(item.owner) !== String(req.user._id) || item.isDemo) throw new HttpError(404, 'Item not found.');
    if (item.status === 'reserved') throw new HttpError(409, 'This item is part of an accepted swap.');
    item.status = 'removed'; await item.save();
    await recordActivity(req.user._id, 'listing_removed');
    res.json({ ok: true });
  } catch (e) { sendError(res, e); }
});

app.get('/api/matches', requireUser, async (req, res) => {
  try {
    const city = optionalText(req.query.city || req.user.city, 60);
    const own = await Listing.find({ owner: req.user._id, status: 'available' }).select('estimatedValue').lean();
    const targetValues = own.map((i) => i.estimatedValue);
    const baseQuery = { owner: { $ne: req.user._id }, status: 'available', isDemo: false };
    const cityPattern = city ? new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') : null;
    const [sameCityListings, otherListings] = await Promise.all([
      Listing.find(cityPattern ? { ...baseQuery, city: cityPattern } : baseQuery).select('-images').sort({ createdAt: -1 }).limit(100).populate('owner', 'name city isDemo demoLabel'),
      cityPattern ? Listing.find({ ...baseQuery, $nor: [{ city: cityPattern }] }).select('-images').sort({ createdAt: -1 }).limit(100).populate('owner', 'name city isDemo demoLabel') : []
    ]);
    const listings = cityPattern ? [...sameCityListings, ...otherListings] : sameCityListings;
    const matches = listings.map((i) => {
      const gap = targetValues.length ? Math.min(...targetValues.map((v) => Math.abs(v - i.estimatedValue) / Math.max(v, i.estimatedValue, 1))) : 1;
      const sameCity = city && i.city.toLocaleLowerCase() === city.toLocaleLowerCase();
      return { item: listingView(i), sameCity: Boolean(sameCity), valueGap: Math.round(gap * 100), matchScore: Math.max(0, Math.round((sameCity ? 60 : 0) + (1 - Math.min(gap, 1)) * 40)) };
    }).sort((a, b) => b.matchScore - a.matchScore || b.item.createdAt - a.item.createdAt).slice(0, 24);
    res.json({ items: matches, cityMatched: Boolean(city), locationMethod: 'Exact city-level matching from member-entered city names; not geospatial, distance, radius, GPS, or street-address matching.' });
  } catch (e) { sendError(res, e); }
});

app.post('/api/swaps', requireUser, requireCsrf, async (req, res) => {
  try {
    const requestedListing = await Listing.findById(parseId(req.body.requestedListingId, 'Item'));
    const offeredListing = await Listing.findById(parseId(req.body.offeredListingId, 'Item'));
    if (!requestedListing || !offeredListing || requestedListing.isDemo || offeredListing.isDemo || requestedListing.status !== 'available' || offeredListing.status !== 'available') throw new HttpError(409, 'Choose two available member listings. Illustrative demo items cannot receive swap requests.');
    if (String(requestedListing.owner) === String(req.user._id) || String(offeredListing.owner) !== String(req.user._id)) throw new HttpError(403, 'Choose your own item to offer and another member’s available item to request.');
    if (await User.exists({ _id: requestedListing.owner, suspended: true })) throw new HttpError(409, 'That member is not accepting swap requests.');
    const duplicate = await Swap.exists({ requester: req.user._id, recipient: requestedListing.owner, offeredListing: offeredListing._id, requestedListing: requestedListing._id, status: { $in: ['requested', 'accepted'] } });
    if (duplicate) throw new HttpError(409, 'This swap request is already active.');
    const createdAt = new Date();
    const swap = await Swap.create({ requester: req.user._id, recipient: requestedListing.owner, offeredListing: offeredListing._id, requestedListing: requestedListing._id, note: optionalText(req.body.note, 600), handoffPreference: enumValue(req.body.handoffPreference || 'flexible', ['local', 'remote', 'flexible'], 'exchange preference'), createdAt, updatedAt: createdAt, statusHistory: [{ from: 'none', to: 'requested', actor: req.user._id, at: createdAt }] });
    await Message.create({ swap: swap._id, sender: req.user._id, body: 'Swap request sent. Use this private thread to discuss the exchange details.' });
    await recordActivity(req.user._id, 'swap_requested');
    res.status(201).json({ swap: { id: String(swap._id), status: swap.status } });
  } catch (e) { sendError(res, e); }
});
app.get('/api/swaps', requireUser, async (req, res) => {
  try {
    const swaps = await Swap.find({ $or: [{ requester: req.user._id }, { recipient: req.user._id }] }).sort({ updatedAt: -1 }).limit(100)
      .populate('requester', 'name city').populate('recipient', 'name city').populate('offeredListing', 'title category size estimatedValue imageCount demoImageNo isDemo status').populate('requestedListing', 'title category size estimatedValue imageCount demoImageNo isDemo status');
    res.json({ swaps: swaps.map((s) => ({ id: String(s._id), status: s.status, note: s.note, handoffPreference: s.handoffPreference, createdAt: s.createdAt, updatedAt: s.updatedAt, requester: userView(s.requester), recipient: userView(s.recipient), offeredListing: s.offeredListing && listingView(s.offeredListing, s.requester), requestedListing: s.requestedListing && listingView(s.requestedListing, s.recipient), confirmed: s.confirmedBy.map(String).includes(String(req.user._id)), ...swapPrivateState(s, req.user._id) })) });
  } catch (e) { sendError(res, e); }
});
app.patch('/api/swaps/:id/status', requireUser, requireCsrf, async (req, res) => {
  try {
    const action = req.body.action;
    if (action === 'accept') {
      const session = await mongoose.startSession();
      try {
        let acceptedSwap;
        await session.withTransaction(async () => {
          const swap = await Swap.findById(parseId(req.params.id, 'Swap')).session(session);
          if (!swap || !isParticipant(swap, req.user._id)) throw new HttpError(404, 'Swap not found.');
          if (String(swap.recipient) !== String(req.user._id) || swap.status !== 'requested') throw new HttpError(409, 'Only the recipient can respond to a pending request.');
          const listingIds = [swap.offeredListing, swap.requestedListing];
          const reservation = await Listing.updateMany(
            { _id: { $in: listingIds }, status: 'available' },
            { $set: { status: 'reserved', updatedAt: new Date() } },
            { session }
          );
          if (reservation.modifiedCount !== 2) throw new HttpError(409, 'One of these items is no longer available.');
          transitionSwap(swap, 'accepted', req.user._id);
          await swap.save({ session });
          const conflicts = await Swap.find({ _id: { $ne: swap._id }, status: 'requested', $or: [{ offeredListing: { $in: listingIds } }, { requestedListing: { $in: listingIds } }] }).session(session);
          for (const conflict of conflicts) {
            transitionSwap(conflict, 'declined', req.user._id);
            await conflict.save({ session });
          }
          await ActivityEvent.create([{ member: req.user._id, action: 'swap_accepted' }], { session });
          acceptedSwap = { id: String(swap._id), status: swap.status, confirmed: swap.confirmedBy.length };
        });
        return res.json({ swap: acceptedSwap });
      } finally {
        await session.endSession();
      }
    }
    const swap = await Swap.findById(parseId(req.params.id, 'Swap'));
    if (!swap || !isParticipant(swap, req.user._id)) throw new HttpError(404, 'Swap not found.');
    let activityAction = null;
    if (action === 'decline') {
      if (String(swap.recipient) !== String(req.user._id) || swap.status !== 'requested') throw new HttpError(409, 'Only the recipient can respond to a pending request.');
      transitionSwap(swap, 'declined', req.user._id); activityAction = 'swap_declined';
    } else if (action === 'withdraw') {
      if (String(swap.requester) !== String(req.user._id) || swap.status !== 'requested') throw new HttpError(409, 'Only your pending request can be withdrawn.');
      transitionSwap(swap, 'withdrawn', req.user._id); activityAction = 'swap_withdrawn';
    } else if (action === 'confirm') {
      if (swap.status !== 'accepted') throw new HttpError(409, 'Both members can confirm only an accepted swap.');
      const latestAgreement = swap.agreements[swap.agreements.length - 1];
      const agreedIds = new Set((latestAgreement?.confirmedBy || []).map((entry) => String(entry.member)));
      if (!latestAgreement || ![swap.requester, swap.recipient].every((id) => agreedIds.has(String(id)))) throw new HttpError(409, 'Both participants must confirm the current negotiated terms before either can confirm completion.');
      if (!swap.confirmedBy.some((id) => String(id) === String(req.user._id))) {
        const confirmedAt = new Date();
        swap.confirmedBy.push(req.user._id);
        swap.completionConfirmations.push({ member: req.user._id, at: confirmedAt });
        activityAction = 'completion_confirmed';
      }
      if ([swap.requester, swap.recipient].every((id) => swap.confirmedBy.some((confirmId) => String(confirmId) === String(id)))) {
        transitionSwap(swap, 'completed', req.user._id);
        await Listing.updateMany({ _id: { $in: [swap.offeredListing, swap.requestedListing] } }, { $set: { status: 'swapped', updatedAt: new Date() } });
      }
    } else if (action === 'dispute') {
      if (!['requested', 'accepted'].includes(swap.status)) throw new HttpError(409, 'This swap cannot be disputed in its current state.');
      transitionSwap(swap, 'disputed', req.user._id); activityAction = 'dispute_reported';
      swap.adminNote = 'A participant asked an administrator to review this swap.';
    } else throw new HttpError(400, 'Choose a valid swap action.');
    swap.updatedAt = new Date(); await swap.save();
    if (activityAction) await recordActivity(req.user._id, activityAction);
    res.json({ swap: { id: String(swap._id), status: swap.status, confirmed: swap.confirmedBy.length } });
  } catch (e) { sendError(res, e); }
});
app.patch('/api/swaps/:id/agreement', requireUser, requireCsrf, async (req, res) => {
  try {
    const swap = await getSwapForUser(req.params.id, req.user._id);
    if (swap.status !== 'accepted') throw new HttpError(409, 'Negotiated terms can be proposed or confirmed only after the request is accepted.');
    let revisionCreated = false;
    if (req.body.action === 'propose') {
      const terms = safeText(req.body.terms, 1000, 'Agreed terms');
      const participants = [String(swap.requester), String(swap.recipient)];
      const messageAuthors = await Message.distinct('sender', { swap: swap._id, sender: { $in: participants } });
      if (!participants.every((id) => messageAuthors.map(String).includes(id))) throw new HttpError(409, 'Both participants must exchange at least one message before proposing final terms.');
      const current = swap.agreements[swap.agreements.length - 1];
      if (!current || current.terms !== terms) {
        swap.agreements.push({ revision: (current?.revision || 0) + 1, terms, proposedBy: req.user._id, proposedAt: new Date(), confirmedBy: [] });
        swap.updatedAt = new Date();
        await swap.save();
        await recordActivity(req.user._id, 'agreement_proposed');
        revisionCreated = true;
      }
    } else if (req.body.action === 'confirm') {
      const current = swap.agreements[swap.agreements.length - 1];
      if (!current) throw new HttpError(409, 'There are no negotiated terms to confirm yet.');
      if (!current.confirmedBy.some((entry) => String(entry.member) === String(req.user._id))) {
        current.confirmedBy.push({ member: req.user._id, at: new Date() });
        swap.updatedAt = new Date(); await swap.save();
        await recordActivity(req.user._id, 'agreement_confirmed');
      }
    } else throw new HttpError(400, 'Choose propose or confirm for negotiated terms.');
    res.json({ swap: { id: String(swap._id), ...swapPrivateState(swap, req.user._id) }, revisionCreated });
  } catch (e) { sendError(res, e); }
});
app.patch('/api/swaps/:id/shipment', requireUser, requireCsrf, async (req, res) => {
  try {
    const swap = await getSwapForUser(req.params.id, req.user._id);
    const currentAgreement = swap.agreements[swap.agreements.length - 1];
    const agreedIds = new Set((currentAgreement?.confirmedBy || []).map((entry) => String(entry.member)));
    if (swap.status !== 'accepted' || !currentAgreement || ![swap.requester, swap.recipient].every((id) => agreedIds.has(String(id)))) throw new HttpError(409, 'Private shipment notes are available only after both participants confirm the negotiated terms.');
    const status = enumValue(req.body.status, ['not_started', 'dispatched', 'in_transit', 'delivered', 'issue', 'not_applicable'], 'shipment status');
    const preference = req.body.preference === undefined ? swap.handoffPreference : enumValue(req.body.preference, ['local', 'remote', 'flexible'], 'exchange preference');
    const readOptional = (value, max, field) => value === undefined || value === '' ? '' : safeText(value, max, field);
    const serviceLabel = readOptional(req.body.serviceLabel, 80, 'Carrier or service label');
    const trackingReference = readOptional(req.body.trackingReference, 120, 'Tracking reference');
    const previousStatus = swap.shipment.status || 'not_started';
    const now = new Date();
    if (status !== previousStatus) swap.shipment.history.push({ from: previousStatus, to: status, actor: req.user._id, at: now });
    swap.shipment.status = status;
    swap.shipment.serviceLabel = serviceLabel;
    swap.shipment.trackingReference = trackingReference;
    swap.shipment.updatedBy = req.user._id;
    swap.shipment.updatedAt = now;
    swap.handoffPreference = preference;
    swap.updatedAt = now;
    await swap.save();
    await recordActivity(req.user._id, 'shipment_updated');
    res.json({ swap: { id: String(swap._id), handoffPreference: swap.handoffPreference, ...swapPrivateState(swap, req.user._id) } });
  } catch (e) { sendError(res, e); }
});
app.get('/api/swaps/:id/messages', requireUser, async (req, res) => {
  try {
    const swap = await getSwapForUser(req.params.id, req.user._id);
    const messages = await Message.find({ swap: swap._id }).sort({ createdAt: 1 }).limit(300).populate('sender', 'name');
    res.json({ messages: messages.map((m) => ({ id: String(m._id), body: m.body, sender: userView(m.sender), createdAt: m.createdAt })) });
  } catch (e) { sendError(res, e); }
});
app.post('/api/swaps/:id/messages', requireUser, requireCsrf, async (req, res) => {
  try {
    const swap = await getSwapForUser(req.params.id, req.user._id);
    if (completedStatuses.includes(swap.status)) throw new HttpError(409, 'This swap thread is closed.');
    const body = safeText(req.body.body, 1200, 'Message');
    const message = await Message.create({ swap: swap._id, sender: req.user._id, body });
    swap.updatedAt = new Date(); await swap.save();
    await recordActivity(req.user._id, 'message_sent');
    res.status(201).json({ message: { id: String(message._id), body: message.body, createdAt: message.createdAt } });
  } catch (e) { sendError(res, e); }
});

app.get('/api/profile', requireUser, async (req, res) => res.json({ profile: userView(req.user) }));
app.patch('/api/profile', requireUser, requireCsrf, async (req, res) => {
  try {
    req.user.name = safeText(req.body.name, 48, 'Name');
    req.user.city = safeText(req.body.city, 60, 'City');
    req.user.bio = optionalText(req.body.bio, 300);
    await req.user.save();
    await recordActivity(req.user._id, 'profile_updated');
    res.json({ user: userView(req.user) });
  } catch (e) { sendError(res, e); }
});
app.get('/api/dashboard', requireUser, async (req, res) => {
  try {
    const [listings, swaps] = await Promise.all([
      Listing.find({ owner: req.user._id }).select('-images').sort({ createdAt: -1 }).populate('owner', 'name city isDemo demoLabel'),
      Swap.find({ $or: [{ requester: req.user._id }, { recipient: req.user._id }] }).sort({ updatedAt: -1 }).limit(100)
        .populate('requester', 'name city').populate('recipient', 'name city').populate('offeredListing', 'title category size estimatedValue imageCount demoImageNo isDemo status').populate('requestedListing', 'title category size estimatedValue imageCount demoImageNo isDemo status')
    ]);
    res.json({ listings: listings.map((i) => listingView(i)), swaps: swaps.map((s) => ({ id: String(s._id), status: s.status, note: s.note, handoffPreference: s.handoffPreference, createdAt: s.createdAt, updatedAt: s.updatedAt, requester: userView(s.requester), recipient: userView(s.recipient), offeredListing: s.offeredListing && listingView(s.offeredListing, s.requester), requestedListing: s.requestedListing && listingView(s.requestedListing, s.recipient), confirmed: s.confirmedBy.some((id) => String(id) === String(req.user._id)), ...swapPrivateState(s, req.user._id) })) });
  } catch (e) { sendError(res, e); }
});

app.get('/api/admin/overview', requireUser, requireAdmin, async (_req, res) => {
  try {
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [members, liveListings, requests, accepted, completed, disputed, recentUsers, recentListings, recentSwaps, eligibleMemberIds, requestsCreated30d, requestsAccepted30d] = await Promise.all([
      User.countDocuments({ isDemo: false }), Listing.countDocuments({ isDemo: false, status: 'available' }), Swap.countDocuments({}),
      Swap.countDocuments({ status: 'accepted' }), Swap.countDocuments({ status: 'completed' }), Swap.countDocuments({ status: 'disputed' }),
      User.find({ isDemo: false }).select('name email city role suspended createdAt').sort({ createdAt: -1 }).limit(30),
      Listing.find({ isDemo: false }).select('-images').sort({ createdAt: -1 }).limit(30).populate('owner', 'name city isDemo demoLabel'),
      Swap.find({}).sort({ updatedAt: -1 }).limit(30).populate('requester', 'name city').populate('recipient', 'name city').populate('offeredListing', 'title category size estimatedValue imageCount isDemo status').populate('requestedListing', 'title category size estimatedValue imageCount isDemo status'),
      User.find({ isDemo: false, suspended: false, createdAt: { $lte: windowEnd } }).distinct('_id'),
      Swap.countDocuments({ createdAt: { $gte: windowStart, $lte: windowEnd } }),
      Swap.countDocuments({ createdAt: { $gte: windowStart, $lte: windowEnd }, 'statusHistory.to': 'accepted' })
    ]);
    const activityRows = eligibleMemberIds.length ? await ActivityEvent.aggregate([
      { $match: { member: { $in: eligibleMemberIds }, createdAt: { $gte: windowStart, $lte: windowEnd } } },
      { $group: { _id: '$member', actionCount: { $sum: 1 } } }
    ]) : [];
    const activeUsers30d = activityRows.length;
    const engagedMembers30d = activityRows.filter((row) => row.actionCount >= 2).length;
    const engagementRatePercent = eligibleMemberIds.length ? Math.round((engagedMembers30d / eligibleMemberIds.length) * 10000) / 100 : null;
    const swapAcceptanceRatePercent = requestsCreated30d ? Math.round((requestsAccepted30d / requestsCreated30d) * 10000) / 100 : null;
    const adminSwapView = (s) => ({ id: String(s._id), status: s.status, note: s.note, handoffPreference: s.handoffPreference, adminNote: s.adminNote, createdAt: s.createdAt, requester: userView(s.requester), recipient: userView(s.recipient), offeredListing: s.offeredListing && listingView(s.offeredListing, s.requester), requestedListing: s.requestedListing && listingView(s.requestedListing, s.recipient), statusHistory: (s.statusHistory || []).map((entry) => ({ from: entry.from, to: entry.to, actorId: String(entry.actor), at: entry.at })) });
    res.json({ kpis: {
      registeredMembers: members, availableMemberListings: liveListings, swapRequests: requests, acceptedSwaps: accepted, memberConfirmedCompletions: completed, disputesOpen: disputed,
      activity30d: { startsAt: windowStart, endsAt: windowEnd, eligibleMemberCount: eligibleMemberIds.length, activeUsers: activeUsers30d, engagedMemberCount: engagedMembers30d, engagementRatePercent, requestsCreated: requestsCreated30d, requestsAccepted: requestsAccepted30d, requestAcceptanceRatePercent: swapAcceptanceRatePercent }
    }, users: recentUsers.map((u) => ({ ...userView(u), suspended: u.suspended })), listings: recentListings.map((i) => listingView(i)), swaps: recentSwaps.map(adminSwapView), note: 'Counts use member and swap records; seed/demo accounts and listings are excluded. Activity analytics are first-party server events over the rolling 30 days; no third-party tracker or PII fields are stored. Completion is counted only after both members confirm.' });
  } catch (e) { sendError(res, e); }
});
app.patch('/api/admin/users/:id', requireUser, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const user = await User.findById(parseId(req.params.id, 'Member'));
    if (!user || user.isDemo || String(user._id) === String(req.user._id)) throw new HttpError(404, 'Member not found.');
    if (typeof req.body.suspended !== 'boolean') throw new HttpError(400, 'Choose whether to suspend this account.');
    user.suspended = req.body.suspended; await user.save();
    res.json({ user: { id: String(user._id), suspended: user.suspended } });
  } catch (e) { sendError(res, e); }
});
app.patch('/api/admin/listings/:id', requireUser, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const item = await Listing.findById(parseId(req.params.id, 'Item'));
    if (!item || item.isDemo) throw new HttpError(404, 'Item not found.');
    if (req.body.hidden === true) item.status = 'hidden';
    else if (req.body.hidden === false && item.status === 'hidden') item.status = 'available';
    else throw new HttpError(400, 'Choose whether to hide or restore this listing.');
    await item.save(); res.json({ itemId: String(item._id), status: item.status });
  } catch (e) { sendError(res, e); }
});
app.patch('/api/admin/swaps/:id/resolve', requireUser, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const swap = await Swap.findById(parseId(req.params.id, 'Swap'));
    if (!swap || swap.status !== 'disputed') throw new HttpError(409, 'Only an open dispute can be resolved here.');
    const reason = safeText(req.body.reason, 600, 'Resolution note');
    if (req.body.outcome !== 'close') throw new HttpError(400, 'A moderator can close a disputed request, not claim that an exchange occurred.');
    transitionSwap(swap, 'withdrawn', req.user._id); swap.adminNote = reason;
    await swap.save();
    await Listing.updateMany({ _id: { $in: [swap.offeredListing, swap.requestedListing] }, status: 'reserved' }, { $set: { status: 'available', updatedAt: new Date() } });
    res.json({ swapId: String(swap._id), status: swap.status });
  } catch (e) { sendError(res, e); }
});

app.get('/api/health', (_req, res) => res.json({ ok: mongoose.connection.readyState === 1, database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable' }));
if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, '../public'), { index: false, maxAge: isProduction ? '1h' : 0, etag: true }));
}
app.get('*', (req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
app.use((err, _req, res, _next) => {
  const safe = err.status ? err : (err instanceof multer.MulterError ? new HttpError(400, 'Check the selected photo type, size, and count.') : err);
  sendError(res, safe);
});

module.exports = { app, HttpError };
