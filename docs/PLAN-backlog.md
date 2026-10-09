# Adilingo – Implementation Plan for the 4 Backlog Items

Status: **planning draft** · Written against commit `9c3bac8` (React 18 + Vite + TypeScript + Tailwind, PWA, FSRS, IndexedDB).
Everything below is derived from reading the code; items I could **not** verify are marked ⚠ *verify*.

Backlog:

| # | Item | Size |
|---|------|------|
| 1 | Specialized vocabulary (engineering, e-motor, power electronics, mechanical, medicine, sports…) – **as separate courses** (decided) | XL |
| 2 | Chinese grammar wiki | M code + L content |
| 3 | Proper interface localization (extensible languages, no broken layouts) | L |
| 4 | Audio play speed in the exercises | S |

---

> **Status (2026-10):** Phases A, B, C done. Phase D shipped (Wiki tab, 80 draft articles). Phase E shipped in a first version: six domains
> (e-motor, power electronics, mechanical, medicine, football, Pilates), each in a Chinese-terms and an English-terms course, catalogue modal,
> `speakAs`/definition support, tier badges. Schema stays v3 (no migration was needed). Topic packs: 18 Chinese packs (4,000 words) and
> 29 English topics (5,200 words). **Content is machine-drafted and still needs subject-matter review**; learning paths for specialty
> courses (E5) and the `vocabForCurriculum` `en-` fallback cleanup are done now: specialty courses have tier/topic paths, the `en-` hack is replaced by `effectiveCurriculum`.
> Both language courses share one "Paths & Grammar" screen (Paths | Grammar | Wiki); the English course has 74 trainable grammar lessons (`src/data/grammarEn`, format in `content/README.md` §5) and 7 themed paths (voice, tenses, adverbs …).

## 0. What the code looks like today (findings that shape the plan)

**Architecture facts**

- Courses are hard-wired to two ids. `CourseId = 'chinese' | 'english'` is declared **twice** (`src/types.ts:1`, `src/data/courses.ts:3`). About **100 literal checks** (`=== 'english'`, `'chinese'`, `startsWith('en-')`) are spread over 21 files (App 19, SettingsModal 17, ReviewCard 9, srsEngine 7, storage 6, vocab 5, analytics 4, speech 4 …).
- `storage.sanitize` (`storage.ts:232`) coerces **any** unknown `settings.course` to `'chinese'`, and `settings.uiLanguage` to `'en'|'zh'`. A new course id or UI language would be silently reset on load.
- Per-course state is stored in a *swap* design: flat `state.progress` = the active course; `courseProgress[course]`, `dailyByCourse`, `knownLevelsByCourse`, `starredWordsByCourse` hold the snapshots (`App.switchCourse`, `srsEngine.recordReview`).
- **Latent bug (affects item 1):** `syncMerge.mergeUserStates` merges only the flat `progress`/`daily`/`starredWords`/`knownLevels`. It never merges `courseProgress`, `dailyByCourse`, `*ByCourse`. If two devices have different active courses, one device's flat `progress` is merged into the other's active course, and the non-active course snapshots are not merged at all. With N courses this gets much worse.
- `TopicTraining` always iterates the Chinese-curated `TOPIC_PACKS` (`TopicTraining.tsx:43`) – ⚠ *verify* what the English course shows there today.
- Vocabulary = `VocabItem` (`hanzi`, `pinyin`, `english[]`, `hskLevel`, `levels{curriculum→level}`, `topics`, `exampleSentence`). The English course reuses `hanzi`=word and `pinyin`=IPA. Chinese data is lazy-loaded JSON chunks; English is a TS array.
- Grammar: Chinese = **135 structured lessons** (`src/data/grammar/hsk1-7.json`, with explanation / mistakes / examples / 4 exercise types) shown in `GrammarHub` (tabs: *Paths* | *Grammar*). English = `EnglishGrammarGuide` (616 lines): Wiki (20 articles, 9 categories), Tenses blueprint, Active/Passive.
- CI (`.github/workflows/ci.yml`) already runs typecheck, vitest, `validate-grammar`, `validate-grammar-pinyin`, build, Playwright smoke (1 test).

**Item 4 – audio speed (it is half-done)**

