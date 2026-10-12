import type { ReactNode } from 'react';
import { AudioButton } from '../components/AudioButton';
import type { SpeechApi } from '../utils/speech';
import { useI18n } from '../i18n/react';
import type { MessageKey } from '../i18n';
import { card } from '../grammar/ui';
import { markSyllable } from '../utils/pinyinHelper';
import { COMPOUND_LIST } from './data/compounds';
import { MARK_CASES, SANDHI_CASES, TONE_SETS, type SandhiRuleId } from './data/tones';
import { SENTENCE_LEVELS, SENTENCE_ROLES } from './data/sentences';
import { PINYIN_RULE_IDS, pinyinProblems, validSyllables } from './pinyinRules';
import { RoleChip } from './SentenceOrder';

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${card} space-y-3 p-4`}>
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      {children}
    </section>
  );
}

const SANDHI_ORDER: SandhiRuleId[] = ['third', 'bu', 'yi-fourth', 'yi-other', 'yi-stays', 'bu-neutral', 'neutral'];

/** Tone reference: marks on every vowel, where the mark goes, same syllable in four tones, tone changes with exceptions. */
export function ToneGuide({ speech }: { speech: SpeechApi }) {
  const { t, tx } = useI18n();
  const vowels = ['a', 'o', 'e', 'i', 'u', 'ü'];
  return (
    <div className="space-y-3">
      <Panel title={t('foundations.tones.chartTitle')}>
        <p className="text-sm text-slate-700 dark:text-slate-200">{t('foundations.rule.tone-marks')}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-lg">
            <tbody>
              {vowels.map((v) => (
                <tr key={v} className="border-t border-slate-100 first:border-0 dark:border-slate-800">
                  {[1, 2, 3, 4].map((n) => (
                    <td key={n} className="px-2 py-1.5 font-medium text-slate-900 dark:text-slate-100">
                      {markSyllable(v, n)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={t('foundations.tones.markTitle')}>
        <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
          {(['a-e', 'ou', 'iu-ui', 'last'] as const).map((r) => {
            const ex = MARK_CASES.find((c) => c.rule === r);
            return (
              <li key={r}>
                {tx(`foundations.rule.mark-${r}`, '')}
                {ex && <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">{markSyllable(ex.numbered.slice(0, -1), Number(ex.numbered.slice(-1)))}</span>}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title={t('foundations.tones.setsTitle')}>
        <p className="text-sm text-slate-700 dark:text-slate-200">{t('foundations.rule.tone-meaning')}</p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TONE_SETS.filter((s) => s.members.length === 4)
            .slice(0, 6)
            .map((s) => (
              <li key={s.syllable} className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
                <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                  {s.members.map((m) => (
                    <li key={m.tone} className="flex items-center gap-1">
                      <span lang="zh-CN" className="font-hanzi text-lg text-slate-900 dark:text-slate-100">{m.hanzi}</span>
                      <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200">
                        {m.pinyin} · {m.meaning}
                      </span>
                      <AudioButton speech={speech} text={m.hanzi} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
        </ul>
      </Panel>

      <Panel title={t('foundations.tones.sandhiTitle')}>
        <div className="space-y-4">
          {SANDHI_ORDER.map((rule) => {
            const cases = SANDHI_CASES.filter((c) => c.rule === rule);
            const exception = cases.some((c) => c.exception);
            return (
              <div key={rule}>
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  {exception && <span className="mr-1.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t('foundations.tones.exception')}</span>}
                  {tx(`foundations.rule.sandhi-${rule}`, '')}
                </p>
                <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {cases.map((c) => (
                    <li key={c.hanzi} className="flex items-center gap-2 rounded-xl bg-slate-50 px-2 py-1.5 text-xs dark:bg-slate-800/60">
                      <span lang="zh-CN" className="font-hanzi text-lg text-slate-900 dark:text-slate-100">{c.hanzi}</span>
                      <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200">
                        <span className="block">
                          {t('foundations.tones.written')}: {c.written}
                        </span>
                        <span className="block font-semibold">
                          {t('foundations.tones.spoken')}: {c.spoken}
                        </span>
                      </span>
                      <AudioButton speech={speech} text={c.hanzi} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/** The spelling rules, each with an example that breaks it. */
export function PinyinGuide() {
  const { t, tx } = useI18n();
  const problems = pinyinProblems();
  return (
    <div className="space-y-3">
      <Panel title={t('foundations.pinyin.rulesTitle')}>
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{t('foundations.pinyin.gHeadline')}</p>
        <ul className="space-y-3">
          {PINYIN_RULE_IDS.map((id) => {
            const examples = problems.filter((p) => p.rule === id).slice(0, 4);
            return (
              <li key={id} className="text-sm text-slate-700 dark:text-slate-200">
                <p>{tx(`foundations.rule.${id}`, '')}</p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {examples.map((p) => (
                    <span key={p.syllable} className="rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-800 line-through dark:bg-red-950/40 dark:text-red-200">
                      {p.syllable}
                    </span>
                  ))}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-slate-600 dark:text-slate-300">{t('foundations.pinyin.validTitle', { count: validSyllables().length })}</p>
      </Panel>
    </div>
  );
}

/** How characters are built: meaning + sound compounds, meaning + meaning compounds and sound families. */
export function BuildGuide() {
  const { t } = useI18n();
  const families = ['青', '包', '马'].map((f) => ({ f, members: COMPOUND_LIST.filter((c) => c.family === f) }));
  return (
    <div className="space-y-3">
      <Panel title={t('foundations.build.explainTitle')}>
        <p className="text-sm text-slate-700 dark:text-slate-200">
          <strong>{t('foundations.build.sound')}</strong> {t('foundations.rule.build-phonetic')}
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-200">
          <strong>{t('foundations.build.meaning')}</strong> {t('foundations.rule.build-meaning')}
        </p>
      </Panel>
      {families.map(({ f, members }) => (
        <Panel key={f} title={t('foundations.build.family', { part: f })}>
          <p className="text-xs text-slate-600 dark:text-slate-300">{t('foundations.build.familyHint')}</p>
          <ul className="flex flex-wrap gap-2">
            {members.map((c) => (
              <li key={c.hanzi} className="rounded-xl bg-slate-50 px-3 py-1.5 text-center dark:bg-slate-800/60">
                <span lang="zh-CN" className="block font-hanzi text-2xl text-slate-900 dark:text-slate-100">{c.hanzi}</span>
                <span className="block text-xs text-slate-700 dark:text-slate-200">{c.pinyin}</span>
                <span className="block text-[11px] text-slate-600 dark:text-slate-300">{c.meaning}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

/** Role legend and the order rules by level. */
export function SentenceGuide() {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <Panel title={t('foundations.order.roles')}>
        <ul className="flex flex-wrap gap-1.5">
          {SENTENCE_ROLES.map((r) => (
            <li key={r}>
              <RoleChip role={r} />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={t('foundations.mod.sentences.title')}>
        <ol className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
          {SENTENCE_LEVELS.map((n) => (
            <li key={n}>
              <span className="mr-2 font-semibold text-slate-900 dark:text-slate-100">{t('foundations.order.level', { n })}</span>
              {t(`foundations.sentence.level.${n}` as MessageKey)}
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
