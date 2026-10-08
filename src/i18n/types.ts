/**
 * Interface languages. Adding a language = one entry here + one folder in ./locales
 * (see docs/i18n.md). Names are written in the language itself so they stay readable
 * whatever language the interface is currently in.
 */
export const LOCALE_META = {
  en: { nativeName: 'English', htmlLang: 'en', flag: '🇬🇧', pseudo: false },
  zh: { nativeName: '简体中文', htmlLang: 'zh-CN', flag: '🇨🇳', pseudo: false },
  de: { nativeName: 'Deutsch', htmlLang: 'de', flag: '🇩🇪', pseudo: false },
  /** Layout stress test (accented, ~35 % longer, bracketed English). Development builds only. */
  xa: { nativeName: 'Pseudo (dev)', htmlLang: 'en-XA', flag: '🧪', pseudo: true },
} as const;

export type UiLanguage = keyof typeof LOCALE_META;

/** Languages the learner can choose from; the pseudo-locale is offered in development builds only. */
export const UI_LANGUAGES = (Object.keys(LOCALE_META) as UiLanguage[]).filter(
  (lang) => !LOCALE_META[lang].pseudo || Boolean(import.meta.env?.DEV),
);

/** Language used when a string is missing in the chosen language, and the only one bundled eagerly. */
export const FALLBACK_LANGUAGE: UiLanguage = 'en';

export function isUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === 'string' && (UI_LANGUAGES as readonly string[]).includes(value);
}

export type MessageVars = Record<string, string | number>;
