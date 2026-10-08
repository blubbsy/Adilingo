import { Fragment, createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  FALLBACK_LANGUAGE,
  LOCALE_META,
  createT,
  formatDate,
  formatList,
  formatNumber,
  hasMessage,
  isLocaleLoaded,
  loadLocale,
  translateUnsafe,
  type MessageKey,
  type MessageVars,
  type TFunction,
  type UiLanguage,
} from './index';
import { splitRich } from './format';

/** Renderers for the `<tag>…</tag>` parts of a message. Unknown tags render as plain text. */
export type RichTags = Record<string, (text: string) => ReactNode>;

export interface I18n {
  lang: UiLanguage;
  t: TFunction;
  /** Like `t`, for messages that contain `<tag>` markup, e.g. `rich('x', { n }, { b: (s) => <b>{s}</b> })`. */
  rich: (key: MessageKey, vars: MessageVars | undefined, tags: RichTags) => ReactNode;
  /** Lookup for keys built from data ids (e.g. `badge.${id}.title`); returns `fallback` when the key does not exist. */
  tx: (key: string, fallback: string, vars?: MessageVars) => string;
  formatList: (items: string[]) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;
}

export function createI18n(lang: UiLanguage): I18n {
  const t = createT(lang);
  return {
    lang,
    t,
    rich: (key, vars, tags) =>
      splitRich(t(key, vars)).map((part, i) =>
        typeof part === 'string' ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <Fragment key={i}>{tags[part.tag] ? tags[part.tag](part.text) : part.text}</Fragment>
        ),
      ),
    tx: (key, fallback, vars) => (hasMessage(key) ? translateUnsafe(lang, key, vars) : fallback),
    formatList: (items) => formatList(lang, items),
    formatNumber: (value, options) => formatNumber(lang, value, options),
    formatDate: (value, options) => formatDate(lang, value, options),
  };
}

export const I18nContext = createContext<I18n>(createI18n(FALLBACK_LANGUAGE));

export function I18nProvider({ lang, children }: { lang: UiLanguage; children: ReactNode }) {
  const value = useMemo(() => createI18n(lang), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Translations and formatters for the current interface language. */
export function useI18n(): I18n {
  return useContext(I18nContext);
}

/**
 * Loads the strings of `wanted` and reports the language that can actually be shown. While a new language
 * loads the previous one stays on screen (no flash); `ready` turns true once it is shown, or once loading
 * failed and English is used instead.
 */
export function useLoadedLanguage(wanted: UiLanguage): { shown: UiLanguage; ready: boolean } {
  const [shown, setShown] = useState<UiLanguage>(isLocaleLoaded(wanted) ? wanted : FALLBACK_LANGUAGE);
  const [failed, setFailed] = useState<UiLanguage | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (isLocaleLoaded(wanted)) {
      setShown(wanted);
      return;
    }
    loadLocale(wanted).then((ok) => {
      if (cancelled) return;
      if (ok) setShown(wanted);
      else setFailed(wanted);
    });
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  return { shown, ready: shown === wanted || failed === wanted };
}

/** Keeps `<html lang>` and `dir` in sync so fonts, hyphenation and screen readers use the right language. */
export function useDocumentLanguage(lang: UiLanguage): void {
  useEffect(() => {
    const root = document.documentElement;
    root.lang = LOCALE_META[lang].htmlLang;
    root.dir = 'ltr';
  }, [lang]);
}
