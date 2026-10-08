import type { MessageKey } from '../en';
import { common } from './common';
import { dashboard } from './dashboard';
import { settings } from './settings';
import { shell } from './shell';
import { study } from './study';

export const zh: Record<MessageKey, string> = {
  ...common,
  ...dashboard,
  ...settings,
  ...shell,
  ...study,
};
