import mongoose, { Schema, Document } from 'mongoose';

// Guarantor kept as a plain sub-document copy of the loan's guarantors
export interface IObsoleteGuarantor {
  holderName: string;
  address: string;
  telephone: string;
  city: string;
}

// The set of fields carried between a live loan and its obsolete copy - i.e.
// every loan detail apart from the account number and loan number.
export interface ObsoleteLoanData {
  date: Date;
  mDate: Date;
  amount: number;
  period: number;
  isDaily: boolean;
  instAmount: number;
  mAmount: number;
  holderName: string;
  holderAddress: string;
  telephone1: string;
  telephone2?: string;
  name: string;
  hasGuarantor: boolean;
  guarantors?: IObsoleteGuarantor[];
}

// Obsolete loan holds every detail of the original loan EXCEPT the account
// number / loan number - those are released back to the pool the moment the
// account is obsoleted, and a fresh one is assigned on restore.
export interface IObsoleteLoan extends Document {
  date: Date;
  mDate: Date;
  amount: number;
  period: number;
  isDaily: boolean;
  instAmount: number;
  mAmount: number;
  holderName: string;
  holderAddress: string;
  telephone1: string;
  telephone2?: string;
  name: string;
  hasGuarantor: boolean;
  guarantors: IObsoleteGuarantor[];
  obsoletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ObsoleteGuarantorSchema = new Schema<IObsoleteGuarantor>({
  holderName: { type: String, trim: true },
  address: { type: String, trim: true },
  telephone: { type: String, trim: true },
  city: { type: String, trim: true }
}, { _id: false });

const ObsoleteLoanSchema = new Schema<IObsoleteLoan>({
  date: { type: Date },
  mDate: { type: Date },
  amount: { type: Number, min: [0, 'Amount cannot be negative'] },
  period: { type: Number, min: [0, 'Period cannot be negative'] },
  isDaily: { type: Boolean, default: true },
  instAmount: { type: Number, min: [0, 'Installment amount cannot be negative'] },
  mAmount: { type: Number, min: [0, 'Maturity amount cannot be negative'] },
  holderName: {
    type: String,
    required: [true, 'Holder name is required'],
    trim: true
  },
  holderAddress: { type: String, trim: true },
  telephone1: { type: String, trim: true },
  telephone2: { type: String, trim: true },
  name: { type: String, trim: true },
  hasGuarantor: { type: Boolean, default: false },
  guarantors: [ObsoleteGuarantorSchema],
  obsoletedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

ObsoleteLoanSchema.index({ obsoletedAt: -1 });

export default mongoose.models.ObsoleteLoan ||
  mongoose.model<IObsoleteLoan>('ObsoleteLoan', ObsoleteLoanSchema);