- A global setting exists: `settings.speechRate`, `SPEECH_RATES = [0.5, 0.75, 1, 1.25]` chosen **only in the Settings modal** (`SettingsModal.tsx:189`); storage clamps 0.5–1.5.
- `useSpeech(defaultRate)` → `speak(text, rate = defaultRate)` sets `u.rate` (WebSpeech) and `audio.playbackRate` (stream fallback). Call sites without an explicit rate (EnglishGrammarGuide ×4, IrregularVerbsTrainer ×5, TopicTraining ×1) fall back to the global default, so the *setting* works everywhere.
- **What is missing is control inside the exercise** (user must leave the session to open Settings), a quick "slow replay", and live-change behavior. Rate is also prop-drilled through ~20 call sites (`rate=`/`speechRate=`).
- Suspicious: `buildAudioUrls` hard-codes `speed=0.5` (Google `lr-language-tts`) and `spd=5` (Baidu). Combined with `playbackRate` this may make the fallback tier play at a *different base speed* than WebSpeech. ⚠ *verify empirically* (measure clip duration).
- `ReviewCard.tsx:305-307` autoplay effect depends on `settings.speechRate` → changing speed during a card would re-trigger autoplay (acceptable if intentional, must be explicit).
- Existing shortcuts in ReviewCard: `1–4`, `Space`, `Enter`, `f/F/p/P` (flip). `s` is free.

**Item 3 – i18n debt (measured)**

- `src/utils/i18n.ts`: flat `Record<string,string>`, ~90 keys, `en` + `zh` only, **untyped keys** (a typo renders the key string), 68 `t()` calls.
- Most of the UI is *not* localized: **39** `lang === 'zh' ? … : …` ternaries (App, Dashboard, EnglishLearningHub, SettingsModal); ~270 source lines with CJK literals in TSX (EnglishLearningHub 50, EnglishGrammarGuide 46, IrregularVerbsTrainer 42, SettingsModal 34, App 25, ReviewCard 22, ModeSelector 12 …); many English literals (TopicTraining, Dictionary, SyncModal, StudySession, Insights, "`{streak}-day streak`" in App).
- `courses.ts` mixes English and Chinese in labels/names; the course switcher text (`中文 HSK`/`英语 CEFR`) is hardcoded; language switch is a 2-way toggle button; footer uses `toLocaleString('en')`; `<html lang>` is never updated.
- Layout hazards for long languages (German ≈ +30%): mobile bottom nav `grid-cols-5` with `text-[10px]`, fixed-size pills in header, sidebar buttons without wrapping.

**Item 1/2 content facts**

- `validate-grammar.mjs` + `validate-grammar-pinyin.mjs` (uses `pinyin-pro`) already exist and run in CI – reuse for new content.
- Hash router (`#/home`, `#/learn`, …) has **no sub-routes**; GrammarHub keeps its sub-state in `sessionStorage` (`hanzi-flow:grammar-ui`). New sub-views should follow that pattern, not add a router.
- No component-test infra (no jsdom / Testing Library); tests are pure-logic vitest + one Playwright smoke test.

---

## 1. Execution order (and why)

```
Phase A  Item 4  Audio speed ................ independent, small, touches mission-critical speech.ts
Phase B  Foundation (needed by 1 and 3)
   B1  Course registry + capability flags (kill literal checks)
   B2  Course-aware sync merge  (+ latent-bug fix)
   B3  Storage schema v4 (course ids / ui languages no longer coerced)
Phase C  Item 3  i18n infrastructure → shell migration → full migration (+ layout hardening)
Phase D  Item 2  Chinese grammar wiki ........ UI is born localized
Phase E  Item 1  Specialty courses: engine → catalogue UI → 2-domain pilot → content scale-up
```

- Do **C before D/E**: every new string in the wiki and the catalogue is then written localized from day one instead of migrated later.
- Do **B before C and E**: both rewrite the same places (App shell, Settings, storage).
- Item 4 first: quick win, and it is the riskiest file for regressions (see GEMINI.md §2), so it benefits from landing in isolation.
- Each phase = 1–4 small PRs; every PR ends with the mandatory gate: `npm test && npm run typecheck && npm run build` (+ `validate-grammar`, `validate-pinyin`, `check:i18n` once it exists, Playwright) and a **zh + en parity check** (GEMINI.md §1).

Rough effort (one developer, focused days, excluding content review time): A 1–1.5 · B 3 · C 5–7 · D 3 + content · E 8–10 + content.

---

## 2. Phase A – Item 4: Audio play speed in exercises

### Goal
Change playback speed **inside any exercise with one tap/keypress**, plus a one-shot *slow replay*, consistently across WebSpeech and the streaming fallbacks, in both courses.

