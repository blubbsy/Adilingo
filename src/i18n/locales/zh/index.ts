import type { MessageKey } from '../en';
import { common } from './common';
import { dashboard } from './dashboard';
import { dictionary } from './dictionary';
import { modes } from './modes';
import { settings } from './settings';
import { shell } from './shell';
import { study } from './study';

export const zh: Record<MessageKey, string> = {
  ...common,
  ...dashboard,
  ...dictionary,
  ...modes,
  ...settings,
  ...shell,
  ...study,
};
