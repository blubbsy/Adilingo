#!/usr/bin/env node
/**
 * Builds the bundled HSK vocabulary + example sentences.
 *
 *   node scripts/build-vocab.mjs
 *
 * Sources (downloaded into scripts/.cache on first run):
 *   - complete-hsk-vocabulary (MIT) — HSK 2.0, HSK 3.0 (2021) and HSK 3.0 (2026) word lists,
 *     pinyin, CC-CEDICT meanings, radicals, classifiers, frequency.
 *   - Tatoeba (CC-BY 2.0 FR) — Mandarin sentences with English translations.
 *
 * Outputs:
 *   src/data/hsk/words.json     compact word records (see WordRecord in src/data/vocab.ts)
 *   src/data/hsk/examples.json  [hanzi, pinyin, english, tatoebaId][]
 *   src/data/legacyIds.json     old curated id → new id (for the schema v2 migration)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Bunzip from 'seek-bzip';
import { pinyin as pinyinPro } from 'pinyin-pro';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'scripts', '.cache');
const outDir = path.join(root, 'src', 'data', 'hsk');
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const SOURCES = {
  'complete.min.json': 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.min.json',
  'cmn_sentences.tsv': 'https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2',
  'cmn-eng_links.tsv': 'https://downloads.tatoeba.org/exports/per_language/cmn/cmn-eng_links.tsv.bz2',
  'eng_sentences.tsv': 'https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2',
  'cmn_transcriptions.tsv': 'https://downloads.tatoeba.org/exports/per_language/cmn/cmn_transcriptions.tsv.bz2',
};

async function ensure(name) {
  const file = path.join(cache, name);
  if (fs.existsSync(file)) return file;
  const url = SOURCES[name];
  console.log(`↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  let buf = Buffer.from(await res.arrayBuffer());
  if (url.endsWith('.bz2')) buf = Bunzip.decode(buf);
  fs.writeFileSync(file, buf);
  return file;
}

const readLines = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);

// ---------- pinyin helpers (mirrors src/utils/pinyinHelper.ts) ----------

const MARKS = { a: 'aāáǎà', e: 'eēéěè', i: 'iīíǐì', o: 'oōóǒò', u: 'uūúǔù', ü: 'üǖǘǚǜ', A: 'AĀÁǍÀ', E: 'EĒÉĚÈ', I: 'IĪÍǏÌ', O: 'OŌÓǑÒ', U: 'UŪÚǓÙ', Ü: 'ÜǕǗǙǛ' };
const fixU = (s) => s.replace(/u:/g, 'ü').replace(/U:/g, 'Ü').replace(/v/g, 'ü').replace(/V/g, 'Ü');
function markSyllable(raw) {
  const m = raw.match(/^([a-zA-ZüÜ:]+)([0-5])?$/);
  if (!m) return raw;
  const s = fixU(m[1]);
  const tone = Number(m[2] ?? 5);
  if (tone < 1 || tone > 4) return s;
  const lower = s.toLowerCase();
  let idx = lower.indexOf('a');
  if (idx < 0) idx = lower.indexOf('e');
  if (idx < 0 && lower.includes('ou')) idx = lower.indexOf('o');
  if (idx < 0) for (let i = lower.length - 1; i >= 0; i--) if ('aeiouü'.includes(lower[i])) { idx = i; break; }
  if (idx < 0) return s;
  return s.slice(0, idx) + MARKS[s[idx]][tone] + s.slice(idx + 1);
}
const TONE_OF = { '\u0304': 1, '\u0301': 2, '\u030C': 3, '\u0300': 4 };
/** "xiè" → "xie4", "le" → "le5" */
function markedToNumbered(syl) {
  let tone = 5;
  const base = [...syl.normalize('NFD')]
    .filter((c) => {
      if (TONE_OF[c]) { tone = TONE_OF[c]; return false; }
      return true;
    })
    .join('')
    .normalize('NFC')
    .replace(/ü/g, 'v');
  return base + tone;
}
const validNumbered = (n) => /^([a-zA-Z:]+[1-5] ?)+$/.test(n.trim());

