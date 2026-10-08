import type { bulk as en } from '../en/bulk';

export const bulk: Partial<Record<keyof typeof en, string>> = {
  'bulk.title.english': 'Bekannte Stufen markieren',
  'bulk.title.chinese': 'Das kann ich schon',
  'bulk.desc.english': 'Schon fit in Englisch? Markiere abgeschlossene CEFR-Stufen als bekannt, um den Anfängerwortschatz zu überspringen und direkt mit Mittelstufen-Wörtern zu beginnen.',
  'bulk.desc.chinese': 'Du lernst schon Chinesisch? Markiere abgeschlossene Stufen als bekannt, um den Anfängerwortschatz zu überspringen und direkt mit Mittelstufen-Wörtern zu beginnen.',
  'bulk.markedKnown': 'Als bekannt markiert',
  'bulk.markKnown': 'Als bekannt markieren',
};
