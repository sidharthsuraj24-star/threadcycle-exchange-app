const mongoose = require('mongoose');
const { User, Listing, Swap, Message, ActivityEvent, RateLimitCounter, CommunityPost, CommunityComment, CommunityReport, DemoShipment } = require('./models');
const { seedDemoListings } = require('./seed');

let initializationPromise = null;
let initialized = false;

async function initializeDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for persistent application data and sessions.');
  if (initialized && mongoose.connection.readyState === 1) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
        maxPoolSize: 10,
        autoIndex: false
      });
    }
    await Promise.all([User.createIndexes(), Listing.createIndexes(), Swap.createIndexes(), Message.createIndexes(), ActivityEvent.createIndexes(), RateLimitCounter.createIndexes(), CommunityPost.createIndexes(), CommunityComment.createIndexes(), CommunityReport.createIndexes(), DemoShipment.createIndexes()]);
    if (process.env.SEED_DEMOS === 'true') await seedDemoListings();
  })()
    .then(() => { initialized = true; })
    .catch((error) => { initialized = false; throw error; })
    .finally(() => { initializationPromise = null; });

  return initializationPromise;
}

module.exports = { initializeDatabase };