// ---------- vocabulary ----------

const POS_TOPIC = [
  [/^(nr)$/, 'Names'],
  [/^(ns)$/, 'Places'],
  [/^(nt|nz|nx)$/, 'Proper nouns'],
  [/^(t|tg)$/, 'Time'],
  [/^(m|mg|mq)$/, 'Numbers'],
  [/^q$/, 'Measure words'],
  [/^(r|rg)$/, 'Pronouns'],
  [/^(n|ng|an|vn)$/, 'Nouns'],
  [/^(v|vd|vg)$/, 'Verbs'],
  [/^(a|ad|ag|b|z)$/, 'Adjectives'],
  [/^(d|dg)$/, 'Adverbs'],
  [/^(i|l|j)$/, 'Idioms & phrases'],
  [/^(s|f)$/, 'Location'],
  [/^(p|c|u|y|e|o|k|h|w|x|g)$/, 'Function words'],
];
function topicsFor(pos) {
  const out = [];
  for (const p of pos) {
    const hit = POS_TOPIC.find(([re]) => re.test(p));
    if (hit && !out.includes(hit[1])) out.push(hit[1]);
  }
  return out.length ? out.slice(0, 2) : ['Other'];
}

function cleanMeanings(list) {
  const out = [];
  for (const m of list) {
    for (let part of m.split(';')) {
      part = part.trim();
      if (!part) continue;
      if (/^(old |unofficial |archaic )?variant of/i.test(part) || /^surname /i.test(part) || /^also (written|pr\.)/i.test(part)) continue;
      if (/^CL:/.test(part)) continue;
      // Purely parenthetical glosses like "(completed action marker)" must stay answerable.
      if (/^\(.*\)$/.test(part)) part = part.slice(1, -1);
      if (part.length > 60) continue;
      if (!out.some((o) => o.toLowerCase() === part.toLowerCase())) out.push(part);
    }
  }
  return out.slice(0, 6);
}

function levelsOf(codes) {
  const lv = {};
  for (const c of codes) {
    const key = { t: 'hsk3_2026', n: 'hsk3_2021', o: 'hsk2' }[c[0]];
    const n = Number(c.slice(1));
    if (key && n >= 1 && n <= 7 && (!lv[key] || n < lv[key])) lv[key] = n;
  }
  return lv;
}

/** Main reading of common polyphonic characters (the one taught as the HSK headword). */
const PRIMARY_READING = {
  行: 'xing2', 长: 'chang2', 得: 'de5', 还: 'hai2', 都: 'dou1', 了: 'le5', 着: 'zhe5', 重: 'zhong4', 为: 'wei4',
  好: 'hao3', 要: 'yao4', 便: 'bian4', 少: 'shao3', 种: 'zhong3', 差: 'cha4', 教: 'jiao1', 数: 'shu4', 相: 'xiang1',
  只: 'zhi3', 正: 'zheng4', 发: 'fa1', 干: 'gan4', 空: 'kong1', 乐: 'le4', 调: 'diao4', 量: 'liang4', 和: 'he2',
  中: 'zhong1', 大: 'da4', 会: 'hui4', 看: 'kan4', 当: 'dang1', 处: 'chu4', 背: 'bei4', 倒: 'dao4', 假: 'jia3',
  难: 'nan2', 将: 'jiang1', 应: 'ying1', 省: 'sheng3', 结: 'jie2', 转: 'zhuan3', 传: 'chuan2', 参: 'can1', 角: 'jiao3',
  降: 'jiang4', 刻: 'ke4', 觉: 'jue2', 地: 'di4', 的: 'de5', 没: 'mei2', 给: 'gei3', 过: 'guo4', 分: 'fen1', 舍: 'she3',
};

const raw = JSON.parse(fs.readFileSync(await ensure('complete.min.json'), 'utf8'));
const curated = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'vocabData.json'), 'utf8'));

