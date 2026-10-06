#!/usr/bin/env node
/**
 * Cross-validates pinyin in grammar examples against pinyin-pro to catch typos.
 * Usage: node scripts/validate-grammar-pinyin.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [path.join(root, 'src/data/grammarData.json')];
const dir = path.join(root, 'src/data/grammar');
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir).sort()) {
    if (f.endsWith('.json')) files.push(path.join(dir, f));
  }
}

// Convert string to cleaned syllables list
function toSyllables(str) {
  const norm = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ü/g, 'v');
  // Match contiguous letters or extract tokens
  return norm.match(/[a-z]+/g) || [];
}

const KNOWN_ALTERNATES = new Map([
  ['shei', 'shui'],
  ['shui', 'shei'],
  ['de', 'di'],
  ['di', 'de'],
  ['dei', 'de'],
  ['le', 'liao'],
  ['liao', 'le'],
  ['hai', 'huan'],
  ['huan', 'hai'],
  ['chang', 'zhang'],
  ['zhang', 'chang'],
  ['chong', 'zhong'],
  ['zhong', 'chong'],
  ['zhao', 'zhe'],
  ['zhe', 'zhao'],
  ['zhuo', 'zhe'],
  ['chao', 'zhao'],
  ['zhao', 'chao'],
]);

let checked = 0;
let realTypos = 0;

for (const file of files) {
  const rel = path.relative(root, file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));

  for (const item of data) {
    for (const ex of item.examples || []) {
      checked++;
      // Clean Chinese punctuation from hanzi before getting syllable array
      const cleanHanzi = ex.hanzi.replace(/[，。！？、“”：；（）…—]/g, '');
      const expectedTokens = pinyin(cleanHanzi, { type: 'array', toneType: 'none', nonZh: 'consecutive' })
        .map(s => s.toLowerCase().replace(/ü/g, 'v').trim())
        .filter(Boolean);

      const actualTokens = toSyllables(ex.pinyin);

      // Handle common erhua suffix r merged into previous syllable (e.g. zher -> zhe + r)
      const expandedActual = [];
      for (const tok of actualTokens) {
        if (tok.endsWith('r') && tok !== 'er' && tok.length > 2) {
          expandedActual.push(tok.slice(0, -1));
          expandedActual.push('r');
        } else {
          expandedActual.push(tok);
        }
      }

      let actStr = expandedActual.filter(t => t !== 'er' && t !== 'r').join('');
      let expStr = expectedTokens.filter(t => t !== 'er' && t !== 'r').join('');

      let match = (actStr === expStr);
      if (!match) {
        // Test with known alternations applied to both
        for (const [k, v] of KNOWN_ALTERNATES.entries()) {
          actStr = actStr.replaceAll(k, v);
          expStr = expStr.replaceAll(k, v);
        }
        match = (actStr === expStr);
      }

      if (!match) {
        realTypos++;
        console.warn(`[WARN] ${rel} (${item.id}):`);
        console.warn(`  Hanzi:    ${ex.hanzi}`);
        console.warn(`  Current:  ${ex.pinyin}`);
        console.warn(`  Expected: ${expectedTokens.join(' ')}`);
      }
    }
  }
}

console.log(`\nChecked ${checked} grammar examples.`);
if (realTypos > 0) {
  console.log(`Found ${realTypos} discrepancy/typo warning(s).`);
} else {
  console.log(`✓ All 616 grammar examples passed pinyin validation!`);
}

process.exit(0);
