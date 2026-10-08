import { common } from './common';
import { dashboard } from './dashboard';
import { settings } from './settings';
import { shell } from './shell';
import { study } from './study';

export const en = {
  ...common,
  ...dashboard,
  ...settings,
  ...shell,
  ...study,
} as const;

/** Every translatable string. The English table is the source of truth; `zh` must be complete (checked by tsc). */
export type MessageKey = keyof typeof en;
