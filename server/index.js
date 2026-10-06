require('dotenv').config();
const mongoose = require('mongoose');

const required = ['MONGODB_URI', 'SESSION_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Startup blocked: set ${missing.join(' and ')} in the deployment environment. No fallback file or in-memory production database is used.`);
  process.exit(1);
}
if (Buffer.byteLength(process.env.SESSION_SECRET) < 32) {
  console.error('Startup blocked: SESSION_SECRET must contain at least 32 bytes.');
  process.exit(1);
}
const { app } = require('./app');
const { seedDemoListings } = require('./seed');
const { User, Listing, Swap, Message, ActivityEvent } = require('./models');

async function start() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
    maxPoolSize: 10,
    autoIndex: false
  });
  await Promise.all([User.createIndexes(), Listing.createIndexes(), Swap.createIndexes(), Message.createIndexes(), ActivityEvent.createIndexes()]);
  if (process.env.SEED_DEMOS === 'true') await seedDemoListings();
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => console.log(`Clothing swap app listening on port ${port}`));
  const stop = async () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  return server;
}

if (require.main === module) {
  start().catch((error) => {
    console.error(`Startup failed (${error.name}): database connection or application initialization failed.`);
    process.exit(1);
  });
}

module.exports = { start };
