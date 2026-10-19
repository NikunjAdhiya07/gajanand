// Creates a login user, or resets the password if the username already exists.
// Usage: node scripts/create-user.mjs --username=admin --password=secret
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MONGODB_URI, arg } from './daybook-common.mjs';

const username = arg('username');
const password = arg('password');
if (!username || !password) {
  console.error('Usage: node scripts/create-user.mjs --username=NAME --password=SECRET');
  process.exit(1);
}
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in .env.local');
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
try {
  const users = mongoose.connection.db.collection('users');
  const existing = await users.find({}, { projection: { username: 1 } }).toArray();
  console.log(`Database: ${mongoose.connection.db.databaseName}`);
  console.log(`Existing users: ${existing.map((u) => u.username).join(', ') || '(none)'}`);

  const hashed = await bcrypt.hash(password, 10);
  const res = await users.updateOne({ username }, { $set: { username, password: hashed } }, { upsert: true });
  console.log(res.upsertedCount ? `Created user "${username}"` : `Updated password for "${username}"`);

  const saved = await users.findOne({ username });
  console.log(`Password check: ${(await bcrypt.compare(password, saved.password)) ? 'OK' : 'FAILED'}`);
} finally {
  await mongoose.disconnect();
}
