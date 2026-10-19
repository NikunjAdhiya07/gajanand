export type EntryType = 'income' | 'expense';

export interface UserRef {
  userId: string;
  username: string;
}

export interface DaybookEntryView {
  _id: string;
  date: string; // 'YYYY-MM-DD' (IST calendar day)
  type: EntryType;
  category: string;
  description: string;
  amount: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface Totals {
  income: number;
  expense: number;
  net: number;
  count: number;
}

export interface DayTotal extends Totals {
  date: string;
}

export interface DaybookSettingView {
  openingBalance: number;
  asOfDate: string;
  updatedBy: string;
  updatedAt: string;
}

export interface DaybookListResponse {
  from: string;
  to: string;
  today: string;
  entries: DaybookEntryView[];
  totals: Totals;
  days: DayTotal[];
  /** Only present when an opening balance is set and `from` is on/after its date. */
  balance: { opening: number; closing: number } | null;
  setting: DaybookSettingView | null;
  categories: string[];
}

export interface EntryInput {
  date: string;
  type: EntryType;
  category: string;
  description: string;
  amount: number;
}

export interface ApiErrorBody {
  message: string;
  code?: string;
  field?: string;
  [key: string]: unknown;
}
