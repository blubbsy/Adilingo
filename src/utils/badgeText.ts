import type { I18n } from '../i18n/react';

type Translate = Pick<I18n, 'tx'>;

/** Localized badge texts. Badge definitions keep their English text, which is the fallback for unknown ids. */
export const badgeTitle = (i18n: Translate, badge: { id: string; title: string }): string => i18n.tx(`badge.${badge.id}.title`, badge.title);
export const badgeDescription = (i18n: Translate, badge: { id: string; description: string }): string =>
  i18n.tx(`badge.${badge.id}.desc`, badge.description);

/** Message key of a badge metric unit such as "cards in a day" or "% retention". */
export function metricUnitKey(unit: string): string {
  return 'badge.unit.' + unit.replace('%', 'pct').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export const metricUnit = (i18n: Translate, unit: string): string => i18n.tx(metricUnitKey(unit), unit);
