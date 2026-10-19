// Connects to MONGODB_URI several times and reports timing or the per-host failure reason.
// Usage: node scripts/db-ping.mjs [--times=5]
import mongoose from 'mongoose';
import { MONGODB_URI, arg } from './daybook-common.mjs';

const times = Number(arg('times', '5'));
for (let i = 1; i <= times; i++) {
  const t0 = Date.now();
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await mongoose.connection.db.admin().ping();
    console.log(`#${i} OK in ${Date.now() - t0} ms (db: ${mongoose.connection.db.databaseName})`);
  } catch (e) {
    console.log(`#${i} FAILED after ${Date.now() - t0} ms: ${e.message}`);
    for (const [host, s] of e.reason?.servers ?? []) {
      console.log(`   ${host}: ${s.type} ${s.error?.message ?? ''}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}
