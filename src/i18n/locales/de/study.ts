import type { study as en } from '../en/study';

export const study: Partial<Record<keyof typeof en, string>> = {
  'card.flipToPinyin': 'Zeichen antippen, um Pinyin zu sehen',
  'card.flipToHanzi': 'Antippen, um zum Zeichen zurückzukehren',
  'card.peekPinyinBtn': 'Pinyin ansehen',
  'card.showHanziBtn': 'Zeichen anzeigen',
  'card.adaptiveScaffold': 'Adaptive Hilfe: {count, plural, one {# Fehler} other {# Fehler}} · Pinyin automatisch eingeblendet',
  'card.stumbledNotice': '{count}× gestolpert · Zeichen antippen für Pinyin',
  'speed.label': 'Wiedergabegeschwindigkeit',
  'speed.slow': 'Langsam wiederholen',
  'speed.slowHint': 'Gedrückt halten oder Shift+Klick: einmal langsam wiederholen',
  'speed.cycle': 'Tempo {rate}× — mit S ändern',
};
