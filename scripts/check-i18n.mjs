#!/usr/bin/env node
/**
 * i18n guard: finds user-visible text that is written directly into components instead of going through
 * the translation system (src/i18n). Uses the TypeScript compiler API, so it understands JSX.
 *
 *   node scripts/check-i18n.mjs            fail if any file has MORE hardcoded strings than the baseline
 *   node scripts/check-i18n.mjs --report   list every finding (the migration worklist)
 *   node scripts/check-i18n.mjs --update   rewrite the baseline (only after strings were migrated)
 *
 * The baseline (scripts/i18n-baseline.json) is a ratchet: counts may only go down. New files start at 0.
 * A finding can be silenced on purpose with an `i18n-ignore` comment on the same or the previous line
 * (for text that is not language: brand names, code, data).
 *
 * What counts as a finding (in .tsx files):
 *   - JSX text containing letters or CJK:                 <p>Hello</p>
 *   - string attributes shown to users:                    aria-label, title, placeholder, alt, label
 *   - string literals inside JSX expressions:              {ok ? 'Yes' : 'No'}, {cond && 'Text'}
 *   - `lang === 'zh' ? ... : ...` style inline translation
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');
const baselineFile = path.join(root, 'scripts', 'i18n-baseline.json');

const args = new Set(process.argv.slice(2));
const ATTRS = new Set(['aria-label', 'title', 'placeholder', 'alt', 'label', 'aria-description', 'aria-roledescription']);
const LETTER = /[A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u3400-\u9fff]/;
/** Skipped directories (content/data, locale tables, tests). */
const SKIP_DIRS = new Set(['__tests__', 'locales', 'data', 'node_modules']);
/** Text that is not language. */
const IGNORED_TEXT = new Set(['Adilingo', 'HSK', 'CEFR', 'FSRS', 'SRS', 'IPA', 'V₁', 'V₂', 'V₃']);

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) out.push(...walk(path.join(dir, e.name)));
    } else if (e.name.endsWith('.tsx') && !e.name.endsWith('.test.tsx')) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

const isLanguage = (text) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 0 && LETTER.test(t) && !IGNORED_TEXT.has(t);
};

function scan(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  const ignored = (line) => /i18n-ignore/.test(lines[line] ?? '') || /i18n-ignore/.test(lines[line - 1] ?? '');
  const add = (node, kind, text) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    if (ignored(line)) return;
    findings.push({ line: line + 1, kind, text: text.replace(/\s+/g, ' ').trim().slice(0, 70) });
  };

  /** String literals that end up on screen inside an expression (ternaries, &&, ||, ??, parentheses). */
  const literalsIn = (expr, found = []) => {
    if (!expr) return found;
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      if (isLanguage(expr.text)) found.push(expr);
    } else if (ts.isTemplateExpression(expr)) {
      const text = [expr.head.text, ...expr.templateSpans.map((s) => s.literal.text)].join(' ');
      if (isLanguage(text)) found.push(expr);
    } else if (ts.isConditionalExpression(expr)) {
      literalsIn(expr.whenTrue, found);
      literalsIn(expr.whenFalse, found);
    } else if (ts.isBinaryExpression(expr)) {
      const op = expr.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
        literalsIn(expr.right, found);
        if (op !== ts.SyntaxKind.AmpersandAmpersandToken) literalsIn(expr.left, found);
      }
    } else if (ts.isParenthesizedExpression(expr)) {
      literalsIn(expr.expression, found);
    }
    return found;
  };

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      if (isLanguage(node.getText())) add(node, 'text', node.getText());
    } else if (ts.isJsxAttribute(node) && node.initializer && ATTRS.has(node.name.getText())) {
      const init = node.initializer;
      if (ts.isStringLiteral(init)) {
        if (isLanguage(init.text)) add(init, `attr:${node.name.getText()}`, init.text);
      } else if (ts.isJsxExpression(init)) {
        for (const lit of literalsIn(init.expression)) add(lit, `attr:${node.name.getText()}`, lit.getText(sf));
      }
    } else if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) {
      for (const lit of literalsIn(node.expression)) add(lit, 'expr', lit.getText(sf));
    }
    // Inline translation by comparing the UI language
    if (ts.isBinaryExpression(node)) {
      const t = node.operatorToken.kind;
      if ((t === ts.SyntaxKind.EqualsEqualsEqualsToken || t === ts.SyntaxKind.ExclamationEqualsEqualsToken) && /^(lang|uiLanguage|s\.uiLanguage|settings\.uiLanguage)$/.test(node.left.getText(sf)) && ts.isStringLiteral(node.right)) {
        add(node, 'lang-branch', node.getText(sf));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

const results = {};
for (const file of walk(srcDir)) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const f = scan(file);
  if (f.length) results[rel] = f;
}

if (args.has('--report')) {
  let total = 0;
  for (const [file, f] of Object.entries(results).sort((a, b) => b[1].length - a[1].length)) {
    total += f.length;
    console.log(`\n${String(f.length).padStart(4)}  ${file}`);
    if (!args.has('--summary')) for (const x of f) console.log(`        ${String(x.line).padStart(4)}  ${x.kind.padEnd(16)} ${x.text}`);
  }
  console.log(`\nTOTAL ${total} hardcoded strings in ${Object.keys(results).length} files`);
  process.exit(0);
}

const counts = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.length]).sort());

if (args.has('--update')) {
  fs.writeFileSync(baselineFile, JSON.stringify(counts, null, 2) + '\n');
  console.log(`Baseline updated: ${Object.values(counts).reduce((a, b) => a + b, 0)} strings in ${Object.keys(counts).length} files.`);
  process.exit(0);
}

const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : {};
let failed = false;
for (const [file, n] of Object.entries(counts)) {
  const allowed = baseline[file] ?? 0;
  if (n > allowed) {
    failed = true;
    console.error(`✗ ${file}: ${n} hardcoded strings (baseline ${allowed}). Use t('…') instead:`);
    for (const x of results[file].slice(0, 8)) console.error(`    line ${x.line} [${x.kind}] ${x.text}`);
  }
}
const improved = Object.entries(baseline).filter(([file, n]) => (counts[file] ?? 0) < n);
if (improved.length) {
  console.log(`ℹ ${improved.length} file(s) have fewer hardcoded strings than the baseline – run \`npm run check:i18n -- --update\` to lock it in.`);
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (failed) process.exit(1);
console.log(`i18n check passed (${total} hardcoded strings remain, baseline ${Object.values(baseline).reduce((a, b) => a + b, 0)}).`);
