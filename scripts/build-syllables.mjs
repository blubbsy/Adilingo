#!/usr/bin/env node
/**
 * Builds src/foundations/data/syllables.json: every toneless Mandarin pinyin syllable that pinyin-pro knows for
 * any CJK character (about 400). The "is this a valid syllable?" quiz uses it as ground truth.
 *   node scripts/build-syllables.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const set = new Set();
for (let cp = 0x4e00; cp <= 0x9fff; cp++) {
  const ch = String.fromCodePoint(cp);
  const py = pinyin(ch, { toneType: 'none', type: 'array', multiple: true });
  for (const s of py.join(' ').split(/\s+/)) {
    const syl = s.replace(/v/g, 'ü').toLowerCase();
    if (/^[a-zü]+$/.test(syl)) set.add(syl);
  }
}
const list = [...set].sort();
const out = path.join(root, 'src/foundations/data/syllables.json');
fs.writeFileSync(out, JSON.stringify(list) + '\n');
console.log(`${list.length} syllables`);
console.log(list.filter((s) => s.length > 6 || /^(ng|hm|m|n|ê|o|e|a)$/.test(s)).join(' '));
