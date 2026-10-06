require('dotenv').config();
const readline = require('node:readline/promises');
const mongoose = require('mongoose');
const { User } = require('../server/models');

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in your trusted shell environment first.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Usage: npm run admin:promote -- member@example.com');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, maxPoolSize: 2 });
  try {
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || user.isDemo || !user.passwordHash) throw new Error('No real registered member exists for that email; promotion stopped.');
    if (user.role === 'admin') { console.log('This account is already an administrator.'); return; }
    console.log(`About to grant the administrator role to the existing account: ${user.name} (${user.email}).`);
    console.log('This command changes permissions. Confirm only if you are the authorized marketplace owner.');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Type the exact email to confirm: ');
    rl.close();
    if (answer.trim().toLowerCase() !== email) throw new Error('Confirmation did not match; no role was changed.');
    user.role = 'admin';
    await user.save();
    console.log('Administrator role granted to the confirmed account. No password or bootstrap secret was created or printed.');
  } finally {
    await mongoose.disconnect();
  }
}
main().catch((error) => {
  console.error(`Admin provisioning stopped: ${error.message}`);
  process.exitCode = 1;
});
