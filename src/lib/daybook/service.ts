import DaybookEntry from '@/models/DaybookEntry';
import DaybookSetting from '@/models/DaybookSetting';
import { notFound } from './errors';
import { istToday } from './istDate';
import { fromPaise, toPaise } from './money';
import type {
  DayTotal,
  DaybookEntryView,
  DaybookListResponse,
  DaybookSettingView,
  EntryInput,
  Totals,
  UserRef,
} from './types';

interface EntryDoc extends EntryInput {
  _id: { toString(): string };
  createdBy: UserRef;
  updatedBy: UserRef;
  createdAt: Date;
  updatedAt: Date;
}

interface SettingDoc {
  openingBalance: number;
  asOfDate: string;
  updatedBy: UserRef;
  updatedAt: Date;
}

const toEntryView = (e: EntryDoc): DaybookEntryView => ({
  _id: e._id.toString(),
  date: e.date,
  type: e.type,
  category: e.category,
  description: e.description,
  amount: e.amount,
  createdBy: e.createdBy?.username ?? '',
  createdAt: new Date(e.createdAt).toISOString(),
  updatedBy: e.updatedBy?.username ?? '',
  updatedAt: new Date(e.updatedAt).toISOString(),
});

const toSettingView = (s: SettingDoc): DaybookSettingView => ({
  openingBalance: s.openingBalance,
  asOfDate: s.asOfDate,
  updatedBy: s.updatedBy?.username ?? '',
  updatedAt: new Date(s.updatedAt).toISOString(),
});

/** Sums in integer paise so repeated additions cannot drift. */
function totalsOf(entries: Pick<EntryInput, 'type' | 'amount'>[]): Totals {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (e.type === 'income') income += toPaise(e.amount);
    else expense += toPaise(e.amount);
  }
  return { income: fromPaise(income), expense: fromPaise(expense), net: fromPaise(income - expense), count: entries.length };
}

/** Net (income - expense) in paise for entries with fromDay <= date < toDay. */
async function netPaiseBetween(fromDay: string, toDay: string): Promise<number> {
  if (fromDay >= toDay) return 0;
  const [row] = await DaybookEntry.aggregate<{ net: number }>([
    { $match: { date: { $gte: fromDay, $lt: toDay } } },
    {
      $group: {
        _id: null,
        net: {
          $sum: {
            $multiply: [
              { $round: [{ $multiply: ['$amount', 100] }, 0] },
              { $cond: [{ $eq: ['$type', 'income'] }, 1, -1] },
            ],
          },
        },
      },
    },
  ]);
  return row?.net ?? 0;
}

async function loadSetting(): Promise<SettingDoc | null> {
  return DaybookSetting.findOne({ key: 'default' }).lean<SettingDoc | null>();
}

export async function listEntries(from: string, to: string): Promise<DaybookListResponse> {
  const [docs, setting, categories] = await Promise.all([
    DaybookEntry.find({ date: { $gte: from, $lte: to } })
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .lean<EntryDoc[]>(),
    loadSetting(),
    DaybookEntry.distinct('category') as Promise<string[]>,
  ]);

  const entries = docs.map(toEntryView);
  const totals = totalsOf(entries);

  const byDay = new Map<string, DaybookEntryView[]>();
  for (const e of entries) {
    const list = byDay.get(e.date);
    if (list) list.push(e);
    else byDay.set(e.date, [e]);
  }
  const days: DayTotal[] = [...byDay].map(([date, list]) => ({ date, ...totalsOf(list) }));

  let balance: DaybookListResponse['balance'] = null;
  if (setting && from >= setting.asOfDate) {
    const opening = toPaise(setting.openingBalance) + (await netPaiseBetween(setting.asOfDate, from));
    balance = { opening: fromPaise(opening), closing: fromPaise(opening + toPaise(totals.net)) };
  }

  return {
    from,
    to,
    today: istToday(),
    entries,
    totals,
    days,
    balance,
    setting: setting ? toSettingView(setting) : null,
    categories: categories.filter(Boolean).sort((a, b) => a.localeCompare(b)),
  };
}

export async function getEntry(id: string): Promise<DaybookEntryView> {
  const doc = await DaybookEntry.findById(id).lean<EntryDoc | null>();
  if (!doc) throw notFound('This entry no longer exists. It may have been deleted.');
  return toEntryView(doc);
}

export async function createEntry(input: EntryInput, user: UserRef): Promise<DaybookEntryView> {
  const doc = await DaybookEntry.create({ ...input, createdBy: user, updatedBy: user });
  return toEntryView(doc.toObject() as EntryDoc);
}

export async function updateEntry(id: string, input: EntryInput, user: UserRef): Promise<DaybookEntryView> {
  const doc = await DaybookEntry.findByIdAndUpdate(
    id,
    { $set: { ...input, updatedBy: user } },
    { new: true, runValidators: true }
  ).lean<EntryDoc | null>();
  if (!doc) throw notFound('This entry no longer exists. It may have been deleted.');
  return toEntryView(doc);
}

export async function deleteEntry(id: string): Promise<void> {
  const res = await DaybookEntry.deleteOne({ _id: id });
  if (res.deletedCount === 0) throw notFound('This entry no longer exists. It may have been deleted.');
}

export async function getSetting(): Promise<DaybookSettingView | null> {
  const s = await loadSetting();
  return s ? toSettingView(s) : null;
}

export async function saveSetting(
  input: { openingBalance: number; asOfDate: string },
  user: UserRef
): Promise<DaybookSettingView> {
  const doc = await DaybookSetting.findOneAndUpdate(
    { key: 'default' },
    { $set: { ...input, updatedBy: user } },
    { new: true, upsert: true, runValidators: true }
  ).lean<SettingDoc | null>();
  if (!doc) throw new Error('Opening balance upsert returned no document');
  return toSettingView(doc);
}

export async function clearSetting(): Promise<void> {
  await DaybookSetting.deleteOne({ key: 'default' });
}
