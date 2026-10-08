/**
 * Pseudo-localization: turns English messages into accented, ~35 % longer, bracketed text
 * (`Save` → `[Śàvé ·····]`). It exposes layouts that cannot cope with longer or accented text, and
 * strings that are not translated at all (they stay plain English), without waiting for translators.
 * Dev only – selectable with `?lang=xa`.
 */

const ACCENTS: Record<string, string> = {
  a: 'à', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ĺ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', q: 'ɋ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẍ', y: 'ý', z: 'ž',
  A: 'Å', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ĺ', M: 'Ṁ',
  N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ɋ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẍ', Y: 'Ý', Z: 'Ž',
};

/** Parts of a message that must stay untouched: `{variables}`, plural blocks and `<tags>`. */
const PROTECTED = /(\{(?:[^{}]|\{[^{}]*\})*\}|<\/?[a-zA-Z][\w-]*>)/;

function accent(text: string): string {
  return text.replace(/[A-Za-z]/g, (ch) => ACCENTS[ch] ?? ch);
}

export function pseudoLocalize(message: string): string {
  const parts = message.split(PROTECTED);
  let letters = 0;
  const body = parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // placeholder or tag
      letters += (part.match(/[A-Za-z]/g) ?? []).length;
      return accent(part);
    })
    .join('');
  const padding = '·'.repeat(Math.ceil(letters * 0.35));
  return `[${body}${padding ? ` ${padding}` : ''}]`;
}

export function pseudoLocalizeAll<T extends Record<string, string>>(messages: T): Record<keyof T, string> {
  const out = {} as Record<keyof T, string>;
  for (const key of Object.keys(messages) as (keyof T)[]) out[key] = pseudoLocalize(messages[key]);
  return out;
}
