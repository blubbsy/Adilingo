import { achievements } from './achievements';
import { badges } from './badges';
import { common } from './common';
import { dashboard } from './dashboard';
import { dictionary } from './dictionary';
import { insights } from './insights';
import { modes } from './modes';
import { recs } from './recs';
import { settings } from './settings';
import { shell } from './shell';
import { study } from './study';
import { topics } from './topics';

export const en = {
  ...achievements,
  ...badges,
  ...common,
  ...dashboard,
  ...dictionary,
  ...insights,
  ...modes,
  ...recs,
  ...settings,
  ...shell,
  ...study,
  ...topics,
} as const;

/** Every translatable string. The English table is the source of truth; `zh` must be complete (checked by tsc). */
export type MessageKey = keyof typeof en;
