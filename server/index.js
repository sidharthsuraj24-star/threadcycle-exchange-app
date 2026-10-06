require('dotenv').config();

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
const { initializeDatabase } = require('./database');
const mongoose = require('mongoose');

async function start() {
  await initializeDatabase();
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => console.log(`Clothing swap app listening on port ${port}`));
  const stop = async () => {
    server.close(async () => {
      const store = app.locals.sessionStore;
      if (store?.close) await store.close();
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
