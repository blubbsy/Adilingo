/**
 * Interface languages. Adding a language = one entry here + one folder in ./locales
 * (see docs/i18n.md). Names are written in the language itself so they stay readable
 * whatever language the interface is currently in.
 */
export const LOCALE_META = {
  en: { nativeName: 'English', htmlLang: 'en', flag: '🇬🇧' },
  zh: { nativeName: '简体中文', htmlLang: 'zh-CN', flag: '🇨🇳' },
  de: { nativeName: 'Deutsch', htmlLang: 'de', flag: '🇩🇪' },
} as const;

export type UiLanguage = keyof typeof LOCALE_META;

export const UI_LANGUAGES = Object.keys(LOCALE_META) as UiLanguage[];

/** Language used when a string is missing in the chosen language, and the only one bundled eagerly. */
export const FALLBACK_LANGUAGE: UiLanguage = 'en';

export function isUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LOCALE_META, value);
}

export type MessageVars = Record<string, string | number>;
