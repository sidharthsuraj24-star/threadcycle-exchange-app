const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const supertest = require('supertest');

let mongo;
let app;
let agentA;
let agentB;
let csrfA;
let csrfB;
let userA;
let userB;
let listingA;
let listingB;
const jpg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k=', 'base64');
async function csrf(agent) { return (await agent.get('/api/me').expect(200)).body.csrfToken; }
async function createMember(agent, name, email, city) {
  const token = await csrf(agent);
  const response = await agent.post('/api/register').set('x-csrf-token', token).send({ name, email, city, password: 'A-safe-test-password-2026!' }).expect(201);
  return { user: response.body.user, csrf: response.body.csrfToken };
}
async function addListing(agent, token, overrides = {}) {
  const payload = {
    title: 'Soft cotton overshirt', category: 'Outerwear', size: 'M', brand: 'Field Notes', brandTier: 'Everyday', condition: 'Excellent',
    description: 'A well-cared-for cotton layer with one inside pocket.',
    ...overrides
  };
  const req = agent.post('/api/listings').set('x-csrf-token', token);
  for (const [key, value] of Object.entries(payload)) req.field(key, value);
  req.attach('images', jpg, { filename: 'garment.jpg', contentType: 'image/jpeg' });
  return (await req.expect(201)).body.item;
}

