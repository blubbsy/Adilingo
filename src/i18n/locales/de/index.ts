import type { MessageKey } from '../en';
import { common } from './common';
import { dashboard } from './dashboard';
import { settings } from './settings';
import { shell } from './shell';
import { study } from './study';

/** Machine-drafted starting point – strings missing here fall back to English. */
export const de: Partial<Record<MessageKey, string>> = {
  ...common,
  ...dashboard,
  ...settings,
  ...shell,
  ...study,
};
