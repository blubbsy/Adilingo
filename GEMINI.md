# AI Coding Agent Instructions & Architecture Guidelines (Adilingo / Vocubulary)

This document contains mandatory instructions, architectural guardrails, and quality standards for all AI coding agents working on this codebase. Follow these rules without exception to prevent regression, broken cross-language features, and silent failures.

---

## 1. Core Principles & Non-Regression Mandate

1. **Multilingual Parity**:
   - This app supports multiple learning tracks: **Chinese (HSK 1–6)** and **English (CEFR A1–C1 / Irregular Verbs / Tenses / Wiki)**, with more languages to follow.
   - **Never break or compromise an existing language when modifying another.** Any modification to audio, routing, SRS, or UI must be validated across **both** Chinese and English modes.
2. **Zero Silent Failures**:
   - Features must fail gracefully with visible logs, fallbacks, or user feedback—never silent no-ops (e.g. dummy playback, empty screens, or swallowed exceptions).
3. **Mandatory Quality Gate**:
   - Every coding session must end with running:
     ```bash
     npm test            # Must pass 100% of unit tests
     npm run typecheck   # (tsc --noEmit) Must pass with 0 errors
     npm run build       # Production bundle build must succeed
     ```

---

## 2. Speech & TTS Audio Engine (`src/utils/speech.ts`)

Audio pronunciation is mission-critical for language learners. The browser audio pipeline has subtle cross-platform pitfalls that **MUST** be respected:

### ⚠️ Known Pitfalls & Root Causes

1. **Silent Fallback Trap in Chromium (Windows/Linux)**:
   - On non-Chinese OS installations (e.g. English Windows), `speechSynthesis.getVoices()` often contains **only English voices** (e.g., *Microsoft David*, *Microsoft Zira*).
   - If `speechSynthesis.speak(utterance)` is called with `utterance.lang = 'zh-CN'` when no Chinese voice is installed, Chromium assigns the default English voice.
   - The English voice **skips Chinese characters silently in <20ms**, triggers `onstart` followed immediately by `onend`, and **never fires `onerror`**.
   - As a result, the audio stream fallback is never triggered, and the user hears total silence!
2. **Sentence Incompatibility on Dictionary Voices**:
   - `dict.youdao.com/dictvoice?le=zh` is high quality for single words and short terms (≤ 5 characters, no punctuation), but returns **HTTP 500** on full sentences or punctuation.
3. **Referer Blocking on Google Translate**:
   - `translate.google.com/translate_tts?client=tw-ob` returns **HTTP 404** if a `Referer` header is sent from `localhost` or foreign origins.
   - `google.com/speech-api/v1/synthesize?...&client=lr-language-tts` works reliably with or without `Referer` headers.

### 🛡️ Mandatory Rules for TTS Implementation

