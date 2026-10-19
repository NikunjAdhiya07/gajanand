import mongoose, { Schema, model } from 'mongoose';

export const UserRefSchema = new Schema(
  { userId: { type: String, required: true }, username: { type: String, required: true } },
  { _id: false }
);

const DaybookEntrySchema = new Schema(
  {
    date: { type: String, required: true }, // 'YYYY-MM-DD' IST calendar day
    type: { type: String, enum: ['income', 'expense'], required: true },
    category: { type: String, required: true, trim: true, maxlength: 50 },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0.01 },
    createdBy: { type: UserRefSchema, required: true },
    updatedBy: { type: UserRefSchema, required: true },
  },
  { timestamps: true }
);

DaybookEntrySchema.index({ date: 1, createdAt: 1 });

// In dev, hot reload re-runs this file while the old model stays registered;
// replace it so schema changes apply without restarting the server.
if (process.env.NODE_ENV !== 'production' && mongoose.models.DaybookEntry) {
  mongoose.deleteModel('DaybookEntry');
}

export default mongoose.models.DaybookEntry || model('DaybookEntry', DaybookEntrySchema);