### Design
1. **Single source of truth in `useSpeech`.** Extend `SpeechApi` with `rate: number` and `setRate(r)`. `App` wires `setRate` → `update(s => settings.speechRate = r)`. `AudioButton` gets `rate` from `speech.rate` (prop becomes optional → existing ~20 call sites keep working; migrate them gradually; remove prop-drilling of `speechRate` in GrammarHub/Lesson/ExercisePlayer/Cloze).
2. **New `SpeedControl` component** (`src/components/SpeedControl.tsx`): segmented chips `0.5× · 0.75× · 1× · 1.25×` (role `radiogroup`, `aria-checked`, focus ring, dark mode), and a compact "cycle" variant (single button 🐢/⚡) for tight spaces. All labels via `t()`.
3. **Placement:** StudySession toolbar (affects ReviewCard + Cloze), next to `AudioButton` in `ExercisePlayer`, `GrammarLesson`, `ClozeExerciseView`, `IrregularVerbsTrainer`, `EnglishGrammarGuide`, `TopicTraining`, `Dictionary`.
4. **Slow replay:** long-press (or `Shift+click`) on `AudioButton`, and key `Shift+Space`, plays once at `0.6×` **without** changing the saved setting. Key `s` cycles the speed (guard: ignore when focus is in an input; ReviewCard already guards `HTMLInputElement`).
5. **Live change semantics (documented, tested):** stream fallback → apply `audio.playbackRate` immediately; WebSpeech cannot change rate mid-utterance → `cancel()` and re-speak the same text at the new rate (only if it was speaking).
6. **Autoplay interplay:** speed change must not silently re-trigger card autoplay. Replace the `settings.speechRate` dependency in the `ReviewCard` autoplay effect with a ref; a speed tap while an audio prompt is showing performs an explicit replay.
7. **Rate consistency across tiers (the ⚠ item):** measure `lr-language-tts` clips with `speed=0.5` vs `speed=1`/absent. If the param slows the clip, **remove the hard-coded value** and let one mechanism (`playbackRate`) own speed, with `preservesPitch = true` (+ `webkitPreservesPitch`) and `defaultPlaybackRate` set in addition to `playbackRate` (Safari/Chromium reset behaviour). All other rules in GEMINI.md §2 stay untouched: strict voice gating, 600 ms start watchdog, `<80 ms` premature-end detection, 5 s per-URL timeout, `NotAllowedError` abort.
8. **Range:** UI offers 0.5–1.25 (storage keeps clamp 0.5–1.5). ⚠ *verify* very low WebSpeech rates on Chinese voices (pitch artefacts) – keep 0.5 as the floor.
9. *(Optional, decision D7)* per-course rate: `settings.speechRateByCourse`. Default recommendation: **keep global** (simpler sync).

### Files
`src/utils/speech.ts`, `src/components/AudioButton.tsx`, **new** `src/components/SpeedControl.tsx`, `src/App.tsx` (wiring), `StudySession.tsx`, `ReviewCard.tsx`, `ClozeExerciseView.tsx`, `src/grammar/{ExercisePlayer,GrammarLesson,GrammarHub}.tsx`, `IrregularVerbsTrainer.tsx`, `EnglishGrammarGuide.tsx`, `TopicTraining.tsx`, `Dictionary.tsx`, `SettingsModal.tsx`, `storage.ts` (unchanged clamp).

### Tests
- Vitest with mocked `Audio` / `speechSynthesis` (extend `pinyinDiffAndSpeech.test.ts`): rate reaches `u.rate`, `playbackRate`, `defaultPlaybackRate`, `preservesPitch`; mid-play change restarts WebSpeech and updates stream; **regressions**: no `speak()` without a strictly matching voice, watchdog and `<80 ms` fallbacks still fire, `NotAllowedError` aborts the cascade; `buildAudioUrls` ordering for zh/en word/sentence unchanged (snapshot).
- Playwright: open a Chinese card → press `s` → control reflects 0.75×; repeat in English course.
- Manual matrix (record in PR): Chrome/Edge Windows **with and without** a Chinese voice, Firefox, Safari iOS, Android Chrome × {0.5, 1, 1.25} × {zh word, zh sentence, en word, en sentence}.

### Acceptance
- Speed changeable without leaving any exercise; keyboard + screen-reader accessible; persists across reload; identical perceived speed on WebSpeech and each fallback tier at the same setting; no GEMINI §2 regression; works in zh **and** en.

