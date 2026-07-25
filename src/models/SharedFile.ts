import mongoose from "mongoose";

const SharedFileSchema = new mongoose.Schema({
  // Random, unguessable id used in the public download URL.
  token: {
    type: String,
    required: true,
    unique: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  contentType: {
    type: String,
    required: true,
  },
  data: {
    type: Buffer,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // MongoDB removes the document (and the file bytes) once this passes.
  expiresAt: {
    type: Date,
    required: true,
  },
});

// TTL index: expireAfterSeconds 0 means "delete when expiresAt is reached".
SharedFileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.SharedFile ||
  mongoose.model("SharedFile", SharedFileSchema);
