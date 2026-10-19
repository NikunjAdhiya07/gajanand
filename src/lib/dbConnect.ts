// src/lib/dbConnect.ts
import mongoose from 'mongoose';

// Load environment variables from .env.local
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  if (process.env.NODE_ENV === 'development') {
    console.error('Please check:');
    console.error('1. .env.local file exists in project root');
    console.error('2. MONGODB_URI is properly defined in .env.local');
    console.error('3. No spaces or quotes around the MONGODB_URI value');
  }
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// Remove any quotes that might have been accidentally added
const uri = MONGODB_URI.replace(/["']/g, '');

interface GlobalWithMongoose {
  mongoose: {
    conn: null | typeof mongoose;
    promise: null | Promise<typeof mongoose>;
  };
}

declare const global: GlobalWithMongoose;

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  // The driver reconnects by itself after a network blip, so a live connection
  // is reused even when the 'disconnected' handler has cleared the cache.
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return cached.conn;
  }

  // If we don't have a promise, create one
  if (!cached.promise) {
    // connect() on a connection that is still connecting/reconnecting creates a
    // second MongoClient while `connection.db` keeps pointing at the first one;
    // sessions then fail with "ClientSession must be from the same MongoClient".
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
    const opts = {
      bufferCommands: false,
      // Skip Mongoose's automatic index (re)build on every cold-start connection
      // in production. Indexes already exist in Atlas; rebuilding-check on each
      // serverless cold start is wasted CPU + DB ops. Kept on in dev for convenience.
      autoIndex: process.env.NODE_ENV !== 'production',
      // Pool tuned for Atlas M0 free tier + Vercel serverless:
      // maxPoolSize: 3 means up to 10 concurrent instances = 30 connections max, well under the 500 limit
      maxPoolSize: 3,
      minPoolSize: 1,        // Hold 1 connection open during the Vercel warm window
      maxIdleTimeMS: 60000,  // Keep connections alive for 60s (covers Vercel warm window)
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxConnecting: 2,
    };

    try {
      // Remove stale listeners before connecting/re-attaching — prevents listener stacking
      // across reconnect cycles (each dbConnect() call after a disconnect would
      // otherwise add a second error/disconnected handler on top of the old one).
      mongoose.connection.removeAllListeners('error');
      mongoose.connection.removeAllListeners('disconnected');

      cached.promise = mongoose.connect(uri, opts).then((m) => m);

      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
        // Clear both so next request gets a clean reconnect
        cached.promise = null;
        cached.conn = null;
      });

      mongoose.connection.on('disconnected', () => {
        cached.conn = null;
        cached.promise = null; // Force full reconnect on next request
      });

    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      cached.promise = null;
      throw error;
    }
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    console.error('❌ Failed to establish MongoDB connection:', e);
    cached.promise = null;
    cached.conn = null;
    throw e;
  }

  return cached.conn;
}

// SIGINT handler at module level — only registered once per process, never inside dbConnect().
// Guarded to development only; Vercel production containers are killed by the platform directly.
if (process.env.NODE_ENV !== 'production') {
  process.once('SIGINT', async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔒 MongoDB connection closed through app termination');
    }
  });
}

// Optional: Add a function to get connection stats
export function getConnectionStats() {
  return {
    readyState: mongoose.connection.readyState,
    name: mongoose.connection.name,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
  };
}

// Optional: Add a function to close connections (useful for testing)
export async function closeConnection() {
  if (cached.conn) {
    await mongoose.connection.close();
    cached.conn = null;
    cached.promise = null;
  }
}

export default dbConnect;