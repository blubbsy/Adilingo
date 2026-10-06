import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { GraduationCap, Route } from 'lucide-react';
import type { Curriculum, SessionRequest, UserState, VocabItem } from '../types';
import type { SpeechApi } from '../utils/speech';
import { GRAMMAR_BY_ID, GRAMMAR_POINTS, LEARNING_PATHS } from './grammarData';
import { GrammarLesson } from './GrammarLesson';
import { GrammarList, type LevelFilter } from './GrammarList';
import { useGrammarProgress } from './grammarStorage';
import { LearningPathsView } from './LearningPathsView';
import { buildLevelPaths } from './levelPaths';
import { stepWordIds, unrecordedDoneSteps, type PathContext } from './pathLogic';
import type { LearningPath, PathUnit, VocabStep } from './types';
import { focusRing } from './ui';

type Tab = 'paths' | 'grammar';

interface UiState {
  tab: Tab;
  pathId: string | null;
  level: LevelFilter;
  lesson: { id: string; from: Tab } | null;
}

const UI_KEY = 'hanzi-flow:grammar-ui';
const DEFAULT_UI: UiState = { tab: 'paths', pathId: null, level: 'all', lesson: null };

/** Restores the view after the hub is unmounted (e.g. while a vocab session launched from a path is running). */
function loadUi(): UiState {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(UI_KEY) ?? 'null') as Partial<UiState> | null;
    if (!raw || typeof raw !== 'object') return DEFAULT_UI;
    const tab: Tab = raw.tab === 'grammar' ? 'grammar' : 'paths';
    // Validated against the (curriculum-dependent) path list at render time.
    const pathId = typeof raw.pathId === 'string' ? raw.pathId : null;
    const level: LevelFilter = typeof raw.level === 'number' ? raw.level : 'all';
    const lesson =
      raw.lesson && typeof raw.lesson.id === 'string' && GRAMMAR_BY_ID.has(raw.lesson.id)
        ? { id: raw.lesson.id, from: raw.lesson.from === 'grammar' ? ('grammar' as const) : ('paths' as const) }
        : null;
    return { tab, pathId, level, lesson };
  } catch {
    return DEFAULT_UI;
  }
}

function saveUi(ui: UiState) {
  try {
    window.sessionStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* ignore */
  }
}

export interface GrammarHubProps {
  vocab: VocabItem[];
  /** Vocab SRS progress; a word counts as learned if progress[id]?.repetitions >= 2. */
  progress: UserState['progress'];
  colorTones: boolean;
  speech: SpeechApi;
  speechRate: number;
  /** Launch vocab practice for a path's vocab step. */
  onStartVocabSession: (req: SessionRequest) => void;
  /** Active curriculum; syllabus paths are generated for its levels. */
  curriculum?: Curriculum;
}

export function GrammarHub(props: GrammarHubProps): JSX.Element {
  const { vocab, progress: vocabProgress, colorTones, speech, speechRate, onStartVocabSession, curriculum = 'hsk3_2026' } = props;
  const grammar = useGrammarProgress();
  const [ui, setUi] = useState<UiState>(loadUi);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ paths: null, grammar: null });

  useEffect(() => saveUi(ui), [ui]);

  const vocabById = useMemo(() => new Map(vocab.map((v) => [v.id, v])), [vocab]);
  const paths = useMemo(() => [...buildLevelPaths(vocab, GRAMMAR_POINTS, curriculum), ...LEARNING_PATHS], [vocab, curriculum]);
  const ctx: PathContext = useMemo(
    () => ({ vocabById, vocabProgress, grammar: grammar.progress }),
    [vocabById, vocabProgress, grammar.progress],
  );

  // Persist completion of steps that are done (words learned / lesson passed) so it stays sticky.
  const { ready, completeSteps } = grammar;
  useEffect(() => {
    if (!ready) return;
    for (const { pathId, stepIds } of unrecordedDoneSteps(paths, ctx)) completeSteps(pathId, stepIds);
  }, [ready, ctx, completeSteps, paths]);

  const setTab = (tab: Tab) => setUi((u) => ({ ...u, tab, lesson: null }));
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next: Tab = e.key === 'Home' ? 'paths' : e.key === 'End' ? 'grammar' : ui.tab === 'paths' ? 'grammar' : 'paths';
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const practiceVocab = (path: LearningPath, _unit: PathUnit, step: VocabStep) => {
    const wordIds = stepWordIds(step, ctx);
    if (!wordIds.length) return;
    onStartVocabSession({
      label: `${path.title} · ${step.title}`,
      mode: 'mixed',
      levels: [],
      topics: [],
      wordIds,
      includeNotDue: true,
      ignoreCap: true,
      limit: wordIds.length,
    });
  };

  const lessonPoint = ui.lesson ? GRAMMAR_BY_ID.get(ui.lesson.id) : undefined;
  const lessonFromPath = ui.lesson?.from === 'paths' ? paths.find((p) => p.id === ui.pathId) : undefined;

  const tabs: { id: Tab; label: string; icon: typeof Route }[] = [
    { id: 'paths', label: 'Learning Paths', icon: Route },
    { id: 'grammar', label: 'Grammar', icon: GraduationCap },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div role="tablist" aria-label="Grammar sections" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/70">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = ui.tab === id;
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              id={`grammar-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`grammar-panel-${id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={onTabKey}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${focusRing} ${
                active
                  ? 'bg-white text-rose-600 shadow-sm dark:bg-slate-900 dark:text-rose-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`grammar-panel-${ui.tab}`} aria-labelledby={`grammar-tab-${ui.tab}`}>
        {lessonPoint ? (
          <GrammarLesson
            key={lessonPoint.id}
            point={lessonPoint}
            pointProgress={grammar.progress.points[lessonPoint.id]}
            colorTones={colorTones}
            speech={speech}
            speechRate={speechRate}
            backLabel={lessonFromPath ? `Back to ${lessonFromPath.title}` : 'All grammar'}
            onBack={() => setUi((u) => ({ ...u, lesson: null }))}
            onSessionDone={(correct, total) => grammar.recordSession(lessonPoint.id, correct, total)}
          />
        ) : ui.tab === 'paths' ? (
          <LearningPathsView
            paths={paths}
            ctx={ctx}
            selectedPathId={ui.pathId}
            onSelectPath={(pathId) => setUi((u) => ({ ...u, pathId }))}
            onOpenGrammar={(id) => setUi((u) => ({ ...u, lesson: { id, from: 'paths' } }))}
            onPracticeVocab={practiceVocab}
          />
        ) : (
          <GrammarList
            points={GRAMMAR_POINTS}
            progress={grammar.progress}
            level={ui.level}
            onLevelChange={(level) => setUi((u) => ({ ...u, level }))}
            onOpen={(id) => setUi((u) => ({ ...u, lesson: { id, from: 'grammar' } }))}
          />
        )}
      </div>
    </div>
  );
}
