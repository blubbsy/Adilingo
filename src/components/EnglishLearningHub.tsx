import { useState, useMemo } from 'react';
import {
  BookOpen,
  ChevronDown,
  CheckCircle2,
  Circle,
  GraduationCap,
  Play,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { SessionRequest, UserState, VocabItem, HskLevel } from '../types';
import type { SpeechApi } from '../utils/speech';
import { levelLabel } from '../data/vocab';
import { isWordStudied } from '../utils/srsEngine';
import { ENGLISH_GRAMMAR_WIKI, type GrammarWikiArticle } from '../data/englishGrammarWiki';

interface Props {
  vocab: VocabItem[];
  state: UserState;
  speech: SpeechApi;
  onStartVocabSession: (req: SessionRequest) => void;
  onNavigate: (view: string) => void;
}

const UNIT_SIZE = 10;

interface LevelMeta {
  level: HskLevel;
  tag: string;
  badgeZh: string;
  titleZh: string;
  descZh: string;
  icon: string;
  color: string;
  grammarIds: string[];
}

const LEVEL_METAS: LevelMeta[] = [
  {
    level: 1,
    tag: 'A1',
    badgeZh: 'A1 · 基础启蒙',
    titleZh: '小学 / 初中核心打底',
    descZh: '掌握最常用的高频基础词汇，打通五大基本句型、名词单复数与空间时间核心介词。',
    icon: '🌱',
    color: 'from-emerald-500/20 via-teal-500/10 to-transparent text-emerald-600 dark:text-emerald-400',
    grammarIds: ['five-sentence-patterns', 'articles-and-nouns', 'prepositions-core'],
  },
  {
    level: 2,
    tag: 'A2',
    badgeZh: 'A2 · 初中进阶',
    titleZh: '中考重点攻坚',
    descZh: '拓展日常生活、校园与社交表达，掌握情态动词、比较级最高级与常见状语从句。',
    icon: '🧭',
    color: 'from-blue-500/20 via-sky-500/10 to-transparent text-blue-600 dark:text-blue-400',
    grammarIds: ['modal-verbs', 'comparative-superlative', 'adverbial-clauses-basic'],
  },
  {
    level: 3,
    tag: 'B1',
    badgeZh: 'B1 · 高中拓展',
    titleZh: '高考关键突破',
    descZh: '涉足深度观点交流、叙事与说明文，攻关现在完成时、定语从句与被动语态核心变式。',
    icon: '🌉',
    color: 'from-indigo-500/20 via-purple-500/10 to-transparent text-indigo-600 dark:text-indigo-400',
    grammarIds: ['attributive-clauses', 'passive-voice', 'present-perfect'],
  },
  {
    level: 4,
    tag: 'B2',
    badgeZh: 'B2 · 大学四级',
    titleZh: 'CET-4 / 职场通用',
    descZh: '覆盖专业话题、长篇报道与学术讨论，通关非谓语动词全家桶、真实与虚拟条件句。',
    icon: '🏔️',
    color: 'from-amber-500/20 via-orange-500/10 to-transparent text-amber-600 dark:text-amber-400',
    grammarIds: ['non-finite-verbs', 'conditional-sentences', 'noun-clauses'],
  },
  {
    level: 5,
    tag: 'C1',
    badgeZh: 'C1 · 大学六级',
    titleZh: 'CET-6 / 高阶学术',
    descZh: '流利阅读学术论文与深度社论，掌握高级倒装句、强调句型与高阶虚拟语气。',
    icon: '👑',
    color: 'from-purple-500/20 via-rose-500/10 to-transparent text-purple-600 dark:text-purple-400',
    grammarIds: ['inversion-and-emphasis', 'subjunctive-mood-advanced'],
  },
  {
    level: 6,
    tag: 'C2',
    badgeZh: 'C2 · 考研领航',
    titleZh: '研究生英语 / 母语级精通',
    descZh: '精准表达微妙语感，驾驭高难度抽象学术思辨与修辞表达。',
    icon: '💎',
    color: 'from-rose-500/20 via-pink-500/10 to-transparent text-rose-600 dark:text-rose-400',
    grammarIds: [],
  },
];

export function EnglishLearningHub({ vocab, state, onStartVocabSession, onNavigate }: Props) {
  const lang = state.settings.uiLanguage ?? 'zh';
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<number | 'all'>('all');
  const [expandedLevels, setExpandedLevels] = useState<Record<number, boolean>>({ 1: true });
  const [activeGrammarModal, setActiveGrammarModal] = useState<GrammarWikiArticle | null>(null);

  const toggleLevel = (lvl: number) => {
    setExpandedLevels((prev) => ({ ...prev, [lvl]: !prev[lvl] }));
  };

  const levelUnits = useMemo(() => {
    const map = new Map<number, { words: VocabItem[]; units: VocabItem[][] }>();
    for (const meta of LEVEL_METAS) {
      const words = vocab.filter((v) => v.hskLevel === meta.level);
      const units: VocabItem[][] = [];
      for (let i = 0; i < words.length; i += UNIT_SIZE) {
        units.push(words.slice(i, i + UNIT_SIZE));
      }
      map.set(meta.level, { words, units });
    }
    return map;
  }, [vocab]);

  const levelStats = useMemo(() => {
    const stats: Record<number, { total: number; learned: number; pct: number }> = {};
    for (const meta of LEVEL_METAS) {
      const data = levelUnits.get(meta.level);
      const total = data?.words.length ?? 0;
      const learned = (data?.words ?? []).filter((w) => isWordStudied(state.progress[w.id])).length;
      const pct = total > 0 ? Math.round((learned / total) * 100) : 0;
      stats[meta.level] = { total, learned, pct };
    }
    return stats;
  }, [levelUnits, state.progress]);

  const visibleLevels = useMemo(() => {
    if (selectedLevelFilter === 'all') return LEVEL_METAS;
    return LEVEL_METAS.filter((m) => m.level === selectedLevelFilter);
  }, [selectedLevelFilter]);

  const startLevelTraining = (meta: LevelMeta) => {
    const lvlName = levelLabel(meta.level, 'english');
    onStartVocabSession({
      label: `${lvlName} · Level Practice`,
      mode: 'mixed',
      levels: [meta.level],
      topics: [],
      includeNotDue: true,
      ignoreCap: true,
      limit: 20,
    });
  };

  const startUnitTraining = (meta: LevelMeta, unitIdx: number, unitWords: VocabItem[]) => {
    onStartVocabSession({
      label: `${meta.tag} · Unit ${unitIdx + 1} (${unitWords.length} words)`,
      mode: 'mixed',
      levels: [],
      topics: [],
      wordIds: unitWords.map((w) => w.id),
      includeNotDue: true,
      ignoreCap: true,
      limit: unitWords.length,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-blue-500/10 p-6 sm:p-8 shadow-sm dark:border-slate-700/80 dark:from-rose-950/30 dark:via-slate-800 dark:to-blue-950/20">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                <GraduationCap className="h-3.5 w-3.5" />
                {lang === 'zh' ? '欧洲语言共同框架 · 梯度路径' : 'CEFR Progressive Paths'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                A1 → C2 循序渐进
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {lang === 'zh' ? '英语分级进阶路径' : 'English Learning Paths'}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {lang === 'zh'
                ? '自主选择适合的学习梯级。每个梯级拆分为 10 词关卡，配备核心语法里程碑与即时特训，助你由浅入深构建扎实语感。'
                : 'Choose your personalized learning ladder. Each level is broken into 10-word bite-sized units with targeted grammar milestones.'}
            </p>
          </div>

          {/* Quick Track Action Cards */}
          <div className="flex flex-wrap gap-2.5 sm:flex-nowrap">
            <button
              onClick={() => onNavigate('grammar')}
              className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-white/90 px-4 py-3 text-left shadow-sm transition hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800/90 dark:hover:bg-slate-800"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">13类时态百科</div>
                <div className="text-[11px] text-slate-500">SPO 主谓宾对照</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('irregular')}
              className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-white/90 px-4 py-3 text-left shadow-sm transition hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-800/90 dark:hover:bg-slate-800"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">不规则动词特训</div>
                <div className="text-[11px] text-slate-500">AAA/ABB/ABC规律</div>
              </div>
            </button>
          </div>
        </div>

        {/* Level Filter Bar */}
        <div className="mt-6 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedLevelFilter('all')}
            className={`shrink-0 rounded-xl px-3.5 py-1.5 font-bold transition ${
              selectedLevelFilter === 'all'
                ? 'bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900'
                : 'bg-white/80 text-slate-600 hover:bg-white dark:bg-slate-800/80 dark:text-slate-300'
            }`}
          >
            {lang === 'zh' ? '全部等级' : 'All Levels'}
          </button>
          {LEVEL_METAS.map((m) => {
            const active = selectedLevelFilter === m.level;
            const stat = levelStats[m.level];
            return (
              <button
                key={m.level}
                onClick={() => setSelectedLevelFilter(m.level)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition ${
                  active
                    ? 'bg-rose-600 text-white shadow'
                    : 'bg-white/80 text-slate-600 hover:bg-white dark:bg-slate-800/80 dark:text-slate-300'
                }`}
              >
                <span>{m.icon}</span>
                <span>{m.tag}</span>
                <span className={`text-[10px] tabular-nums ${active ? 'text-rose-100' : 'text-slate-400'}`}>
                  {stat?.pct ?? 0}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Levels & Units Syllabus Section */}
      <div className="space-y-6">
        {visibleLevels.map((meta) => {
          const data = levelUnits.get(meta.level);
          const units = data?.units ?? [];
          const stat = levelStats[meta.level] ?? { total: 0, learned: 0, pct: 0 };
          const isExpanded = expandedLevels[meta.level] ?? false;
          const grammarArticles = meta.grammarIds
            .map((gid) => ENGLISH_GRAMMAR_WIKI.find((a) => a.id === gid))
            .filter((a): a is GrammarWikiArticle => Boolean(a));

          return (
            <article
              key={meta.level}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              {/* Level Header / Banner */}
              <div className={`border-b border-slate-100 bg-gradient-to-r p-5 sm:p-6 dark:border-slate-800/80 ${meta.color}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm dark:bg-slate-800">
                      {meta.icon}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                          {meta.tag}
                        </span>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                          {meta.badgeZh} · {meta.titleZh}
                        </h2>
                      </div>
                      <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        {meta.descZh}
                      </p>
                    </div>
                  </div>

                  {/* Level Summary and Action Buttons */}
                  <div className="flex items-center gap-3">
                    <div className="hidden text-right text-xs sm:block">
                      <div className="font-bold tabular-nums text-slate-800 dark:text-slate-200">
                        {stat.learned} / {stat.total} {lang === 'zh' ? '词已掌握' : 'learned'}
                      </div>
                      <div className="text-slate-400">{units.length} {lang === 'zh' ? '个关卡' : 'units'}</div>
                    </div>

                    <button
                      onClick={() => startLevelTraining(meta)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 active:scale-95"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      {lang === 'zh' ? '特训本级 (20词)' : 'Practice Level'}
                    </button>

                    <button
                      onClick={() => toggleLevel(meta.level)}
                      className="rounded-xl border border-slate-200 bg-white/90 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                      aria-label="Toggle units"
                    >
                      <ChevronDown
                        className={`h-5 w-5 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Level Progress Bar */}
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${stat.pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-400">
                    {stat.pct}%
                  </span>
                </div>
              </div>

              {/* Grammar Milestones Ribbon */}
              {grammarArticles.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-xs dark:border-slate-800/60 dark:bg-slate-800/40">
                  <span className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    {lang === 'zh' ? '本级核心语法里程碑:' : 'Key Grammar:'}
                  </span>
                  {grammarArticles.map((article) => (
                    <button
                      key={article.id}
                      onClick={() => setActiveGrammarModal(article)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 shadow-2xs transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-rose-500"
                    >
                      <span>📖</span>
                      <span className="font-medium">{article.titleZh}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Units Grid */}
              {isExpanded && (
                <div className="p-5 sm:p-6">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {units.map((unitWords, idx) => {
                      const unitLearned = unitWords.filter((w) => isWordStudied(state.progress[w.id])).length;
                      const unitDone = unitLearned === unitWords.length && unitWords.length > 0;
                      const preview = unitWords.slice(0, 4).map((w) => w.hanzi).join(' · ');

                      return (
                        <div
                          key={idx}
                          className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                            unitDone
                              ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-950/60 dark:bg-emerald-950/20'
                              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/40'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 font-bold text-xs text-slate-900 dark:text-slate-100">
                                {unitDone ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <Circle className="h-4 w-4 text-slate-400" />
                                )}
                                第 {idx + 1} 关 · Unit {idx + 1}
                              </span>
                              <span className="text-xs font-semibold tabular-nums text-slate-500">
                                {unitLearned}/{unitWords.length}
                              </span>
                            </div>

                            <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300 truncate" title={preview}>
                              {preview}
                            </p>
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700/60">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{
                                  width: `${(unitLearned / (unitWords.length || 1)) * 100}%`,
                                }}
                              />
                            </div>

                            <button
                              onClick={() => startUnitTraining(meta, idx, unitWords)}
                              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-xs ${
                                unitDone
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-rose-600 text-white hover:bg-rose-700'
                              }`}
                            >
                              <Play className="h-3 w-3 fill-current" />
                              {unitDone
                                ? (lang === 'zh' ? '巩固复习' : 'Review')
                                : (lang === 'zh' ? '开启关卡' : 'Start Unit')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Grammar Article Quick Modal */}
      {activeGrammarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                  {activeGrammarModal.level}
                </span>
                <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                  {activeGrammarModal.titleZh}
                </h3>
                <div className="text-xs text-slate-500">{activeGrammarModal.titleEn}</div>
              </div>
              <button
                onClick={() => setActiveGrammarModal(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <p className="rounded-2xl bg-slate-50 p-3.5 text-slate-700 leading-relaxed dark:bg-slate-800/60 dark:text-slate-200">
                {activeGrammarModal.summaryZh}
              </p>

              {activeGrammarModal.formula && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-xs font-mono font-bold text-amber-900 dark:border-amber-950/60 dark:bg-amber-950/30 dark:text-amber-200">
                  ⚡ 核心句式: {activeGrammarModal.formula}
                </div>
              )}

              <div className="space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">核心规则与例句</div>
                {activeGrammarModal.rules.map((r, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{r.ruleZh}</div>
                    <div className="mt-1 font-mono text-rose-600 dark:text-rose-400">{r.exampleEn}</div>
                    <div className="text-xs text-slate-500">{r.exampleZh}</div>
                  </div>
                ))}
              </div>

              {activeGrammarModal.pitfallsZh && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5 text-xs text-rose-800 dark:border-rose-950/60 dark:bg-rose-950/30 dark:text-rose-300">
                  <b>⚠️ 常见易错避坑:</b> {activeGrammarModal.pitfallsZh}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveGrammarModal(null)}
                className="rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
