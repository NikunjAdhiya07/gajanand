// Daybook dates are IST calendar days stored as 'YYYY-MM-DD' strings, so they
// never shift with the server or browser timezone. IST has no daylight saving.

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const utcOf = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export function isValidDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function istToday(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return new Date(utcOf(day) + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((utcOf(toDay) - utcOf(fromDay)) / DAY_MS);
}

export function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function formatDayLabel(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

export function weekdayOf(day: string): string {
  return new Date(utcOf(day)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}