const words = [];
const byHanzi = new Map();
const polyphonic = new Set();
for (const w of raw) {
  // Prefer a common-noun/verb reading over a surname-only or capitalised (proper-name) form.
  const usable = w.f.filter((f) => cleanMeanings(f.m).length);
  const primary = PRIMARY_READING[w.s];
  const form =
    (primary && usable.find((f) => f.i.n.toLowerCase() === primary)) ?? usable.find((f) => !/^[A-Z]/.test(f.i.n)) ?? usable[0];
  if (!form) continue;
  let numbered = form.i.n.trim();
  if (!validNumbered(numbered)) {
    numbered = pinyinPro(w.s, { toneType: 'num', type: 'array', toneSandhi: false })
      .map((s) => s.replace(/0$/, '5'))
      .join(' ');
  }
  // Re-derive tone marks from the numbered form so syllables always align 1:1.
  const syllables = numbered.split(/\s+/);
  const pinyin = syllables.map(markSyllable).join(' ');
  const english = cleanMeanings(form.m);
  if (!english.length) continue;
  const levels = levelsOf(w.l);
  if (!Object.keys(levels).length) continue;
  if (new Set(usable.map((f) => f.i.n.toLowerCase())).size > 1) polyphonic.add(w.s);
  const id = `${w.s}|${syllables.join('').toLowerCase()}`;
  if (byHanzi.has(w.s)) {
    // Same spelling listed twice: keep the first entry but merge its levels.
    const prev = byHanzi.get(w.s);
    for (const [k, v] of Object.entries(levels)) if (!prev.l[k] || v < prev.l[k]) prev.l[k] = v;
    continue;
  }
  const rec = {
    i: id,
    h: w.s,
    p: pinyin,
    n: syllables.join(' '),
    e: english,
    l: levels,
    t: topicsFor(w.p ?? []),
    ...(form.c?.length ? { m: form.c[0] } : {}),
    ...(w.r ? { r: w.r } : {}),
    q: w.q ?? 999999,
  };
  words.push(rec);
  byHanzi.set(w.s, rec);
}

// Merge the hand-curated starter set (richer meanings, topics, examples, measure-word pinyin).
const legacyIds = {};
const curatedExamples = new Map();
for (const c of curated) {
  let rec = byHanzi.get(c.hanzi);
  if (!rec) {
    // Not an official list entry (e.g. 你好): add it from the curated data.
    const syl = c.pinyinNumbered.split(' ');
    rec = { i: `${c.hanzi}|${syl.join('').toLowerCase()}`, h: c.hanzi, p: syl.map(markSyllable).join(' '), n: c.pinyinNumbered, e: [], l: { hsk3_2026: c.hskLevel, hsk3_2021: c.hskLevel, hsk2: c.hskLevel }, t: [], q: 0 };
    words.push(rec);
    byHanzi.set(c.hanzi, rec);
    console.log(`added curated word ${c.hanzi}`);
  }
  legacyIds[c.id] = rec.i;
  rec.e = [...c.english, ...rec.e.filter((e) => !c.english.some((x) => x.toLowerCase() === e.toLowerCase()))].slice(0, 6);
  rec.t = [...new Set([...c.topics, ...rec.t])];
  if (c.radical) rec.r = c.radical;
  if (c.measureWord) rec.m = c.measureWord.hanzi;
  rec.c = 1; // curated flag: introduced first within its level
  if (c.exampleSentence) curatedExamples.set(rec.i, c.exampleSentence);
}

// Measure-word pinyin lookup.
const mwPinyin = {};
for (const rec of words) if (rec.m && byHanzi.get(rec.m)) mwPinyin[rec.m] = byHanzi.get(rec.m).p;

// ---------- sentences ----------

