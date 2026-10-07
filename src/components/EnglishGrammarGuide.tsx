import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Layers,
  Search,
  Sparkles,
  Table as TableIcon,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  ACTIVE_PASSIVE_RULES,
  ENGLISH_TENSES,
  MASTER_VERB_EXAMPLE,
  type PersonGroup,
  type TenseGroup,
} from '../data/englishGrammarMaster';
import {
  ENGLISH_GRAMMAR_WIKI,
  GRAMMAR_CATEGORIES,
  type GrammarCategory,
  type GrammarWikiArticle,
} from '../data/englishGrammarWiki';
import type { SpeechApi } from '../utils/speech';

interface Props {
  speech: SpeechApi;
  onOpenIrregularVerbs?: () => void;
}

type MainTab = 'wiki' | 'tenses' | 'passive';

const TENSE_GROUPS: { id: TenseGroup | 'all'; labelZh: string; labelEn: string }[] = [
  { id: 'all', labelZh: '全部时态 (13类)', labelEn: 'All Tenses' },
  { id: 'present', labelZh: '现在时态 (4类)', labelEn: 'Present' },
  { id: 'past', labelZh: '过去时态 (4类)', labelEn: 'Past' },
  { id: 'future', labelZh: '将来时态 (3类)', labelEn: 'Future' },
  { id: 'conditional', labelZh: '条件与虚拟 (2类)', labelEn: 'Conditional' },
];

const PERSON_TABS: { id: PersonGroup; labelZh: string; subjectName: string }[] = [
  { id: 'first', labelZh: '第一人称 (I)', subjectName: 'I' },
  { id: 'third_singular', labelZh: '第三人称单数 (He / She / It)', subjectName: 'He / She / It' },
  { id: 'plural', labelZh: '复数 / 第二人称 (They / We)', subjectName: 'We / They' },
];

