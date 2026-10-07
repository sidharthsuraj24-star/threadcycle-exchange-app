const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const supertest = require('supertest');
const sharp = require('sharp');

let mongo;
let app;
let agentA;
let agentB;
let csrfA;
let csrfB;
let userA;
let userB;
let userOtherCity;
let userNia;
let listingA;
let listingB;
let listingOtherCity;
let communityPostId;
let communityReportId;
let mainSwapId;
let demoTrackingNumber;
let demoShipmentId;
let otherCityAgent;
let outsider;
let testClientIp = 20;
let uploadPhoto;
async function csrf(agent) { return (await agent.get('/api/me').expect(200)).body.csrfToken; }
async function createMember(agent, name, email, city) {
  const token = await csrf(agent);
  const response = await agent.post('/api/register').set('x-csrf-token', token).set('x-forwarded-for', `198.51.100.${testClientIp++}`).send({ name, email, city, password: 'A-safe-test-password-2026!' }).expect(201);
  return { user: response.body.user, csrf: response.body.csrfToken };
}
async function addListing(agent, token, overrides = {}, photo = uploadPhoto) {
  const payload = {
    title: 'Soft cotton overshirt', category: 'Outerwear', size: 'M', brand: 'Field Notes', brandTier: 'Everyday', condition: 'Excellent',
    description: 'A well-cared-for cotton layer with one inside pocket.',
    ...overrides
  };
  const req = agent.post('/api/listings').set('x-csrf-token', token);
  for (const [key, value] of Object.entries(payload)) req.field(key, value);
  req.attach('images', photo, { filename: 'garment.jpg', contentType: 'image/jpeg' });
  return (await req.expect(201)).body.item;
}

