import type { MessageKey } from '../en';
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

export const zh: Record<MessageKey, string> = {
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
};
