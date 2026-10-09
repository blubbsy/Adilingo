#!/usr/bin/env node
/**
 * Compiles the authored content in /content into lazy JSON chunks in src/data/generated (see content/README.md).
 *   node scripts/build-content.mjs          build everything, exit 1 on schema errors
 *   node scripts/build-content.mjs --check  build in memory only (CI): fail on errors, never write
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const OUT = path.join(root, 'src/data/generated');
const errors = [];
const warnings = [];
const err = (file, line, msg) => errors.push(`${file}${line ? `:${line}` : ''}  ${msg}`);
const warn = (file, line, msg) => warnings.push(`${file}${line ? `:${line}` : ''}  ${msg}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
const listFiles = (dir, ext) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(ext) && !f.startsWith('_')).sort() : []);
const rel = (p) => path.relative(root, p).replace(/\\/g, '/');

function* rows(file) {
  const lines = read(file).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    yield { n: i + 1, fields: line.split('|').map((f) => f.trim()), raw: line };
  }
}

function write(name, data) {
  if (CHECK) return;
  const target = path.join(OUT, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(data));
}

// ---------- pinyin helpers ----------
const PUNCT = { '，': ',', '。': '.', '！': '!', '？': '?', '、': ',', '；': ';', '：': ':', '（': '(', '）': ')', '“': '"', '”': '"' };
const ZI_NEXT = new Set([...'女弹孙宫夜时']);
const SCIENTIFIC_ZI = new Set(['分子', '原子', '电子', '粒子', '离子', '质子', '中子', '量子', '光子', '孔子', '君子', '太子', '王子', '因子', '男子', '女子', '弟子', '父子', '母子', '才子', '卵子', '精子', '莲子', '骰子']);
const ZANG_PREV = new Set([...'心肝脾肺肾内']);
/** Splits text into pinyin syllables (Chinese characters) and verbatim runs (latin letters, digits, punctuation). */
function tokens(text) {
  const out = [];
  let raw = '';
  const flush = () => { if (raw) { out.push({ raw }); raw = ''; } };
  const chars = [...text];
  const isHan = (c) => c !== undefined && /[一-鿿]/.test(c);
  pinyin(text, { type: 'all' }).forEach((it, i) => {
    if (it.isZh && it.pinyin) {
      flush();
      let symbol = it.pinyin;
      let num = it.num || 5;
      // 子 is neutral at the end of a word (桌子 zhuōzi) except in scientific terms (原子 yuánzǐ)
      if (it.origin === '子' && isHan(chars[i - 1]) && !SCIENTIFIC_ZI.has(chars[i - 1] + '子') && !ZI_NEXT.has(chars[i + 1] ?? '')) {
        symbol = 'zi';
        num = 5;
      }
      // 脏 is 4th tone (zàng / zang4) when referring to internal organs (preceded by 心, 肝, 脾, 肺, 肾, 内)
      if (it.origin === '脏' && ZANG_PREV.has(chars[i - 1] ?? '')) {
        symbol = 'zàng';
        num = 4;
      }
      out.push({ symbol, numbered: `${pinyin(it.origin, { toneType: 'none' })}${num}` });
      if (symbol === 'zi') out[out.length - 1].numbered = 'zi5';
    } else raw += PUNCT[it.origin] ?? it.origin;
  });
  flush();
  return out;
}
const glue = (s) =>
  s.replace(/\s+([，。！？、；：,.!?;:）」”%])/g, '$1').replace(/([（「“(])\s+/g, '$1').replace(/\s+/g, ' ').trim();
const syllables = (text) => glue(tokens(text).map((t) => t.raw ?? t.symbol).join(' ')).split(' ');
const numbered = (text) => glue(tokens(text).map((t) => t.raw ?? t.numbered).join(' '));
function sentencePinyin(text) {
  const s = glue(tokens(text).map((t) => t.raw ?? t.symbol).join(' '));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const symbolPinyin = (text) => glue(tokens(text).map((t) => t.raw ?? t.symbol).join(' '));

// ---------- Chinese topic packs ----------
function buildZhTopics() {
  const dir = path.join(root, 'content/topics/zh');
  const files = listFiles(dir, '.txt');
  if (!files.length) return;
  const library = new Set(JSON.parse(read(path.join(root, 'src/data/hsk/words.json'))).map((w) => w.h));
  const legacyFile = path.join(dir, '_legacy-ids.json');
  const legacy = fs.existsSync(legacyFile) ? JSON.parse(read(legacyFile)) : {};
  const usedIds = new Set();
  const THEMES = new Set(['home', 'nature', 'food', 'health', 'travel', 'work', 'lifestyle', 'social']);
  const packs = [];
  let order = 0;
  for (const f of files) {
    const file = path.join(dir, f);
    let pack = null;
    const seen = new Set();
    for (const { n, fields } of rows(file)) {
      if (fields[0] === '@pack') {
        const [, id, title, chineseTitle, emoji, theme, description] = fields;
        if (fields.length !== 7) err(rel(file), n, `@pack needs 7 fields, has ${fields.length}`);
        if (!THEMES.has(theme)) err(rel(file), n, `unknown theme "${theme}"`);
        if (id !== f.replace(/\.txt$/, '')) err(rel(file), n, `pack id "${id}" must equal the file name`);
        pack = { id, title, chineseTitle, emoji, theme, description, words: [], supp: [] };
        packs.push(pack);
        continue;
      }
      if (!pack) { err(rel(file), n, 'word before @pack header'); continue; }
      if (fields.length === 5 && fields[4] === '') fields.pop();
      if (fields.length !== 4) { err(rel(file), n, `expected 4 fields, found ${fields.length}: ${fields[0]}`); continue; }
      const [hanzi, eng, ex, exEn] = fields;
      if (!hanzi || !eng || !ex || !exEn) { err(rel(file), n, `empty field in "${hanzi}"`); continue; }
      if (!/[一-鿿]/.test(hanzi)) { err(rel(file), n, `"${hanzi}" has no hanzi`); continue; }
      if (seen.has(hanzi)) { warn(rel(file), n, `duplicate "${hanzi}"`); continue; }
      seen.add(hanzi);
      if (!ex.includes(hanzi)) warn(rel(file), n, `example does not contain "${hanzi}"`);
      pack.words.push(hanzi);
      if (library.has(hanzi)) continue;
      const num = numbered(hanzi);
      let id = legacy[hanzi] ?? `supp:${num.replace(/\s+/g, '')}`;
      for (let k = 2; usedIds.has(id); k++) id = `${legacy[hanzi] ?? `supp:${num.replace(/\s+/g, '')}`}-${k}`;
      usedIds.add(id);
      pack.supp.push({
        id,
        hanzi,
        pinyin: symbolPinyin(hanzi),
        pinyinNumbered: num,
        english: eng.split(';').map((s) => s.trim()).filter(Boolean),
        hskLevel: 3,
        levels: {},
        frequency: 5000 + order++,
        topics: [pack.title],
        exampleSentence: { hanzi: ex, pinyin: sentencePinyin(ex), english: exEn },
      });
    }
    if (!pack) err(rel(file), 0, 'missing @pack header');
    else if (pack.words.length < 100) warn(rel(file), 0, `only ${pack.words.length} words`);
  }
  write('zhTopics.json', packs);
  console.log(`zh topics: ${packs.length} packs, ${packs.reduce((a, p) => a + p.words.length, 0)} words (${packs.reduce((a, p) => a + p.supp.length, 0)} outside the HSK library)`);
}

// ---------- English topic lists ----------
const slug = (w) => w.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function buildEnTopics() {
  const dir = path.join(root, 'content/topics/en');
  const files = listFiles(dir, '.txt');
  if (!files.length) return;
  const seen = new Map();
  const topics = [];
  const all = [];
  for (const f of files) {
    const file = path.join(dir, f);
    let topic = null;
    let count = 0;
    for (const { n, fields } of rows(file)) {
      if (fields[0] === '@topic') {
        if (fields.length < 2) err(rel(file), n, '@topic needs a name');
        topic = { name: fields[1], emoji: fields[2] || '📚' };
        topics.push(topic);
        continue;
      }
      if (!topic) { err(rel(file), n, 'word before @topic header'); continue; }
      if (fields.length === 7 && fields[6] === '') fields.pop();
      if (fields.length !== 6) { err(rel(file), n, `expected 6 fields, found ${fields.length}: ${fields[0]}`); continue; }
      const [word, ipa, zh, ex, exZh, lvl] = fields;
      const level = Number(lvl);
      if (!word || !zh || !ex || !exZh) { err(rel(file), n, `empty field in "${word}"`); continue; }
      if (!(level >= 1 && level <= 6)) { err(rel(file), n, `level "${lvl}" must be 1-6 (${word})`); continue; }
      if (!/^\/.+\/$/.test(ipa)) warn(rel(file), n, `IPA of "${word}" should be written /…/`);
      const key = slug(word);
      if (seen.has(key)) {
        const existing = all.find((r) => r[0] === `en-${key}`);
        if (existing) {
          const list = Array.isArray(existing[5]) ? existing[5] : (existing[5] = [existing[5]]);
          if (!list.includes(topic.name)) list.push(topic.name);
        }
        count++;
        continue;
      }
      seen.set(key, rel(file));
      if (!ex.toLowerCase().includes(word.toLowerCase().split(' ')[0].slice(0, Math.max(3, word.length - 3)))) warn(rel(file), n, `example may not contain "${word}"`);
      all.push([`en-${slug(word)}`, word, ipa, zh.split(';').map((s) => s.trim()).filter(Boolean), level, [topic.name], ex, exZh]);
      count++;
    }
    if (count < 100) warn(rel(file), 0, `only ${count} words`);
  }
  const ids = new Set();
  for (const r of all) {
    if (ids.has(r[0])) err('content/topics/en', 0, `id collision ${r[0]}`);
    ids.add(r[0]);
  }
  write('enWords.json', all);
  write('enTopics.json', topics);
  console.log(`en topics: ${topics.length} topics, ${all.length} words`);
}

// ---------- Domain (specialty) courses ----------
/** Rows of a domain file followed by those of its part files `_<id>-*.txt` (authored in chunks, concatenated here). */
function* domainRows(dir, f) {
  const id = f.replace(/\.txt$/, '');
  yield* rows(path.join(dir, f));
  for (const part of fs.readdirSync(dir).filter((x) => x.startsWith(`_${id}-`) && x.endsWith('.txt')).sort()) yield* rows(path.join(dir, part));
}
function buildDomains() {
  const dir = path.join(root, 'content/domains');
  const files = listFiles(dir, '.txt');
  if (!files.length) return;
  const manifest = [];
  const FAMILIES = new Set(['engineering', 'medicine', 'sports']);
  for (const f of files) {
    const file = path.join(dir, f);
    let dom = null;
    const ids = new Set();
    const terms = new Set();
    const rowsOut = [];
    const tiers = [0, 0, 0];
    const topics = [];
    for (const { n, fields } of domainRows(dir, f)) {
      if (fields[0] === '@domain') {
        if (fields.length === 7 && fields[6] === '') fields.pop();
      if (fields.length !== 6) { err(rel(file), n, `@domain needs 6 fields, has ${fields.length}`); continue; }
        const [, id, en, zh, family, description] = fields;
        if (id !== f.replace(/\.txt$/, '')) err(rel(file), n, `domain id "${id}" must equal the file name`);
        if (!FAMILIES.has(family)) err(rel(file), n, `unknown family "${family}"`);
        dom = { id, name: { en, zh }, family, description };
        continue;
      }
      if (!dom) { err(rel(file), n, 'concept before @domain header'); continue; }
      if (fields.length === 11 && fields[10] === '') fields.pop(); // trailing pipe
      if (fields.length === 9) fields.push(''); // a missing last field means "no respelling"
      if (fields.length !== 10) { err(rel(file), n, `expected 10 fields, found ${fields.length}: ${fields[0]}`); continue; }
      const [cid, tierS, topic, en, zh, abbr, def, exEn, exZh, speak] = fields;
      const tier = Number(tierS);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cid)) { err(rel(file), n, `bad concept id "${cid}"`); continue; }
      if (ids.has(cid)) { warn(rel(file), n, `duplicate concept id "${cid}"`); continue; }
      if (!(tier >= 1 && tier <= 3)) { err(rel(file), n, `tier "${tierS}" must be 1-3 (${cid})`); continue; }
      if (!topic || !en || !zh || !def || !exEn || !exZh) { err(rel(file), n, `empty required field in "${cid}"`); continue; }
      if (terms.has(en.toLowerCase())) warn(rel(file), n, `duplicate English term "${en}"`);
      if (!/[一-鿿]/.test(zh) && !/^[A-Za-z0-9 ./\-+()]+$/.test(zh)) err(rel(file), n, `term_zh of "${cid}" has no hanzi`);
      if (!exZh.includes(zh)) warn(rel(file), n, `example_zh of "${cid}" does not contain "${zh}"`);
      if (!exEn.toLowerCase().includes(en.toLowerCase().replace(/s$/, '').slice(0, Math.max(3, en.length - 3)))) warn(rel(file), n, `example_en of "${cid}" may not contain "${en}"`);
      if (def.length > 260) warn(rel(file), n, `definition of "${cid}" is long (${def.length})`);
      ids.add(cid);
      terms.add(en.toLowerCase());
      tiers[tier - 1]++;
      if (!topics.includes(topic)) topics.push(topic);
      rowsOut.push([cid, tier, topic, en, zh, symbolPinyin(zh), numbered(zh), abbr, def, exEn, exZh, sentencePinyin(exZh), speak]);
    }
    if (!dom) { err(rel(file), 0, 'missing @domain header'); continue; }
    if (rowsOut.length < 150) warn(rel(file), 0, `only ${rowsOut.length} concepts`);
    write(`domains/${dom.id}.json`, rowsOut);
    manifest.push({ ...dom, count: rowsOut.length, tiers, topics });
    console.log(`domain ${dom.id}: ${rowsOut.length} concepts (tiers ${tiers.join('/')}, ${topics.length} topics)`);
  }
  write('domainManifest.json', manifest);
}