test('end-to-end marketplace flows use the MongoDB data models and persisted sessions', async (t) => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  uploadPhoto = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#c84' } }).jpeg({ quality: 85 }).toBuffer();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongo.getUri('clothing_swap_test');
  process.env.SESSION_SECRET = 'test-session-secret-long-enough-to-meet-minimum-32-bytes';
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const { User, Listing, Swap, ActivityEvent, RateLimitCounter, CommunityPost, CommunityReport, DemoShipment } = require('../server/models');
  await Promise.all([User.createIndexes(), Listing.createIndexes(), Swap.createIndexes(), DemoShipment.createIndexes()]);
  app = require('../server/app').app;
  app.set('trust proxy', 1);
  const { seedDemoListings } = require('../server/seed');
  await seedDemoListings();
  agentA = supertest.agent(app);
  agentB = supertest.agent(app);

  await t.test('server boots with explicitly labelled sample items, not demo accounts', async () => {
    assert.equal(require('../index'), app, 'the root entrypoint exports the Express app for Vercel');
    const vercelConfig = JSON.parse(fs.readFileSync(require.resolve('../vercel.json'), 'utf8'));
    assert.deepEqual(vercelConfig.headers.map((rule) => rule.source), ['/', '/index.html']);
    assert.ok(vercelConfig.headers.every((rule) => rule.headers.some((header) => header.key === 'Content-Security-Policy')));
    const html = await agentA.get('/').expect(200);
    assert.match(html.text, /Second Loop/);
    assert.match(html.headers['content-security-policy'], /default-src 'self'/);
    for (const route of ['/login', '/register', '/dashboard?tab=profile', '/matches', '/community', '/profile', '/admin', '/messages/example', '/swap/new', '/listings/example']) {
      const page = await agentA.get(route).expect(200);
      assert.match(page.text, /id="app"/, `${route} should serve the single-page app on a direct load`);
    }
    await agentA.get('/api/no-such-endpoint').expect(404);
    await agentA.get('/app.js').expect(200).expect('Content-Type', /javascript/);
    const result = await agentA.get('/api/listings');
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.total, 12);
    assert.ok(result.body.items.every((x) => x.isDemo === true && x.demoLabel.includes('Illustrative demo')));
    assert.equal((await User.countDocuments({ isDemo: true })), 12);
    assert.equal((await User.countDocuments({ isDemo: true, passwordHash: { $exists: true } })), 0);
  });

  await t.test('registration validates, hashes passwords, rotates session, and limits the public profile', async () => {
    const token = await csrf(agentA);
    await agentA.post('/api/register').set('x-csrf-token', token).send({ name: 'Ada Member', email: 'ada@example.test', city: 'Pune', password: 'tiny' }).expect(400);
    const created = await createMember(agentA, 'Ada Member', 'ada@example.test', '  Pune   ');
    csrfA = created.csrf; userA = created.user;
    assert.equal(userA.role, 'member');
    assert.equal(userA.city, 'Pune', 'registration trims and collapses city whitespace');
    assert.equal('passwordHash' in userA, false);
    const stored = await User.findById(userA.id).select('+passwordHash').lean();
    assert.notEqual(stored.passwordHash, 'A-safe-test-password-2026!');
    assert.ok(await require('bcryptjs').compare('A-safe-test-password-2026!', stored.passwordHash));
    const me = await agentA.get('/api/me').expect(200);
    assert.equal(me.body.user.email, 'ada@example.test');
    assert.equal(JSON.stringify(me.body).includes('passwordHash'), false);
    const duplicate = await agentA.post('/api/register').set('x-csrf-token', csrfA).send({ name: 'Ada', email: 'ada@example.test', city: 'Pune', password: 'A-safe-test-password-2026!' }).expect(409);
    assert.match(duplicate.body.error, /already exists/);
    const signedBackIn = supertest.agent(app);
    const loginToken = await csrf(signedBackIn);
    await signedBackIn.post('/api/login').set('x-csrf-token', loginToken).send({ email: 'ada@example.test', password: 'A-safe-test-password-2026!' }).expect(200);
    assert.equal((await signedBackIn.get('/api/me').expect(200)).body.user.id, userA.id);
    const badLogin = supertest.agent(app);
    const badLoginToken = await csrf(badLogin);
    await badLogin.post('/api/login').set('x-csrf-token', badLoginToken).send({ email: 'ada@example.test', password: 'wrong-password' }).expect(401);
  });

  await t.test('same-site state changes reject requests without the session CSRF token', async () => {
    await agentA.patch('/api/profile').send({ name: 'Changed Name', city: 'Pune' }).expect(403);
    await supertest(app).post('/api/login').send({ email: 'ada@example.test', password: 'A-safe-test-password-2026!' }).expect(403);
    await agentA.patch('/api/profile').set('Origin', 'https://attacker.invalid').set('x-csrf-token', csrfA).send({ name: 'Forged origin', city: 'Pune' }).expect(403);
    await agentA.patch('/api/profile').set('x-csrf-token', csrfA).send({ name: '<img src=x onerror=alert(1)>', city: '  PuNe   ', bio: '<script>text</script>' }).expect(200);
    const profile = (await agentA.get('/api/profile').expect(200)).body.profile;
    assert.match(profile.name, /<img/);
    assert.equal(profile.city, 'PuNe', 'normalization preserves the member’s city-name casing for display');
  });

  await t.test('listing creation validates photos, strips EXIF metadata, and preserves server-side value rules', async () => {
    const locationJpg = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#c84' } })
      .withExif({ IFD0: { ImageDescription: 'GPS: 18.5204, 73.8567' } })
      .jpeg().toBuffer();
    const sourceMetadata = await sharp(locationJpg).metadata();
    assert.ok(sourceMetadata.exif?.includes(Buffer.from('GPS: 18.5204, 73.8567')), 'fixture starts with location-like EXIF metadata');
    listingA = await addListing(agentA, csrfA, { estimatedValue: '49999', comparableRetailPrice: '4200' }, locationJpg);
    assert.equal(listingA.imageCount, 1);
    assert.equal(listingA.estimatedValue, 1300, 'comparable retail price does not replace or affect the server estimate');
    assert.equal(listingA.comparableRetailPrice, 4200);
    const photo = await agentA.get(listingA.imageUrls[0]).expect(200);
    assert.equal(photo.headers['content-type'], 'image/webp');
    const doc = await Listing.findById(listingA.id).select('+images');
    assert.equal(doc.images[0].mime, 'image/webp');
    assert.notEqual(doc.images[0].data.toString('base64'), locationJpg.toString('base64'));
    const storedMetadata = await sharp(doc.images[0].data).metadata();
    assert.equal(storedMetadata.format, 'webp');
    assert.equal(storedMetadata.exif, undefined, 're-encoded upload must not retain EXIF location data');
    const edited = agentA.patch(`/api/listings/${listingA.id}`).set('x-csrf-token', csrfA)
      .field('title', 'Updated cotton overshirt').field('category', 'Outerwear').field('size', 'M').field('brand', 'Field Notes')
      .field('brandTier', 'Premium').field('condition', 'Excellent').field('description', 'Updated listing text.')
      .field('comparableRetailPrice', '5100')
      .attach('images', uploadPhoto, { filename: 'updated.jpg', contentType: 'image/jpeg' });
    listingA = (await edited.expect(200)).body.item;
    assert.equal(listingA.title, 'Updated cotton overshirt');
    assert.equal(listingA.estimatedValue, 1600);
    assert.equal(listingA.comparableRetailPrice, 5100);
    assert.equal((await Listing.findById(listingA.id)).comparableRetailPrice, 5100);
    const removable = await addListing(agentA, csrfA, { title: 'Temporary item to remove' });
    await agentA.delete(`/api/listings/${removable.id}`).set('x-csrf-token', csrfA).send({}).expect(200);
    await agentA.get(`/api/listings/${removable.id}`).expect(404);
    await agentA.get(`/api/listings/${removable.id}/images/0`).expect(404);
    const bad = agentA.post('/api/listings').set('x-csrf-token', csrfA)
      .field('title', 'Bad photo').field('category', 'Tops').field('size', 'M').field('brand', 'X').field('brandTier', 'Everyday').field('condition', 'Good').field('description', 'No SVG uploads')
      .attach('images', Buffer.from('<svg onload="alert(1)"></svg>'), { filename: 'bad.svg', contentType: 'image/svg+xml' });
    await bad.expect(400);
    const badPrice = agentA.post('/api/listings').set('x-csrf-token', csrfA)
      .field('title', 'Invalid comparable price').field('category', 'Tops').field('size', 'M').field('brand', 'X').field('brandTier', 'Everyday').field('condition', 'Good').field('description', 'Reject an out-of-range reference').field('comparableRetailPrice', '10000001')
      .attach('images', uploadPhoto, { filename: 'bad-price.jpg', contentType: 'image/jpeg' });
    const rejectedPrice = await badPrice.expect(400);
    assert.match(rejectedPrice.body.error, /Comparable retail price/);
    const tooLargeBytes = Buffer.alloc(1_000_001);
    Buffer.from([0xff, 0xd8, 0xff]).copy(tooLargeBytes);
    const tooLarge = agentA.post('/api/listings').set('x-csrf-token', csrfA)
      .field('title', 'Oversized photo').field('category', 'Tops').field('size', 'M').field('brand', 'X').field('brandTier', 'Everyday').field('condition', 'Good').field('description', 'Check upload limit')
      .attach('images', tooLargeBytes, { filename: 'oversized.jpg', contentType: 'image/jpeg' });
    const tooLargeResponse = await tooLarge.expect(400);
    assert.match(tooLargeResponse.body.error, /1 MB or smaller/);
  });

  await t.test('analytics report an unavailable request-conversion rate when there are no requests', async () => {
    await User.updateOne({ _id: userA.id }, { $set: { role: 'admin' } });
    const overview = await agentA.get('/api/admin/overview').expect(200);
    assert.equal(overview.body.kpis.activity30d.requestsCreated, 0);
    assert.equal(overview.body.kpis.activity30d.requestsAccepted, 0);
    assert.equal(overview.body.kpis.activity30d.requestAcceptanceRatePercent, null);
    await User.updateOne({ _id: userA.id }, { $set: { role: 'member' } });
  });

  await t.test('a real member can filter by coarse city, but demo samples are not match candidates', async () => {
    const created = await createMember(agentB, 'Sam Member', 'sam@example.test', '  pUnE   '); csrfB = created.csrf; userB = created.user;
    assert.equal(userB.city, 'pUnE');
    listingB = await addListing(agentB, csrfB, { title: 'Indigo cotton jacket', category: 'Outerwear', size: 'L', brandTier: 'Premium', comparableRetailPrice: '9000000' });
    assert.equal(listingB.estimatedValue, 1600);
    assert.equal(listingB.comparableRetailPrice, 9000000);
    otherCityAgent = supertest.agent(app);
    const otherCityCreated = await createMember(otherCityAgent, 'Ravi Member', 'ravi@example.test', 'Mumbai'); userOtherCity = otherCityCreated.user;
    listingOtherCity = await addListing(otherCityAgent, otherCityCreated.csrf, { title: 'Mumbai linen shirt', category: 'Tops', city: 'Mumbai' });
    assert.equal(listingOtherCity.comparableRetailPrice, null, 'the comparison price is optional');
    const matches = await agentA.get('/api/matches').query({ city: '  PUNE   ' }).expect(200);
    const sameCity = matches.body.items.find((entry) => entry.item.id === listingB.id);
    const differentCity = matches.body.items.find((entry) => entry.item.id === listingOtherCity.id);
    assert.equal(sameCity.sameCity, true);
    assert.equal(differentCity.sameCity, false);
    assert.equal(matches.body.items[0].sameCity, true, 'actual same-city offers rank before other-city alternatives');
    assert.match(matches.body.locationMethod, /normalized city-level/i);
    assert.match(matches.body.locationMethod, /case and spacing insensitive/);
    assert.match(matches.body.locationMethod, /not geospatial/);
    const browse = await agentA.get('/api/listings').query({ city: '  PUNE   ' });
    assert.equal(browse.status, 200, JSON.stringify(browse.body));
    assert.ok(browse.body.items.every((x) => x.city.toLocaleLowerCase() === 'pune'));
    const sample = (await agentA.get('/api/listings').expect(200)).body.items.find((item) => item.isDemo);
    await agentA.post('/api/swaps').set('x-csrf-token', csrfA).send({ requestedListingId: sample.id, offeredListingId: listingA.id }).expect(409);
  });

  await t.test('sustainability community posts are public to browse and require membership to interact', async () => {
    await supertest(app).post('/api/community/posts').send({ title: 'Guest post', body: 'Not allowed', category: 'Clothing Care' }).expect(401);
    await agentB.get('/api/admin/community/reports').expect(403);
    const created = await agentA.post('/api/community/posts').set('x-csrf-token', csrfA)
      .send({ title: 'Cold-water cotton care', body: 'A useful member tip. <script>text only</script>', category: 'Clothing Care' }).expect(201);
    communityPostId = created.body.post.id;
    assert.equal(created.body.post.author.id, userA.id);
    const noSelfReport = await agentA.post(`/api/community/posts/${communityPostId}/reports`).set('x-csrf-token', csrfA).send({ reason: 'Self-report.' }).expect(403);
    assert.match(noSelfReport.body.error, /own post/);

    await agentB.post(`/api/community/posts/${communityPostId}/comments`).set('x-csrf-token', csrfB).send({ body: 'Thanks for the practical tip.' }).expect(201);
    const firstLike = await agentB.post(`/api/community/posts/${communityPostId}/like`).set('x-csrf-token', csrfB).send({}).expect(200);
    assert.deepEqual(firstLike.body, { liked: true, likeCount: 1 });
    const unliked = await agentB.post(`/api/community/posts/${communityPostId}/like`).set('x-csrf-token', csrfB).send({}).expect(200);
    assert.deepEqual(unliked.body, { liked: false, likeCount: 0 });
    await agentB.post(`/api/community/posts/${communityPostId}/like`).set('x-csrf-token', csrfB).send({}).expect(200);
    const report = await agentB.post(`/api/community/posts/${communityPostId}/reports`).set('x-csrf-token', csrfB)
      .send({ reason: 'Test report for moderation controls.' }).expect(201);
    communityReportId = report.body.report.id;
    await agentB.post(`/api/community/posts/${communityPostId}/reports`).set('x-csrf-token', csrfB)
      .send({ reason: 'Duplicate open report.' }).expect(409);

    const publicFeed = await supertest(app).get('/api/community/posts').query({ category: 'Clothing Care' }).expect(200);
    assert.equal(publicFeed.body.total, 1);
    assert.equal(publicFeed.body.posts[0].commentCount, 1);
    assert.equal(publicFeed.body.posts[0].comments[0].body, 'Thanks for the practical tip.');
    assert.equal('email' in publicFeed.body.posts[0].author, false);
    assert.equal(publicFeed.body.posts[0].likedByMe, false, 'anonymous browsing does not inherit a member like state');
    const memberFeed = await agentB.get('/api/community/posts').query({ category: 'Clothing Care' }).expect(200);
    assert.equal(memberFeed.body.posts[0].likedByMe, true);
    assert.equal((await agentA.get('/api/community/posts').query({ category: 'Fashion Tips' }).expect(200)).body.total, 0);
    const ownPost = await agentB.post('/api/community/posts').set('x-csrf-token', csrfB)
      .send({ title: 'My upcycling notes', body: 'A member-owned post.', category: 'Repair & Upcycling' }).expect(201);
    await agentA.delete(`/api/community/posts/${ownPost.body.post.id}`).set('x-csrf-token', csrfA).send({}).expect(404);
    await agentB.delete(`/api/community/posts/${ownPost.body.post.id}`).set('x-csrf-token', csrfB).send({}).expect(200);
    assert.equal((await CommunityPost.findById(ownPost.body.post.id)).status, 'deleted');
    await supertest(app).get(`/api/community/posts/${ownPost.body.post.id}`).expect(404);
  });

  await t.test('a request starts a private thread; only its two participants can read and write', async () => {
    outsider = supertest.agent(app);
    const nia = await createMember(outsider, 'Nia Member', 'nia@example.test', 'Delhi'); userNia = nia.user;
    await agentB.get('/api/admin/overview').expect(403);
    await agentA.post('/api/swaps').set('x-csrf-token', csrfA).send({ requestedListingId: listingB.id, offeredListingId: listingA.id, handoffPreference: 'courier-booked' }).expect(400);
    const token = csrfA;
    const response = await agentA.post('/api/swaps').set('x-csrf-token', token).send({ requestedListingId: listingB.id, offeredListingId: listingA.id, note: 'Would love to compare shoulder measurements.', handoffPreference: 'remote' }).expect(201);
    const swapId = response.body.swap.id;
    mainSwapId = swapId;
    const courierInput = { pickupLocality: 'Aundh', deliveryLocality: 'Kalyani Nagar', packageCategory: 'clothing_standard', weightKg: '1' };
    await supertest(app).get(`/api/swaps/${swapId}/courier/shipment`).expect(401);
    await supertest(app).get(`/api/swaps/${swapId}/courier/tracking`).expect(401);
    await supertest(app).post(`/api/swaps/${swapId}/courier/rates`).send(courierInput).expect(401);
    await outsider.get(`/api/swaps/${swapId}/courier/shipment`).expect(404);
    const initial = await Swap.findById(swapId).lean();
    assert.equal(initial.handoffPreference, 'remote');
    assert.deepEqual(initial.statusHistory[0].from, 'none');
    assert.equal(initial.statusHistory[0].to, 'requested');
    assert.equal(String(initial.statusHistory[0].actor), userA.id);
    assert.ok(initial.statusHistory[0].at instanceof Date);
    assert.deepEqual(Object.keys(initial.statusHistory[0]).sort(), ['actor', 'at', 'from', 'to']);
    assert.equal((await agentA.get('/api/swaps').expect(200)).body.swaps.find((s) => s.id === swapId).handoffPreference, 'remote');
    const msgs = await agentA.get(`/api/swaps/${swapId}/messages`).expect(200);
    assert.equal(msgs.body.messages.length, 1);
    await agentA.post(`/api/swaps/${swapId}/messages`).set('x-csrf-token', csrfA).send({ body: 'Could you measure the sleeve?' }).expect(201);
    await agentB.post(`/api/swaps/${swapId}/messages`).set('x-csrf-token', csrfB).send({ body: 'I can; the sleeve is 61 cm.' }).expect(201);
    assert.equal((await agentB.get(`/api/swaps/${swapId}/messages`).expect(200)).body.messages.length, 3);
    await outsider.get(`/api/swaps/${swapId}/messages`).expect(404);
    const outsiderCsrf = await csrf(outsider);
    await outsider.post(`/api/swaps/${swapId}/courier/rates`).set('x-csrf-token', outsiderCsrf).send(courierInput).expect(404);
    await outsider.get(`/api/swaps/${swapId}/courier/tracking`).expect(404);
    await outsider.patch(`/api/swaps/${swapId}/agreement`).set('x-csrf-token', outsiderCsrf).send({ action: 'propose', terms: 'Outsider cannot see these terms.' }).expect(404);
    await outsider.patch(`/api/swaps/${swapId}/shipment`).set('x-csrf-token', outsiderCsrf).send({ status: 'in_transit' }).expect(404);
    await agentA.patch(`/api/swaps/${swapId}/agreement`).set('x-csrf-token', csrfA).send({ action: 'propose', terms: 'Agreed item pair and mutually selected hand-off plan.' }).expect(409);
    await agentA.patch(`/api/swaps/${swapId}/status`).set('x-csrf-token', csrfA).send({ action: 'accept' }).expect(409);
    await agentB.patch(`/api/swaps/${swapId}/status`).set('x-csrf-token', csrfB).send({ action: 'accept' }).expect(200);
    assert.equal((await Listing.findById(listingA.id)).status, 'reserved');
    assert.equal((await Listing.findById(listingB.id)).status, 'reserved');
    await agentA.post(`/api/swaps/${swapId}/courier/rates`).set('x-csrf-token', csrfA).send(courierInput).expect(409);
    assert.equal(await DemoShipment.countDocuments({ swap: swapId }), 0, 'acceptance alone does not permit a demo shipment');
    await agentA.patch(`/api/swaps/${swapId}/status`).set('x-csrf-token', csrfA).send({ action: 'confirm' }).expect(409);
    await agentA.patch(`/api/swaps/${swapId}/shipment`).set('x-csrf-token', csrfA).send({ serviceLabel: 'Manual label', trackingReference: 'ref-private-1', status: 'in_transit', preference: 'remote' }).expect(409);
    await agentA.patch(`/api/swaps/${swapId}/agreement`).set('x-csrf-token', csrfA).send({ action: 'propose', terms: 'Agreed item pair and mutually selected hand-off plan.' }).expect(200);
    const proposal = (await agentA.get('/api/swaps').expect(200)).body.swaps.find((s) => s.id === swapId);
    assert.equal(proposal.agreements.length, 1);
    assert.equal(proposal.agreements[0].revision, 1);
    assert.equal(proposal.agreements[0].proposedBy, userA.id);
    assert.ok(Number.isFinite(new Date(proposal.agreements[0].proposedAt).getTime()));
    assert.equal('email' in proposal.agreements[0], false);
    const duplicateTerms = await agentB.patch(`/api/swaps/${swapId}/agreement`).set('x-csrf-token', csrfB).send({ action: 'propose', terms: 'Agreed item pair and mutually selected hand-off plan.' }).expect(200);
    assert.equal(duplicateTerms.body.revisionCreated, false);
    assert.equal(duplicateTerms.body.swap.agreements.length, 1);
    await agentB.patch(`/api/swaps/${swapId}/agreement`).set('x-csrf-token', csrfB).send({ action: 'confirm' }).expect(200);
    const oneTermConfirmation = (await agentA.get('/api/swaps').expect(200)).body.swaps.find((s) => s.id === swapId).agreements[0].confirmedBy;
    assert.equal(oneTermConfirmation.length, 1);
    assert.equal(oneTermConfirmation[0].memberId, userB.id);
    assert.ok(Number.isFinite(new Date(oneTermConfirmation[0].at).getTime()));
    await agentA.patch(`/api/swaps/${swapId}/status`).set('x-csrf-token', csrfA).send({ action: 'confirm' }).expect(409);
    await agentA.patch(`/api/swaps/${swapId}/agreement`).set('x-csrf-token', csrfA).send({ action: 'confirm' }).expect(200);
    let agreed = (await agentA.get('/api/swaps').expect(200)).body.swaps.find((s) => s.id === swapId);
    assert.equal(agreed.agreementConfirmed, true, JSON.stringify({ requester: agreed.requester.id, recipient: agreed.recipient.id, agreements: agreed.agreements }));
    assert.equal(agreed.myAgreementConfirmed, true);
    assert.deepEqual(agreed.agreements[0].confirmedBy.map((entry) => entry.memberId).sort(), [userA.id, userB.id].sort());
    await agentA.patch(`/api/swaps/${swapId}/agreement`).set('x-csrf-token', csrfA).send({ action: 'propose', terms: 'Revised: agreed item pair, fit disclosures, and mutual hand-off plan.' }).expect(200);
    agreed = (await agentA.get('/api/swaps').expect(200)).body.swaps.find((s) => s.id === swapId);
    assert.equal(agreed.agreements.length, 2);
    assert.equal(agreed.agreementConfirmed, false, 'changing terms invalidates both confirmations');
    assert.equal(agreed.agreements[1].confirmedBy.length, 0);
    await agentA.patch(`/api/swaps/${swapId}/status`).set('x-csrf-token', csrfA).send({ action: 'confirm' }).expect(409);
    await agentA.patch(`/api/swaps/${swapId}/agreement`).set('x-csrf-token', csrfA).send({ action: 'confirm' }).expect(200);
    await agentB.patch(`/api/swaps/${swapId}/agreement`).set('x-csrf-token', csrfB).send({ action: 'confirm' }).expect(200);
    const shipment = await agentA.patch(`/api/swaps/${swapId}/shipment`).set('x-csrf-token', csrfA).send({ serviceLabel: 'Manually entered example carrier', trackingReference: 'private-ref-123', status: 'in_transit', preference: 'remote' }).expect(200);
    assert.equal(shipment.body.swap.shipment.status, 'in_transit');
    assert.equal(shipment.body.swap.shipment.history.length, 1);
    assert.equal(shipment.body.swap.shipment.history[0].actorId, userA.id);
    assert.ok(Number.isFinite(new Date(shipment.body.swap.shipment.history[0].at).getTime()));
    const participantView = (await agentB.get('/api/swaps').expect(200)).body.swaps.find((s) => s.id === swapId);
    assert.equal(participantView.shipment.trackingReference, 'private-ref-123');
    const publicListings = await agentA.get('/api/listings').expect(200);
    assert.doesNotMatch(JSON.stringify(publicListings.body), /private-ref-123/);
    assert.equal(await DemoShipment.countDocuments({ swap: swapId }), 0, 'saving manual hand-off notes must not create a courier shipment');
    await agentA.post(`/api/swaps/${swapId}/courier/rates`).set('x-csrf-token', csrfA).send({ ...courierInput, pickupLocality: '10 Park Street' }).expect(400);
    await agentA.post(`/api/swaps/${swapId}/courier/rates`).set('x-csrf-token', csrfA).send({ ...courierInput, weightKg: '8' }).expect(400);
    const ratesResponse = await agentA.post(`/api/swaps/${swapId}/courier/rates`).set('x-csrf-token', csrfA).send(courierInput).expect(200);
    assert.equal(ratesResponse.body.simulated, true);
    assert.match(ratesResponse.body.label, /NO REAL SHIPMENT/);
    assert.deepEqual(ratesResponse.body.rates.map((rate) => rate.id).sort(), ['demo-economy', 'demo-express', 'demo-priority']);
    assert.ok(ratesResponse.body.rates.every((rate) => rate.mode === 'demo' && rate.simulated === true && rate.currency === 'INR'));
    const ratesAgain = await agentA.post(`/api/swaps/${swapId}/courier/rates`).set('x-csrf-token', csrfA).send(courierInput).expect(200);
    assert.deepEqual(ratesAgain.body.rates, ratesResponse.body.rates, 'mock rates are deterministic for the same inputs');
    assert.equal(await DemoShipment.countDocuments({ swap: swapId }), 0, 'getting rates does not create a shipment');
    await agentA.post(`/api/swaps/${swapId}/courier/shipments`).set('x-csrf-token', csrfA)
      .send({ ...courierInput, rateId: 'demo-express', mode: 'live' }).expect(400);
    assert.equal(await DemoShipment.countDocuments({ swap: swapId }), 0, 'a live-mode request is rejected before persistence');
    const demoCreated = await agentA.post(`/api/swaps/${swapId}/courier/shipments`).set('x-csrf-token', csrfA)
      .send({ ...courierInput, rateId: 'demo-express', mode: 'demo' }).expect(201);
    const demoShipment = demoCreated.body.shipment;
    demoTrackingNumber = demoShipment.trackingNumber;
    demoShipmentId = demoShipment.id;
    assert.match(demoTrackingNumber, /^DEMO-SL-[A-F0-9]{16}$/);
    assert.equal(demoShipment.swapId, swapId);
    assert.equal(demoShipment.provider, 'local-mock');
    assert.equal(demoShipment.mode, 'demo');
    assert.equal(demoShipment.status, 'SIMULATED_SHIPPED');
    assert.equal(demoShipment.pickupLocality, 'Aundh');
    assert.equal(demoShipment.deliveryLocality, 'Kalyani Nagar');
    const persistedDemoShipment = await DemoShipment.findById(demoShipmentId).lean();
    assert.equal(String(persistedDemoShipment.swap), swapId);
    assert.equal(String(persistedDemoShipment.createdBy), userA.id);
    const duplicateCreate = await agentB.post(`/api/swaps/${swapId}/courier/shipments`).set('x-csrf-token', csrfB)
      .send({ ...courierInput, rateId: 'demo-economy', mode: 'demo' }).expect(200);
    assert.equal(duplicateCreate.body.alreadyCreated, true);
    assert.equal(duplicateCreate.body.shipment.trackingNumber, demoTrackingNumber, 'retry cannot create a second shipment for the swap');
    const privateDemoShipment = await agentB.get(`/api/swaps/${swapId}/courier/shipment`).expect(200);
    assert.equal(privateDemoShipment.body.shipment.trackingNumber, demoTrackingNumber);
    const demoTracking = await agentB.get(`/api/swaps/${swapId}/courier/tracking`).expect(200);
    assert.equal(demoTracking.body.tracking.simulated, true);
    assert.equal(demoTracking.body.tracking.status, 'Shipped · simulated');
    assert.equal(demoTracking.body.tracking.statusCode, 'SIMULATED_SHIPPED');
    assert.ok(demoTracking.body.tracking.events.some((event) => event.state === 'current'));
    assert.ok(demoTracking.body.tracking.events.some((event) => event.state === 'illustrative'));
    await outsider.get(`/api/swaps/${swapId}/courier/shipment`).expect(404);
    await outsider.get(`/api/swaps/${swapId}/courier/tracking`).expect(404);
    assert.doesNotMatch(JSON.stringify(publicListings.body), /Aundh|Kalyani Nagar|DEMO-SL-/);
    await agentA.patch(`/api/swaps/${swapId}/status`).set('x-csrf-token', csrfA).send({ action: 'confirm' }).expect(200);
    const pending = await Swap.findById(swapId).lean();
    assert.equal(pending.status, 'accepted');
    assert.equal(pending.completionConfirmations.length, 1);
    assert.equal(String(pending.completionConfirmations[0].member), userA.id);
    assert.ok(pending.completionConfirmations[0].at instanceof Date);
    await agentB.patch(`/api/swaps/${swapId}/status`).set('x-csrf-token', csrfB).send({ action: 'confirm' }).expect(200);
    const done = await Swap.findById(swapId).lean();
    assert.equal(done.status, 'completed');
    assert.equal(done.confirmedBy.length, 2);
    assert.equal(done.completionConfirmations.length, 2);
    assert.deepEqual(done.completionConfirmations.map((event) => String(event.member)).sort(), [userA.id, userB.id].sort());
    assert.deepEqual(done.statusHistory.map((event) => `${event.from}:${event.to}`), ['none:requested', 'requested:accepted', 'accepted:completed']);
    assert.equal(String(done.statusHistory[1].actor), userB.id);
    assert.equal(String(done.statusHistory[2].actor), userB.id);
    assert.equal((await Listing.findById(listingA.id)).status, 'swapped');
    assert.equal((await Listing.findById(listingB.id)).status, 'swapped');
    await agentA.get('/api/admin/overview').expect(403);
  });

  await t.test('only an already-registered member promoted from trusted server access gets admin controls', async () => {
    await User.updateOne({ _id: userA.id }, { $set: { role: 'admin' } });
    await ActivityEvent.deleteMany({});
    const recentAt = new Date(Date.now() - 1000);
    const oldAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await ActivityEvent.insertMany([
      { member: userA.id, action: 'listing_created', createdAt: recentAt },
      { member: userA.id, action: 'message_sent', createdAt: recentAt },
      { member: userB.id, action: 'swap_requested', createdAt: recentAt },
      { member: userOtherCity.id, action: 'listing_created', createdAt: recentAt },
      { member: userOtherCity.id, action: 'message_sent', createdAt: recentAt },
      { member: userNia.id, action: 'message_sent', createdAt: oldAt }
    ]);
    const storedEvent = await ActivityEvent.findOne({ member: userA.id }).lean();
    assert.deepEqual(Object.keys(storedEvent).sort(), ['_id', 'action', 'createdAt', 'member']);
    assert.equal('email' in storedEvent, false);
    assert.ok(ActivityEvent.schema.indexes().some(([fields, options]) => fields.createdAt === 1 && options?.expireAfterSeconds === 35 * 24 * 60 * 60));
    await Swap.create({ requester: userA.id, recipient: userB.id, offeredListing: listingA.id, requestedListing: listingB.id, status: 'requested', createdAt: recentAt, updatedAt: recentAt, statusHistory: [{ from: 'none', to: 'requested', actor: userA.id, at: recentAt }] });
    await Swap.create({ requester: userA.id, recipient: userB.id, offeredListing: listingA.id, requestedListing: listingB.id, status: 'accepted', createdAt: oldAt, updatedAt: oldAt, statusHistory: [{ from: 'none', to: 'requested', actor: userA.id, at: oldAt }, { from: 'requested', to: 'accepted', actor: userB.id, at: oldAt }] });
    const overview = await agentA.get('/api/admin/overview');
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    assert.equal(overview.body.kpis.registeredMembers, 4);
    assert.equal(overview.body.kpis.memberConfirmedCompletions, 1);
    assert.equal(overview.body.kpis.disputesOpen, 0);
    assert.match(overview.body.note, /seed\/demo accounts/);
    const activity = overview.body.kpis.activity30d;
    assert.equal(activity.eligibleMemberCount, 4);
    assert.equal(activity.activeUsers, 3);
    assert.equal(activity.engagedMemberCount, 2);
    assert.equal(activity.engagementRatePercent, 50);
    assert.equal(activity.requestsCreated, 2);
    assert.equal(activity.requestsAccepted, 1);
    assert.equal(activity.requestAcceptanceRatePercent, 50);
    assert.ok(Date.now() - new Date(activity.startsAt).getTime() >= 30 * 24 * 60 * 60 * 1000 - 100);
    assert.doesNotMatch(JSON.stringify(overview.body), /private-ref-123/);
    const adminDemoShipment = overview.body.demoShipments.find((shipment) => shipment.id === demoShipmentId);
    assert.ok(adminDemoShipment, 'admin can see the demo shipment record');
    assert.equal(adminDemoShipment.trackingNumber, demoTrackingNumber);
    assert.equal(adminDemoShipment.swapId, mainSwapId);
    assert.equal(adminDemoShipment.provider, 'local-mock');
    assert.equal(adminDemoShipment.mode, 'demo');
    assert.equal(adminDemoShipment.status, 'SIMULATED_SHIPPED');
    assert.equal('pickupLocality' in adminDemoShipment, false);
    assert.doesNotMatch(JSON.stringify(overview.body), /Aundh|Kalyani Nagar/);
    const adminMainSwap = overview.body.swaps.find((s) => s.id === mainSwapId);
    assert.equal('shipment' in adminMainSwap, false, 'admin overview does not receive participant-only shipment references');
    const communityQueue = await agentA.get('/api/admin/community/reports').expect(200);
    assert.equal(communityQueue.body.reports.length, 1);
    assert.equal(communityQueue.body.reports[0].id, communityReportId);
    assert.equal(communityQueue.body.reports[0].post.id, communityPostId);
    await agentA.patch(`/api/admin/community/reports/${communityReportId}`).set('x-csrf-token', csrfA)
      .send({ status: 'resolved', hidePost: true }).expect(200);
    assert.equal((await CommunityPost.findById(communityPostId)).status, 'hidden');
    await supertest(app).get(`/api/community/posts/${communityPostId}`).expect(404);
    const hiddenPosts = await agentA.get('/api/admin/community/posts?status=hidden').expect(200);
    assert.ok(hiddenPosts.body.posts.some((post) => post.id === communityPostId));
    await agentA.patch(`/api/admin/community/posts/${communityPostId}`).set('x-csrf-token', csrfA)
      .send({ hidden: false }).expect(200);
    assert.equal((await CommunityPost.findById(communityPostId)).status, 'published');
    assert.equal((await CommunityReport.findById(communityReportId)).status, 'resolved');
    const moderated = await addListing(agentB, csrfB, { title: 'Member piece for moderation' });
    await agentA.patch(`/api/admin/listings/${moderated.id}`).set('x-csrf-token', csrfA).send({ hidden: true }).expect(200);
    assert.equal((await Listing.findById(moderated.id)).status, 'hidden');
    await agentA.get(`/api/listings/${moderated.id}`).expect(404);
    await agentA.get(moderated.imageUrls[0]).expect(404);
    await agentA.patch(`/api/admin/listings/${moderated.id}`).set('x-csrf-token', csrfA).send({ hidden: false }).expect(200);
    assert.equal((await Listing.findById(moderated.id)).status, 'available');
    await agentA.patch(`/api/admin/users/${userB.id}`).set('x-csrf-token', csrfA).send({ suspended: true }).expect(200);
    await agentB.get('/api/dashboard').expect(401);
    await agentA.patch(`/api/admin/users/${userB.id}`).set('x-csrf-token', csrfA).send({ suspended: false }).expect(200);
    agentB = supertest.agent(app);
    const reauthToken = await csrf(agentB);
    const reauth = await agentB.post('/api/login').set('x-csrf-token', reauthToken).send({ email: 'sam@example.test', password: 'A-safe-test-password-2026!' }).expect(200);
    csrfB = reauth.body.csrfToken;

    const offered = await addListing(agentA, csrfA, { title: 'Second offer for review' });
    const requested = await addListing(agentB, csrfB, { title: 'Second request for review' });
    const toWithdraw = await agentA.post('/api/swaps').set('x-csrf-token', csrfA).send({ offeredListingId: offered.id, requestedListingId: requested.id }).expect(201);
    await agentA.patch(`/api/swaps/${toWithdraw.body.swap.id}/status`).set('x-csrf-token', csrfA).send({ action: 'withdraw' }).expect(200);
    const withdrawnSwap = await Swap.findById(toWithdraw.body.swap.id).lean();
    assert.equal(withdrawnSwap.status, 'withdrawn');
    assert.equal(withdrawnSwap.statusHistory[1].to, 'withdrawn');
    assert.equal(String(withdrawnSwap.statusHistory[1].actor), userA.id);
    assert.ok(withdrawnSwap.statusHistory[1].at instanceof Date);
    const toDecline = await agentA.post('/api/swaps').set('x-csrf-token', csrfA).send({ offeredListingId: offered.id, requestedListingId: requested.id }).expect(201);
    await agentB.patch(`/api/swaps/${toDecline.body.swap.id}/status`).set('x-csrf-token', csrfB).send({ action: 'decline' }).expect(200);
    const declinedSwap = await Swap.findById(toDecline.body.swap.id).lean();
    assert.equal(declinedSwap.status, 'declined');
    assert.equal(declinedSwap.statusHistory[1].to, 'declined');
    assert.equal(String(declinedSwap.statusHistory[1].actor), userB.id);
    const request = await agentA.post('/api/swaps').set('x-csrf-token', csrfA).send({ offeredListingId: offered.id, requestedListingId: requested.id, note: 'Please confirm fit.' }).expect(201);
    const disputeId = request.body.swap.id;
    await agentB.patch(`/api/swaps/${disputeId}/status`).set('x-csrf-token', csrfB).send({ action: 'dispute' }).expect(200);
    const disputedSwap = await Swap.findById(disputeId).lean();
    assert.equal(disputedSwap.statusHistory[1].to, 'disputed');
    assert.equal(String(disputedSwap.statusHistory[1].actor), userB.id);
    assert.equal((await agentA.get('/api/admin/overview').expect(200)).body.kpis.disputesOpen, 1);
    await agentA.patch(`/api/admin/swaps/${disputeId}/resolve`).set('x-csrf-token', csrfA).send({ outcome: 'complete', reason: 'An admin cannot attest that an exchange happened.' }).expect(400);
    const closed = await agentA.patch(`/api/admin/swaps/${disputeId}/resolve`).set('x-csrf-token', csrfA).send({ outcome: 'close', reason: 'Request closed after review.' }).expect(200);
    assert.equal(closed.body.status, 'withdrawn');
    const closedSwap = await Swap.findById(disputeId).lean();
    assert.equal(closedSwap.adminNote, 'Request closed after review.');
    assert.equal(closedSwap.statusHistory[2].from, 'disputed');
    assert.equal(closedSwap.statusHistory[2].to, 'withdrawn');
    assert.equal(String(closedSwap.statusHistory[2].actor), userA.id);

    const competingOffer = await addListing(agentA, csrfA, { title: 'First competing offer' });
    const competingOfferOther = listingOtherCity;
    const sharedRequest = await addListing(agentB, csrfB, { title: 'Shared request target' });
    const firstCompetingRequest = await agentA.post('/api/swaps').set('x-csrf-token', csrfA).send({ offeredListingId: competingOffer.id, requestedListingId: sharedRequest.id }).expect(201);
    const otherCityCsrf = await csrf(otherCityAgent);
    const secondCompetingRequest = await otherCityAgent.post('/api/swaps').set('x-csrf-token', otherCityCsrf).send({ offeredListingId: competingOfferOther.id, requestedListingId: sharedRequest.id }).expect(201);
    const [firstAccept, secondAccept] = await Promise.all([
      agentB.patch(`/api/swaps/${firstCompetingRequest.body.swap.id}/status`).set('x-csrf-token', csrfB).send({ action: 'accept' }),
      agentB.patch(`/api/swaps/${secondCompetingRequest.body.swap.id}/status`).set('x-csrf-token', csrfB).send({ action: 'accept' })
    ]);
    assert.deepEqual([firstAccept.status, secondAccept.status].sort(), [200, 409]);
    const [firstStored, secondStored] = await Promise.all([
      Swap.findById(firstCompetingRequest.body.swap.id).lean(),
      Swap.findById(secondCompetingRequest.body.swap.id).lean()
    ]);
    const winner = firstStored.status === 'accepted' ? firstStored : secondStored;
    const loser = firstStored.status === 'declined' ? firstStored : secondStored;
    assert.equal(winner.status, 'accepted');
    assert.equal(loser.status, 'declined');
    assert.equal(loser.statusHistory[1].to, 'declined');
    assert.equal(String(loser.statusHistory[1].actor), String(winner.recipient));
    assert.equal((await Listing.findById(sharedRequest.id)).status, 'reserved');
    assert.equal((await Listing.findById(winner.offeredListing)).status, 'reserved');
    assert.equal((await Listing.findById(loser.offeredListing)).status, 'available', 'the losing swap must not reserve its unique offered item');
  });

  await t.test('rate-limit counters are shared by MongoDB-backed store instances without storing raw client keys', async () => {
    const { MongoRateLimitStore } = require('../server/rate-limit-store');
    const key = '203.0.113.220';
    const storeA = new MongoRateLimitStore('shared-test', process.env.SESSION_SECRET);
    const storeB = new MongoRateLimitStore('shared-test', process.env.SESSION_SECRET);
    storeA.init({ windowMs: 60_000 });
    storeB.init({ windowMs: 60_000 });
    assert.equal((await storeA.increment(key)).totalHits, 1);
    const secondHit = await storeB.increment(key);
    assert.equal(secondHit.totalHits, 2);
    const stored = await RateLimitCounter.findOne({ store: 'shared-test' }).lean();
    assert.notEqual(stored.key, key);
    assert.match(stored.key, /^[a-f0-9]{64}$/);
    assert.ok(stored.expiresAt instanceof Date);
    await storeB.resetKey(key);
    assert.equal(await storeA.get(key), undefined);
  });

  await t.test('public health check does not expose database credentials', async () => {
    const result = await agentA.get('/api/health').expect(200);
    assert.deepEqual(result.body, { ok: true, database: 'connected' });
  });
});

