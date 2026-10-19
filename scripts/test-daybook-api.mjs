// End-to-end test of the Day Book API against a running server.
//
//   DAYBOOK_ALLOW_WRITES=yes node scripts/test-daybook-api.mjs
//
// Writes test entries on dates in January 2000 (well away from real data),
// checks every operation against the API and directly in MongoDB, then deletes
// them and restores the opening-balance setting. Login comes from
// DAYBOOK_TEST_USERNAME / DAYBOOK_TEST_PASSWORD (or ADMIN_USERNAME / ADMIN_PASSWORD).
import mongoose from 'mongoose';
import { BASE_URL, MONGODB_URI, client, login } from './daybook-common.mjs';

if (process.env.DAYBOOK_ALLOW_WRITES !== 'yes') {
  console.error('Refusing to run: set DAYBOOK_ALLOW_WRITES=yes (writes and then removes test entries dated January 2000).');
  process.exit(1);
}

const D1 = '2000-01-10';
const D2 = '2000-01-11';
const D3 = '2000-01-12';
let failures = 0;
let passes = 0;
const check = (name, ok, detail = '') => {
  if (ok) passes++;
  else failures++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `  -> ${detail}`}`);
};

const cookie = await login();
const call = client(cookie);
await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const entriesCol = mongoose.connection.db.collection('daybookentries');
const created = [];
const originalSetting = (await call('/api/daybook/settings')).body.setting ?? null;

try {
  // Leftovers from an interrupted run would skew the totals.
  await entriesCol.deleteMany({ date: { $gte: '2000-01-01', $lte: '2000-01-31' } });

  // ---- Auth ----
  check('GET without login is 401', (await call(`/api/daybook?from=${D1}`, { auth: false })).status === 401);
  check('POST without login is 401', (await call('/api/daybook/entries', { method: 'POST', body: {}, auth: false })).status === 401);

  // ---- Validation ----
  const bad = async (name, body, field) => {
    const r = await call('/api/daybook/entries', { method: 'POST', body });
    check(`rejects ${name}`, r.status === 400 && (!field || r.body.field === field), JSON.stringify(r));
  };
  const ok = { date: D1, type: 'expense', category: 'Tea & Snacks', description: 'Samosa', amount: 30 };
  await bad('missing amount', { ...ok, amount: undefined }, 'amount');
  await bad('zero amount', { ...ok, amount: 0 }, 'amount');
  await bad('negative amount', { ...ok, amount: -5 }, 'amount');
  await bad('3 decimals', { ...ok, amount: 1.005 }, 'amount');
  await bad('text amount', { ...ok, amount: 'abc' }, 'amount');
  await bad('bad type', { ...ok, type: 'transfer' }, 'type');
  await bad('empty description', { ...ok, description: '   ' }, 'description');
  await bad('long description', { ...ok, description: 'x'.repeat(201) }, 'description');
  await bad('empty category', { ...ok, category: '' }, 'category');
  await bad('invalid date', { ...ok, date: '2000-02-30' }, 'date');
  await bad('future date', { ...ok, date: '2999-01-01' }, 'date');
  await bad('unknown field', { ...ok, status: 'x' });
  const r415 = await fetch(`${BASE_URL}/api/daybook/entries`, { method: 'POST', headers: { Cookie: cookie }, body: 'x' });
  check('non-JSON POST is 415', r415.status === 415);
  check('range over 366 days is 400', (await call('/api/daybook?from=2000-01-01&to=2001-12-31')).status === 400);
  check('to before from is 400', (await call(`/api/daybook?from=${D2}&to=${D1}`)).status === 400);
  check('bad id is 400', (await call('/api/daybook/entries/xyz')).status === 400);
  check('missing id is 404', (await call('/api/daybook/entries/0123456789abcdef01234567')).status === 404);

  // ---- Create ----
  const add = async (body) => {
    const r = await call('/api/daybook/entries', { method: 'POST', body });
    if (r.status === 201) created.push(r.body.entry._id);
    return r;
  };
  const samosa = await add(ok);
  check('create expense returns 201', samosa.status === 201, JSON.stringify(samosa.body));
  const e = samosa.body.entry ?? {};
  check('created entry has all fields', e.date === D1 && e.type === 'expense' && e.amount === 30 && e.description === 'Samosa' && e.category === 'Tea & Snacks' && !!e.createdBy);
  const tissue = await add({ date: D1, type: 'expense', category: 'Office Supplies', description: '  Tissue   papers ', amount: '50' });
  check('trims text and accepts numeric string', tissue.body.entry?.description === 'Tissue papers' && tissue.body.entry?.amount === 50);
  await add({ date: D1, type: 'income', category: 'Collection', description: 'Cash received', amount: 1000.1 });
  await add({ date: D1, type: 'income', category: 'Other Income', description: 'Paise check', amount: 0.2 });
  await add({ date: D2, type: 'expense', category: 'Travel', description: 'Auto fare', amount: 0.1 });
  await add({ date: D3, type: 'income', category: 'Interest', description: 'Interest', amount: 500 });

  // ---- Saved in DB ----
  const dbDoc = await entriesCol.findOne({ _id: new mongoose.Types.ObjectId(e._id) });
  check('entry is stored in MongoDB', dbDoc?.amount === 30 && dbDoc?.date === D1 && dbDoc?.type === 'expense' && dbDoc?.createdBy?.username);

  // ---- Fetch (simulates a page refresh) ----
  const day1 = (await call(`/api/daybook?from=${D1}`)).body;
  check('day view lists 4 entries in entry order', day1.entries?.length === 4 && day1.entries[0].description === 'Samosa', JSON.stringify(day1.entries?.map((x) => x.description)));
  check('day totals are exact (no float drift)', day1.totals?.income === 1000.3 && day1.totals?.expense === 80 && day1.totals?.net === 920.3, JSON.stringify(day1.totals));
  const span = (await call(`/api/daybook?from=${D1}&to=${D3}`)).body;
  check('range lists 6 entries', span.entries?.length === 6);
  check('range day totals', JSON.stringify(span.days?.map((d) => [d.date, d.net])) === JSON.stringify([[D1, 920.3], [D2, -0.1], [D3, 500]]), JSON.stringify(span.days));
  check('categories include used ones', span.categories?.includes('Tea & Snacks') && span.categories?.includes('Travel'));

  // ---- Update ----
  const upd = await call(`/api/daybook/entries/${e._id}`, { method: 'PUT', body: { ...ok, amount: 35, description: 'Samosa x7' } });
  check('update returns new values', upd.status === 200 && upd.body.entry?.amount === 35 && upd.body.entry?.description === 'Samosa x7');
  check('update is stored in MongoDB', (await entriesCol.findOne({ _id: new mongoose.Types.ObjectId(e._id) }))?.amount === 35);
  const moved = await call(`/api/daybook/entries/${e._id}`, { method: 'PUT', body: { ...ok, amount: 35, date: D2 } });
  check('moving an entry to another date', moved.body.entry?.date === D2 && (await call(`/api/daybook?from=${D1}`)).body.entries.length === 3);
  check('update with invalid data is 400', (await call(`/api/daybook/entries/${e._id}`, { method: 'PUT', body: { ...ok, amount: -1 } })).status === 400);

  // ---- Opening balance (optional) ----
  await call('/api/daybook/settings', { method: 'DELETE' });
  check('no balance without a setting', (await call(`/api/daybook?from=${D2}`)).body.balance === null);
  const set = await call('/api/daybook/settings', { method: 'PUT', body: { openingBalance: 100, asOfDate: D1 } });
  check('save opening balance', set.status === 200 && set.body.setting?.openingBalance === 100);
  // D1 now: income 1000.3, expense 50 -> net 950.3. D2: expense 35 + 0.1.
  const b1 = (await call(`/api/daybook?from=${D1}`)).body.balance;
  check('opening/closing on start day', b1?.opening === 100 && b1?.closing === 1050.3, JSON.stringify(b1));
  const b2 = (await call(`/api/daybook?from=${D2}`)).body.balance;
  check('next day opens at previous closing', b2?.opening === 1050.3 && b2?.closing === 1015.2, JSON.stringify(b2));
  check('no balance before the start date', (await call('/api/daybook?from=2000-01-09')).body.balance === null);
  check('invalid opening balance is 400', (await call('/api/daybook/settings', { method: 'PUT', body: { openingBalance: 'x', asOfDate: D1 } })).status === 400);

  // ---- Delete ----
  const del = await call(`/api/daybook/entries/${e._id}`, { method: 'DELETE' });
  check('delete returns 200', del.status === 200);
  check('deleted entry is gone from MongoDB', (await entriesCol.countDocuments({ _id: new mongoose.Types.ObjectId(e._id) })) === 0);
  check('deleting again is 404', (await call(`/api/daybook/entries/${e._id}`, { method: 'DELETE' })).status === 404);
  check('editing a deleted entry is 404', (await call(`/api/daybook/entries/${e._id}`, { method: 'PUT', body: ok })).status === 404);
  check('totals update after delete', (await call(`/api/daybook?from=${D2}`)).body.totals?.expense === 0.1);
} finally {
  for (const id of created) await call(`/api/daybook/entries/${id}`, { method: 'DELETE' });
  await entriesCol.deleteMany({ date: { $gte: '2000-01-01', $lte: '2000-01-31' } });
  if (originalSetting) {
    await call('/api/daybook/settings', { method: 'PUT', body: { openingBalance: originalSetting.openingBalance, asOfDate: originalSetting.asOfDate } });
  } else {
    await call('/api/daybook/settings', { method: 'DELETE' });
  }
  await mongoose.disconnect();
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
