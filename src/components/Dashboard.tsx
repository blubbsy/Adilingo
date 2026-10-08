import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCheck,
  ChevronRight,
  Compass,
  Flame,
  Layers,
  Music,
  Play,
  SlidersHorizontal,
  Sparkles,
  Target,
  Timer,
  Volume2,
  Zap,
} from 'lucide-react';
import type { HskLevel, SessionRequest, UserState, VocabItem } from '../types';
import { accuracyByLevel, averageLatencySec, calculateTrueRetention, recommendations, type Recommendation } from '../utils/analytics';
import { bulkMarkLevelKnown, dailyLogFor, effectiveStreak, isWordStudied, queueSummary } from '../utils/srsEngine';
import { curriculumInfo, levelLabel } from '../data/vocab';
import { t, type UiLanguage } from '../utils/i18n';
import { ModeSelector } from './ModeSelector';
import { PlacementTestModal } from './PlacementTestModal';
import { BulkMarkModal } from './BulkMarkModal';

interface Props {
  vocab: VocabItem[];
  state: UserState;
  onStart: (req: SessionRequest) => void;
  onNavigate: (view: 'learn' | 'grammar' | 'irregular' | 'topics' | 'dictionary' | 'insights' | 'achievements') => void;
  onUpdateState: (newState: UserState) => void;
  onOpenGrammarGuide?: () => void;
  onOpenIrregularVerbs?: () => void;
}

const REC_ICON: Record<Recommendation['kind'], typeof Flame> = {
  tone: Music,
  leech: AlertTriangle,
  topic: Target,
  due: Layers,
  listening: Volume2,
  new: Sparkles,
  streak: Flame,
};

const panel = 'rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/70';