test('dashboard escapes a member-controlled name before rendering HTML', async () => {
  const appRoot = { innerHTML: '' };
  const context = {
    document: { getElementById: () => appRoot },
    URL,
    URLSearchParams,
    location: { href: 'https://market.test/dashboard', origin: 'https://market.test' }
  };
  vm.createContext(context);
  const frontend = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  const bootstrapOffset = frontend.indexOf("appRoot.addEventListener('submit', submitHandler);");
  assert.ok(bootstrapOffset > 0, 'frontend bootstrap boundary exists');
  vm.runInContext(frontend.slice(0, bootstrapOffset), context, { filename: 'public/app.js' });

  const attackerName = '<img src=x onerror=alert(1)> Member';
  context.attackerName = attackerName;
  vm.runInContext(`
    currentUser = { id: 'member-1', name: attackerName, city: 'Pune', role: 'member' };
    api = async (url) => url === '/api/dashboard'
      ? { listings: [], swaps: [] }
      : { profile: { name: attackerName, email: 'member@example.test', city: 'Pune', bio: '' } };
  `, context);
  await vm.runInContext('renderDashboard(new URLSearchParams())', context);

  assert.match(appRoot.innerHTML, /Hello, &lt;img/);
  assert.doesNotMatch(appRoot.innerHTML, /Hello, <img/);
});

