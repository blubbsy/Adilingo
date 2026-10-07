import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, Play, Search, Star, X } from 'lucide-react';
import type { CardProgress, Curriculum, HskLevel, SessionRequest, UserState, VocabItem } from '../types';
import { CURRICULA, levelLabel } from '../data/vocab';
import { normalizePinyin, stripTones } from '../utils/pinyinHelper';
import { allTopics, isLearned } from '../utils/analytics';
import { RADICAL_MEANINGS } from '../utils/radicals';
import type { SpeechApi } from '../utils/speech';
import { formatInterval } from './ReviewCard';
import { AudioButton } from './AudioButton';
import { FreePinyin, HanziText, PinyinText } from './ToneText';

interface Props {
  vocab: VocabItem[];
  state: UserState;
  speech: SpeechApi;
  onStart: (req: SessionRequest) => void;
  onToggleStar: (wordId: string) => void;
}

type SrsStatus = 'new' | 'learning' | 'learned' | 'leech';
type Status = 'all' | 'starred' | SrsStatus;
const PAGE = 60;

interface Indexed {
  item: VocabItem;
  pinyinMarked: string;
  pinyinBare: string;
  english: string;
}

function statusOf(state: UserState, item: VocabItem): SrsStatus {
  const p = state.progress[item.id];
  if (!p) return 'new';
  if (p.recognition?.isLeech || p.recall?.isLeech) return 'leech';
  return isLearned(state, item) ? 'learned' : 'learning';
}

const STATUS_STYLE: Record<SrsStatus, string> = {
  new: 'bg-slate-300 dark:bg-slate-600',
  learning: 'bg-sky-500',
  learned: 'bg-emerald-500',
  leech: 'bg-amber-500',
};