1. **Strict Voice Gating**:
   - Never call `window.speechSynthesis.speak(u)` unless [`findVoice(effectiveLang)`](file:///C:/Users/Sibby/Documents/Projekte/Vocubulary/src/utils/speech.ts) returns a **strictly matching native voice** (`matchingVoice !== null`).
   - If no matching voice exists for the target language, **immediately skip WebSpeech** and directly stream from verified fallback endpoints.
2. **Watchdog Timers**:
   - Always retain a 600ms start watchdog timer to catch frozen speech synthesizers.
   - Detect premature termination: if `onend` fires in `< 80ms` for text longer than 1 character, the synthesizer silently skipped characters; automatically switch to the streaming audio fallback.
3. **Multi-Tiered Streaming Fallbacks**:
   - In [`buildAudioUrls(text, lang)`](file:///C:/Users/Sibby/Documents/Projekte/Vocubulary/src/utils/speech.ts):
     - **Chinese Words**: Youdao Chinese voice (`le=zh`) ➔ Google `lr-language-tts` ➔ Google Translate TTS ➔ Baidu TTS.
     - **Chinese Sentences**: Google `lr-language-tts` ➔ Google Translate TTS ➔ Baidu TTS (omit Youdao to prevent 500s).
     - **English Words**: Youdao en-US voice (`type=2`) ➔ Google `lr-language-tts` ➔ Google Translate TTS ➔ Baidu TTS.
     - **English Sentences**: Google `lr-language-tts` ➔ Google Translate TTS ➔ Baidu TTS ➔ Youdao.
4. **Timeout & User Gesture Handling**:
   - Audio elements must have a 5-second per-URL timeout to prevent hanging on stalled networks.
   - `NotAllowedError` (autoplay restrictions prior to user interaction) must abort the cascade cleanly rather than firing repeated failed network requests.

### 🐢 Playback Speed Rules

1. **One source of truth**: the saved speed is `settings.speechRate`, exposed as `speech.rate` / `speech.setRate()` from `useSpeech`. New audio UI must read `speech.rate` (do not prop-drill a separate rate) and use `<SpeedControl>` / `<AudioButton>`.
2. **One mechanism per tier**: WebSpeech uses `utterance.rate`; streamed audio uses `applyAudioRate()` (`playbackRate` + `defaultPlaybackRate` + `preservesPitch`). Never set `audio.playbackRate` directly.
3. **Live changes**: stream audio changes speed immediately; WebSpeech restarts the current text at the new speed. Changing speed must never re-trigger card autoplay by itself.
4. **Slow replay** (`Shift+click`, long-press, `SLOW_REPLAY_RATE`) must not change the saved speed. Keyboard: `S` cycles speed (ignored while typing).
5. ⚠ Open item: `buildAudioUrls` hard-codes `speed=0.5` (Google lr-language-tts) and `spd=5` (Baidu). Verify in a browser whether this makes the fallback tier slower than WebSpeech at the same setting before changing it.

---

## 3. Course Isolation & Navigation Routing

1. **Course Scope Isolation**:
   - The active course is stored in `state.settings.course` (`'chinese' | 'english'`).
   - Views like `#/learn` and `#/grammar` **must strictly branch on `activeCourse`**:
     - English Course: Render [`EnglishGrammarGuide`](file:///C:/Users/Sibby/Documents/Projekte/Vocubulary/src/components/EnglishGrammarGuide.tsx) (Tenses Blueprint, Active/Passive, Grammar Wikipedia).
     - Chinese Course: Render [`GrammarHub`](file:///C:/Users/Sibby/Documents/Projekte/Vocubulary/src/components/GrammarHub.tsx) (HSK 1–6 Grammar Points).
   - Never allow HSK content to appear in English mode, or CEFR/irregular verbs to bleed into Chinese mode.
2. **Course Registry Rules (`src/data/courses.ts`)**:
   - **Never branch on course id strings** (`course === 'english'`). Use `getCourseConfig(id).track`, `.features.*`, `trackOf(id)` or `isViewAvailable(id, view)`.
   - Navigation, the route guard in `App.tsx` and the quick switchers are derived from `CourseConfig.views`, `mobileViews` and `languageCourses()`. A screen a course does not list must redirect (`fallbackView`) and never render another course's content.
   - Adding a course = adding a registry entry (+ its vocabulary loader), not editing UI branches.
   - Persisted state may contain course ids this build does not know: `storage.sanitize` keeps their data under their own id and activates the default course. Never coerce unknown ids into `'chinese'`.
   - Daily limits come from `dailyLogFor(state)` (per course). Never read `stats.daily` directly for limits.
3. **Specialty courses (`chinese:emotor`, `english:power-electronics`, …)**:
   - Ids are `<track>:<domain>`; one course per domain and language track, generated from `src/data/generated/domainManifest.json` in `courses.ts`. They reuse the language machinery of their `track` (pinyin/tones, IPA, TTS voice) but have **no** grammar, learning paths, irregular verbs, wiki or placement test (`views`, `features.placement`).
   - Their vocabulary comes from `content/domains/<domain>.txt` (see `content/README.md`). Items carry `definition`, `abbr`, `speakAs` (TTS respelling: always speak `item.speakAs ?? item.hanzi`) and `domain`. Ids are `d:<domain>:<concept>:<zh|en>` and never collide with other courses.
   - Adding a domain = adding a content file (+ `npm run build:content`); no code or UI changes.
4. **Authored content pipeline**:
   - Topic packs (`content/topics/zh|en`), domains (`content/domains`) and the Chinese grammar wiki (`content/wiki/zh`) are text/JSON sources compiled by `scripts/build-content.mjs` into `src/data/generated/*` (committed; CI fails when stale or invalid via `npm run check:content`). Never edit generated files by hand.
   - The Chinese grammar wiki lives in the Chinese course's `GrammarHub` (third tab); the English course must never show it.
5. **Dashboard & Sidebar Context**:
   - Dashboard buttons, progress bars, and sidebar links must display language-appropriate labels and targets (e.g. "HSK 语法点" vs. "语法百科与时态").

---

## 4. Spaced Repetition (SRS) & Progress Isolation

1. **Storage Namespacing**:
   - Vocabulary cards, progress states, and leeches must not collide across courses.
   - Course items use distinct IDs and schemas (`item.id`, `hskLevel` vs. `cefrLevel`).
2. **Grading & Interval Calculations**:
   - Keep FSRS/SM-2 calculations in `srsEngine.ts` pure and deterministic.
   - Test review card behavior with unit tests whenever grading or interval logic is touched.

---

## 5. UI, Accessibility & Internationalization (i18n)

1. **Localization rules (`src/i18n`, full guide in `docs/i18n.md`)**:
   - The interface supports `en`, `zh`, `de` (and a dev-only pseudo-locale `xa`). **Never write UI text inline** – not in JSX, `aria-label`/`title`/`placeholder`, nor `lang === 'zh' ? … : …`. Use `const { t } = useI18n(); t('area.key', vars)`. `npm run check:i18n` must stay at **0**.
   - Add every new string to `src/i18n/locales/en/<area>.ts` **and** `zh` (compile-time complete) **and** `de`. One key per sentence (no concatenation), plurals via `{n, plural, one {…} other {…}}`, styled parts via `<tag>…</tag>` + `rich()`.
   - Numbers/dates/lists go through `formatNumber` / `formatDate` / `formatList` / `formatRelative`, never `toLocaleString('en')`.
   - Data-driven text (badges, levels, course names) uses keys built from ids (`tx`, `levelLabel(level, course, t)`); utilities throw `LocalizedError`, never English-only `Error`s for user-visible problems.
   - Course *content* (grammar articles, glosses) is not translated through these tables.
   - **Layout**: no fixed widths on text, allow wrapping, test with `?lang=xa`; `e2e/layout.spec.ts` fails on sideways scroll, controls outside the viewport and clipped labels at 360 / 768 / 1280 px.
2. **Accessibility & Dark Mode**:
   - Maintain full dark mode support via Tailwind `dark:` variants.
   - Keep interactive elements accessible with `aria-label`, visible focus rings (`focus:ring-2`), and keyboard shortcuts (`1-4`, `Space`, `Enter`).

---

## 6. Pre-Commit Verification Checklist

Before finishing any task or reporting completion to the user, the agent **MUST** run:

```bash
# 1. Run all unit tests
npm test

# 2. Run TypeScript strict type-checking
npm run typecheck

# 3. Verify production Vite build
npm run build
```

If any check fails, resolve the root cause before completing the turn.
