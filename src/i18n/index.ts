import { en, type MessageKey } from './locales/en';
import { formatMessage, numberFormatFor } from './format';
import { FALLBACK_LANGUAGE, LOCALE_META, isUiLanguage, type MessageVars, type UiLanguage } from './types';

export { LOCALE_META, UI_LANGUAGES, FALLBACK_LANGUAGE, isUiLanguage, type UiLanguage, type MessageVars } from './types';
export type { MessageKey } from './locales/en';
export { formatMessage, messageArguments } from './format';

type Messages = Partial<Record<MessageKey, string>>;

/** English is bundled; other languages are separate chunks fetched on demand (and cached offline by the service worker). */
const loaded: Partial<Record<UiLanguage, Messages>> = { en };
const inFlight = new Map<UiLanguage, Promise<boolean>>();
const loaders: Record<UiLanguage, () => Promise<Messages>> = {
  en: async () => en,
  zh: () => import('./locales/zh').then((m) => m.zh),
  de: () => import('./locales/de').then((m) => m.de),
};

export function isLocaleLoaded(lang: UiLanguage): boolean {
  return loaded[lang] !== undefined;
}

/** Loads a language's strings. Resolves false (after logging) when the chunk cannot be fetched; the UI then stays in English. */
export function loadLocale(lang: UiLanguage): Promise<boolean> {
  if (isLocaleLoaded(lang)) return Promise.resolve(true);
  let pending = inFlight.get(lang);
  if (!pending) {
    pending = loaders[lang]()
      .then((messages) => {
        loaded[lang] = messages;
        return true;
      })
      .catch((err: unknown) => {
        console.error(`[i18n] Could not load the "${lang}" language pack – falling back to English.`, err);
        return false;
      })
      .finally(() => inFlight.delete(lang));
    inFlight.set(lang, pending);
  }
  return pending;
}

const warned = new Set<string>();
function warnOnce(message: string) {
  if (!import.meta.env?.DEV || warned.has(message)) return;
  warned.add(message);
  console.warn(`[i18n] ${message}`);
}

export type TFunction = (key: MessageKey, vars?: MessageVars) => string;

/** Looks a string up with the fallback chain `lang → English`. A key missing even in English is a bug: warn and show the key. */
export function translateUnsafe(lang: UiLanguage, key: string, vars?: MessageVars): string {
  if (!loaded[lang]) warnOnce(`"${lang}" strings were used before the language pack finished loading (showing English). Await loadLocale("${lang}") first.`);
  const own = loaded[lang]?.[key as MessageKey];
  const template = own ?? (en as Record<string, string>)[key];
  if (template === undefined) {
    warnOnce(`Missing translation key "${key}"`);
    return key;
  }
  return formatMessage(template, vars, own !== undefined ? lang : FALLBACK_LANGUAGE);
}

/** Type-checked lookup: a typo in `key` fails `tsc`. */
export function translate(lang: UiLanguage, key: MessageKey, vars?: MessageVars): string {
  return translateUnsafe(lang, key, vars);
}

/** A translate function bound to one language (what components receive from `useI18n`). */
export function createT(lang: UiLanguage): TFunction {
  return (key, vars) => translateUnsafe(lang, key, vars);
}

/** @deprecated Use `useI18n().t(key, vars)` in components; kept for call sites that still pass the language explicitly. */
export function t(key: MessageKey, lang: UiLanguage = 'en', vars?: MessageVars): string {
  return translateUnsafe(lang, key, vars);
}

// ---------- language selection ----------

/** Supported UI language for a BCP-47 tag list (`['de-AT', 'en']` → `'de'`). */
export function matchUiLanguage(tags: readonly string[] | undefined): UiLanguage | undefined {
  for (const tag of tags ?? []) {
    const primary = tag.toLowerCase().split('-')[0];
    if (isUiLanguage(primary)) return primary;
  }
  return undefined;
}

/**
 * First-run language: the browser's own language when it is a supported non-English one. English browsers
 * return undefined so the course default applies (the English course is built for Chinese speakers).
 */
export function detectUiLanguage(
  tags: readonly string[] | null = typeof navigator === 'undefined' ? null : navigator.languages,
): UiLanguage | undefined {
  const match = matchUiLanguage(tags ?? undefined);
  return match && match !== 'en' ? match : undefined;
}

// ---------- formatting ----------

export function formatNumber(lang: UiLanguage, value: number, options?: Intl.NumberFormatOptions): string {
  return options ? new Intl.NumberFormat(lang, options).format(value) : numberFormatFor(lang).format(value);
}

export function formatDate(lang: UiLanguage, value: Date | number, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(LOCALE_META[lang].htmlLang, options).format(value);
}