---

## 3. Phase B – Foundation (course registry, sync, schema)

### B1 Course registry & capability flags
Replace id-string checks with data.

```ts
// types.ts: CourseId becomes an opaque string validated against the registry
export type CourseId = string;            // 'chinese' | 'english' | 'chinese:emotor' | …
export type TrackId = 'chinese' | 'english';   // language machinery (TTS, pinyin, direction logic)

interface CourseConfig {                  // courses.ts (existing fields kept)
  id: CourseId;
  kind: 'language' | 'specialty';
  track: TrackId;                         // replaces `course === 'english'` checks
  domain?: { id: string; family: string; icon: string; version: number; status: 'draft' | 'reviewed' };
  contentLang: 'en' | 'zh';               // language of explanations/glosses (was sourceLang)
  features: {
    pinyin; tones; measureWords; radicals;                    // existing
    grammar: 'hsk-lessons+wiki' | 'english-wiki' | 'none';    // routes: learn/grammar
    irregularVerbs: boolean;
    placementTest: boolean; bulkMark: boolean;
    learningPaths: 'syllabus' | 'topic-clusters' | 'none';
    topics: 'curated-packs' | 'item-topics';
  };
  load: () => Promise<VocabItem[]>;       // replaces `loadLibrary(courseId)` branching
}
```
- Single `isViewAvailable(course, view)` used by **nav building**, **switchCourse route sanitization** (today only handles `chinese` ← grammar/irregular), and the hash router. Course-isolation rule from GEMINI §3 becomes a table-driven test: *for every course × every view, an unavailable view redirects, and content from another course never renders*.
- Mechanical refactor of the ~100 literal checks → `getCourseConfig(id).track` / `features.*`. Done in 3 PRs ordered by risk: (1) data layer `vocab.ts`/`courses.ts`/`storage.ts`, (2) engine `srsEngine.ts`/`analytics.ts`/`speech.ts`, (3) UI. `srsEngine.promptForDirection` currently guesses English via a regex heuristic – switch to `track`.
- Badges (`analytics.ts` `course-polyglot`, `course-english-scholar` read `courseProgress.chinese/english`) must keep working and stay base-track-only; specialty courses get their own generic badges (see E).
- `TopicTraining` takes `packs` as a prop from the course (`curated-packs` → `TOPIC_PACKS`; `item-topics` → packs derived from `VocabItem.topics`). ⚠ verify the current English behaviour first and add a regression test.