export function Dashboard({
  vocab,
  state,
  onStart,
  onNavigate,
  onUpdateState,
  onOpenGrammarGuide,
  onOpenIrregularVerbs,
}: Props) {
  const [showPlacementTest, setShowPlacementTest] = useState(false);
  const [showBulkMark, setShowBulkMark] = useState(false);
  const [showCustomPractice, setShowCustomPractice] = useState(false);

  const isEnglishCourse = state.settings.course === 'english';
  const lang: UiLanguage = state.settings.uiLanguage ?? (isEnglishCourse ? 'zh' : 'en');

  const recs = useMemo(() => recommendations(state, vocab), [state, vocab]);
  const levels = useMemo(() => accuracyByLevel(state, vocab), [state, vocab]);
  const streak = effectiveStreak(state);
  const latency = averageLatencySec(state);
  const today = dailyLogFor(state).reviewed;
  const seen = useMemo(() => vocab.filter((v) => isWordStudied(state.progress[v.id])).length, [vocab, state.progress]);
  const info = curriculumInfo(state.settings.curriculum);
  const currentLevel = levels.find((l) => l.learned < l.words) ?? levels[levels.length - 1];

  const summary = useMemo(() => queueSummary(vocab, state), [vocab, state]);
  const trueRet = useMemo(() => calculateTrueRetention(state), [state]);

  const activeDailyCount = Math.min(summary.dueCount + summary.newAvailable, summary.remainingToday);

  const sessionBatch = state.settings.sessionSize ?? 15;

  function handleStartDailySession() {
    if (activeDailyCount > 0) {
      onStart({
        label: t('dashboard.startSession', lang),
        mode: state.settings.defaultMode,
        levels: [],
        topics: [],
        limit: Math.min(activeDailyCount, sessionBatch),
      });
    } else {
      // Extra practice
      onStart({
        label: t('dashboard.extraPractice', lang, { count: sessionBatch }),
        mode: 'mixed',
        levels: [],
        topics: [],
        includeNotDue: true,
        ignoreCap: true,
        limit: sessionBatch,
      });
    }
  }

  function handlePlacementComplete(estimatedLevel: HskLevel, markLevelsKnown: HskLevel[]) {
    let nextState: UserState = {
      ...state,
      placementResult: {
        estimatedLevel,
        date: new Date().toISOString(),
        score: 12,
        total: 15,
      },
    };
    for (const lvl of markLevelsKnown) {
      nextState = bulkMarkLevelKnown(nextState, vocab, lvl, true);
    }
    onUpdateState(nextState);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        {/* Metric tiles on mobile */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:hidden">
          <Tiles
            streak={streak}
            best={state.stats.longestStreak}
            today={today}
            cap={state.settings.dailyCap}
            trueRetentionRate={trueRet.rate}
            matureTotal={trueRet.matureTotal}
            latency={latency}
            lang={lang}
          />
        </section>

        {/* HERO: One Main Action - Today's Daily Plan */}
        <section className={`${panel} relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-white via-white to-rose-50/40 dark:from-slate-800 dark:via-slate-800 dark:to-rose-950/20 shadow-sm`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                <Sparkles className="h-3.5 w-3.5" /> {t('dashboard.dailySchedule', lang)}
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                {activeDailyCount > 0 ? (
                  <>
                    <span className="text-rose-600 dark:text-rose-400">{summary.dueCount}</span>{' '}
                    {lang === 'zh' ? '个待复习 + ' : 'reviews + '}
                    <span className="text-slate-900 dark:text-slate-100">{summary.newAvailable}</span>{' '}
                    {lang === 'zh' ? '个新词' : 'new'}
                  </>
                ) : (
                  t('dashboard.allCaughtUp', lang)
                )}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {activeDailyCount > 0
                  ? t('dashboard.estimatedTime', lang, {
                      min: summary.estimatedMinutes,
                      reviewed: summary.reviewedToday,
                      cap: state.settings.dailyCap,
                    })
                  : t('dashboard.restMessage', lang)}
              </p>
            </div>

            <button
              onClick={handleStartDailySession}
              className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-rose-600 px-7 py-4 text-lg font-bold text-white shadow-xl shadow-rose-600/25 transition active:scale-[0.98] hover:bg-rose-700"
            >
              <Play className="h-5 w-5 fill-current" />
              {activeDailyCount > 0
                ? t('dashboard.startSession', lang)
                : t('dashboard.extraPractice', lang, { count: sessionBatch })}
            </button>
          </div>

          {/* Special Quick Action Cards for English Track */}
          {isEnglishCourse && (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 border-t border-slate-100 pt-5 dark:border-slate-700/60">
              {onOpenGrammarGuide && (
                <button
                  onClick={onOpenGrammarGuide}
                  className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-3.5 text-left transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {t('dashboard.grammarHero', lang)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      一个经典例句通关13类时态与SPO主谓宾
                    </div>
                  </div>
                </button>
              )}

              {onOpenIrregularVerbs && (
                <button
                  onClick={onOpenIrregularVerbs}
                  className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 text-left transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {t('dashboard.irregularVerbsHero', lang)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      AAA / ABB / ABC / ABA 四维规律特训
                    </div>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Quick onboarding & level shortcuts */}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-700/60 text-xs">
            <button
              onClick={() => onNavigate('learn')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              <Compass className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              {t('dashboard.learningPaths', lang)}
            </button>

            <button
              onClick={() => setShowPlacementTest(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
            >
              <Award className="h-4 w-4 text-amber-500" />
              {t('dashboard.placementTest', lang)}
            </button>

            <button
              onClick={() => setShowBulkMark(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
            >
              <CheckCheck className="h-4 w-4 text-emerald-500" />
              {t('dashboard.bulkMark', lang)}
            </button>

            <button
              onClick={() => onNavigate('topics')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <Layers className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              {t('dashboard.topicTraining', lang)}
            </button>

            <button
              onClick={() => setShowCustomPractice((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 ml-auto"
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-400" />
              {showCustomPractice
                ? t('dashboard.hideCustomPractice', lang)
                : t('dashboard.customPractice', lang)}
            </button>
          </div>
        </section>

        {/* Collapsible Custom Practice Panel */}
        {showCustomPractice && (
          <section className="animate-fade-in">
            <ModeSelector vocab={vocab} state={state} onStart={onStart} />
          </section>
        )}

        {/* Recommendations */}
        {recs.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">{t('dashboard.recommended', lang)}</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {recs.slice(0, 4).map((r) => {
                const Icon = REC_ICON[r.kind];
                return (
                  <article key={r.id} className={`${panel} flex gap-3 p-4`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{r.title}</h3>
                      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{r.body}</p>
                      {r.action && (
                        <button
                          onClick={() => onStart(r.action!.request)}
                          className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                        >
                          {r.action.label}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Sidebar on desktop */}
      <aside className="space-y-6">
        <section className="hidden grid-cols-2 gap-3 xl:grid">
          <Tiles
            streak={streak}
            best={state.stats.longestStreak}
            today={today}
            cap={state.settings.dailyCap}
            trueRetentionRate={trueRet.rate}
            matureTotal={trueRet.matureTotal}
            latency={latency}
            lang={lang}
          />
        </section>

        <section className={`${panel} p-5`}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">{t('dashboard.syllabusProgress', lang)}</h2>
            <span className="text-xs text-slate-500">{info.short}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('dashboard.wordsLearned', lang, {
              seen: seen.toLocaleString('en'),
              total: vocab.length.toLocaleString('en'),
            })}
          </p>

          <ul className="mt-4 space-y-3">
            {levels.map((l) => {
              const pct = l.words ? Math.round((l.learned / l.words) * 100) : 0;
              const isCurrent = l.level === currentLevel?.level;
              const lvlName = levelLabel(l.level, state.settings.course);
              return (
                <li key={l.level} className="group rounded-xl p-1 transition hover:bg-slate-50 dark:hover:bg-slate-800/50" title={`${l.learned} of ${l.words} ${lvlName} words learned`}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className={isCurrent ? 'font-semibold' : ''}>
                      {lvlName}{' '}
                      {isCurrent && (
                        <span className="ml-1 rounded bg-rose-100 px-1.5 text-[10px] font-semibold uppercase text-rose-700 dark:bg-rose-900/50 dark:text-rose-200">
                          {t('dashboard.currentLevel', lang)}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-slate-500 text-xs">
                        {l.learned.toLocaleString('en')}/{l.words.toLocaleString('en')}
                      </span>
                      <button
                        onClick={() =>
                          onStart({
                            label: `${lvlName} · Practice`,
                            mode: 'mixed',
                            levels: [l.level],
                            topics: [],
                            ignoreCap: true,
                            includeNotDue: true,
                            limit: 15,
                          })
                        }
                        className="rounded-lg bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 opacity-80 transition hover:bg-rose-600 hover:text-white group-hover:opacity-100 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white"
                        title={`Practice ${lvlName}`}
                      >
                        {lang === 'zh' ? '练习' : 'Practice'}
                      </button>
                    </div>
                  </div>
                  <div
                    className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${lvlName} progress`}
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.max(pct, l.learned ? 1 : 0)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('learn')}
              className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 shadow-sm"
            >
              {t('dashboard.learningPaths', lang)}{' '}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
            {isEnglishCourse && (
              <button
                onClick={() => onNavigate('grammar')}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {lang === 'zh' ? '时态与语法百科' : 'Grammar Guide'}
              </button>
            )}
            <button
              onClick={() => onNavigate('topics')}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {t('dashboard.topicTrainingBtn', lang)} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              onClick={() => setShowBulkMark(true)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              {t('dashboard.bulkMarkLevels', lang)}
            </button>
          </div>
        </section>
      </aside>

      {/* Modals */}
      <PlacementTestModal
        vocab={vocab}
        isOpen={showPlacementTest}
        course={state.settings.course}
        onClose={() => setShowPlacementTest(false)}
        onComplete={handlePlacementComplete}
      />

      <BulkMarkModal
        vocab={vocab}
        state={state}
        isOpen={showBulkMark}
        course={state.settings.course}
        onClose={() => setShowBulkMark(false)}
        onUpdateState={onUpdateState}
      />
    </div>
  );
}

function Tiles({
  streak,
  best,
  today,
  cap,
  trueRetentionRate,
  matureTotal,
  latency,
  lang = 'en',
}: {
  streak: number;
  best: number;
  today: number;
  cap: number;
  trueRetentionRate: number | null;
  matureTotal: number;
  latency: number | null;
  lang?: UiLanguage;
}) {
  return (
    <>
      <Tile
        icon={Flame}
        label={t('dashboard.streak', lang)}
        value={String(streak)}
        sub={t('dashboard.bestDays', lang, { best })}
        accent="text-orange-500"
        highlight={streak > 0}
      />
      <RadialTile
        label={t('dashboard.today', lang)}
        value={today}
        max={cap}
        sub={t('dashboard.ofGoal', lang, { cap })}
        accent="text-rose-500"
      />
      <Tile
        icon={Target}
        label={t('dashboard.trueRetention', lang)}
        value={trueRetentionRate === null ? '—' : `${trueRetentionRate}%`}
        sub={
          matureTotal > 0
            ? t('dashboard.matureCards', lang, { count: matureTotal })
            : t('dashboard.needsMatureCards', lang)
        }
        accent="text-emerald-500"
        title={t('dashboard.retentionTooltip', lang)}
      />
      <Tile
        icon={Timer}
        label={t('dashboard.speed', lang)}
        value={latency === null ? '—' : `${latency.toFixed(1)}s`}
        sub={t('dashboard.perCard', lang)}
        accent="text-sky-500"
      />
    </>
  );
}

function RadialTile({
  label,
  value,
  max,
  sub,
  accent,
}: {
  label: string;
  value: number;
  max: number;
  sub: string;
  accent: string;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  const radius = 17;
  const stroke = 3.5;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className={`${panel} flex items-center justify-between p-4`}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Layers className={`h-4 w-4 ${accent}`} aria-hidden /> {label}
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        <div className="truncate text-xs text-slate-500">{sub}</div>
      </div>
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
        <svg className="h-12 w-12 -rotate-90 transform" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={radius} className="stroke-slate-100 dark:stroke-slate-700" strokeWidth={stroke} fill="transparent" />
          <circle
            cx="22"
            cy="22"
            r={radius}
            className="stroke-rose-500 transition-all duration-700 ease-out"
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <span className="absolute text-[10px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{pct}%</span>
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  highlight,
  title,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  sub: string;
  accent: string;
  highlight?: boolean;
  title?: string;
}) {
  return (
    <div
      title={title}
      className={`${panel} p-4 transition-colors ${
        highlight ? 'bg-gradient-to-br from-white to-orange-50/50 dark:from-slate-800/70 dark:to-orange-950/20' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon className={`h-4 w-4 ${accent} ${highlight ? 'animate-pulse' : ''}`} aria-hidden /> {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      <div className="truncate text-xs text-slate-500">{sub}</div>
    </div>
  );
}
