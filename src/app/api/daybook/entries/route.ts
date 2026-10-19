import { daybookRoute, readJson } from '@/lib/daybook/http';
import { createEntry } from '@/lib/daybook/service';
import { parseEntryInput } from '@/lib/daybook/validate';

export const dynamic = 'force-dynamic';

export const POST = daybookRoute(async (req, user) => {
  const input = parseEntryInput(await readJson(req));
  return { entry: await createEntry(input, user) };
});