### B2 Course-aware sync merge (bug fix + prerequisite)
`mergeUserStates` → normalize both sides to `{courseProgress[...], dailyByCourse, starredWordsByCourse, knownLevelsByCourse}` (fold flat `progress`/`daily`/`starredWords`/`knownLevels` into the entry for each side's *own* active course), merge **per course key**, then re-derive the flat fields from the merged entry of the local active course. Tests in `sync.test.ts`: devices on different active courses; 3 courses; unknown course id from the remote is preserved untouched; idempotent; commutative.

### B3 Storage schema v4
- `SCHEMA_VERSION = 4`; migration 4: no data change (adds nothing destructive); `sanitize` validates `course` against the registry; **unknown id → keep all `*ByCourse` data, set active to the base default** (never delete another course's progress); `uiLanguage` validated against supported locales, not the literal pair.
- `CURRICULUM_IDS` gains `'domain'`.
- Forward-compat note: an *old* client that receives a state with a specialty course id would coerce the course to `chinese` while flat `progress` holds specialty cards. B2's normalization (flat progress folded under its own course tag) prevents that pollution once all devices are updated; PWA auto-update makes the window short.

### Acceptance
No behavioral change for the two existing courses (all existing tests green, snapshot of nav/routes per course identical), new course ids survive reload/sync, `grep -E "=== '(english|chinese)'" src` returns only registry/test files.

---

## 4. Phase C – Item 3: Interface localization

### Scope split (important)
- **A. UI chrome** (buttons, nav, settings, messages) → follows `settings.uiLanguage`.
- **B. Course content** (grammar explanations, glosses, descriptions) → follows `course.contentLang`, with a fallback chain and a visible note when falling back (e.g. German UI + Chinese course → explanations shown in English).
Translating the *content* (135 HSK lessons, wiki) into German is **out of scope**; the architecture just must not block it.

### Decisions (recommended defaults)
- **Build, don't adopt, a heavy library** (D6): keep the zero-dependency, offline-first style. Extend the existing `t()` instead of introducing i18next. Reconsider if > 5 locales or external translators need tooling.
- Locales: **`en`, `zh` (complete, compile-time enforced) + `de` (partial, proves extensibility and is the layout stress test)** (D3).

### Design
1. **Typed keys.** `src/i18n/locales/en/*.ts` are `as const` and define `MessageKey`. `zh` is `satisfies Record<MessageKey,string>` → a missing key fails `npm run typecheck`. Other locales are `Partial`, reported by coverage script, falling back `de → en`.
2. **Namespaces, lazy locales.** `common, nav, dashboard, study, settings, courses, grammarEn, grammarZh, catalogue, errors`; non-default locales loaded with dynamic `import()` (PWA-cached). `en` is bundled.
3. **API.** `useT()` hook via React context (ends `lang` prop drilling); `t(key, vars)` with **ICU-lite plurals** through `Intl.PluralRules` (`'{count, plural, one {# card} other {# cards}}'`); `useFormat()` wrapping `Intl.NumberFormat/DateTimeFormat/RelativeTimeFormat`. Dev build: **missing key → `console.warn` + visible `⟦key⟧`** (satisfies the "zero silent failures" rule); prod: fallback chain.
4. **Document wiring.** Effect sets `<html lang dir>`; per-element `lang="zh-CN"` on hanzi so CJK fonts/hyphenation are right; first run picks language from `navigator.languages`, falling back to today's per-course default (english course → zh).
5. **Language picker.** Replace both 2-way toggle buttons with a `LanguageMenu` (native names: *English · 简体中文 · Deutsch*) in the header/sidebar **and** Settings. `Settings.uiLanguage: UiLanguage` widened.
6. **Content localization type.** `type LocalizedText = Partial<Record<UiLanguage,string>>` + `pickText(text, uiLang, course.contentLang)`; used by `courses.ts` labels, catalogue, wiki.
7. **Layout hardening** (the "avoid bad layouts" requirement):
   - Design rules added to GEMINI.md: no fixed widths on text containers; `min-w-0` + `break-words`; `hyphens-auto` (needs `lang`); buttons use `min-h`, never `h-` + one line; **no sentence concatenation** (one key per sentence with placeholders – e.g. `"{streak}-day streak"`); no `uppercase tracking-*` on German/CJK labels.
   - Concrete fixes: mobile bottom nav (`grid-cols-5`, `text-[10px]`) → two-line-safe labels `leading-tight` + `aria-label`, fallback to icon-only below 360 px; header pills truncate with `title`; sidebar buttons wrap; `Intl` replaces `toLocaleString('en')`.
   - **Pseudo-locale `en-XA`** (accented + ~40 % padding, dev-only via `?lang=xa`) to expose overflow without waiting for translators.
   - **Playwright layout test:** for locales `en, zh, de, xa` × viewports `360×640, 768×1024, 1280×800` × routes `home, learn, topics, dictionary, settings modal`, assert `documentElement.scrollWidth <= innerWidth` and no clipped interactive element (bounding box inside viewport).
8. **Guard rails.** `scripts/check-i18n.mjs` (uses the `typescript` compiler API already in devDependencies): (a) locale coverage report, (b) placeholder parity (`{count}` present in all), (c) unused keys, (d) **hardcoded-literal scan** of JSX text and `aria-label/title/placeholder/alt` attributes, with a committed baseline that may only shrink ("ratchet"). Wired into `package.json` (`check:i18n`) and CI. GEMINI.md §5 updated: *never inline UI literals; run `check:i18n`*.

### Migration order (by visibility × size; one PR each, `lang===` ternaries and literals → keys)
1. Infrastructure + `App` shell/nav/header/switchers/footer (25 CJK lines + 19 ternary sites) + `LanguageMenu` + `<html lang>`.
2. `SettingsModal` (34 CJK lines, 17 course literals).
3. `Dashboard`, `ModeSelector`, `StudySession`, `ReviewCard` (22).
4. `EnglishLearningHub` (50), `EnglishGrammarGuide` UI chrome (46 – *content stays Chinese by design*), `IrregularVerbsTrainer` (42).
5. `TopicTraining`, `Dictionary`, `Insights`, `Achievements`, `SyncModal`, `PlacementTestModal`, `BulkMarkModal`, grammar module chrome (`GrammarHub`, `GrammarList`, `LearningPathsView`, `ExercisePlayer`, `ui.tsx`).
6. `courses.ts` labels + badge/achievement titles (currently English literals in `analytics.ts`) → keys.
7. `de` first-pass translation (machine-drafted, flagged "needs native review" in the coverage report), layout test matrix green.

### Tests
Existing `i18nAndGrammar.test.ts` stays green. New: key parity (en↔zh complete), placeholder parity, plural rules (`en`, `de`, `zh` has only `other`), fallback chain, dev-warning on missing key, `storage.sanitize` accepts `de` and rejects unknown, `<html lang>` sync, `pickText` fallback. Playwright layout matrix above.

### Acceptance
`check:i18n` baseline at 0 for migrated files; switching language updates every visible string without reload and never overflows at 360 px in `de`/`xa`; adding a new locale = adding one folder (no code changes elsewhere).

---

## 5. Phase D – Item 2: Chinese grammar wiki

### What it is
The Chinese track already has 135 **lessons** organized by HSK level. What is missing is the English track's counterpart: a **concept-first reference** ("why does 了 behave like that? 不 vs 没?"). So: ~40–60 *wiki articles*, each a concept hub that links to lessons + vocab — **not** a duplicate of lesson text.

### Content model (`src/grammarWiki/types.ts`)
```ts
interface ZhWikiArticle {
  id: string;                       // 'particle-le', 'bu-vs-mei', 'ba-construction'
  title: LocalizedText;             // { en: 'Aspect particle 了' }
  titleHanzi?: string;
  category: ZhWikiCategory;
  hskRange: [HskLevel, HskLevel];
  summary: LocalizedText;
  pattern?: string;                 // same " + " convention as GrammarPoint
  rules: { rule: LocalizedText; examples: GrammarExample[]; highlight?: string }[];
  contrasts?: { vs: string; text: LocalizedText }[];       // 不 vs 没, 会/能/可以
  pitfalls: LocalizedText[];        // incl. typical English/German-speaker errors
  relatedPointIds: string[];        // → GRAMMAR_BY_ID  ("Practice" buttons)
  relatedWordIds?: string[];        // → vocab (measure words, particles)
  keywords: string[];               // hanzi, pinyin (toneless), English – for search
}
```
Categories (initial): sentence patterns · particles · aspect · complements · 把/被 · comparison · questions · negation · modal verbs · measure words · connectors/clauses · time/place · formal/written (HSK 5–7).
Authoring format: `src/data/grammarWiki/zh/<category>.json`; loader `grammarWikiData.ts` mirrors `grammarData.ts` (runtime validation, drop-and-warn on malformed entries).

### UI
- `GrammarHub` gets a third tab **Wiki** (*Paths | Grammar | Wiki*). Sub-state (`wikiArticleId`, category, query) joins the existing `sessionStorage` UI state (`loadUi` currently maps unknown tab → `paths`; extend the union). No router changes.
- **Extract shared building blocks** from `EnglishGrammarGuide` (search box, category chips, expandable article card, rule/example row) into `src/components/wiki/*` and use them for both languages. This refactor is the main regression risk → do it in its own PR with an English-course snapshot/e2e check *before* adding Chinese content (parity rule).
- Chinese examples render with `ToneText` + audio and **respect `pinyinHelperMode`** (adaptive/flip/always/never – don't reintroduce the "pinyin trap" fixed in `90df8bd`); the new `SpeedControl` from Phase A appears next to audio.
- Cross-links: lesson ⇄ article ("Read the wiki article" / "Practice this"), Dictionary entry → "Grammar notes" for measure words/particles.
- Pure function `searchWiki(articles, query)`: matches hanzi, toneless pinyin (`pinyinHelper`), English; unit-tested.
- Isolation: Wiki exists only when `features.grammar === 'hsk-lessons+wiki'`; English course must never show it (route + nav test from B1).

### Content pipeline
1. **Seed set (12 flagship articles)**: 了, 过/着/在 (aspect), 的/地/得, 不 vs 没, 把, 被, 比 comparisons, 吗/呢/吧, result complements, direction complements, 会/能/可以, measure words. Then grow to ~40 across later PRs.
2. Draft from the existing 135 lessons (reuse their examples where good; link rather than copy), original wording; any Tatoeba sentence keeps its `source` + CC-BY attribution.
3. `validate-grammar.mjs` extended: unique ids, `relatedPointIds` exist, levels valid, every example has hanzi/pinyin/english; `validate-grammar-pinyin.mjs` extended to check pinyin of all wiki examples with `pinyin-pro` (polyphones flagged).
4. Human review pass per article batch before merge; content `status: 'draft'|'reviewed'` stored but not shown unless draft.

### Tests / acceptance
Loader + validator tests, `searchWiki` tests, Playwright: Chinese → Learn → Wiki → search "了" → article opens → "Practice" opens the lesson; English course has **no** Wiki tab; 12 reviewed articles shipped; English wiki behaves exactly as before.

---

## 6. Phase E – Item 1: Specialized vocabulary as separate courses

### Definition
A **specialty course** is a first-class registry entry (B1) with its **own vocabulary, tiers, progress, daily limits, stats and topic structure**, reusing the language machinery (`track`) of a parent language: TTS, pinyin/tones, direction logic, card modes. Example ids: `chinese:emotor`, `english:power-electronics`.

### E1 Course/domain catalogue
Domains are *data* (a manifest, eager and tiny; the vocabulary behind it is lazy):
```
src/data/domains/manifest.json     [{ id, family, icon, nameKey, descKey, tracks:['chinese','english'], tiers, status, version }]
src/data/domains/<id>/<track>.json  compact VocabItem records (lazy chunk)
```
Families & initial domains (can grow without code changes):

| Family | Domains |
|---|---|
| Engineering | E-motor design · Power electronics · Mechanical engineering · (shared `eng-core` base pack) |
| Medicine | General clinical medicine (safety disclaimer shown) |
| Sports | Football · Pilates |

**Pilot (recommended, D2): E-motor design + Power electronics (+ Football as taxonomy stress test)**, ~300 reviewed terms each, tiers 1–3 (*Essentials / Professional / Expert*).

### E2 Authoring model & pipeline
- **Source of truth = concept table** (`src/content/domains/<id>.concepts.json`): `{ conceptId, tier, topic, term: { en, zh, de? }, abbr?, definition: { en, zh?, de? }, example: { en, zh, de? }, speakAs?: { en?, zh? }, review: 'draft'|'auto'|'sme' }`. One entry yields cards for **every track** that has the language (Chinese course: zh term + English gloss; English course: en term + Chinese gloss; German gloss later for free, ties into item 3).
  *Simpler alternative (D8): author per-track files directly – faster to start, doubles the work later.*
- `scripts/build-domain.mjs` (modelled on `build-vocab.mjs`): generates **pinyin with `pinyin-pro`**, ids `d:<domain>:<conceptId>:<track>`, `levels: { domain: tier }`, compacts to JSON chunks; fails on schema errors.
- `scripts/validate-domain.mjs` in CI: unique ids/terms, term occurs in its example, pinyin vs pinyin-pro (flag polyphones), length limits, tier balance, `review` coverage report (% sme-reviewed), no verbatim copy markers.
- **LLM-assisted drafting → automated checks → SME review** (D5: who is the reviewer? ideally you for e-motor/power electronics). Chinese terminology cross-checked against standard terms (GB/T, termonline) and bilingual sources; unreviewed content shows a **"draft vocabulary – report error"** badge. Licensing: write original definitions; do not copy IEC Electropedia/Wikipedia text; per-course attribution replaces the HSK-only footer.
- Author brief per domain includes **register** guidance: engineering = technical prose; medicine = clinical + patient-facing phrases; football = commentary & slang; Pilates = imperative cueing.

### E3 Engine changes
- `VocabItem` gains optional `definition?`, `abbr?`, `speakAs?`, `domain?` (backward-compatible; progress stores ids only → no sync impact). `ReviewCard`/`Dictionary` show the definition on the answer side.
- **TTS (GEMINI §2 applies):** `speak()` uses `speakAs ?? text` (e.g. "IGBT" → "I G B T", "MOSFET" → "moss fet"); verify `buildAudioUrls` behaviour for long compounds (>5 chars → Youdao skipped) and multi-word English terms; add tests; keep voice-gating/watchdog rules.
- `vocabForCurriculum` loses its `en-` id-prefix hack; specialty courses use `curriculum: 'domain'` and a single hidden curriculum selector.
- Progress/limits: reuse swap mechanism; `dailyByCourse[course]` already isolates the daily new-card intake (fix from `21a17ae`). Streak stays global by design.
- Features per specialty course: grammar `none`, irregular verbs off, placement test off, **bulk-mark by tier on**, topics `item-topics`, learning paths `topic-clusters` (E5), Chinese tracks keep pinyin/tones/radicals, English tracks keep IPA.
- Badges: generic course-scoped badges (first 50/200/500 terms, tier complete, streak-in-course) generated from `vocab.length`, not hard-wired to HSK ids.

### E4 Catalogue & switching UX
- Replace the two-button switcher (sidebar + header pill) with `CourseSwitcher`: **"My courses"** (those with progress, pinned) + **"Browse catalogue"** (families → domains, search, word count, tier info, draft/reviewed badge, "Start"). Bottom sheet on mobile; long German/Chinese names truncate with `title`. Settings "Course track" uses the same list.
- Dashboard variant for specialty courses: progress per **tier and topic** instead of HSK syllabus; hero copy from `t()`.

### E5 Learning paths (phase 2 of E)
Auto-generate topic-cluster paths (e.g. E-motor: *Machine types → Stator & windings → Magnetics → Cooling & thermal → Control (FOC) → Testing*) using the existing `LearningPath` shapes with vocab-only steps; no new grammar steps.

### Isolation rules to enforce with tests (GEMINI §3–4 extended)
For every course pair: vocab ids never overlap in the active library; progress, `dailyByCourse`, stars, known levels do not leak; switching preserves each course's snapshot; nav/routes derive only from `features`; a Chinese-HSK-only feature (pinyin lessons/wiki) can't appear in a specialty English course and vice-versa.

### Tests / acceptance
- Unit: registry shape, domain loader, ids unique, `build-domain` + validator, per-course badge generation, TTS `speakAs`, sync merge with ≥3 courses, snapshot/restore on switch.
- Playwright: Catalogue → start `chinese:emotor` → study 3 cards → switch to `english` → progress/daily counters untouched → switch back → intact.
- Pilot ships when: 2 domains × 300 terms × ≥1 track each, ≥80 % SME-reviewed, CI validators green, bundle impact < 150 KB gz (lazy chunks), all zh/en parity checks green, no existing-course regression.
- Scale-up afterwards is **content-only** (new JSON + manifest line) – this is the key success criterion of the architecture.

---

## 7. Cross-cutting

**Docs/rules to update (GEMINI.md, mirrored by AGENTS.md pointer):** §2 add speed rules (single mechanism, live-change semantics); §3 course isolation becomes capability-based ("never branch on course id strings"); §5 i18n rules (`useT`, no literals, `check:i18n`, layout rules); new §7 specialty-course content QA.

**CI additions:** `check:i18n`, `validate-domain`, extended `validate-grammar*`, expanded Playwright (layout matrix, course switching, wiki). Playwright config/time budget to be checked (currently 1 smoke test).

**Risks & mitigations**

| Risk | Mitigation |
|---|---|
| Course-literal refactor breaks zh/en (≈100 sites) | Behavior-neutral PRs in 3 steps, per-course route/nav snapshot tests before touching code |
| `speech.ts` regression (silent audio) | Phase A isolated; keep GEMINI §2 tests; manual browser matrix |
| Old devices pollute progress after schema change | B2 normalization + B3 unknown-id handling; ship B before any specialty course |
| Terminology errors in specialty vocab | Draft badge, SME review, validators, report-error link, pilot only 2 domains |
| i18n migration drags on / regresses | Ratchet baseline script, one file group per PR |
| Wiki refactor of `EnglishGrammarGuide` | Separate PR with e2e before adding Chinese content |
| Bundle/offline size growth | Lazy chunks per domain/track; SW already caches hashed assets |

**Definition of done (every PR):** `npm test`, `npm run typecheck`, `npm run build`, validators, Playwright green; zh + en (and, from E, one specialty course) manually smoke-tested; docs updated.

---

## 8. Open decisions (defaults assumed above)

| # | Question | Default assumed |
|---|---|---|
| D1 | Specialty courses for Chinese track, English track, or both? | Both, from one concept table |
| D2 | Pilot domains | E-motor design + Power electronics (+ Football) |
| D3 | UI languages to ship | en, zh, **de** (partial) |
| D4 | Gloss language for specialty courses | Existing pairing (zh→English glosses, en→Chinese glosses); German glosses later |
| D5 | Who reviews technical terminology? | You (engineering domains); other domains need a reviewer |
| D6 | i18n: in-house vs i18next | In-house, typed, lazy |
| D7 | Speech rate global vs per course | Global |
| D8 | Concept table vs per-track files for domain content | Concept table |
| D9 | Wiki article language | English now (matches the 135 lessons), German later via `LocalizedText` |