// ---------- Chinese grammar wiki ----------
const WIKI_CATEGORIES = ['sentence-patterns', 'particles', 'aspect', 'complements', 'ba-bei', 'comparison', 'questions', 'negation', 'modal-verbs', 'measure-words', 'connectors', 'time-place', 'formal-written', 'adverbs', 'coverbs'];
const stripTones = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ü/g, 'v').toLowerCase();
function buildWiki() {
  const dir = path.join(root, 'content/wiki/zh');
  const files = listFiles(dir, '.json');
  if (!files.length) return;
  const lessonIds = new Set();
  for (let i = 1; i <= 7; i++) {
    const data = JSON.parse(read(path.join(root, `src/data/grammar/hsk${i}.json`)));
    for (const p of Array.isArray(data) ? data : data.points) lessonIds.add(p.id);
  }
  const seen = new Set();
  const articles = [];
  for (const f of files) {
    const file = path.join(dir, f);
    let list;
    try { list = JSON.parse(read(file)); } catch (e) { err(rel(file), 0, `invalid JSON: ${e.message}`); continue; }
    if (!Array.isArray(list)) { err(rel(file), 0, 'must be a JSON array'); continue; }
    for (const a of list) {
      const where = `${rel(file)} [${a?.id}]`;
      if (!a || typeof a.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.id)) { err(where, 0, 'bad id'); continue; }
      if (seen.has(a.id)) { err(where, 0, 'duplicate article id'); continue; }
      seen.add(a.id);
      if (!WIKI_CATEGORIES.includes(a.category)) err(where, 0, `unknown category "${a.category}"`);
      if (!a.title || !a.summary) err(where, 0, 'title and summary are required');
      if (!Array.isArray(a.hskRange) || a.hskRange.length !== 2) err(where, 0, 'hskRange must be [from, to]');
      if (!Array.isArray(a.rules) || !a.rules.length) { err(where, 0, 'needs rules'); continue; }
      let examples = 0;
      for (const r of a.rules) {
        if (!r.rule || !Array.isArray(r.examples) || !r.examples.length) err(where, 0, `rule without examples: ${String(r.rule).slice(0, 40)}`);
        for (const ex of r.examples ?? []) {
          examples++;
          if (!ex.hanzi || !ex.pinyin || !ex.english) { err(where, 0, `incomplete example ${ex.hanzi}`); continue; }
          // Compare syllables ignoring tones/spacing: catches typos without punishing sandhi or neutral-tone conventions
          const want = stripTones(symbolPinyin(ex.hanzi)).replace(/[^a-z]/g, '');
          const got = stripTones(ex.pinyin).replace(/[^a-z]/g, '');
          if (want !== got) warn(where, 0, `pinyin letters differ for "${ex.hanzi}": ${ex.pinyin}`);
        }
      }
      if (examples < 4) warn(where, 0, `only ${examples} examples`);
      for (const id of a.relatedPointIds ?? []) if (!lessonIds.has(id)) err(where, 0, `unknown relatedPointId "${id}"`);
      a.pitfalls ??= [];
      a.keywords ??= [];
      a.relatedPointIds ??= [];
      a.contrasts ??= [];
      articles.push(a);
    }
  }
  write('zhWiki.json', articles);
  console.log(`zh wiki: ${articles.length} articles, ${articles.reduce((n, a) => n + a.rules.reduce((m, r) => m + r.examples.length, 0), 0)} examples`);
}

buildZhTopics();
buildEnTopics();
buildDomains();
buildWiki();

for (const w of warnings.slice(0, process.env.ALL_WARNINGS ? Infinity : 60)) console.warn('warn ', w);
if (warnings.length > 60) console.warn(`... ${warnings.length - 60} more warnings`);
if (errors.length) {
  for (const e of errors.slice(0, 80)) console.error('ERROR', e);
  console.error(`${errors.length} error(s)`);
  process.exit(1);
}
console.log(`ok (${warnings.length} warnings)`);
