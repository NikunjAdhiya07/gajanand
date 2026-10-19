// Shared helpers for the Daybook scripts. Reads .env.local from the project root.
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env.local') });

export const MONGODB_URI = process.env.MONGODB_URI?.replace(/["']/g, '');
export const BASE_URL = (process.env.DAYBOOK_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

export const hasFlag = (name) => process.argv.includes(`--${name}`);

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86400000;

export const istToday = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
export const istDayStart = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
};
export const addDays = (day, n) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
};
export const paise = (n) => Math.round((Number(n) || 0) * 100);

export async function login() {
  const username = process.env.DAYBOOK_TEST_USERNAME || process.env.ADMIN_USERNAME || 'Admin';
  const password = process.env.DAYBOOK_TEST_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('Set DAYBOOK_TEST_PASSWORD or ADMIN_PASSWORD in .env.local');
  const res = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}) at ${BASE_URL}`);
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Login returned no cookie');
  return cookie;
}

export function client(cookie) {
  return async function call(path, { method = 'GET', body, auth = true } = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && cookie ? { Cookie: cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json };
  };
}
