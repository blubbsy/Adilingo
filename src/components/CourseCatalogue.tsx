import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { CourseId, UserState } from '../types';
import { DOMAIN_FAMILIES, DOMAINS, FAMILY_ICON, domainCourseId, domainName, type DomainInfo } from '../data/domains';
import { isWordLearned } from '../utils/srsEngine';
import { useI18n } from '../i18n/react';

interface Props {
  state: UserState;
  activeCourse: CourseId;
  onSelect: (course: CourseId) => void;
  onClose: () => void;
}

/** Catalogue of the specialty courses: every field can be learned from the Chinese or the English side. */
export function CourseCatalogue({ state, activeCourse, onSelect, onClose }: Props) {
  const { t, lang, formatNumber } = useI18n();
  const [query, setQuery] = useState('');

  const name = (d: DomainInfo) => domainName(d, lang);
  const progressOf = (course: CourseId): number => {
    const progress = course === activeCourse ? state.progress : state.courseProgress?.[course];
    return progress ? Object.values(progress).filter(isWordLearned).length : 0;
  };
  const started = (course: CourseId): boolean => {
    const progress = course === activeCourse ? state.progress : state.courseProgress?.[course];
    return !!progress && Object.keys(progress).length > 0;
  };

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (d: DomainInfo) =>
      !q || `${d.name.en} ${d.name.zh} ${d.description} ${d.topics.join(' ')}`.toLowerCase().includes(q);
    return DOMAIN_FAMILIES.map((family) => ({ family, domains: DOMAINS.filter((d) => d.family === family && matches(d)) })).filter(
      (g) => g.domains.length > 0,
    );
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="catalogue-title">
      <div className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-700">
          <div className="min-w-0">
            <h2 id="catalogue-title" className="text-xl font-bold">{t('catalogue.title')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('catalogue.intro')}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label={t('catalogue.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('catalogue.search')}
              aria-label={t('catalogue.search')}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
        </div>

        <div className="space-y-6 overflow-y-auto p-5">
          {groups.length === 0 && <p className="text-sm text-slate-500">{t('catalogue.empty')}</p>}
          {groups.map(({ family, domains }) => (
            <section key={family} aria-label={t(`catalogue.family.${family}`)}>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span aria-hidden>{FAMILY_ICON[family]}</span> {t(`catalogue.family.${family}`)}
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {domains.map((d) => (
                  <li key={d.id} className="min-w-0 rounded-2xl border border-slate-200 p-4 dark:border-slate-700" data-domain={d.id}>
                    <div className="font-semibold leading-snug">{name(d)}</div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{d.description}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {t('catalogue.terms', { count: d.count })} · {t('catalogue.tiers', { a: d.tiers[0], b: d.tiers[1], c: d.tiers[2] })}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {(['chinese', 'english'] as const).map((track) => {
                        const id = domainCourseId(d.id, track);
                        const active = id === activeCourse;
                        return (
                          <button
                            key={track}
                            type="button"
                            data-course={id}
                            onClick={() => onSelect(id)}
                            aria-current={active ? 'true' : undefined}
                            className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                              active
                                ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40'
                                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span className="block font-medium">{t(`catalogue.track.${track}`)}</span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400">
                              {active
                                ? t('catalogue.active')
                                : started(id)
                                  ? t('catalogue.progress', { learned: formatNumber(progressOf(id)), total: formatNumber(d.count) })
                                  : t('catalogue.start')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-xs text-slate-500">{t('catalogue.draft')}</p>
        </div>
      </div>
    </div>
  );
}
