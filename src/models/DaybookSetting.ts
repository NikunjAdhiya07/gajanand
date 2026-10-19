import mongoose, { Schema, model } from 'mongoose';
import { UserRefSchema } from './DaybookEntry';

// Optional opening balance. The register works without it; when set, running
// balances are shown from `asOfDate` onwards.
const DaybookSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    openingBalance: { type: Number, required: true },
    asOfDate: { type: String, required: true }, // 'YYYY-MM-DD'
    updatedBy: { type: UserRefSchema, required: true },
  },
  { timestamps: true }
);

// See DaybookEntry: keeps the dev server on the current schema after hot reload.
if (process.env.NODE_ENV !== 'production' && mongoose.models.DaybookSetting) {
  mongoose.deleteModel('DaybookSetting');
}

export default mongoose.models.DaybookSetting || model('DaybookSetting', DaybookSettingSchema);
