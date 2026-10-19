import { daybookRoute, readJson } from '@/lib/daybook/http';
import { deleteEntry, getEntry, updateEntry } from '@/lib/daybook/service';
import { parseEntryInput, requireObjectId } from '@/lib/daybook/validate';

export const dynamic = 'force-dynamic';

type Params = { id: string };

export const GET = daybookRoute<Params>(async (_req, _user, { id }) => ({
  entry: await getEntry(requireObjectId(id)),
}));

export const PUT = daybookRoute<Params>(async (req, user, { id }) => {
  const entryId = requireObjectId(id);
  const input = parseEntryInput(await readJson(req));
  return { entry: await updateEntry(entryId, input, user) };
});

export const DELETE = daybookRoute<Params>(async (_req, _user, { id }) => {
  await deleteEntry(requireObjectId(id));
  return { ok: true };
});
