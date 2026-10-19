import { Types } from 'mongoose';
import { badRequest } from './errors';
import { addDays, daysBetween, isValidDay, istToday } from './istDate';
import { hasAtMostTwoDecimals } from './money';
import type { EntryInput, EntryType } from './types';

const MAX_AMOUNT = 1_000_000_000;
export const MAX_RANGE_DAYS = 366;
const ENTRY_FIELDS = new Set(['date', 'type', 'category', 'description', 'amount']);

export function requireDay(value: unknown, field = 'date'): string {
  if (!isValidDay(value)) throw badRequest('Enter a valid date', field);
  return value;
}

function requireAmount(value: unknown, field: string, allowZeroOrNegative = false): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw badRequest('Enter a valid amount', field);
  if (!allowZeroOrNegative && n <= 0) throw badRequest('Amount must be greater than zero', field);
  if (Math.abs(n) > MAX_AMOUNT) throw badRequest('Amount is too large', field);
  if (!hasAtMostTwoDecimals(n)) throw badRequest('Amount can have at most 2 decimal places', field);
  return Math.round(n * 100) / 100;
}

function requireText(value: unknown, field: string, label: string, max: number): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!text) throw badRequest(`${label} is required`, field);
  if (text.length > max) throw badRequest(`${label} can be at most ${max} characters`, field);
  return text;
}

export function parseEntryInput(body: Record<string, unknown>): EntryInput {
  const unknown = Object.keys(body).filter((k) => !ENTRY_FIELDS.has(k));
  if (unknown.length) throw badRequest(`Unknown field: ${unknown.join(', ')}`);

  const date = requireDay(body.date);
  if (date > istToday()) throw badRequest('Date cannot be in the future', 'date');

  const type = body.type;
  if (type !== 'income' && type !== 'expense') throw badRequest('Choose Income or Expense', 'type');

  return {
    date,
    type: type as EntryType,
    amount: requireAmount(body.amount, 'amount'),
    description: requireText(body.description, 'description', 'Description', 200),
    category: requireText(body.category, 'category', 'Category', 50),
  };
}

export function parseSettingInput(body: Record<string, unknown>) {
  return {
    openingBalance: requireAmount(body.openingBalance, 'openingBalance', true),
    asOfDate: requireDay(body.asOfDate, 'asOfDate'),
  };
}

export function parseRange(params: URLSearchParams): { from: string; to: string } {
  const today = istToday();
  const from = requireDay(params.get('from') ?? today, 'from');
  const to = requireDay(params.get('to') ?? from, 'to');
  if (to < from) throw badRequest('"To" date must be on or after "From" date', 'to');
  if (daysBetween(from, to) >= MAX_RANGE_DAYS) {
    throw badRequest(`Choose a range of at most ${MAX_RANGE_DAYS} days (up to ${addDays(from, MAX_RANGE_DAYS - 1)})`, 'to');
  }
  return { from, to };
}

export function requireObjectId(value: unknown): string {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) throw badRequest('Invalid entry id');
  return value;
}