test('shipment panel links only to the free external manual calculator and does not collect quote details', () => {
  const appRoot = { innerHTML: '' };
  const context = {
    document: { getElementById: () => appRoot },
    URL,
    URLSearchParams,
    location: { href: 'https://market.test/dashboard', origin: 'https://market.test' }
  };
  vm.createContext(context);
  const frontend = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  const bootstrapOffset = frontend.indexOf("appRoot.addEventListener('submit', submitHandler);");
  assert.ok(bootstrapOffset > 0, 'frontend bootstrap boundary exists');
  vm.runInContext(frontend.slice(0, bootstrapOffset), context, { filename: 'public/app.js' });
  const markup = vm.runInContext("shipmentPanel({ id: 'swap-1', status: 'accepted', agreementConfirmed: false, requester: { id: 'member-1' }, recipient: { id: 'member-2' }, shipment: { status: 'not_started', history: [] } }, 'member-1')", context);

  assert.match(markup, /href="https:\/\/www\.shiprocket\.in\/shipping-rate-calculator\/"/);
  assert.match(markup, /target="_blank" rel="noopener noreferrer"/);
  assert.match(markup, /free manual shipping estimate/);
  assert.match(markup, /external estimate only/);
  assert.match(markup, /any courier shipment you arrange will cost money/);
  assert.match(markup, /does not collect or send them, request quotes, or book shipments/);
  assert.doesNotMatch(markup, /name="(?:pickup|delivery|pin|weight|dimensions)/i);
});

test('listing detail presents the optional comparable price separately and marks it unverified', async () => {
  const appRoot = { innerHTML: '' };
  const context = {
    document: { getElementById: () => appRoot },
    URL,
    URLSearchParams,
    location: { href: 'https://market.test/listings/listing-1', origin: 'https://market.test' }
  };
  vm.createContext(context);
  const frontend = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  const bootstrapOffset = frontend.indexOf("appRoot.addEventListener('submit', submitHandler);");
  assert.ok(bootstrapOffset > 0, 'frontend bootstrap boundary exists');
  vm.runInContext(frontend.slice(0, bootstrapOffset), context, { filename: 'public/app.js' });
  context.listing = { id: 'listing-1', title: 'Cotton overshirt', category: 'Outerwear', size: 'M', brand: 'Field Notes', condition: 'Excellent', description: 'A well-cared-for layer.', city: 'Pune', estimatedValue: 1300, comparableRetailPrice: 4200, status: 'available', isDemo: false, imageUrls: [], ownerId: 'member-1', ownerName: 'Ada Member', ownerCity: 'Pune', ownerIsDemo: false };
  vm.runInContext('api = async () => ({ item: listing })', context);
  const formMarkup = vm.runInContext('listingForm(listing)', context);
  assert.match(formMarkup, /Comparable retail price \(user-entered, unverified\)/);
  assert.match(formMarkup, /name="comparableRetailPrice"/);
  assert.match(formMarkup, /No retailer prices are imported/);
  await vm.runInContext('renderDetail("listing-1")', context);
  assert.match(appRoot.innerHTML, /Comparable retail price \(user-entered, unverified\)/);
  assert.match(appRoot.innerHTML, /₹4,200/);
  assert.match(appRoot.innerHTML, /not verified and not used to calculate the swap estimate or matches/);
  assert.match(appRoot.innerHTML, /Indicative swap-value estimate—not cash, a sale price, or a guarantee/);
});

test('community post cards escape member-authored titles, posts, and comments', async () => {
  const appRoot = { innerHTML: '' };
  const context = {
    document: { getElementById: () => appRoot },
    URL,
    URLSearchParams,
    location: { href: 'https://market.test/community', origin: 'https://market.test' }
  };
  vm.createContext(context);
  const frontend = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  const bootstrapOffset = frontend.indexOf("appRoot.addEventListener('submit', submitHandler);");
  assert.ok(bootstrapOffset > 0, 'frontend bootstrap boundary exists');
  vm.runInContext(frontend.slice(0, bootstrapOffset), context, { filename: 'public/app.js' });
  context.communityData = { total: 1, page: 1, pageCount: 1, posts: [{
    id: 'post-1', title: '<img src=x onerror=alert(1)>', body: '<script>unsafe()</script>', category: 'Clothing Care',
    author: { id: 'member-2', name: '<svg onload=alert(2)>' }, createdAt: new Date().toISOString(),
    likeCount: 1, likedByMe: false, commentCount: 1,
    comments: [{ id: 'comment-1', body: '<iframe>bad</iframe>', author: { id: 'member-3', name: '<b>name</b>' }, createdAt: new Date().toISOString() }]
  }] };
  vm.runInContext("currentUser = { id: 'member-1', name: 'Member', role: 'member' }; api = async () => communityData", context);
  await vm.runInContext('renderCommunity(new URLSearchParams())', context);
  assert.match(appRoot.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(appRoot.innerHTML, /&lt;script&gt;unsafe\(\)&lt;\/script&gt;/);
  assert.match(appRoot.innerHTML, /&lt;svg onload=alert\(2\)&gt;/);
  assert.match(appRoot.innerHTML, /&lt;iframe&gt;bad&lt;\/iframe&gt;/);
  assert.doesNotMatch(appRoot.innerHTML, /<script>unsafe\(\)<\/script>/);
});
test('courier service returns deterministic demo data and always blocks live booking without a provider', async () => {
  const previousMode = process.env.COURIER_MODE;
  const previousLiveFlag = process.env.LIVE_SHIPMENTS;
  try {
    process.env.COURIER_MODE = 'demo';
    process.env.LIVE_SHIPMENTS = 'false';
    const { CourierService } = require('../server/courier/service');
    const service = new CourierService();
    const details = { pickupLocality: 'Aundh', deliveryLocality: 'Kalyani Nagar', packageCategory: 'clothing_standard', weightKg: 1 };
    const rates = await service.getRates(details);
    assert.deepEqual(await service.getRates(details), rates);
    assert.ok(rates.every((rate) => rate.mode === 'demo' && rate.simulated));
    const simulated = await service.createShipment({ ...details, rate: rates[0] });
    assert.deepEqual(await service.createShipment({ ...details, rate: rates[0] }), simulated, 'the mock tracking reference is deterministic for the same shipment inputs');
    assert.equal(simulated.mode, 'demo');
    assert.equal(simulated.provider, 'local-mock');
    assert.match(simulated.trackingNumber, /^DEMO-SL-[A-F0-9]{16}$/);
    const tracking = await service.getTracking(simulated);
    assert.equal(tracking.simulated, true);
    assert.match(tracking.label, /NO REAL SHIPMENT/);
    const cancelled = await service.cancelShipment(simulated);
    assert.equal(cancelled.status, 'SIMULATED_CANCELLED');
    await assert.rejects(service.createLiveShipment({}), /Live shipment booking is disabled/);
    process.env.LIVE_SHIPMENTS = 'true';
    await assert.rejects(service.createLiveShipment({}), /No live courier provider is configured/);
    process.env.COURIER_MODE = 'live';
    await assert.rejects(service.getRates(details), /Only the local demo courier provider is available/);
  } finally {
    if (previousMode === undefined) delete process.env.COURIER_MODE; else process.env.COURIER_MODE = previousMode;
    if (previousLiveFlag === undefined) delete process.env.LIVE_SHIPMENTS; else process.env.LIVE_SHIPMENTS = previousLiveFlag;
  }
});
test('demo courier panel labels simulation, collects only locality-level details, and adapts for mobile', () => {
  const appRoot = { innerHTML: '' };
  const context = {
    document: { getElementById: () => appRoot },
    URL,
    URLSearchParams,
    location: { href: 'https://market.test/messages/swap-1', origin: 'https://market.test' }
  };
  vm.createContext(context);
  const frontend = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  const bootstrapOffset = frontend.indexOf("appRoot.addEventListener('submit', submitHandler);");
  assert.ok(bootstrapOffset > 0, 'frontend bootstrap boundary exists');
  vm.runInContext(frontend.slice(0, bootstrapOffset), context, { filename: 'public/app.js' });
  const formMarkup = vm.runInContext("courierPanel({ id: 'swap-1', status: 'accepted', agreementConfirmed: true, requester: { id: 'member-1', city: 'Pune' }, recipient: { id: 'member-2', city: 'Mumbai' } }, 'member-1', null, null)", context);
  assert.match(formMarkup, /Arrange Delivery/);
  assert.match(formMarkup, /DEMO ONLY · NO REAL SHIPMENT OR PAYMENT/);
  assert.match(formMarkup, /Get simulated rates/);
  assert.match(formMarkup, /name="pickupLocality"/);
  assert.match(formMarkup, /name="deliveryLocality"/);
  assert.match(formMarkup, /name="packageCategory"/);
  assert.match(formMarkup, /name="weightKg"/);
  assert.doesNotMatch(formMarkup, /name="(?:street|address|pinCode|phone|email)"/i);
  vm.runInContext("courierQuotes.set('swap-1', { details: { pickupLocality: 'Pune', deliveryLocality: 'Mumbai', packageCategory: 'clothing_standard', weightKg: '1' }, rates: [{ id: 'demo-express', courier: 'Demo Express', estimatedCost: 82, currency: 'INR', estimatedDelivery: '3–4 days' }] })", context);
  const rateMarkup = vm.runInContext("courierPanel({ id: 'swap-1', status: 'accepted', agreementConfirmed: true, requester: { id: 'member-1', city: 'Pune' }, recipient: { id: 'member-2', city: 'Mumbai' } }, 'member-1', null, null)", context);
  assert.match(rateMarkup, /SIMULATED COURIER OPTIONS/);
  assert.match(rateMarkup, /Create Demo Shipment/);
  assert.match(rateMarkup, /name="rateId"/);
  assert.match(rateMarkup, /Demo Express/);
  const shippedMarkup = vm.runInContext("courierPanel({ id: 'swap-1', status: 'accepted', agreementConfirmed: true, requester: { id: 'member-1', city: 'Pune' }, recipient: { id: 'member-2', city: 'Mumbai' } }, 'member-1', { trackingNumber: 'DEMO-SL-AB12CD34', courierName: 'Demo Express', estimatedCost: 82, currency: 'INR', pickupLocality: 'Pune', deliveryLocality: 'Mumbai', estimatedDelivery: '3–4 days' }, { status: 'Shipped · simulated', events: [{ label: 'Shipped · simulated', state: 'current', occurredAt: null }, { label: 'Example next stage: in transit', state: 'illustrative', occurredAt: null }] })", context);
  assert.match(shippedMarkup, /SIMULATED SHIPMENT · NO REAL DELIVERY/);
  assert.match(shippedMarkup, /Shipped · simulated/);
  assert.match(shippedMarkup, /Illustrative only · not carrier activity/);
  const styles = fs.readFileSync(require.resolve('../public/styles.css'), 'utf8');
  assert.match(styles, /@media\(max-width:720px\)\{[^}]*\.courier-choice-grid,\.courier-rate-grid\{grid-template-columns:1fr\}/);
});
test.after(async () => {
  if (app?.locals?.sessionStore?.close) { try { await app.locals.sessionStore.close(); } catch {} }
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
