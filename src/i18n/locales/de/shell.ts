import type { shell as en } from '../en/shell';

export const shell: Partial<Record<keyof typeof en, string>> = {
  'nav.dashboard': 'Übersicht',
  'nav.learn': 'Lernpfade & Grammatik',
  'nav.topics': 'Themen-Training',
  'nav.dictionary': 'Wörterbuch',
  'nav.insights': 'Statistik',
  'nav.badges': 'Abzeichen',
  'nav.settings': 'Einstellungen',
  'nav.irregular': 'Unregelmäßige Verben',
  'nav.grammar': 'Grammatik-Wiki',
  'header.course': 'Kurs',
  'header.course.chinese': 'Chinesisch (HSK)',
  'header.course.english': 'Englisch (CEFR/CET)',
  'header.lang': 'Sprache',
  'header.sync': 'Sync',
};
