import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, ClipboardCheck, Play, ShieldAlert } from 'lucide-react';
import type { SpeechApi } from '../utils/speech';
import type { VocabItem } from '../types';
import { useI18n } from '../i18n/react';
import type { MessageKey } from '../i18n';
import { card, focusRing, primaryBtn, secondaryBtn } from '../grammar/ui';
import { BuildGuide, PinyinGuide, SentenceGuide, ToneGuide } from './Guides';
import { dueDate, gateSummary, moduleStatus, useFoundations, type ModuleStatus } from './progress';
import { QuizRunner } from './QuizRunner';
import { RadicalWiki } from './RadicalWiki';
import { ALL_MODULES, CORE_MODULES, buildQuestions, moduleAvailable, type FoundationModule, type Question } from './questions';

type View = { type: 'home' } | { type: 'guide'; module: FoundationModule } | { type: 'quiz'; module: FoundationModule | 'checkup'; round: number };

const ROUND_SIZE: Record<FoundationModule, number> = { radicals: 10, build: 10, tones: 10, pinyin: 10, pinyin2hanzi: 10, sentences: 6 };
const CHECKUP_PER_MODULE = 4;

const STATUS_STYLE: Record<ModuleStatus, string> = {
  new: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  due: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
};

function questionsFor(module: FoundationModule | 'checkup', vocab: VocabItem[], due: FoundationModule[]): Question[] {
  if (module === 'checkup') {
    return due.slice(0, 4).flatMap((m) => buildQuestions(m, m === 'sentences' ? 2 : CHECKUP_PER_MODULE, { vocab }));
  }
  return buildQuestions(module, ROUND_SIZE[module], { vocab });
}

interface HubProps {
  vocab: VocabItem[];
  speech: SpeechApi;
}

