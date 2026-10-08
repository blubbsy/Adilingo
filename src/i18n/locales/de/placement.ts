import type { placement as en } from '../en/placement';

export const placement: Partial<Record<keyof typeof en, string>> = {
  'placement.title': 'Adaptiver Einstufungstest',
  'placement.testing': 'Getestet wird: {level}',
  'placement.question': 'Was bedeutet dieses Wort?',
  'placement.recommended': 'Empfohlen: {level}',
  'placement.basis': 'Nach deinen adaptiven Antworten beherrschst du den Wortschatz bis einschließlich {level} sicher.',
  'placement.basisBeginner': 'Nach deinen adaptiven Antworten beherrschst du den Wortschatz bis zum Anfängerniveau sicher.',
  'placement.skip.title': 'Anfängerstoff überspringen',
  'placement.skip.desc': 'Markiere alle Wörter aus {levels} als bekannt, damit deine Tagesliste direkt bei {start} beginnt.',
  'placement.markAndStart': '{levels} als bekannt markieren & starten',
  'placement.keepNew': 'Alle Karten als neu behalten',
};
