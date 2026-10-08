import type { common as en } from '../en/common';

export const common: Partial<Record<keyof typeof en, string>> = {
  'common.search': 'Wörter suchen …',
  'common.filter': 'Filter',
  'common.all': 'Alle',
  'common.level': 'Stufe',
  'common.back': 'Zurück',
  'common.next': 'Weiter',
  'common.finish': 'Fertig',
  'common.loading': 'Wird geladen …',
  'common.practice': 'Üben',
  'common.interval.today': 'heute',
  'common.interval.days': '{days, plural, one {# Tag} other {# Tage}}',
  'common.interval.months': '{months} Mon.',
  'common.interval.short': '{days} T.',
  'common.close': 'Schließen',
  'common.cancel': 'Abbrechen',
  'common.done': 'Fertig',
};