/** Foundations: the basics of Chinese (radicals, tone, pinyin spelling, sentence order) with a pass mark and regular re-checks. */
export function FoundationsHub({ vocab, speech }: HubProps) {
  const { t, formatDate, formatNumber } = useI18n();
  const { progress } = useFoundations();
  const [view, setView] = useState<View>({ type: 'home' });
  const gate = gateSummary(progress);

  // A round is built once per start so the questions do not change while the learner answers.
  const questions = useMemo(
    () => (view.type === 'quiz' ? questionsFor(view.module, vocab, gate.attention) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view.type === 'quiz' ? view.module : null, view.type === 'quiz' ? view.round : 0],
  );

  const title = (m: FoundationModule) => t(`foundations.mod.${m}.title` as MessageKey);

  if (view.type === 'quiz') {
    return (
      <div className="space-y-3">
        <BackButton onClick={() => setView({ type: 'home' })} />
        <QuizRunner
          key={`${view.module}-${view.round}`}
          questions={questions}
          speech={speech}
          title={view.module === 'checkup' ? t('foundations.checkup') : title(view.module)}
          onClose={() => setView({ type: 'home' })}
          onAgain={() => setView({ type: 'quiz', module: view.module, round: view.round + 1 })}
        />
      </div>
    );
  }

  if (view.type === 'guide') {
    const m = view.module;
    const guide: Record<FoundationModule, ReactNode> = {
      radicals: <RadicalWiki speech={speech} />,
      build: <BuildGuide />,
      tones: <ToneGuide speech={speech} />,
      pinyin: <PinyinGuide />,
      pinyin2hanzi: null,
      sentences: <SentenceGuide />,
    };
    return (
      <div className="space-y-4">
        <BackButton onClick={() => setView({ type: 'home' })} />
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title(m)}</h2>
        {guide[m]}
        <button type="button" className={primaryBtn} onClick={() => setView({ type: 'quiz', module: m, round: 0 })}>
          <Play className="h-4 w-4" aria-hidden /> {t('foundations.practice')}
        </button>
      </div>
    );
  }

  const dueNow = gate.due;
  const renderModule = (m: FoundationModule) => {
    const p = progress.modules[m];
    const status = moduleStatus(p);
    const available = moduleAvailable(m, vocab);
    const hasGuide = m !== 'pinyin2hanzi';
    const due = dueDate(p);
    return (
      <li key={m} className={`${card} space-y-3 p-4`} data-module={m} data-status={status}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title(m)}</h3>
            <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{t(`foundations.mod.${m}.desc` as MessageKey)}</p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}>
            {status === 'ok' && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
            {status === 'ok' && due ? t('foundations.status.ok', { date: formatDate(due, { month: 'short', day: 'numeric' }) }) : t(`foundations.status.${status}` as MessageKey)}
          </span>
        </div>
        {p?.lastScore !== undefined && (
          <p className="text-xs text-slate-600 dark:text-slate-300">{t('foundations.lastScore', { percent: formatNumber(p.lastScore, { style: 'percent' }) })}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {hasGuide && (
            <button type="button" className={secondaryBtn} onClick={() => setView({ type: 'guide', module: m })}>
              <BookOpen className="h-4 w-4" aria-hidden /> {t('foundations.learn')}
            </button>
          )}
          <button type="button" className={status === 'new' || status === 'due' ? primaryBtn : secondaryBtn} onClick={() => setView({ type: 'quiz', module: m, round: 0 })} disabled={!available}>
            <Play className="h-4 w-4" aria-hidden /> {t('foundations.practice')}
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('foundations.title')}</h2>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{t('foundations.intro')}</p>
      </div>

      {dueNow.length > 0 && (
        <div className={`${card} flex flex-wrap items-center justify-between gap-3 border-amber-300 p-4 dark:border-amber-800`}>
          <p className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">{t('foundations.checkupHint', { count: dueNow.length })}</p>
          <button type="button" className={primaryBtn} onClick={() => setView({ type: 'quiz', module: 'checkup', round: 0 })} data-testid="foundations-checkup">
            <ClipboardCheck className="h-4 w-4" aria-hidden /> {t('foundations.checkup')}
          </button>
        </div>
      )}

      <section aria-labelledby="fd-core">
        <h3 id="fd-core" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          {t('foundations.core')}
        </h3>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{CORE_MODULES.map(renderModule)}</ul>
      </section>

      <section aria-labelledby="fd-extra">
        <h3 id="fd-extra" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          {t('foundations.extras')}
        </h3>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{ALL_MODULES.filter((m) => !CORE_MODULES.includes(m)).map(renderModule)}</ul>
      </section>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onClick} data-testid="foundations-back" className={`inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white ${focusRing}`}>
      <ArrowLeft className="h-4 w-4" aria-hidden /> {t('foundations.back')}
    </button>
  );
}

/** A soft gate: reminds the learner of basics that are missing or due. Renders nothing when everything is in order. */
export function FoundationsGate({ onOpen, compact = false }: { onOpen: () => void; compact?: boolean }) {
  const { t, formatList } = useI18n();
  const { progress } = useFoundations();
  const gate = gateSummary(progress);
  if (gate.attention.length === 0) return null;
  const missing = gate.missing.length > 0;
  const names = formatList((missing ? gate.missing : gate.due).map((m) => t(`foundations.mod.${m}.title` as MessageKey)));
  return (
    <div
      role="note"
      data-testid="foundations-gate"
      className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${missing ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30'} ${compact ? 'text-sm' : ''}`}
    >
      <ShieldAlert className={`h-5 w-5 shrink-0 ${missing ? 'text-amber-600' : 'text-sky-600'}`} aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-slate-800 dark:text-slate-100">{missing ? t('foundations.gate.missing', { list: names }) : t('foundations.gate.due', { list: names })}</p>
      <button type="button" className={secondaryBtn} onClick={onOpen}>
        {t('foundations.gate.cta')}
      </button>
    </div>
  );
}
