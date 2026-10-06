# Hànzì Flow

A browser-only Mandarin trainer (React + Vite + TypeScript + Tailwind) that covers the **complete HSK syllabus**: every word of HSK 3.0 (2026 syllabus, levels 1–6 plus the 7–9 band), HSK 3.0 (2021) and HSK 2.0, plus grammar lessons and learning paths for each level. All progress stays on your device. The app can be installed as a PWA and works offline after the first visit.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run test:e2e   # Playwright smoke test
npm run validate-grammar  # grammar schema & content validation
npm run validate-pinyin   # grammar pinyin check against pinyin-pro
npm run build      # type-check + production bundle in dist/
```

## Content

| | Source | Notes |
|---|---|---|
| ~11,400 words, 3 standards | [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT), CC-CEDICT meanings | Switch standards in Settings. HSK 3.0 2026 is labeled as community draft syllabus. |
| ~7,400 example sentences | [Tatoeba](https://tatoeba.org) (CC-BY 2.0 FR) | Each word gets the shortest natural sentence at or below its level. Sentence pinyin is generated: dictionary readings first, then pinyin-pro. |
| Grammar, HSK 1 → 7–9 | `src/data/grammarData.json`, `src/data/grammar/hsk{n}.json` | Each point has an explanation, common mistakes, 4 examples and 4–5 exercises. Tagged as community draft with pre-filled GitHub issue reporting. |
| Learning paths | Generated per level (`src/grammar/levelPaths.ts`) and themed (`learningPaths.json`) | Units of 10 words, with that level's grammar spread across them. |

To rebuild the word data: `node scripts/build-vocab.mjs`. It downloads the sources into `scripts/.cache` the first time.

## Spaced Repetition (FSRS) & Adaptive Flow

- **FSRS Scheduling**: Uses the modern Free Spaced Repetition Scheduler (`ts-fsrs`) algorithm for optimal memory retention with fewer reviews.
- **Directional Cards**: Tracks `recognition` (Hanzi → Meaning) and `recall` (Meaning → Hanzi) as independent skills.
- **One Question Per Card**: Each review card asks one clear question with clean multiple-choice or typing inputs and keyboard shortcuts (`1`–`4`, `Space`, `Enter`).
- **Headline Stat (True Retention)**: Tracks retention percentage on mature cards (stability $\ge 21$ days).
- **Placement & Skip Grind**: Includes a 15-question adaptive placement test and a bulk "Mark Level as Known" panel so learners don't have to grind through familiar levels.
- **Persistent Storage**: Uses IndexedDB with `navigator.storage.persist()`. Backward compatible migrations are automated.