export function Dictionary({ vocab, state, speech, onStart, onToggleStar }: Props) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<HskLevel | 'all'>('all');
  const [status, setStatus] = useState<Status>('all');
  const [topic, setTopic] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const color = state.settings.colorTones;
  const starredSet = useMemo(() => new Set(state.starredWords ?? []), [state.starredWords]);

  const index = useMemo<Indexed[]>(
    () =>
      vocab.map((item) => {
        const marked = normalizePinyin(item.pinyin);
        return { item, pinyinMarked: marked, pinyinBare: stripTones(marked), english: item.english.join(' | ').toLowerCase() };
      }),
    [vocab],
  );
  const levels = useMemo(() => [...new Set(vocab.map((v) => v.hskLevel))].sort((a, b) => a - b), [vocab]);
  const topics = useMemo(() => allTopics(vocab).sort(), [vocab]);

  const results = useMemo(() => {
    const q = deferredQuery.trim();
    const isHan = /\p{Script=Han}/u.test(q);
    const qPinyin = normalizePinyin(q);
    const qBare = stripTones(qPinyin);
    const toneless = qPinyin === qBare;
    const qEn = q.toLowerCase();
    const scored: { item: VocabItem; score: number }[] = [];
    for (const row of index) {
      const { item } = row;
      if (level !== 'all' && item.hskLevel !== level) continue;
      if (topic !== 'all' && !item.topics.includes(topic)) continue;
      if (status === 'starred') {
        if (!starredSet.has(item.id)) continue;
      } else if (status !== 'all' && statusOf(state, item) !== status) {
        continue;
      }
      let score = 0;
      if (q) {
        if (isHan) {
          score = item.hanzi === q ? 100 : item.hanzi.startsWith(q) ? 60 : item.hanzi.includes(q) ? 30 : 0;
        } else {
          const p = toneless ? row.pinyinBare : row.pinyinMarked;
          const qp = toneless ? qBare : qPinyin;
          if (qp && p === qp) score = 90;
          else if (qp && p.startsWith(qp)) score = 50;
          if (qEn.length >= 2) {
            if (item.english.some((e) => e.toLowerCase() === qEn || e.toLowerCase() === `to ${qEn}`)) score = Math.max(score, 80);
            else if (new RegExp(`\\b${qEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(row.english)) score = Math.max(score, 40);
          }
        }
        if (!score) continue;
      }
      scored.push({ item, score });
    }
    // Stable sort keeps curriculum order (level → frequency) within equal scores.
    if (q) scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.item);
  }, [index, deferredQuery, level, topic, status, state, starredSet]);

  useEffect(() => setLimit(PAGE), [deferredQuery, level, topic, status]);

  // Infinite scroll: load the next page when the sentinel comes into view.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && setLimit((l) => l + PAGE), { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [results]);

  const selected = selectedId ? vocab.find((v) => v.id === selectedId) : undefined;
  const selectClass =
    'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 min-h-[44px] sm:min-h-0';

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
      <section className="min-w-0">
        <div className="sticky top-[57px] z-10 -mx-4 bg-slate-50/95 px-4 pb-3 pt-1 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:mx-0 lg:px-0 dark:bg-slate-950/95">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 汉字, pinyin (hao3 / hǎo / hao) or English…"
              className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-base outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-slate-600 dark:bg-slate-900 dark:focus:ring-rose-900"
              aria-label="Search words"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <select value={level} onChange={(e) => setLevel(e.target.value === 'all' ? 'all' : (Number(e.target.value) as HskLevel))} className={selectClass} aria-label="Level">
              <option value="all">All levels</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {levelLabel(l)}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={selectClass} aria-label="Status">
              <option value="all">Any status</option>
              <option value="starred">Starred ({state.starredWords?.length ?? 0})</option>
              <option value="new">Not started</option>
              <option value="learning">Learning</option>
              <option value="learned">Learned</option>
              <option value="leech">Leeches</option>
            </select>
            <select value={topic} onChange={(e) => setTopic(e.target.value)} className={selectClass} aria-label="Category">
              <option value="all">All categories</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="ml-auto self-center text-sm tabular-nums text-slate-500">{results.length.toLocaleString('en')} words</span>
          </div>
          {status === 'starred' && results.length > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="font-medium">
                {results.length} starred {results.length === 1 ? 'word' : 'words'}
              </span>
              <button
                type="button"
                onClick={() =>
                  onStart({
                    label: `Starred words (${results.length})`,
                    mode: state.settings.defaultMode,
                    levels: [],
                    topics: [],
                    wordIds: results.map((w) => w.id),
                    includeNotDue: true,
                    ignoreCap: true,
                    limit: results.length,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 font-semibold text-white shadow-sm transition hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
              >
                <Play className="h-4 w-4" aria-hidden /> Practice starred ({results.length})
              </button>
            </div>
          )}
        </div>

        <ul className="mt-1 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-700/70 dark:border-slate-700 dark:bg-slate-800/70">
          {results.slice(0, limit).map((item) => {
            const st = statusOf(state, item);
            const active = item.id === selectedId;
            const isStarred = starredSet.has(item.id);
            return (
              <li key={item.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  aria-current={active ? 'true' : undefined}
                  className={`flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-700/40 ${
                    active ? 'bg-rose-50 dark:bg-rose-950/30' : ''
                  }`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_STYLE[st]}`} title={st} aria-label={st} />
                  <HanziText item={item} color={color} className="min-w-[3.5rem] shrink-0 text-2xl" />
                  <span className="min-w-0 flex-1">
                    <PinyinText item={item} color={color} className="block text-sm" />
                    <span className="block truncate text-sm text-slate-600 dark:text-slate-300">{item.english.slice(0, 3).join('; ')}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {levelLabel(item.hskLevel, state.settings.course)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleStar(item.id)}
                  aria-label={isStarred ? `Unstar ${item.hanzi}` : `Star ${item.hanzi}`}
                  title={isStarred ? 'Unstar word' : 'Star word'}
                  className="px-3.5 py-3 text-slate-400 hover:text-amber-500 focus-visible:outline-none focus-visible:text-amber-500 transition"
                >
                  <Star
                    className={`h-5 w-5 transition ${
                      isStarred
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400'
                    }`}
                  />
                </button>
              </li>
            );
          })}
          {results.length === 0 && <li className="p-6 text-center text-slate-500">No words match.</li>}
        </ul>
        {limit < results.length && (
          <div ref={sentinel} className="py-4 text-center">
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">
              Show more ({(results.length - limit).toLocaleString('en')} left)
            </button>
          </div>
        )}
      </section>

      {/* Detail: side panel on large screens, bottom sheet on small ones. */}
      <aside className="hidden lg:block">
        <div className="sticky top-6">
          {selected ? (
            <WordDetail item={selected} progress={state.progress[selected.id]} state={state} speech={speech} onStart={onStart} onToggleStar={onToggleStar} />
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">
              <BookMarked className="h-8 w-8" aria-hidden />
              Select a word to see details.
            </div>
          )}
        </div>
      </aside>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/50 backdrop-blur-sm lg:hidden" onClick={() => setSelectedId(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.hanzi} details`}
            onClick={(e) => e.stopPropagation()}
            className="animate-pop max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] dark:bg-slate-800 sm:mx-auto sm:max-w-xl"
          >
            <div className="flex justify-end p-2">
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 pb-6">
              <WordDetail item={selected} progress={state.progress[selected.id]} state={state} speech={speech} onStart={onStart} onToggleStar={onToggleStar} bare />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WordDetail({
  item,
  progress,
  state,
  speech,
  onStart,
  onToggleStar,
  bare,
}: {
  item: VocabItem;
  progress?: CardProgress;
  state: UserState;
  speech: SpeechApi;
  onStart: (req: SessionRequest) => void;
  onToggleStar: (wordId: string) => void;
  bare?: boolean;
}) {
  const color = state.settings.colorTones;
  const ex = item.exampleSentence;
  const isStarred = (state.starredWords ?? []).includes(item.id);
  return (
    <div className={bare ? 'space-y-4' : 'space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/70'}>
      <div className="text-center">
        <HanziText item={item} color={color} className="text-6xl" />
        <div className="mt-2 flex items-center justify-center gap-3">
          <PinyinText item={item} color={color} className="text-2xl" />
          <AudioButton speech={speech} text={item.hanzi} rate={state.settings.speechRate} />
          <button
            type="button"
            onClick={() => onToggleStar(item.id)}
            title={isStarred ? 'Remove from starred' : 'Add to starred'}
            aria-label={isStarred ? 'Remove from starred' : 'Add to starred'}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-amber-500 transition dark:hover:bg-slate-700"
          >
            <Star className={`h-6 w-6 transition ${isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
          </button>
        </div>
      </div>
      <ol className="list-decimal space-y-0.5 pl-5 text-slate-700 dark:text-slate-200">
        {item.english.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ol>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {(state.settings.course ?? 'chinese') === 'chinese' ? (
          CURRICULA.map((c) => (
            <div key={c.id} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/60">
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">{c.short}</dt>
              <dd className="font-medium">{item.levels[c.id as Curriculum] ? levelLabel(item.levels[c.id as Curriculum]!, 'chinese') : '—'}</dd>
            </div>
          ))
        ) : (
          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/60">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">CEFR Standard</dt>
            <dd className="font-medium">{levelLabel(item.hskLevel, 'english')}</dd>
          </div>
        )}
        {item.radical && (
          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/60">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">Radical</dt>
            <dd>
              <span className="font-hanzi text-lg">{item.radical}</span> <span className="text-slate-500">{RADICAL_MEANINGS[item.radical] ?? ''}</span>
            </dd>
          </div>
        )}
        {item.measureWord && (
          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/60">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">Measure word</dt>
            <dd>
              <span className="font-hanzi text-lg">{item.measureWord.hanzi}</span> <FreePinyin text={item.measureWord.pinyin} color={color} />
            </dd>
          </div>
        )}
        <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/60">
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">Category</dt>
          <dd>{item.topics.join(', ')}</dd>
        </div>
      </dl>
      {ex && (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`cursor-pointer hover:opacity-80 transition ${
                /[\u4e00-\u9fa5]/.test(ex.hanzi) ? 'font-hanzi text-lg' : 'font-sans text-base font-semibold'
              }`}
              lang={/[\u4e00-\u9fa5]/.test(ex.hanzi) ? 'zh-CN' : 'en'}
              onClick={() => speech.speak(ex.hanzi, state.settings.speechRate)}
              title="Click to hear example sentence"
            >
              {ex.hanzi}
            </p>
            <AudioButton speech={speech} text={ex.hanzi} rate={state.settings.speechRate} />
          </div>
          {ex.pinyin && <FreePinyin text={ex.pinyin} color={color} className="block text-sm" />}
          <p className="text-sm text-slate-600 dark:text-slate-300">{ex.english}</p>
          {ex.source && (
            <p className="mt-1 text-[11px] text-slate-400">
              <a href={`https://tatoeba.org/sentences/show/${ex.source}`} target="_blank" rel="noreferrer" className="underline">
                Tatoeba #{ex.source}
              </a>{' '}
              · CC-BY 2.0 FR · pinyin auto-generated
            </p>
          )}
        </div>
      )}
      <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/60">
        {progress && (progress.recognition || progress.recall || progress.manuallyMarkedKnown) ? (
          <p>
            {progress.manuallyMarkedKnown ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Marked as already known</span>
            ) : (
              <>
                {(progress.recognition?.isLeech || progress.recall?.isLeech) ? 'Leech · ' : ''}
                Reviewed {((progress.recognition?.history.length ?? 0) + (progress.recall?.history.length ?? 0))}× ·
                stability {(progress.recognition?.stability ?? progress.recall?.stability ?? 0).toFixed(1)}d
                {progress.recognition?.due && (
                  <> · next in {formatInterval(Math.max(0, Math.round((new Date(progress.recognition.due).getTime() - Date.now()) / 86_400_000)))}</>
                )}
              </>
            )}
          </p>
        ) : (
          <p className="text-slate-500">Not studied yet.</p>
        )}
      </div>
      <button
        type="button"
        onClick={() =>
          onStart({ label: `${item.hanzi} · ${item.english[0]}`, mode: state.settings.defaultMode, levels: [], topics: [], wordIds: [item.id], includeNotDue: true, ignoreCap: true, limit: 1 })
        }
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 font-semibold text-white hover:bg-rose-700"
      >
        <Play className="h-4 w-4" aria-hidden /> Practice this word
      </button>
    </div>
  );
}
