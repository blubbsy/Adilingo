import { useMemo, useState } from 'react';
import { Check, RotateCcw, Undo2 } from 'lucide-react';
import { AudioButton } from '../components/AudioButton';
import type { SpeechApi } from '../utils/speech';
import { useI18n } from '../i18n/react';
import type { MessageKey } from '../i18n';
import { focusRing, primaryBtn, secondaryBtn } from '../grammar/ui';
import { isAcceptedOrder, type SentenceRole, type SentenceTile } from './data/sentences';
import { shuffle, type OrderQuestion } from './questions';

const ROLE_STYLE: Record<SentenceRole, string> = {
  S: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  V: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  O: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  T: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  P: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  A: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  N: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  Asp: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  Q: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200',
  Cv: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  Comp: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  Adj: 'bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200',
  Mod: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
};

export function RoleChip({ role }: { role: SentenceRole }) {
  const { t } = useI18n();
  return <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${ROLE_STYLE[role]}`}>{t(`foundations.role.${role}` as MessageKey)}</span>;
}

function Tile({ tile, showRole, onClick, disabled }: { tile: SentenceTile; showRole: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center shadow-sm transition hover:border-rose-300 disabled:cursor-default disabled:opacity-100 dark:border-slate-700 dark:bg-slate-900 ${focusRing}`}
    >
      <span lang="zh-CN" className="font-hanzi text-xl text-slate-900 dark:text-slate-100">{tile.hanzi}</span>
      <span className="text-xs text-slate-600 dark:text-slate-300">{tile.pinyin}</span>
      {showRole && <RoleChip role={tile.role} />}
    </button>
  );
}

interface Props {
  q: OrderQuestion;
  speech: SpeechApi;
  /** Called once with the result of the first check. */
  onAnswered: (ok: boolean) => void;
}

export function SentenceOrder({ q, speech, onAnswered }: Props) {
  const { t } = useI18n();
  const { item } = q;
  const n = item.tiles.length;
  const bank = useMemo(() => {
    // Shuffle until the order differs from the answer (a 2-tile sentence could otherwise start solved).
    for (let attempt = 0; attempt < 10; attempt++) {
      const order = shuffle(item.tiles.map((_, i) => i), Math.random);
      if (!isAcceptedOrder(item, order)) return order;
    }
    return item.tiles.map((_, i) => i).reverse();
  }, [item]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [result, setResult] = useState<'ok' | 'alt' | 'wrong' | null>(null);
  const done = result !== null;

  const choose = (i: number) => setChosen((c) => (c.includes(i) || c.length >= n ? c : [...c, i]));
  const check = () => {
    const ok = isAcceptedOrder(item, chosen);
    const isMain = item.tiles.every((_, i) => chosen[i] === i);
    setResult(ok ? (isMain ? 'ok' : 'alt') : 'wrong');
    onAnswered(ok);
  };
  const sentence = item.tiles.map((x) => x.hanzi).join('');

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('foundations.order.instruction', { meaning: item.english })}</p>
      <p className="text-xs text-slate-600 dark:text-slate-300">
        {t('foundations.order.level', { n: item.level })} · {t(`foundations.sentence.level.${item.level}` as MessageKey)}
      </p>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{t('foundations.order.answer')}</h3>
        <div
          className="flex min-h-[4.5rem] flex-wrap items-start gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-2 dark:border-slate-600"
          aria-live="polite"
        >
          {chosen.length === 0 && <span className="px-1 py-2 text-sm text-slate-500 dark:text-slate-400">{t('foundations.order.emptyAnswer')}</span>}
          {chosen.map((i) => (
            <Tile key={i} tile={item.tiles[i]} showRole={q.showRoles || done} disabled={done} onClick={() => setChosen((c) => c.filter((x) => x !== i))} />
          ))}
        </div>
      </div>

      {!done && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{t('foundations.order.bank')}</h3>
          <div className="flex flex-wrap gap-2" data-testid="order-bank">
            {bank.map((i) => (
              <div key={i} className={chosen.includes(i) ? 'invisible' : ''}>
                <Tile tile={item.tiles[i]} showRole={q.showRoles} onClick={() => choose(i)} disabled={chosen.includes(i)} />
              </div>
            ))}
          </div>
          {!q.showRoles && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{t('foundations.order.rolesHidden')}</p>}
        </div>
      )}

      {!done && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryBtn} onClick={() => setChosen((c) => c.slice(0, -1))} disabled={chosen.length === 0}>
            <Undo2 className="h-4 w-4" aria-hidden /> {t('foundations.order.undo')}
          </button>
          <button type="button" className={secondaryBtn} onClick={() => setChosen([])} disabled={chosen.length === 0}>
            <RotateCcw className="h-4 w-4" aria-hidden /> {t('foundations.order.reset')}
          </button>
          <button type="button" className={primaryBtn} onClick={check} disabled={chosen.length !== n}>
            <Check className="h-4 w-4" aria-hidden /> {t('foundations.check')}
          </button>
        </div>
      )}

      {done && (
        <div role="status" className={`space-y-2 rounded-2xl border p-4 text-sm ${result === 'wrong' ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'}`}>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{result === 'wrong' ? t('foundations.wrong') : t('foundations.right')}</p>
          {result === 'alt' && <p className="text-slate-700 dark:text-slate-200">{t('foundations.order.alsoOk')}</p>}
          {result === 'wrong' && <p className="text-slate-700 dark:text-slate-200">{t('foundations.order.correctIs')}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {item.tiles.map((x, i) => (
              <span key={i} className="inline-flex flex-col items-center rounded-lg bg-white/70 px-2 py-1 dark:bg-slate-900/60">
                <span lang="zh-CN" className="font-hanzi text-lg">{x.hanzi}</span>
                <span className="text-[11px] text-slate-600 dark:text-slate-300">{x.pinyin}</span>
                <RoleChip role={x.role} />
              </span>
            ))}
            <AudioButton speech={speech} text={sentence} />
          </div>
        </div>
      )}
    </div>
  );
}