console.log('Reading Tatoeba…');
const zh = new Map();
for (const line of readLines(await ensure('cmn_sentences.tsv'))) {
  const [id, , text] = line.split('\t');
  zh.set(id, text);
}
// Prefer the simplified-script rendering when the original is traditional.
for (const line of readLines(await ensure('cmn_transcriptions.tsv'))) {
  const [id, , script, , text] = line.split('\t');
  if (script === 'Hans' && zh.has(id)) zh.set(id, text);
}
const zhToEn = new Map();
for (const line of readLines(await ensure('cmn-eng_links.tsv'))) {
  const [a, b] = line.split('\t');
  if (!zhToEn.has(a)) zhToEn.set(a, b);
}
const needEn = new Set(zhToEn.values());
const en = new Map();
for (const line of readLines(await ensure('eng_sentences.tsv'))) {
  const t1 = line.indexOf('\t');
  const id = line.slice(0, t1);
  if (needEn.has(id)) en.set(id, line.slice(line.indexOf('\t', t1 + 1) + 1));
}

const HAN = /\p{Script=Han}/u;
const hanChars = new Set(words.flatMap((w) => [...w.h]));
const maxLen = Math.max(...words.map((w) => [...w.h].length));

/** Greedy longest-match segmentation over the HSK dictionary. */
function segment(text) {
  const chars = [...text];
  const out = [];
  let i = 0;
  while (i < chars.length) {
    if (!HAN.test(chars[i])) {
      out.push(chars[i]);
      i++;
      continue;
    }
    let len = Math.min(maxLen, chars.length - i);
    for (; len > 1; len--) if (byHanzi.has(chars.slice(i, i + len).join(''))) break;
    out.push(chars.slice(i, i + len).join(''));
    i += len;
  }
  return out;
}

const level26 = (rec) => rec.l.hsk3_2026 ?? rec.l.hsk3_2021 ?? rec.l.hsk2 ?? 8;

const sentences = [];
for (const [id, text] of zh) {
  const enId = zhToEn.get(id);
  const english = enId && en.get(enId);
  if (!english || english.length > 110) continue;
  if (/[A-Za-z0-9０-９Ａ-Ｚａ-ｚ]/.test(text)) continue;
  const han = [...text].filter((c) => HAN.test(c));
  if (han.length < 4 || han.length > 22) continue;
  if (han.some((c) => !hanChars.has(c))) continue; // also filters out leftover traditional characters
  const segs = segment(text);
  let difficulty = 0;
  for (const s of segs) {
    if (!HAN.test(s)) continue;
    const rec = byHanzi.get(s);
    difficulty = Math.max(difficulty, rec ? level26(rec) : 9);
  }
  sentences.push({ id, text, english, segs, difficulty, han: han.length });
}
console.log(`${sentences.length} usable sentences`);

const bySegment = new Map();
sentences.forEach((s, idx) => {
  for (const seg of new Set(s.segs)) {
    if (!byHanzi.has(seg)) continue;
    if (!bySegment.has(seg)) bySegment.set(seg, []);
    bySegment.get(seg).push(idx);
  }
});

