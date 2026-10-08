import type { MessageKey } from '../en';
import { achievements } from './achievements';
import { badges } from './badges';
import { bulk } from './bulk';
import { common } from './common';
import { courses } from './courses';
import { dashboard } from './dashboard';
import { dictionary } from './dictionary';
import { english } from './english';
import { errors } from './errors';
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

/** Machine-drafted starting point – strings missing here fall back to English. */
export const de: Partial<Record<MessageKey, string>> = {
  ...achievements,
  ...badges,
  ...bulk,
  ...common,
  ...courses,
  ...dashboard,
  ...dictionary,
  ...english,
  ...errors,
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
