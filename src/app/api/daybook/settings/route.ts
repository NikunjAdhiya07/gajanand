import { daybookRoute, readJson } from '@/lib/daybook/http';
import { clearSetting, getSetting, saveSetting } from '@/lib/daybook/service';
import { parseSettingInput } from '@/lib/daybook/validate';

export const dynamic = 'force-dynamic';

export const GET = daybookRoute(async () => ({ setting: await getSetting() }));

export const PUT = daybookRoute(async (req, user) => ({
  setting: await saveSetting(parseSettingInput(await readJson(req)), user),
}));

export const DELETE = daybookRoute(async () => {
  await clearSetting();
  return { setting: null };
});
