import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { AudioButton } from '../components/AudioButton';
import type { SpeechApi } from '../utils/speech';
import { useI18n } from '../i18n/react';
import type { MessageKey } from '../i18n';
import { card, focusRing } from '../grammar/ui';
import { RADICALS, radicalForms, type Radical, type RadicalPosition } from './data/radicals';

const POSITIONS: RadicalPosition[] = ['left', 'right', 'top', 'bottom', 'enclosing', 'any'];

function matches(x: Radical, q: string): boolean {
  if (!q) return true;
  const hay = [...radicalForms(x), x.pinyin, x.pinyin.normalize('NFD').replace(/[̀-ͯ]/g, ''), x.meaning, ...x.examples.flatMap((e) => [e.hanzi, e.meaning])].join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
}

/** Browsable list of radicals with meaning, usual position and example characters. */
export function RadicalWiki({ speech }: { speech: SpeechApi }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<RadicalPosition | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => RADICALS.filter((x) => (position === 'all' || x.position === position) && matches(x, query.trim())), [query, position]);

  return (
    <section className="space-y-4" aria-labelledby="radical-wiki-title">
      <div>
        <h2 id="radical-wiki-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('foundations.wiki.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{t('foundations.wiki.intro')}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative block flex-1">
          <span className="sr-only">{t('foundations.wiki.search')}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('foundations.wiki.search')}
            className={`w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 ${focusRing}`}
          />
        </label>
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value as RadicalPosition | 'all')}
          aria-label={t('foundations.wiki.all')}
          className={`rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 ${focusRing}`}
        >
          <option value="all">{t('foundations.wiki.all')}</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {t(`foundations.wiki.position.${p}` as MessageKey)}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300" aria-live="polite">
        {t('foundations.wiki.count', { count: list.length })}
      </p>

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-600 dark:text-slate-300">{t('foundations.wiki.none')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {list.map((x) => {
            const expanded = open === x.id + x.pinyin;
            return (
              <li key={x.id + x.pinyin} className={`${card} ${expanded ? 'sm:col-span-2' : ''}`} data-radical={x.id}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : x.id + x.pinyin)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${focusRing}`}
                >
                  <span lang="zh-CN" className="flex h-12 min-w-[3rem] shrink-0 items-center justify-center rounded-xl bg-rose-50 px-2 font-hanzi text-3xl text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                    {radicalForms(x).join(' ')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{x.meaning}</span>
                    <span className="block text-xs text-slate-600 dark:text-slate-300">
                      {x.pinyin} · {t('foundations.wiki.strokes', { count: x.strokes })}
                    </span>
                  </span>
                </button>
                {expanded && (
                  <div className="space-y-3 border-t border-slate-100 px-3 pb-3 pt-3 text-sm dark:border-slate-800">
                    <p className="text-slate-700 dark:text-slate-200">{x.hint}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {t('foundations.wiki.position', { position: t(`foundations.wiki.position.${x.position}` as MessageKey) })}
                      {x.variant && x.variant !== x.id ? ` · ${t('foundations.wiki.variant', { variant: x.variant })}` : ''}
                    </p>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{t('foundations.wiki.examples')}</h3>
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {x.examples.map((e) => (
                        <li key={e.hanzi} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
                          <span lang="zh-CN" className="font-hanzi text-2xl text-slate-900 dark:text-slate-100">{e.hanzi}</span>
                          <span className="min-w-0 flex-1 text-xs text-slate-700 dark:text-slate-200">
                            <span className="block">{e.pinyin}</span>
                            <span className="block text-slate-600 dark:text-slate-300">{e.meaning}</span>
                          </span>
                          <AudioButton speech={speech} text={e.hanzi} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
