import type { MessageVars, UiLanguage } from './types';

/**
 * Message syntax (a small ICU subset):
 *   "Hello {name}"                                         variable
 *   "{count, plural, one {# card} other {# cards}}"        plural; `#` is the number, `=0 {…}` matches exactly
 * Plural categories come from Intl.PluralRules, so every language gets its own rules
 * (English one/other, German one/other, Chinese other, Russian one/few/many/other …).
 */

const pluralRules = new Map<string, Intl.PluralRules>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function rulesFor(lang: string): Intl.PluralRules {
  let r = pluralRules.get(lang);
  if (!r) {
    r = new Intl.PluralRules(lang);
    pluralRules.set(lang, r);
  }
  return r;
}

export function numberFormatFor(lang: string): Intl.NumberFormat {
  let f = numberFormats.get(lang);
  if (!f) {
    f = new Intl.NumberFormat(lang);
    numberFormats.set(lang, f);
  }
  return f;
}

/** Index of the `}` that closes the `{` at `open`, or -1. */
function closingBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

interface PluralBranches {
  [selector: string]: string;
}

function parseBranches(source: string): PluralBranches {
  const branches: PluralBranches = {};
  let i = 0;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i])) i++;
    const start = i;
    while (i < source.length && !/[\s{]/.test(source[i])) i++;
    const selector = source.slice(start, i);
    while (i < source.length && /\s/.test(source[i])) i++;
    if (!selector || source[i] !== '{') break;
    const end = closingBrace(source, i);
    if (end < 0) break;
    branches[selector] = source.slice(i + 1, end);
    i = end + 1;
  }
  return branches;
}

function renderArgument(inner: string, vars: MessageVars, lang: UiLanguage, whole: string): string {
  const comma = inner.indexOf(',');
  if (comma < 0) {
    const name = inner.trim();
    const value = vars[name];
    return value === undefined ? whole : String(value);
  }
  const name = inner.slice(0, comma).trim();
  const rest = inner.slice(comma + 1);
  const kindEnd = rest.indexOf(',');
  const kind = (kindEnd < 0 ? rest : rest.slice(0, kindEnd)).trim();
  if (kind !== 'plural' || kindEnd < 0) return whole;

  const raw = vars[name];
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (raw === undefined || Number.isNaN(n)) return whole;

  const branches = parseBranches(rest.slice(kindEnd + 1));
  const branch = branches[`=${n}`] ?? branches[rulesFor(lang).select(n)] ?? branches.other;
  if (branch === undefined) return whole;
  return render(branch, vars, lang, n);
}

function render(template: string, vars: MessageVars, lang: UiLanguage, hash?: number): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch === '{') {
      const end = closingBrace(template, i);
      if (end < 0) {
        out += template.slice(i);
        break;
      }
      out += renderArgument(template.slice(i + 1, end), vars, lang, template.slice(i, end + 1));
      i = end + 1;
    } else if (ch === '#' && hash !== undefined) {
      out += numberFormatFor(lang).format(hash);
      i++;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/** Fills `{variables}` and plural branches. Unknown variables are left in place so the gap is visible. */
export function formatMessage(template: string, vars: MessageVars | undefined, lang: UiLanguage): string {
  if (!vars || !template.includes('{')) return template;
  return render(template, vars, lang);
}

/** Names of the arguments a template uses (for placeholder-parity checks). */
export function messageArguments(template: string): string[] {
  const names = new Set<string>();
  const scan = (text: string) => {
    let i = 0;
    while (i < text.length) {
      if (text[i] === '{') {
        const end = closingBrace(text, i);
        if (end < 0) return;
        const inner = text.slice(i + 1, end);
        const comma = inner.indexOf(',');
        names.add((comma < 0 ? inner : inner.slice(0, comma)).trim());
        if (comma >= 0) {
          const rest = inner.slice(comma + 1);
          const kindEnd = rest.indexOf(',');
          if (kindEnd >= 0) for (const body of Object.values(parseBranches(rest.slice(kindEnd + 1)))) scan(body);
        }
        i = end + 1;
      } else i++;
    }
  };
  scan(template);
  return [...names].sort();
}
