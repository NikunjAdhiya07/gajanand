// Seeds (or updates) the admin login user.
//
//   npm run seed
//
// Credentials come from .env.local so nothing secret lands in git:
//   ADMIN_USERNAME  - login username (default: Admin)
//   ADMIN_PASSWORD  - plaintext password, hashed here before it is stored
//
// Re-running is safe: an existing user with the same username has its
// password reset rather than being duplicated.

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI?.replace(/["']/g, '');
const username = process.env.ADMIN_USERNAME || 'Admin';
const password = process.env.ADMIN_PASSWORD;

if (!uri) {
  console.error('✗ MONGODB_URI is not set in .env.local');
  process.exit(1);
}
if (!password) {
  console.error('✗ ADMIN_PASSWORD is not set in .env.local');
  process.exit(1);
}

// Mirrors src/models/User.ts. That model hashes nothing on save, so the
// hash is built here with the same cost factor the reset-credentials
// route uses (10), keeping every stored hash consistent.
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const existing = await User.findOne({ username });
  const hashed = await bcrypt.hash(password, 10);

  await User.findOneAndUpdate(
    { username },
    { username, password: hashed },
    { upsert: true, new: true }
  );

  console.log(
    existing
      ? `✓ Password updated for existing user "${username}"`
      : `✓ Admin user "${username}" created`
  );
} catch (error) {
  console.error('✗ Seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.connection.close();
}
