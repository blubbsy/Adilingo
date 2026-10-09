#!/usr/bin/env node
/**
 * Validates the English grammar lessons: node scripts/validate-grammar-en.mjs [level]
 * Checks every src/data/grammarEn/<level>/*.json (one lesson per file, see content/README.md §5).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'src/data/grammarEn');
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
const only = process.argv[2];
const CJK = /[㐀-鿿]/;
const wikiIds = new Set(
  [...fs.readFileSync(path.join(root, 'src/data/englishGrammarWiki.ts'), 'utf8').matchAll(/^\s{4}id: '([^']+)'/gm)].map((m) => m[1]),
);

let errors = 0;
const err = (where, msg) => {
  errors++;
  console.log(`✗ ${where}: ${msg}`);
};
const isPerm = (a, b) => a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');
const ids = new Set();

for (const [li, level] of LEVELS.entries()) {
  if (only && only !== level) continue;
  const dir = path.join(base, level);
  if (!fs.existsSync(dir)) {
    if (only) err(level, 'folder missing');
    continue;
  }
  const counts = { lessons: 0, examples: 0, exercises: 0 };
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const at = `${level}/${f}`;
    let p;
    try {
      p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch (e) {
      err(at, `invalid JSON: ${e.message}`);
      continue;
    }
    counts.lessons++;
    if (!p.id || ids.has(p.id)) err(at, 'missing or duplicate id');
    ids.add(p.id);
    if (p.cefr !== li + 1) err(at, `cefr ${p.cefr} should be ${li + 1}`);
    if (!String(p.id).startsWith(`e${li + 1}-`)) err(at, `id should start with e${li + 1}-`);
    if (p.id && `${String(p.id).slice(3)}.json` !== f) err(at, `file name should be ${String(p.id).slice(3)}.json`);
    for (const k of ['title', 'tag', 'pattern', 'summary']) if (typeof p[k] !== 'string' || !p[k]) err(at, `missing ${k}`);
    if (p.tag && p.tag.length > 12) err(at, 'tag longer than 12 characters');
    if (p.wikiId && !wikiIds.has(p.wikiId)) err(at, `unknown wikiId ${p.wikiId}`);
    if (!Array.isArray(p.explanation) || p.explanation.length < 3) err(at, 'needs ≥3 explanation paragraphs');
    else if (!p.explanation.some((x) => CJK.test(x))) err(at, 'explanation must be Chinese');
    if (!Array.isArray(p.mistakes) || p.mistakes.length < 2) err(at, 'needs ≥2 mistakes');
    for (const m of p.mistakes ?? []) if (!m.includes('✗') || !m.includes('✓')) err(at, `mistake needs ✗ and ✓: ${m.slice(0, 40)}`);
    if (!Array.isArray(p.examples) || p.examples.length < 5) err(at, `only ${p.examples?.length ?? 0} examples (need ≥5)`);
    for (const e of p.examples ?? []) {
      if (!e.text || CJK.test(e.text)) err(at, `example text must be English: ${e.text}`);
      if (!e.translation || !CJK.test(e.translation)) err(at, `example translation must be Chinese: ${e.text}`);
    }
    const types = new Set();
    const answers = [];
    (p.exercises ?? []).forEach((x, i) => {
      const w = `${at} ex${i}`;
      types.add(x.type);
      if (!x.prompt || !x.explanation) err(w, 'missing prompt/explanation');
      else if (!CJK.test(x.explanation)) err(w, 'explanation must be Chinese');
      if (['choice', 'translate', 'error'].includes(x.type)) {
        if (!Array.isArray(x.options) || x.options.length < 2 || x.options.length > 6) err(w, 'needs 2–6 options');
        if (!Number.isInteger(x.answer) || x.answer < 0 || x.answer >= (x.options?.length ?? 0)) err(w, 'answer out of range');
        if (new Set(x.options).size !== x.options?.length) err(w, 'duplicate options');
        if ((x.options ?? []).some((o) => typeof o !== 'string' || !o || CJK.test(o))) err(w, 'options must be non-empty English');
        answers.push(x.answer);
      }
      if (x.type === 'choice' && (x.sentence?.match(/___/g) ?? []).length !== 1) err(w, 'sentence needs exactly one ___');
      if (x.type === 'choice' && x.sentence && CJK.test(x.sentence)) err(w, 'sentence must be English');
      if (x.type === 'translate' && (!x.source || !CJK.test(x.source))) err(w, 'translate needs a Chinese source');
      if (x.type === 'order') {
        if (!Array.isArray(x.tokens) || x.tokens.length < 3 || x.tokens.length > 12) err(w, 'needs 3–12 tokens');
        if ((x.tokens ?? []).some((t) => CJK.test(t) || /\s/.test(t))) err(w, 'tokens must be single English words');
        for (const a of x.alternatives ?? []) if (!isPerm(a, x.tokens)) err(w, 'alternative is not a permutation of tokens');
        if (!x.translation || !CJK.test(x.translation)) err(w, 'order needs a Chinese translation');
      }
      if (!['choice', 'translate', 'error', 'order'].includes(x.type)) err(w, `unknown type ${x.type}`);
    });
    const n = p.exercises?.length ?? 0;
    if (n < 8) err(at, `only ${n} exercises (need ≥8)`);
    if (types.size < 3) err(at, 'exercises use fewer than 3 types');
    if (answers.length >= 5 && new Set(answers).size < 2) err(at, 'all answers sit at the same index');
    counts.examples += p.examples?.length ?? 0;
    counts.exercises += n;
  }
  console.log(`${level}: ${counts.lessons} lessons, ${counts.examples} examples, ${counts.exercises} exercises`);
}
console.log(errors ? `\n${errors} problem(s)` : '\nAll English grammar content valid.');
process.exit(errors ? 1 : 0);