test('end-to-end marketplace flows use the MongoDB data models and persisted sessions', async (t) => {
  mongo = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongo.getUri('clothing_swap_test');
  process.env.SESSION_SECRET = 'test-session-secret-long-enough-to-meet-minimum-32-bytes';
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const { User, Listing, Swap } = require('../server/models');
  await Promise.all([User.createIndexes(), Listing.createIndexes(), Swap.createIndexes()]);
  app = require('../server/app').app;
  const { seedDemoListings } = require('../server/seed');
  await seedDemoListings();
  agentA = supertest.agent(app);
  agentB = supertest.agent(app);

  await t.test('server boots with explicitly labelled sample items, not demo accounts', async () => {
    const html = await agentA.get('/').expect(200);
    assert.match(html.text, /Second Loop/);
    assert.match(html.headers['content-security-policy'], /default-src 'self'/);
    await agentA.get('/app.js').expect(200).expect('Content-Type', /javascript/);
    const result = await agentA.get('/api/listings');
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.total, 8);
    assert.ok(result.body.items.every((x) => x.isDemo === true && x.demoLabel.includes('Illustrative demo')));
    assert.equal((await User.countDocuments({ isDemo: true })), 8);
    assert.equal((await User.countDocuments({ isDemo: true, passwordHash: { $exists: true } })), 0);
  });

  await t.test('registration validates, hashes passwords, rotates session, and limits the public profile', async () => {
    const token = await csrf(agentA);
    await agentA.post('/api/register').set('x-csrf-token', token).send({ name: 'Ada Member', email: 'ada@example.test', city: 'Pune', password: 'tiny' }).expect(400);
    const created = await createMember(agentA, 'Ada Member', 'ada@example.test', 'Pune');
    csrfA = created.csrf; userA = created.user;
    assert.equal(userA.role, 'member');
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
    await agentA.patch('/api/profile').set('Origin', 'https://attacker.invalid').set('x-csrf-token', csrfA).send({ name: 'Forged origin', city: 'Pune' }).expect(403);
    await agentA.patch('/api/profile').set('x-csrf-token', csrfA).send({ name: '<img src=x onerror=alert(1)>', city: 'Pune', bio: '<script>text</script>' }).expect(200);
    const profile = (await agentA.get('/api/profile').expect(200)).body.profile;
    assert.match(profile.name, /<img/);
    assert.equal(profile.city, 'Pune');
  });

  await t.test('listing creation validates photo type, estimates value server-side, and stores image bytes in MongoDB', async () => {
    listingA = await addListing(agentA, csrfA, { estimatedValue: '49999' });
    assert.equal(listingA.imageCount, 1);
    assert.equal(listingA.estimatedValue, 1300);
    const photo = await agentA.get(listingA.imageUrls[0]).expect(200);
    assert.equal(photo.headers['content-type'], 'image/jpeg');
    const doc = await Listing.findById(listingA.id).select('+images');
    assert.equal(doc.images[0].data.length, jpg.length);
    const edited = agentA.patch(`/api/listings/${listingA.id}`).set('x-csrf-token', csrfA)
      .field('title', 'Updated cotton overshirt').field('category', 'Outerwear').field('size', 'M').field('brand', 'Field Notes')
      .field('brandTier', 'Premium').field('condition', 'Excellent').field('description', 'Updated listing text.')
      .attach('images', jpg, { filename: 'updated.jpg', contentType: 'image/jpeg' });
    listingA = (await edited.expect(200)).body.item;
    assert.equal(listingA.title, 'Updated cotton overshirt');
    assert.equal(listingA.estimatedValue, 1600);
    const removable = await addListing(agentA, csrfA, { title: 'Temporary item to remove' });
    await agentA.delete(`/api/listings/${removable.id}`).set('x-csrf-token', csrfA).send({}).expect(200);
    await agentA.get(`/api/listings/${removable.id}`).expect(404);
    await agentA.get(`/api/listings/${removable.id}/images/0`).expect(404);
    const bad = agentA.post('/api/listings').set('x-csrf-token', csrfA)
      .field('title', 'Bad photo').field('category', 'Tops').field('size', 'M').field('brand', 'X').field('brandTier', 'Everyday').field('condition', 'Good').field('description', 'No SVG uploads')
      .attach('images', Buffer.from('<svg onload="alert(1)"></svg>'), { filename: 'bad.svg', contentType: 'image/svg+xml' });
    await bad.expect(400);
  });

  await t.test('a real member can filter by coarse city, but demo samples are not match candidates', async () => {
    const matches = await agentA.get('/api/matches?city=Pune').expect(200);
    assert.equal(matches.body.items.length, 0);
    assert.match(matches.body.locationMethod, /No GPS/);
    const browse = await agentA.get('/api/listings?city=Pune');
    assert.equal(browse.status, 200, JSON.stringify(browse.body));
    assert.ok(browse.body.items.every((x) => x.city === 'Pune'));
    const sample = (await agentA.get('/api/listings').expect(200)).body.items.find((item) => item.isDemo);
    await agentA.post('/api/swaps').set('x-csrf-token', csrfA).send({ requestedListingId: sample.id, offeredListingId: listingA.id }).expect(409);
  });

  await t.test('a request starts a private thread; only its two participants can read and write', async () => {
    const created = await createMember(agentB, 'Sam Member', 'sam@example.test', 'Mumbai'); csrfB = created.csrf; userB = created.user;
    const outsider = supertest.agent(app);
    await createMember(outsider, 'Nia Member', 'nia@example.test', 'Delhi');
    listingB = await addListing(agentB, csrfB, { title: 'Indigo cotton jacket', category: 'Outerwear', size: 'L', brandTier: 'Premium' });
    await agentB.get('/api/admin/overview').expect(403);
    await agentA.post('/api/swaps').set('x-csrf-token', csrfA).send({ requestedListingId: listingB.id, offeredListingId: listingA.id, handoffPreference: 'courier-booked' }).expect(400);
    const token = csrfA;
    const response = await agentA.post('/api/swaps').set('x-csrf-token', token).send({ requestedListingId: listingB.id, offeredListingId: listingA.id, note: 'Would love to compare shoulder measurements.', handoffPreference: 'remote' }).expect(201);
    const swapId = response.body.swap.id;
    assert.equal((await Swap.findById(swapId)).handoffPreference, 'remote');
    assert.equal((await agentA.get('/api/swaps').expect(200)).body.swaps.find((s) => s.id === swapId).handoffPreference, 'remote');
    const msgs = await agentA.get(`/api/swaps/${swapId}/messages`).expect(200);
    assert.equal(msgs.body.messages.length, 1);
    await agentA.post(`/api/swaps/${swapId}/messages`).set('x-csrf-token', csrfA).send({ body: 'Could you measure the sleeve?' }).expect(201);
    assert.equal((await agentB.get(`/api/swaps/${swapId}/messages`).expect(200)).body.messages.length, 2);
    await outsider.get(`/api/swaps/${swapId}/messages`).expect(404);
    await agentB.patch(`/api/swaps/${swapId}/status`).set('x-csrf-token', csrfB).send({ action: 'accept' }).expect(200);
    await agentA.patch(`/api/swaps/${swapId}/status`).set('x-csrf-token', csrfA).send({ action: 'confirm' }).expect(200);
    const pending = await Swap.findById(swapId).lean();
    assert.equal(pending.status, 'accepted');
    await agentB.patch(`/api/swaps/${swapId}/status`).set('x-csrf-token', csrfB).send({ action: 'confirm' }).expect(200);
    const done = await Swap.findById(swapId).lean();
    assert.equal(done.status, 'completed');
    assert.equal(done.confirmedBy.length, 2);
    assert.equal((await Listing.findById(listingA.id)).status, 'swapped');
    assert.equal((await Listing.findById(listingB.id)).status, 'swapped');
    await agentA.get('/api/admin/overview').expect(403);
  });

  await t.test('only an already-registered member promoted from trusted server access gets admin controls', async () => {
    await User.updateOne({ _id: userA.id }, { $set: { role: 'admin' } });
    const overview = await agentA.get('/api/admin/overview');
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    assert.equal(overview.body.kpis.registeredMembers, 3);
    assert.equal(overview.body.kpis.memberConfirmedCompletions, 1);
    assert.equal(overview.body.kpis.disputesOpen, 0);
    assert.match(overview.body.note, /seed\/demo accounts/);
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
    assert.equal((await Swap.findById(toWithdraw.body.swap.id)).status, 'withdrawn');
    const toDecline = await agentA.post('/api/swaps').set('x-csrf-token', csrfA).send({ offeredListingId: offered.id, requestedListingId: requested.id }).expect(201);
    await agentB.patch(`/api/swaps/${toDecline.body.swap.id}/status`).set('x-csrf-token', csrfB).send({ action: 'decline' }).expect(200);
    assert.equal((await Swap.findById(toDecline.body.swap.id)).status, 'declined');
    const request = await agentA.post('/api/swaps').set('x-csrf-token', csrfA).send({ offeredListingId: offered.id, requestedListingId: requested.id, note: 'Please confirm fit.' }).expect(201);
    const disputeId = request.body.swap.id;
    await agentB.patch(`/api/swaps/${disputeId}/status`).set('x-csrf-token', csrfB).send({ action: 'dispute' }).expect(200);
    assert.equal((await agentA.get('/api/admin/overview').expect(200)).body.kpis.disputesOpen, 1);
    await agentA.patch(`/api/admin/swaps/${disputeId}/resolve`).set('x-csrf-token', csrfA).send({ outcome: 'complete', reason: 'An admin cannot attest that an exchange happened.' }).expect(400);
    const closed = await agentA.patch(`/api/admin/swaps/${disputeId}/resolve`).set('x-csrf-token', csrfA).send({ outcome: 'close', reason: 'Request closed after review.' }).expect(200);
    assert.equal(closed.body.status, 'withdrawn');
    assert.equal((await Swap.findById(disputeId)).adminNote, 'Request closed after review.');
  });

  await t.test('public health check does not expose database credentials', async () => {
    const result = await agentA.get('/api/health').expect(200);
    assert.deepEqual(result.body, { ok: true, database: 'connected' });
  });
});

test.after(async () => {
  if (app?.locals?.sessionStore?.close) { try { await app.locals.sessionStore.close(); } catch {} }
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
