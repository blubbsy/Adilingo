# Hànzì Flow

A browser-only Mandarin vocabulary trainer (React + Vite + TypeScript + Tailwind). It has no backend: all progress is stored on your device.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle in dist/
```

## Project layout

```
src/
  App.tsx                    shell, navigation, sessions, badge toasts, undo
  types.ts                   VocabItem, UserState (schema v1), session types
  data/vocabData.json        37 HSK 1–2 words, in curriculum order
  hooks/useUserState.ts      load → debounced save, cross-tab sync, safe-load guard
  utils/
    pinyinHelper.ts          numbered→tone marks, pinyin/English answer checking, sandhi
    srsEngine.ts             SM-2 variant, leeches, daily cap, session queue
    storage.ts               IndexedDB (idb-keyval) → localStorage → memory, migrations, backup
    analytics.ts             accuracy breakdowns, recommendations, achievements
    speech.ts                Web Speech API hook (zh-CN voice detection, fallback)
  grammar/                   grammar lessons + exercises, learning paths (GrammarHub), own progress store
  data/grammarData.json      19 HSK 1–2 grammar points · data/learningPaths.json  4 paths, 18 units
  components/
    ReviewCard.tsx           every practice mode, reveal panel, grading
    StudySession.tsx         queue, in-session relearning, undo, summary
    Dashboard.tsx / ModeSelector.tsx / Insights.tsx / Achievements.tsx / SettingsModal.tsx
```

## Notes

- **Typing pinyin:** type numbers after syllables, e.g. `ni3hao3` becomes `nǐhǎo`. Type `v` or `u:` for `ü`. `5` or `0` gives the neutral tone.
- **Grading:** keys `1`–`4` stand for Again, Hard, Good and Easy. A card you fail comes back once later in the same session as a learning step, and that repeat does not change its schedule.
- **Leeches:** a word failed more than 4 times becomes a leech. Leeches get memory hints and an example-sentence breakdown, and failing one does not lower its ease further. Getting it right 3 times in a row clears the leech flag.
- **Backup:** use Settings → Export/Import JSON. If saved data can't be read on load, the app keeps a copy under a separate key and pauses saving until you decide what to do.
