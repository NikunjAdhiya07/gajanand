// Creates the indexes the Day Book relies on. Production runs with Mongoose
// autoIndex disabled, so run this once per environment:
//
//   node scripts/daybook-indexes.mjs
//
// Safe to re-run. Also removes collections and indexes left by the earlier
// Close Day version of the Day Book (only when those collections are empty).
import mongoose from 'mongoose';
import { MONGODB_URI } from './daybook-common.mjs';

if (!MONGODB_URI) {
  console.error('✗ MONGODB_URI is not set in .env.local');
  process.exit(1);
}

const INDEXES = [
  ['daybookentries', { date: 1, createdAt: 1 }, {}],
  ['daybooksettings', { key: 1 }, { unique: true }],
];
const LEGACY_COLLECTIONS = ['daybookdaycloses', 'daybookaudits'];
const LEGACY_INDEXES = [['daybookentries', 'day_1_status_1']];

try {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

  for (const name of LEGACY_COLLECTIONS) {
    if (!existing.has(name)) continue;
    const count = await db.collection(name).countDocuments();
    if (count === 0) {
      await db.collection(name).drop();
      console.log(`✓ removed empty legacy collection ${name}`);
    } else {
      console.log(`! kept legacy collection ${name} (${count} documents)`);
    }
  }
  for (const [collection, index] of LEGACY_INDEXES) {
    if (!existing.has(collection)) continue;
    const names = (await db.collection(collection).indexes()).map((i) => i.name);
    if (names.includes(index)) {
      await db.collection(collection).dropIndex(index);
      console.log(`✓ removed legacy index ${collection}.${index}`);
    }
  }
  for (const [collection, keys, options] of INDEXES) {
    const name = await db.collection(collection).createIndex(keys, options);
    console.log(`✓ ${collection}: ${name}`);
  }
} catch (error) {
  console.error('✗ Index setup failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.connection.close();
}
