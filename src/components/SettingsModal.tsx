import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Database, Download, QrCode, Trash2, Upload, X, Zap } from 'lucide-react';
import type { CourseId, Curriculum, Settings, StudyMode, ThemePref, UserState } from '../types';
import { getCourseConfig } from '../data/courses';
import { SPEECH_RATES, type SpeechApi } from '../utils/speech';
import { createDefaultState, exportBackup, parseBackup, type StorageBackend } from '../utils/storage';
import { createEmptyGrammarProgress, exportableGrammarProgress, importGrammarProgress, saveGrammarProgress } from '../grammar';
import { AudioButton } from './AudioButton';
import { CHINESE_MODES, ENGLISH_MODES } from './ModeSelector';
import { getStoredSyncKey } from '../utils/syncService';

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
            <button
              type="button"
              role="radio"
              aria-checked={(s.course ?? 'chinese') === 'chinese'}
              onClick={() => onSwitchCourse?.('chinese')}
              className={`rounded-xl border-2 p-3 text-left transition ${
                (s.course ?? 'chinese') === 'chinese' ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🇨🇳</span>
                <span className="font-bold">Mandarin (HSK)</span>
              </div>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">HSK 1–9 Syllabus · 汉字 & Pinyin</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={s.course === 'english'}
              onClick={() => onSwitchCourse?.('english')}
              className={`rounded-xl border-2 p-3 text-left transition ${
                s.course === 'english' ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🇬🇧</span>
                <span className="font-bold">English (英语)</span>
              </div>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">CEFR A1–C2 · 中考·高考·四六级</span>
            </button>
          </div>
        </Group>

        <Group title="Interface Language (界面语言)">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Interface Language">
            <button
              type="button"
              role="radio"
              aria-checked={(s.uiLanguage ?? (s.course === 'english' ? 'zh' : 'en')) === 'en'}
              onClick={() => set({ uiLanguage: 'en' })}
              className={`rounded-xl border-2 p-3 text-left transition ${
                (s.uiLanguage ?? (s.course === 'english' ? 'zh' : 'en')) === 'en'
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
              aria-checked={(s.uiLanguage ?? (s.course === 'english' ? 'zh' : 'en')) === 'zh'}
              onClick={() => set({ uiLanguage: 'zh' })}
              className={`rounded-xl border-2 p-3 text-left transition ${
                (s.uiLanguage ?? (s.course === 'english' ? 'zh' : 'en')) === 'zh'
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
            {getCourseConfig(s.course ?? 'chinese').curricula.map((c) => (
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
              text={(s.course ?? 'chinese') === 'english' ? 'Hello, welcome to English training!' : '你好，欢迎！'}
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
              : `Audio source: Studio native ${(s.course ?? 'chinese') === 'english' ? 'English' : 'Mandarin'} audio stream (crystal-clear pronunciation)`}
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
          {s.course !== 'english' && (
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

        <Group title="Study">
          <NumberField label="Daily review cap" value={s.dailyCap} min={5} max={500} onChange={(v) => set({ dailyCap: v })} />
          <NumberField label="New cards per day" value={s.newCardsPerDay} min={0} max={100} onChange={(v) => set({ newCardsPerDay: v })} />
          <label className="mt-3 flex items-center justify-between gap-4">
            <span>Default mode</span>
            <select
              value={s.defaultMode}
              onChange={(e) => set({ defaultMode: e.target.value as StudyMode })}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
            >
              {((s.course ?? 'chinese') === 'english' ? ENGLISH_MODES : CHINESE_MODES).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
        </Group>

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

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="mt-2 flex items-center justify-between gap-4">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, Math.round(v))));
        }}
        className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right tabular-nums dark:border-slate-600 dark:bg-slate-900"
      />
    </label>
  );
}
