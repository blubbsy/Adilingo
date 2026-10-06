#!/usr/bin/env node
/**
 * Validates grammar content: node scripts/validate-grammar.mjs
 * Checks src/data/grammarData.json and every src/data/grammar/*.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [path.join(root, 'src/data/grammarData.json')];
const dir = path.join(root, 'src/data/grammar');
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.json')) files.push(path.join(dir, f));

const ids = new Set();
let errors = 0;
const err = (where, msg) => {
  errors++;
  console.log(`✗ ${where}: ${msg}`);
};
const isPerm = (a, b) => a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');

for (const file of files) {
  const name = path.relative(root, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    err(name, `invalid JSON: ${e.message}`);
    continue;
  }
  if (!Array.isArray(data)) {
    err(name, 'not an array');
    continue;
  }
  const fileLevel = Number(name.match(/hsk(\d)\.json$/)?.[1]) || null;
  const counts = { examples: 0, exercises: 0 };
  for (const p of data) {
    const at = `${name} ${p.id}`;
    if (!p.id || ids.has(p.id)) err(at, 'missing or duplicate id');
    ids.add(p.id);
    if (fileLevel && p.hskLevel !== fileLevel) err(at, `hskLevel ${p.hskLevel} ≠ file level ${fileLevel}`);
    if (fileLevel && !p.id.startsWith(`g${fileLevel}-`)) err(at, `id should start with g${fileLevel}-`);
    for (const k of ['title', 'pattern', 'summary']) if (typeof p[k] !== 'string' || !p[k]) err(at, `missing ${k}`);
    if (!Array.isArray(p.explanation) || !p.explanation.length) err(at, 'missing explanation');
    if (!Array.isArray(p.examples) || p.examples.length < 3) err(at, `only ${p.examples?.length ?? 0} examples`);
    for (const e of p.examples ?? []) if (!e.hanzi || !e.pinyin || !e.english) err(at, 'incomplete example');
    const types = new Set();
    (p.exercises ?? []).forEach((x, i) => {
      const w = `${at} ex${i}`;
      types.add(x.type);
      if (!x.prompt || !x.explanation) err(w, 'missing prompt/explanation');
      if (['choice', 'translate', 'error'].includes(x.type)) {
        if (!Array.isArray(x.options) || x.options.length < 2 || x.options.length > 9) err(w, 'needs 2–9 options');
        if (!Number.isInteger(x.answer) || x.answer < 0 || x.answer >= (x.options?.length ?? 0)) err(w, 'answer out of range');
        if (new Set(x.options).size !== x.options?.length) err(w, 'duplicate options');
      }
      if (x.type === 'choice' && (x.sentence?.match(/___/g) ?? []).length !== 1) err(w, 'sentence needs exactly one ___');
      if (x.type === 'translate' && !x.english) err(w, 'missing english');
      if (x.type === 'order') {
        if (!Array.isArray(x.tokens) || x.tokens.length < 2 || x.tokens.length > 12) err(w, 'needs 2–12 tokens');
        for (const a of x.alternatives ?? []) if (!isPerm(a, x.tokens)) err(w, 'alternative is not a permutation of tokens');
      }
      if (!['choice', 'translate', 'error', 'order'].includes(x.type)) err(w, `unknown type ${x.type}`);
    });
    if ((p.exercises?.length ?? 0) < 3) err(at, `only ${p.exercises?.length ?? 0} exercises`);
    if (types.size < 2) err(at, 'exercises use fewer than 2 types');
    counts.examples += p.examples?.length ?? 0;
    counts.exercises += p.exercises?.length ?? 0;
  }
  console.log(`${name}: ${data.length} points, ${counts.examples} examples, ${counts.exercises} exercises`);
}
console.log(errors ? `\n${errors} problem(s)` : '\nAll grammar content valid.');
process.exit(errors ? 1 : 0);