export function EnglishGrammarGuide({ speech, onOpenIrregularVerbs }: Props) {
  const [activeTab, setActiveTab] = useState<MainTab>('wiki');
  const [searchQuery, setSearchQuery] = useState('');

  // Wikipedia filter state
  const [selectedWikiCategory, setSelectedWikiCategory] = useState<GrammarCategory | 'all'>('all');
  const [expandedWikiId, setExpandedWikiId] = useState<string | null>(null);

  // Tense guide state
  const [selectedGroup, setSelectedGroup] = useState<TenseGroup | 'all'>('all');
  const [selectedPerson, setSelectedPerson] = useState<PersonGroup>('third_singular');
  const [tenseViewMode, setTenseViewMode] = useState<'cards' | 'spo_table'>('cards');
  const [expandedTenseId, setExpandedTenseId] = useState<string | null>(null);

  // Filtered Wikipedia articles
  const filteredWikiArticles = useMemo(() => {
    return ENGLISH_GRAMMAR_WIKI.filter((art) => {
      const matchCat = selectedWikiCategory === 'all' || art.category === selectedWikiCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        art.titleEn.toLowerCase().includes(q) ||
        art.titleZh.toLowerCase().includes(q) ||
        art.summaryZh.toLowerCase().includes(q) ||
        art.keywords.some((k) => k.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [selectedWikiCategory, searchQuery]);

  // Filtered Tenses
  const filteredTenses = useMemo(() => {
    return ENGLISH_TENSES.filter((t) => {
      const matchGrp = selectedGroup === 'all' || t.group === selectedGroup;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        t.nameEn.toLowerCase().includes(q) ||
        t.nameZh.toLowerCase().includes(q) ||
        t.signalWords.some((w) => w.toLowerCase().includes(q));
      return matchGrp && matchSearch;
    });
  }, [selectedGroup, searchQuery]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-2 py-4 sm:px-4">
      {/* Header Banner */}
      <header className="relative overflow-hidden rounded-3xl border border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-amber-50/40 p-6 shadow-sm dark:border-rose-900/50 dark:from-slate-800 dark:via-slate-800 dark:to-rose-950/20 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
              <Sparkles className="h-3.5 w-3.5" /> English Grammar Wikipedia & Blueprint
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              英语语法百科全书与时态速查
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              权威完整的英语语法百科库：涵盖<strong>五大核心句型、定状名三大从句、非谓语动词、虚拟语气、情态推测</strong>，以及以单一经典例句（
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                &ldquo;write a letter&rdquo; / 写信
              </span>
              ）贯通的 <strong>13大时态 SPO (主谓宾) 蓝图</strong>。
            </p>
          </div>

          {onOpenIrregularVerbs && (
            <button
              onClick={onOpenIrregularVerbs}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-700 active:scale-95"
            >
              <Zap className="h-4 w-4" />
              不规则动词专项特训 (V₁ / V₂ / V₃)
            </button>
          )}
        </div>

        {/* Universal Search Bar */}
        <div className="mt-6 relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索任何英语语法点，例如：定语从句、虚拟语气、倒装句、不定式、现在完成时、happen被动..."
            className="w-full rounded-2xl border border-slate-200 bg-white/95 py-3.5 pl-12 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Section Navigation Tabs */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-rose-200/60 pt-4 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('wiki')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'wiki'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            📖 语法百科速查库 (Grammar Wiki)
          </button>
          <button
            onClick={() => setActiveTab('tenses')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'tenses'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            <TableIcon className="h-4 w-4" />
            ⏱️ 13大时态与SPO总表 (Tenses Blueprint)
          </button>
          <button
            onClick={() => setActiveTab('passive')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'passive'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            <Layers className="h-4 w-4" />
            🔄 主动与被动语态蜕变规则
          </button>
        </div>
      </header>

      {/* TAB 1: Grammar Wikipedia */}
      {activeTab === 'wiki' && (
        <section className="space-y-6 animate-fade-in">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
            {GRAMMAR_CATEGORIES.map((cat) => {
              const active = selectedWikiCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedWikiCategory(cat.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    active
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.labelZh}</span>
                </button>
              );
            })}
          </div>

          {/* Article List */}
          <div className="space-y-4">
            {filteredWikiArticles.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                未找到与 &ldquo;{searchQuery}&rdquo; 匹配的语法百科条目。尝试搜索其它关键词。
              </div>
            ) : (
              filteredWikiArticles.map((art: GrammarWikiArticle) => {
                const isExpanded = expandedWikiId === art.id;
                return (
                  <article
                    key={art.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  >
                    {/* Header */}
                    <div
                      onClick={() => setExpandedWikiId(isExpanded ? null : art.id)}
                      className="cursor-pointer flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6 transition hover:bg-slate-50/50 dark:hover:bg-slate-750"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            CEFR {art.level}
                          </span>
                          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                            {art.titleZh}
                          </h2>
                          <span className="text-xs font-medium text-slate-400">({art.titleEn})</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {art.summaryZh}
                        </p>
                        {art.formula && (
                          <div className="mt-2 inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-semibold text-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                            核心公式：{art.formula}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {isExpanded ? '收起详情' : '展开规则与例句'}
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Detailed Rules & Examples */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-5 sm:p-6 space-y-4 animate-fade-in dark:border-slate-700/60 dark:bg-slate-900/30">
                        <div className="space-y-3">
                          {art.rules.map((rule, idx) => (
                            <div
                              key={idx}
                              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-700 dark:bg-slate-800"
                            >
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {rule.ruleZh}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                                  {rule.exampleEn}
                                </div>
                                <button
                                  onClick={() => speech.speak(rule.exampleEn)}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                                  title="朗读"
                                >
                                  <Volume2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{rule.exampleZh}</div>
                            </div>
                          ))}
                        </div>

                        {/* Pitfalls & Traps */}
                        {art.pitfallsZh && (
                          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                            <div>
                              <strong>易错陷阱与避坑准则：</strong> {art.pitfallsZh}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* TAB 2: Tenses & SPO Blueprint */}
      {activeTab === 'tenses' && (
        <section className="space-y-6 animate-fade-in">
          {/* Controls: Tense Group & Person & View */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-slate-500">时态分组:</span>
              {TENSE_GROUPS.map((g) => {
                const active = selectedGroup === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGroup(g.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    {g.labelZh}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Person switcher */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900/50">
                {PERSON_TABS.map((p) => {
                  const active = selectedPerson === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPerson(p.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        active
                          ? 'bg-white font-bold text-rose-600 shadow-sm dark:bg-slate-800 dark:text-rose-400'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      }`}
                      title={p.labelZh}
                    >
                      主语: {p.subjectName}
                    </button>
                  );
                })}
              </div>

              {/* Cards vs SPO Table Mode */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900/50">
                <button
                  onClick={() => setTenseViewMode('cards')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
                    tenseViewMode === 'cards'
                      ? 'bg-white font-bold text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5" /> 结构卡片
                </button>
                <button
                  onClick={() => setTenseViewMode('spo_table')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
                    tenseViewMode === 'spo_table'
                      ? 'bg-white font-bold text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  <TableIcon className="h-3.5 w-3.5" /> SPO 主谓宾总表
                </button>
              </div>
            </div>
          </div>

          {/* Cards View */}
          {tenseViewMode === 'cards' ? (
            <div className="space-y-4">
              {filteredTenses.map((tense) => {
                const conj = tense.conjugations[selectedPerson];
                const isExpanded = expandedTenseId === tense.id;

                return (
                  <article
                    key={tense.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/80"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-5 dark:border-slate-700/60 dark:bg-slate-800/40 sm:p-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            {tense.nameZh}
                          </span>
                          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-xl">
                            {tense.nameEn}
                          </h2>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {tense.summaryZh} ({tense.summaryEn})
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedTenseId(isExpanded ? null : tense.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {isExpanded ? '收起详情' : '展开规则与标志词'}
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="p-5 sm:p-6">
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Active Voice Box */}
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-950/40 dark:bg-emerald-950/20">
                          <div className="flex items-center justify-between">
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                              主动语态 (Active Voice)
                            </span>
                            <button
                              onClick={() => speech.speak(conj.fullActive)}
                              className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                              title="听发音"
                            >
                              <Volume2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                            <span className="text-slate-500">{conj.subject} </span>
                            <span className="rounded bg-emerald-200/80 px-1.5 py-0.5 text-emerald-900 dark:bg-emerald-800/80 dark:text-emerald-100">
                              {conj.verbText}
                            </span>{' '}
                            <span>{MASTER_VERB_EXAMPLE.object}.</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{conj.translation}</p>

                          <div className="mt-3 text-xs text-emerald-800 dark:text-emerald-300">
                            <strong>主动公式：</strong> <code className="font-mono">{tense.formulaActive}</code>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            动词变化特征：<span className="font-semibold text-emerald-700 dark:text-emerald-400">{conj.changedPart}</span>
                          </div>
                        </div>

                        {/* Passive Voice Box */}
                        <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4 dark:border-sky-950/40 dark:bg-sky-950/20">
                          <div className="flex items-center justify-between">
                            <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800 dark:bg-sky-900/60 dark:text-sky-300">
                              被动语态 (Passive Voice)
                            </span>
                            <button
                              onClick={() => speech.speak(tense.passive.sentence)}
                              className="rounded-lg p-1 text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900/50"
                              title="听发音"
                            >
                              <Volume2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                            <span className="text-slate-500">A letter </span>
                            <span className="rounded bg-sky-200/80 px-1.5 py-0.5 text-sky-900 dark:bg-sky-800/80 dark:text-sky-100">
                              {tense.passive.verbPart}
                            </span>{' '}
                            <span className="text-slate-500">
                              {tense.passive.sentence.includes('by') ? 'by him.' : '.'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{tense.passive.translation}</p>

                          <div className="mt-3 text-xs text-sky-800 dark:text-sky-300">
                            <strong>被动公式：</strong> <code className="font-mono">{tense.formulaPassive}</code>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            语态转换关键：<span className="font-medium text-sky-700 dark:text-sky-300">{tense.passive.whatChangedZh}</span>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/40">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            常见时间状语与标志词 (Signal Words):
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {tense.signalWords.map((word) => (
                              <span
                                key={word}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono font-semibold text-slate-700 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {word}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* SPO Master Tense Table */
            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <table className="w-full min-w-[760px] text-left text-xs sm:text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3.5 font-bold">时态 (Tense)</th>
                    <th className="px-3 py-3.5 font-bold">主语 (S)</th>
                    <th className="px-4 py-3.5 font-bold">谓语动词结构 (V)</th>
                    <th className="px-3 py-3.5 font-bold">宾语 (O)</th>
                    <th className="px-4 py-3.5 font-bold">例句 (SPO Complete)</th>
                    <th className="px-4 py-3.5 font-bold">被动语态对应句</th>
                    <th className="px-4 py-3.5 font-bold">核心标志词</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredTenses.map((tense) => {
                    const conj = tense.conjugations[selectedPerson];
                    return (
                      <tr key={tense.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-750">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                          <div>{tense.nameZh}</div>
                          <div className="text-[11px] text-slate-500 font-normal">{tense.nameEn}</div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-rose-600 dark:text-rose-400">
                          {conj.subject}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {conj.verbText}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-500 font-medium">
                          {MASTER_VERB_EXAMPLE.object}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-1.5">
                            <span>{conj.fullActive}</span>
                            <button
                              onClick={() => speech.speak(conj.fullActive)}
                              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="text-[11px] text-slate-500">{conj.translation}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-sky-700 dark:text-sky-300">
                            {tense.passive.sentence}
                          </span>
                          <div className="text-[11px] text-slate-500">{tense.passive.translation}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs font-mono">
                          {tense.signalWords.slice(0, 3).join(', ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: Passive Voice Transformation 3 Golden Rules */}
      {activeTab === 'passive' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8 space-y-6 animate-fade-in">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-xl">
                主动语态 ➔ 被动语态三大黄金蜕变法则
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              任何英语主动句转换成被动语态，都严格遵循以下三步流水线：
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {ACTIVE_PASSIVE_RULES.map((rule, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/40"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {rule.step}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {rule.rule}
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-800">
                  <div className="font-semibold text-slate-500">示例演变：</div>
                  <div className="mt-1 text-slate-800 dark:text-slate-200">{rule.exampleActive}</div>
                  <div className="mt-1 flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                    <ArrowRight className="h-3 w-3" />
                    {rule.examplePassive}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
