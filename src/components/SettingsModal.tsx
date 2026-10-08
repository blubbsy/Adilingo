import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Database, Download, QrCode, Trash2, Upload, X, Zap } from 'lucide-react';
import type { CourseId, Curriculum, PinyinHelperMode, Settings, StudyMode, ThemePref, UserState } from '../types';
import { getCourseConfig, languageCourses } from '../data/courses';
import { SPEECH_RATES, type SpeechApi } from '../utils/speech';
import { createDefaultState, exportBackup, parseBackup, type StorageBackend } from '../utils/storage';
import { createEmptyGrammarProgress, exportableGrammarProgress, importGrammarProgress, saveGrammarProgress } from '../grammar';
import { AudioButton } from './AudioButton';
import { CHINESE_MODES, ENGLISH_MODES } from './ModeSelector';
import { getStoredSyncKey } from '../utils/syncService';
import { t } from '../i18n';

interface Props {
  state: UserState;
  backend: StorageBackend;
  speech: SpeechApi;
  onChangeSettings: (s: Settings) => void;
  onReplaceState: (s: UserState) => void;
  onClose: () => void;
  onOpenSyncModal: () => void;
  onSwitchCourse?: (course: CourseId) => void;
}

const BACKEND_LABEL: Record<StorageBackend, string> = {
  indexeddb: 'IndexedDB (recommended)',
  localstorage: 'localStorage (fallback)',
  memory: 'Memory only — progress will be lost on reload!',
};

