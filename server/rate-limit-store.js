const crypto = require('node:crypto');
const { RateLimitCounter } = require('./models');

class MongoRateLimitStore {
  constructor(storeName, secret) {
    if (!storeName || !secret || Buffer.byteLength(secret) < 32) throw new Error('A named rate-limit store and strong secret are required.');
    this.storeName = storeName;
    this.secret = secret;
    this.windowMs = 0;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  filterFor(clientKey) {
    const key = crypto.createHmac('sha256', this.secret).update(`${this.storeName}:${clientKey}`).digest('hex');
    return { store: this.storeName, key };
  }

  result(document) {
    return document ? { totalHits: document.totalHits, resetTime: document.resetTime } : undefined;
  }

  async get(clientKey) {
    const now = new Date();
    const document = await RateLimitCounter.findOne({ ...this.filterFor(clientKey), resetTime: { $gt: now } }).lean();
    return this.result(document);
  }

  async increment(clientKey) {
    if (!this.windowMs) throw new Error('Rate-limit store must be initialized before use.');
    const filter = this.filterFor(clientKey);
    const now = new Date();
    const resetTime = new Date(now.getTime() + this.windowMs);

    const active = await RateLimitCounter.findOneAndUpdate(
      { ...filter, resetTime: { $gt: now } },
      { $inc: { totalHits: 1 } },
      { new: true }
    );
    if (active) return this.result(active);

    const expired = await RateLimitCounter.findOneAndUpdate(
      { ...filter, resetTime: { $lte: now } },
      { $set: { totalHits: 1, resetTime, expiresAt: resetTime } },
      { new: true }
    );
    if (expired) return this.result(expired);

    try {
      const created = await RateLimitCounter.findOneAndUpdate(
        { ...filter, resetTime: { $exists: false } },
        { $setOnInsert: { totalHits: 1, resetTime, expiresAt: resetTime } },
        { upsert: true, new: true }
      );
      return this.result(created);
    } catch (error) {
      if (error.code === 11000) return this.increment(clientKey);
      throw error;
    }
  }

  async decrement(clientKey) {
    await RateLimitCounter.updateOne(
      { ...this.filterFor(clientKey), resetTime: { $gt: new Date() }, totalHits: { $gt: 0 } },
      { $inc: { totalHits: -1 } }
    );
  }

  async resetKey(clientKey) {
    await RateLimitCounter.deleteOne(this.filterFor(clientKey));
  }

  async resetAll() {
    await RateLimitCounter.deleteMany({ store: this.storeName });
  }
}

module.exports = { MongoRateLimitStore };