/** Particle 地 between a modifier and a verb (认真地学, 很快地走) is read "de"; pinyin-pro says "dì". */
const isAdverbialDe = (seg, prev, next) => seg === '地' && !!prev && HAN.test(prev) && !!next && HAN.test(next);
const pinyinCache = new Map();
/** Word-segmented, tone-marked pinyin for a sentence, plus per-segment toneless readings. */
function sentencePinyin(s) {
  if (pinyinCache.has(s.id)) return pinyinCache.get(s.id);
  const pro = pinyinPro(s.text, { type: 'array', toneSandhi: true });
  // pinyin-pro returns one entry per character (punctuation included).
  const chars = [...s.text];
  const per = chars.map((c, i) => (HAN.test(c) ? pro[i] : c));
  let ci = 0;
  const words = [];
  for (const [si, seg] of s.segs.entries()) {
    const len = [...seg].length;
    const rec = byHanzi.get(seg);
    let syl;
    if (rec && !polyphonic.has(seg) && rec.n.split(' ').length === len) {
      syl = rec.p.split(' ');
    } else if (isAdverbialDe(seg, s.segs[si - 1], s.segs[si + 1])) {
      syl = ['de'];
    } else {
      syl = per.slice(ci, ci + len);
    }
    words.push({ seg, syl, han: HAN.test(seg) });
    ci += len;
  }
  // Join: syllables of a word together, words separated by spaces, punctuation glued.
  let out = '';
  for (const w of words) {
    if (!w.han) {
      const p = { '，': ',', '。': '.', '？': '?', '！': '!', '：': ':', '；': ';', '、': ',', '“': ' "', '”': '"', '（': ' (', '）': ')', '…': '…' }[w.seg] ?? w.seg;
      out += /\s/.test(p) ? '' : p;
      continue;
    }
    // Syllables of one word are joined; an apostrophe marks a vowel-initial syllable (nǚ'ér).
    const word = w.syl.map((x, i) => (i > 0 && /^[aeoāáǎàēéěèōóǒò]/.test(x) ? "'" + x : x)).join('');
    out += (out && !/[ "(]$/.test(out) ? ' ' : '') + word;
  }
  out = out.replace(/([,.?!:;])(?=[^\s"')])/g, '$1 ').replace(/\s+/g, ' ').trim();
  out = out.replace(/(^|[.?!]\s+"?)(\p{Ll})/gu, (_, pre, c) => pre + c.toUpperCase());
  const res = { pinyin: out, readings: new Map(words.map((w) => [w.seg, w.syl.join('')])) };
  pinyinCache.set(s.id, res);
  return res;
}

const stripTones = (s) => s.normalize('NFD').replace(/[\u0300\u0301\u0304\u030C]/g, '').normalize('NFC').toLowerCase();

console.log('Selecting examples…');
const examples = [];
const exampleIndex = new Map();
const uses = new Map();
let matched = 0;
for (const rec of words) {
  const cur = curatedExamples.get(rec.i);
  if (cur) {
    rec.x = examples.push([cur.hanzi, cur.pinyin, cur.english, '']) - 1;
    continue;
  }
  const cands = bySegment.get(rec.h);
  if (!cands) continue;
  const lvl = level26(rec);
  const ranked = cands
    .map((idx) => sentences[idx])
    .filter((s) => (uses.get(s.id) ?? 0) < 3)
    .sort(
      (a, b) =>
        Math.max(0, a.difficulty - lvl) - Math.max(0, b.difficulty - lvl) ||
        Math.abs(a.han - 9) - Math.abs(b.han - 9),
    )
    .slice(0, 8);
  const target = stripTones(rec.p.replace(/ /g, ''));
  for (const s of ranked) {
    const { pinyin, readings } = sentencePinyin(s);
    // Skip sentences where the word is read differently (e.g. 行 háng vs xíng).
    const reading = readings.get(rec.h) ?? '';
    if (polyphonic.has(rec.h) ? reading.toLowerCase() !== rec.p.replace(/ /g, '').toLowerCase() : stripTones(reading) !== target) continue;
    if (!exampleIndex.has(s.id)) exampleIndex.set(s.id, examples.push([s.text, pinyin, s.english, s.id]) - 1);
    rec.x = exampleIndex.get(s.id);
    uses.set(s.id, (uses.get(s.id) ?? 0) + 1);
    matched++;
    break;
  }
}
console.log(`examples: ${matched + curatedExamples.size}/${words.length} words, ${examples.length} sentences`);

// Order: level (2026 → fallback), curated first, then frequency.
words.sort((a, b) => level26(a) - level26(b) || (b.c ?? 0) - (a.c ?? 0) || a.q - b.q);

fs.writeFileSync(path.join(outDir, 'words.json'), JSON.stringify(words));
fs.writeFileSync(path.join(outDir, 'examples.json'), JSON.stringify(examples));
fs.writeFileSync(path.join(outDir, 'measureWords.json'), JSON.stringify(mwPinyin));
fs.writeFileSync(path.join(root, 'src', 'data', 'legacyIds.json'), JSON.stringify(legacyIds, null, 2));
const size = (f) => (fs.statSync(path.join(outDir, f)).size / 1024).toFixed(0) + ' KB';
console.log(`words.json ${size('words.json')}, examples.json ${size('examples.json')}`);
const counts = {};
for (const w of words) for (const [k, v] of Object.entries(w.l)) counts[`${k}:${v}`] = (counts[`${k}:${v}`] ?? 0) + 1;
console.log(counts);
