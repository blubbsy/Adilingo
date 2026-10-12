import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { AudioButton } from '../components/AudioButton';
import type { SpeechApi } from '../utils/speech';
import { useI18n } from '../i18n/react';
import type { MessageKey } from '../i18n';
import { Zh, card, focusRing, primaryBtn, secondaryBtn } from '../grammar/ui';
import { INTERVAL_DAYS, PASS_RATIO, useFoundations } from './progress';
import type { ChoiceOption, ChoiceQuestion, FoundationModule, Question } from './questions';
import { SentenceOrder } from './SentenceOrder';

interface Props {
  questions: Question[];
  speech: SpeechApi;
  /** Heading above the round (module name or "check-up"). */
  title: string;
  onClose: () => void;
  /** Starts a fresh round of the same kind. */
  onAgain: () => void;
}

type Outcome = { module: FoundationModule; ok: boolean };

export function QuizRunner({ questions, speech, title, onClose, onAgain }: Props) {
  const i18n = useI18n();
  const { t, tx, formatNumber } = i18n;
  const { progress, record } = useFoundations();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [orderDone, setOrderDone] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const finished = index >= questions.length;
  const recorded = useRef(false);
  const q = questions[index];

  const answered = q?.kind === 'choice' ? picked !== null : orderDone;

  const answerChoice = (i: number) => {
    if (!q || q.kind !== 'choice' || picked !== null) return;
    setPicked(i);
    setOutcomes((o) => [...o, { module: q.module, ok: i === q.correct }]);
  };
  const next = () => {
    setPicked(null);
    setOrderDone(false);
    setIndex((i) => i + 1);
  };

  // Keys 1–4 pick an option, Enter continues once answered.
  useEffect(() => {
    if (finished) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (q?.kind === 'choice' && picked === null && /^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < q.options.length) answerChoice(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Record each module's result once, when the last question is done.
  useEffect(() => {
    if (!finished || recorded.current) return;
    recorded.current = true;
    const byModule = new Map<FoundationModule, { correct: number; total: number }>();
    for (const o of outcomes) {
      const cur = byModule.get(o.module) ?? { correct: 0, total: 0 };
      byModule.set(o.module, { correct: cur.correct + (o.ok ? 1 : 0), total: cur.total + 1 });
    }
    byModule.forEach((v, m) => record(m, v.correct, v.total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (questions.length === 0) {
    return (
      <div className={`${card} space-y-3 p-5`}>
        <p className="text-sm text-slate-700 dark:text-slate-200">{t('foundations.empty')}</p>
        <button type="button" className={secondaryBtn} onClick={onClose}>
          {t('foundations.back')}
        </button>
      </div>
    );
  }

  if (finished) {
    const byModule = new Map<FoundationModule, { correct: number; total: number }>();
    for (const o of outcomes) {
      const cur = byModule.get(o.module) ?? { correct: 0, total: 0 };
      byModule.set(o.module, { correct: cur.correct + (o.ok ? 1 : 0), total: cur.total + 1 });
    }
    return (
      <div className={`${card} space-y-4 p-5`} data-testid="foundations-result">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('foundations.result.title')}</h2>
        <ul className="space-y-3">
          {[...byModule.entries()].map(([m, v]) => {
            const ratio = v.correct / v.total;
            const passed = ratio >= PASS_RATIO;
            const box = progress.modules[m]?.box ?? 0;
            return (
              <li key={m} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t(`foundations.mod.${m}.title` as MessageKey)}</span>
                  <span className="text-sm text-slate-700 dark:text-slate-200">
                    {t('foundations.result.score', { correct: v.correct, total: v.total })} · {formatNumber(ratio, { style: 'percent' })}
                  </span>
                </div>
                <p className={`mt-1 flex items-start gap-1.5 text-sm ${passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
                  {passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                  {passed
                    ? t('foundations.result.passed', { days: INTERVAL_DAYS[Math.min(Math.max(box, 1), INTERVAL_DAYS.length - 1)] })
                    : t('foundations.result.failed', { percent: formatNumber(PASS_RATIO, { style: 'percent' }) })}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryBtn} onClick={onClose} data-testid="foundations-done">
            {t('foundations.done')}
          </button>
          <button type="button" className={secondaryBtn} onClick={onAgain}>
            {t('foundations.again')}
          </button>
        </div>
      </div>
    );
  }

  const optionLabel = (o: ChoiceOption) => (o.labelKey ? tx(o.labelKey, o.text, o.vars) : o.text);

  return (
    <div className={`${card} space-y-4 p-4 sm:p-5`} data-testid="foundations-quiz">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
        <span className="text-xs text-slate-600 dark:text-slate-300">{t('foundations.round.progress', { n: index + 1, total: questions.length })}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={index} aria-label={t('foundations.round.progress', { n: index + 1, total: questions.length })}>
        <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>

      {q.kind === 'order' ? (
        <SentenceOrder
          key={q.id}
          q={q}
          speech={speech}
          onAnswered={(ok) => {
            setOrderDone(true);
            setOutcomes((o) => [...o, { module: q.module, ok }]);
          }}
        />
      ) : (
        <ChoiceView q={q} picked={picked} onPick={answerChoice} speech={speech} optionLabel={optionLabel} />
      )}

      {answered && (
        <div className="flex justify-end">
          <button type="button" className={primaryBtn} onClick={next} autoFocus data-testid="foundations-next">
            {index + 1 >= questions.length ? t('foundations.finish') : t('foundations.next')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

function ChoiceView({
  q,
  picked,
  onPick,
  speech,
  optionLabel,
}: {
  q: ChoiceQuestion;
  picked: number | null;
  onPick: (i: number) => void;
  speech: SpeechApi;
  optionLabel: (o: ChoiceOption) => string;
}) {
  const { t, tx } = useI18n();
  const answered = picked !== null;
  const ok = picked === q.correct;
  const rule = q.rule ? tx(`foundations.rule.${q.rule}`, '') : '';
  const single = q.options.length <= 2;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{tx(`foundations.q.${q.variant}`, '')}</p>

      {(q.shown || q.audio) && (
        <div className="flex flex-col items-center gap-2 py-1 text-center">
          {q.shown && (
            <span lang={q.shownHanzi ? 'zh-CN' : undefined} className={`break-words ${q.shownHanzi ? 'font-hanzi text-5xl' : 'text-4xl font-semibold'} text-slate-900 dark:text-slate-100`}>
              {q.shown}
            </span>
          )}
          {q.hint && <span className="text-sm text-slate-600 dark:text-slate-300">{q.hint}</span>}
          {q.audio && <AudioButton speech={speech} text={q.audio} size="lg" label={t('foundations.round.listen')} />}
        </div>
      )}

      <ul className={`grid gap-2 ${single ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {q.options.map((o, i) => {
          const isRight = i === q.correct;
          const isPicked = i === picked;
          const tone = !answered
            ? 'border-slate-200 bg-white hover:border-rose-300 dark:border-slate-700 dark:bg-slate-900'
            : isRight
              ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40'
              : isPicked
                ? 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/40'
                : 'border-slate-200 bg-white opacity-60 dark:border-slate-700 dark:bg-slate-900';
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onPick(i)}
                disabled={answered}
                data-correct={isRight ? 'true' : undefined}
                className={`flex min-h-[3.25rem] w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition disabled:cursor-default ${tone} ${focusRing}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200" aria-hidden>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span lang={o.hanzi ? 'zh-CN' : undefined} className={`block break-words text-slate-900 dark:text-slate-100 ${o.hanzi ? 'font-hanzi text-2xl' : 'text-base'}`}>
                    {optionLabel(o)}
                  </span>
                  {o.sub && <span className="block text-xs text-slate-600 dark:text-slate-300">{o.sub}</span>}
                </span>
                {answered && isRight && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />}
                {answered && isPicked && !isRight && <XCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div role="status" className={`space-y-2 rounded-2xl border p-4 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40'}`}>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{ok ? t('foundations.right') : t('foundations.wrong')}</p>
          {!ok && <p className="text-slate-700 dark:text-slate-200">{t('foundations.rightIs', { answer: optionLabel(q.options[q.correct]) })}</p>}
          {rule && <p className="text-slate-700 dark:text-slate-200">{rule}</p>}
          {q.facts.length > 0 && (
            <ul className="space-y-0.5 text-slate-700 dark:text-slate-200">
              {q.facts.map((f, i) => (
                <li key={i}>
                  <Zh text={f} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
