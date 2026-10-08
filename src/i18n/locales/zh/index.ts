import type { MessageKey } from '../en';
import { achievements } from './achievements';
import { badges } from './badges';
import { bulk } from './bulk';
import { common } from './common';
import { dashboard } from './dashboard';
import { dictionary } from './dictionary';
import { grammar } from './grammar';
import { insights } from './insights';
import { modes } from './modes';
import { placement } from './placement';
import { recs } from './recs';
import { settings } from './settings';
import { shell } from './shell';
import { study } from './study';
import { sync } from './sync';
import { topics } from './topics';

export const zh: Record<MessageKey, string> = {
  ...achievements,
  ...badges,
  ...bulk,
  ...common,
  ...dashboard,
  ...dictionary,
  ...grammar,
  ...insights,
  ...modes,
  ...placement,
  ...recs,
  ...settings,
  ...shell,
  ...study,
  ...sync,
  ...topics,
};