export function SettingsModal({
  state,
  backend,
  speech,
  onChangeSettings,
  onReplaceState,
  onClose,
  onOpenSyncModal,
  onSwitchCourse,
}: Props) {
  const syncKey = getStoredSyncKey();
  const s = state.settings;
  const course = getCourseConfig(s.course);
  const lang = s.uiLanguage ?? course.defaultUiLanguage;
  const set = (patch: Partial<Settings>) => onChangeSettings({ ...s, ...patch });
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleImport(file: File) {
    try {
      const { state: imported, grammar } = await parseBackup(file);
      const words = Object.keys(imported.progress).length;
      if (!window.confirm(`Replace your current progress with this backup (${words} words, ${imported.stats.totalReviewed} reviews)?`)) return;
      onReplaceState(imported);
      const grammarOk = grammar !== undefined && (await importGrammarProgress(grammar)) !== null;
      setMessage({ ok: true, text: `Backup restored: ${words} words${grammarOk ? ' + grammar progress' : ''}.` });
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
  }

  async function handleReset() {
    if (!window.confirm('Erase all progress and statistics? Consider exporting a backup first.')) return;
    onReplaceState({ ...createDefaultState(), settings: s });
    await saveGrammarProgress(createEmptyGrammarProgress());
    setMessage({ ok: true, text: 'Progress reset.' });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-pop max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl outline-none sm:rounded-3xl sm:pb-6 lg:max-w-2xl dark:bg-slate-800"
      >
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close settings">
            <X className="h-5 w-5" />
          </button>
        </div>

        <Group title="Course & Language Track">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Course Track">
            {languageCourses().map((c) => {
              const selected = course.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSwitchCourse?.(c.id)}
                  className={`rounded-xl border-2 p-3 text-left transition ${
                    selected ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{c.flag}</span>
                    <span className="font-bold">{c.cardTitle}</span>
                  </div>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{c.cardSubtitle}</span>
                </button>
              );
            })}
          </div>
        </Group>

        <Group title="Interface Language (界面语言)">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Interface Language">
            <button
              type="button"
              role="radio"
              aria-checked={(s.uiLanguage ?? course.defaultUiLanguage) === 'en'}
              onClick={() => set({ uiLanguage: 'en' })}
              className={`rounded-xl border-2 p-3 text-left transition ${
                (s.uiLanguage ?? course.defaultUiLanguage) === 'en'
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🇬🇧</span>
                <span className="font-bold">English</span>
              </div>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">English interface</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={(s.uiLanguage ?? course.defaultUiLanguage) === 'zh'}
              onClick={() => set({ uiLanguage: 'zh' })}
              className={`rounded-xl border-2 p-3 text-left transition ${
                (s.uiLanguage ?? course.defaultUiLanguage) === 'zh'
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🇨🇳</span>
                <span className="font-bold">简体中文</span>
              </div>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">中文交互界面</span>
            </button>
          </div>
        </Group>

        <Group title="Curriculum & Syllabus">
          <div className="grid gap-2" role="radiogroup" aria-label="Curriculum">
            {course.curricula.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={s.curriculum === c.id}
                onClick={() => set({ curriculum: c.id as Curriculum })}
                className={`rounded-xl border-2 p-3 text-left transition ${
                  s.curriculum === c.id ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                }`}
              >
                <span className="block font-medium">{c.name}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{c.description}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Switching keeps all progress: words shared between standards stay learned.</p>
        </Group>

        <Group title="Audio">
          <div className="flex flex-wrap items-center gap-2">
            {SPEECH_RATES.map((r) => (
              <button
                key={r}
                onClick={() => set({ speechRate: r })}
                aria-pressed={s.speechRate === r}
                className={`rounded-lg border px-3 py-1.5 text-sm tabular-nums ${
                  s.speechRate === r ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {r}×
              </button>
            ))}
            <AudioButton
              speech={speech}
              text={course.speechSample}
              rate={s.speechRate}
              label="Test"
            />
          </div>
          <label className="mt-3 flex items-center justify-between gap-4">
            <span>Sound effects & haptics</span>
            <Toggle checked={s.soundEffects} onChange={(v) => set({ soundEffects: v })} label="Sound effects" />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            {speech.voice
              ? `Local voice: ${speech.voice.name} (${speech.voice.lang})`
              : `Audio source: Studio native ${course.languageName} audio stream (crystal-clear pronunciation)`}
          </p>
        </Group>

        <Group title="Display">
          <div className="mb-3 flex items-center justify-between gap-4">
            <span>Theme</span>
            <div className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-600" role="radiogroup" aria-label="Theme">
              {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={s.theme === t}
                  onClick={() => set({ theme: t })}
                  className={`rounded-md px-3 py-1 text-sm capitalize ${s.theme === t ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {course.features.tones && (
            <label className="flex items-center justify-between gap-4">
              <span>
                Tone colours
                <span className="ml-2 text-sm">
                  <span className="text-tone1">mā</span> <span className="text-tone2">má</span> <span className="text-tone3">mǎ</span>{' '}
                  <span className="text-tone4">mà</span> <span className="text-tone0">ma</span>
                </span>
              </span>
              <Toggle checked={s.colorTones} onChange={(v) => set({ colorTones: v })} label="Tone colours" />
            </label>
          )}
        </Group>

        <Group title={t('settings.pace', lang)}>
          {/* Quick Presets */}
          <div className="mb-4">
            <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              {lang === 'zh' ? '预设学习节奏' : 'Quick Pace Presets'}
            </span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {[
                { id: 'casual', label: t('settings.pace.casual', lang), newCards: 5, dailyCap: 25, sessionSize: 10, icon: '🐢' },
                { id: 'steady', label: t('settings.pace.steady', lang), newCards: 10, dailyCap: 50, sessionSize: 15, icon: '🚶' },
                { id: 'ambitious', label: t('settings.pace.ambitious', lang), newCards: 20, dailyCap: 100, sessionSize: 20, icon: '🏃' },
                { id: 'intensive', label: t('settings.pace.intensive', lang), newCards: 35, dailyCap: 200, sessionSize: 30, icon: '🚀' },
              ].map((p) => {
                const isActive =
                  s.newCardsPerDay === p.newCards &&
                  s.dailyCap === p.dailyCap &&
                  (s.sessionSize ?? 15) === p.sessionSize;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set({ newCardsPerDay: p.newCards, dailyCap: p.dailyCap, sessionSize: p.sessionSize })}
                    className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition ${
                      isActive
                        ? 'border-rose-500 bg-rose-50 font-semibold text-rose-800 shadow-xs dark:bg-rose-950/40 dark:text-rose-200'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    <span className="text-base">{p.icon}</span>
                    <span className="text-xs font-medium">{p.label}</span>
                    <span className="text-[10px] text-slate-400 tabular-nums">+{p.newCards} / {p.dailyCap}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <RangeSlider
            label={t('settings.newCards', lang)}
            value={s.newCardsPerDay}
            min={0}
            max={50}
            step={1}
            unit={lang === 'zh' ? '词/天' : 'words/day'}
            description={t('settings.newCardsDesc', lang)}
            onChange={(v) => set({ newCardsPerDay: v })}
          />

          <RangeSlider
            label={t('settings.dailyCap', lang)}
            value={s.dailyCap}
            min={10}
            max={300}
            step={5}
            unit={lang === 'zh' ? '词/天' : 'cards/day'}
            description={t('settings.dailyCapDesc', lang)}
            onChange={(v) => set({ dailyCap: v })}
          />

          <RangeSlider
            label={t('settings.sessionSize', lang)}
            value={s.sessionSize ?? 15}
            min={5}
            max={40}
            step={5}
            unit={lang === 'zh' ? '题/次' : 'cards'}
            description={t('settings.sessionSizeDesc', lang)}
            onChange={(v) => set({ sessionSize: v })}
          />

          <label className="mt-3 flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{lang === 'zh' ? '默认练习题型' : 'Default mode'}</span>
            <select
              value={s.defaultMode}
              onChange={(e) => set({ defaultMode: e.target.value as StudyMode })}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            >
              {(course.track === 'english' ? ENGLISH_MODES : CHINESE_MODES).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
        </Group>

        {course.features.pinyin && (
          <Group title={t('settings.pinyinHelper', lang)}>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              {t('settings.pinyinHelperDesc', lang)}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Pinyin helper mode">
              {[
                {
                  id: 'adaptive',
                  title: t('settings.pinyinMode.adaptive', lang),
                  desc: lang === 'zh' ? '智能分析错题：失误达到门槛后自动呈现拼音，未失误词保留纯汉字测试' : 'Intelligent scaffold: Automatically reveals Pinyin for difficult words, pure character immersion otherwise',
                  icon: '🧠',
                },
                {
                  id: 'flip',
                  title: t('settings.pinyinMode.flip', lang),
                  desc: lang === 'zh' ? '纯汉字沉浸测试，随时可点击卡片 3D 翻转查看拼音' : 'Pure immersion by default, click character anytime to flip card and peek Pinyin',
                  icon: '🃏',
                },
                {
                  id: 'always',
                  title: t('settings.pinyinMode.always', lang),
                  desc: lang === 'zh' ? '练习中始终在汉字旁显示拼音' : 'Always display Pinyin alongside Chinese characters',
                  icon: '👁️',
                },
                {
                  id: 'never',
                  title: t('settings.pinyinMode.never', lang),
                  desc: lang === 'zh' ? '完全关闭卡片翻转与拼音提示，直至点击提交答案' : 'Disable peek flip; Pinyin is only revealed after answering',
                  icon: '🔒',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={(s.pinyinHelperMode ?? 'adaptive') === opt.id}
                  onClick={() => set({ pinyinHelperMode: opt.id as PinyinHelperMode })}
                  className={`rounded-xl border-2 p-3 text-left transition ${
                    (s.pinyinHelperMode ?? 'adaptive') === opt.id
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-sm">
                    <span>{opt.icon}</span>
                    <span>{opt.title}</span>
                  </div>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>

            {(s.pinyinHelperMode ?? 'adaptive') === 'adaptive' && (
              <div className="mt-3 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/20">
                <RangeSlider
                  label={t('settings.pinyinThreshold', lang)}
                  value={s.pinyinAdaptiveThreshold ?? 2}
                  min={1}
                  max={5}
                  step={1}
                  unit={lang === 'zh' ? '次失误' : 'mistakes'}
                  description={t('settings.pinyinThresholdDesc', lang)}
                  onChange={(v) => set({ pinyinAdaptiveThreshold: v })}
                />
              </div>
            )}
          </Group>
        )}

        <Group title="Multi-Device Cloud Sync">
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                  <Zap className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {syncKey ? 'Cloud Sync Active' : 'Sync Between Devices'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {syncKey ? 'End-to-end encrypted · Auto-syncs progress' : 'Zero-login sync via QR code or pairing key'}
                  </p>
                </div>
              </div>
              {syncKey && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                </span>
              )}
            </div>

            <button
              onClick={onOpenSyncModal}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
            >
              <QrCode className="h-3.5 w-3.5" />
              {syncKey ? 'Manage Sync / Show QR Code' : 'Link This Device (QR Code)'}
            </button>
          </div>
        </Group>

        <Group title="Data & backup">
          <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Database className="h-3.5 w-3.5" /> Stored in: {BACKEND_LABEL[backend]}
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={async () => exportBackup(state, await exportableGrammarProgress())} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">
              <Download className="h-4 w-4" /> Export backup (JSON)
            </button>
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700">
              <Upload className="h-4 w-4" /> Import backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = '';
              }}
            />
            <button onClick={handleReset} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
              <Trash2 className="h-4 w-4" /> Reset progress
            </button>
          </div>
          {message && (
            <p role="status" className={`mt-2 text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}
        </Group>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function RangeSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  description,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  description?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
        <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 tabular-nums dark:bg-rose-950/60 dark:text-rose-300">
          {value} {unit}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold text-slate-400 tabular-nums">{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const numVal = Number(e.target.value);
            if (Number.isFinite(numVal)) {
              onChange(Math.max(min, Math.min(max, numVal)));
            }
          }}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-700"
        />
        <span className="text-[11px] font-semibold text-slate-400 tabular-nums">{max}</span>
      </div>
      {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
  );
}
