import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Award, BarChart3, BookMarked, BookOpenCheck, Flame, Home, Layers, Loader2, Settings as SettingsIcon, Zap } from 'lucide-react';
import type { Grade, SessionCard, SessionRequest, Settings, UserState } from './types';
import { useUserState } from './hooks/useUserState';
import { useSpeech } from './utils/speech';
import { buildSession, effectiveStreak, recordReview } from './utils/srsEngine';
import { newlyUnlocked, type Badge } from './utils/analytics';
import { curriculumInfo, loadLibrary, vocabForCurriculum, type VocabLibrary } from './data/vocab';
import { Dashboard } from './components/Dashboard';
import { StudySession } from './components/StudySession';
import { Insights } from './components/Insights';
import { Achievements } from './components/Achievements';
import { Dictionary } from './components/Dictionary';
import { TopicTraining } from './components/TopicTraining';
import { SettingsModal } from './components/SettingsModal';
import { SyncModal } from './components/SyncModal';
import type { CardResult } from './components/ReviewCard';
import { GrammarHub } from './grammar';
import {
  getStoredSyncKey,
  setStoredSyncKey,
  syncBidirectional,
  pushVault,
  DeviceRevokedError,
} from './utils/syncService';

type View = 'home' | 'learn' | 'topics' | 'dictionary' | 'study' | 'insights' | 'achievements';
type NavView = Exclude<View, 'study'>;
const NAV_IDS: NavView[] = ['home', 'learn', 'topics', 'dictionary', 'insights', 'achievements'];

/** "#/dictionary" → "dictionary"; anything unknown → home. */
function viewFromHash(): NavView {
  const id = window.location.hash.replace(/^#\/?/, '') as NavView;
  return NAV_IDS.includes(id) ? id : 'home';
}

const NAV: { id: NavView; label: string; short: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Dashboard', short: 'Home', icon: Home },
  { id: 'learn', label: 'Paths & Grammar', short: 'Learn', icon: BookOpenCheck },
  { id: 'topics', label: 'Topic Training', short: 'Topics', icon: Layers },
  { id: 'dictionary', label: 'Dictionary', short: 'Words', icon: BookMarked },
  { id: 'insights', label: 'Insights', short: 'Stats', icon: BarChart3 },
  { id: 'achievements', label: 'Badges', short: 'Badges', icon: Award },
];

/** Applies the theme preference to <html> and follows the OS setting in "system" mode. */
function useTheme(pref: Settings['theme']) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', pref === 'dark' || (pref === 'system' && media.matches));
    apply();
    try {
      localStorage.setItem('adilingo:theme', pref);
    } catch {
      /* the inline pre-paint script just falls back to "system" */
    }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [pref]);
}

export default function App() {
  const { state, ready, backend, loadWarning, update, replace, allowSave } = useUserState();
  const speech = useSpeech(state.settings.speechRate);
  const [library, setLibrary] = useState<VocabLibrary | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [view, setView] = useState<View>(viewFromHash);
  const [session, setSession] = useState<{ request: SessionRequest; cards: SessionCard[]; key: number; returnTo: NavView } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [toasts, setToasts] = useState<Badge[]>([]);
  const undoSnapshot = useRef<UserState | null>(null);
  const syncPushTimer = useRef<number>();
  useTheme(state.settings.theme);

  // Auto-detect pairing key from URL (e.g. from QR scan #/sync-pair?key=... or ?syncKey=...)
  useEffect(() => {
    const checkPairingParam = async () => {
      let pairKey: string | null = null;
      const hash = window.location.hash;
      if (hash.includes('sync-pair') || hash.includes('key=')) {
        const m = hash.match(/[?&]key=([^&]+)/);
        if (m) pairKey = decodeURIComponent(m[1]);
      }
      if (!pairKey) {
        const sp = new URLSearchParams(window.location.search);
        pairKey = sp.get('syncKey') || sp.get('key');
      }

      if (pairKey) {
        try {
          const res = await syncBidirectional(pairKey, state);
          setStoredSyncKey(pairKey);
          replace(res.mergedState);
          allowSave();
          window.history.replaceState(null, '', window.location.pathname + '#/home');
          setView('home');
          setToasts((t) => [
            ...t,
            {
              id: `sync-paired-${Date.now()}`,
              title: 'Device Linked & Synced!',
              description: 'All flashcards and progress synchronized.',
              emoji: '⚡',
              category: 'special',
              tier: 'gold',
              progress: () => 1,
            },
          ]);
        } catch (e) {
          console.warn('Auto-pair failed:', e);
        }
      }
    };
    checkPairingParam();
  }, [state, replace, allowSave]);

  // Background sync on app mount & tab visibility change
  useEffect(() => {
    if (!ready) return;
    const runBackgroundSync = () => {
      const key = getStoredSyncKey();
      if (!key) return;
      syncBidirectional(key, state)
        .then((res) => {
          if (res.updated) {
            replace(res.mergedState);
            allowSave();
          }
        })
        .catch((err) => {
          if (err instanceof DeviceRevokedError || err?.name === 'DeviceRevokedError') {
            setToasts((t) => [
              ...t,
              {
                id: `sync-revoked-${Date.now()}`,
                title: 'Device Unlinked',
                description: 'This device was unpaired by another linked device.',
                emoji: '🔌',
                category: 'special',
                tier: 'silver',
                progress: () => 1,
              },
            ]);
          }
        });
    };

    runBackgroundSync();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        runBackgroundSync();
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [ready]);

  // Auto-push reviews to cloud vault
  useEffect(() => {
    if (!ready) return;
    const key = getStoredSyncKey();
    if (!key) return;

    window.clearTimeout(syncPushTimer.current);
    syncPushTimer.current = window.setTimeout(() => {
      pushVault(key, state).catch(() => {});
    }, 2000);

    return () => window.clearTimeout(syncPushTimer.current);
  }, [state, ready]);

  useEffect(() => {
    loadLibrary()
      .then(setLibrary)
      .catch((e: Error) => setLibraryError(e.message));
  }, []);

  const curriculum = state.settings.curriculum;
  const vocab = useMemo(() => (library ? vocabForCurriculum(library, curriculum) : []), [library, curriculum]);
  const loaded = ready && library !== null;

  // Badge unlocks are derived from state, so they also fire after imports.
  useEffect(() => {
    if (!loaded) return;
    const fresh = newlyUnlocked(state, vocab);
    if (!fresh.length) return;
    update((s) => ({ ...s, unlockedBadges: [...s.unlockedBadges, ...fresh.map((b) => b.id)] }));
    setToasts((t) => [...t, ...fresh]);
  }, [state, loaded, vocab, update]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = window.setTimeout(() => setToasts((ts) => ts.slice(1)), 4000);
    return () => window.clearTimeout(t);
  }, [toasts]);

  // Hash routing: deep links, and the browser / Android back button moves between views
  // (leaving a study session with "back" returns to where it was started).
  useEffect(() => {
    const onHash = () => {
      setView(window.location.hash === '#/study' ? 'study' : viewFromHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((v: NavView) => {
    if (window.location.hash !== `#/${v}`) window.location.hash = `/${v}`;
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  const startSession = useCallback(
    (request: SessionRequest) => {
      setSession((prev) => ({
        request,
        cards: buildSession(vocab, state, request),
        key: Date.now(),
        returnTo: view === 'study' ? (prev?.returnTo ?? 'home') : view,
      }));
      setView('study');
      if (window.location.hash !== '#/study') window.location.hash = '/study';
      window.scrollTo({ top: 0 });
    },
    [state, view, vocab],
  );

  const handleReview = useCallback(
    (card: SessionCard, grade: Grade, result: CardResult, learningStep: boolean) => {
      update((s) => {
        undoSnapshot.current = s;
        return recordReview(
          s,
          { item: card.item, direction: card.direction, grade, correct: result.correct, prompt: card.prompt, latencyMs: result.latencyMs },
          new Date(),
          { learningStep },
        );
      });
    },
    [update],
  );

  const handleUndo = useCallback(() => {
    if (undoSnapshot.current) {
      replace(undoSnapshot.current);
      undoSnapshot.current = null;
    }
  }, [replace]);

  const handleToggleStar = useCallback(
    (wordId: string) => {
      update((s) => {
        const starred = s.starredWords ?? [];
        const next = starred.includes(wordId) ? starred.filter((id) => id !== wordId) : [...starred, wordId];
        return { ...s, starredWords: next };
      });
    },
    [update],
  );

  const streak = effectiveStreak(state);
  // A reload on #/study has no session to resume: fall back to the dashboard.
  useEffect(() => {
    if (view === 'study' && !session) navigate('home');
  }, [view, session, navigate]);
  const studying = view === 'study' && session !== null;
  const info = curriculumInfo(curriculum);

  const content = useMemo(() => {
    if (libraryError) {
      return (
        <div role="alert" className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          The word list could not be loaded ({libraryError}). Check your connection and reload.
        </div>
      );
    }
    if (!loaded) {
      return (
        <div className="flex flex-col items-center gap-3 py-24 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          Loading {library ? 'your progress' : 'the HSK word list'}…
        </div>
      );
    }
    switch (view) {
      case 'study':
        return session ? (
          <StudySession
            key={session.key}
            request={session.request}
            initialCards={session.cards}
            vocab={vocab}
            state={state}
            speech={speech}
            onReview={handleReview}
            onUndo={handleUndo}
            onExit={() => navigate(session.returnTo)}
            onRestart={() => startSession(session.request)}
          />
        ) : null;
      case 'learn':
        return (
          <GrammarHub
            vocab={vocab}
            progress={state.progress}
            colorTones={state.settings.colorTones}
            speech={speech}
            speechRate={state.settings.speechRate}
            onStartVocabSession={startSession}
            curriculum={curriculum}
          />
        );
      case 'topics':
        return (
          <TopicTraining
            vocab={vocab}
            state={state}
            speech={speech}
            onStartSession={startSession}
            onToggleStar={handleToggleStar}
          />
        );
      case 'dictionary':
        return <Dictionary vocab={vocab} state={state} speech={speech} onStart={startSession} onToggleStar={handleToggleStar} />;
      case 'insights':
        return <Insights vocab={vocab} state={state} onStart={startSession} />;
      case 'achievements':
        return <Achievements vocab={vocab} state={state} />;
      default:
        return <Dashboard vocab={vocab} state={state} onStart={startSession} onNavigate={navigate} onUpdateState={(ns) => update(() => ns)} />;
    }
  }, [libraryError, loaded, library, view, session, vocab, state, speech, handleReview, handleUndo, handleToggleStar, navigate, startSession, curriculum, update]);

  const navButton = (n: (typeof NAV)[number], variant: 'side' | 'top') => {
    const Icon = n.icon;
    const active = view === n.id || (view === 'study' && session?.returnTo === n.id);
    return (
      <button
        key={n.id}
        onClick={() => navigate(n.id)}
        aria-current={active ? 'page' : undefined}
        className={`inline-flex shrink-0 items-center gap-3 rounded-xl font-medium transition ${
          variant === 'side' ? 'w-full px-3 py-2.5 text-[15px]' : 'px-3 py-2 text-sm'
        } ${
          active
            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
        {n.label}
      </button>
    );
  };

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop / large tablet landscape: persistent sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex xl:w-72 dark:border-slate-800 dark:bg-slate-900">
        <button onClick={() => navigate('home')} className="mb-6 flex items-center gap-3 px-2" aria-label="Adilingo home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 font-hanzi text-2xl font-bold text-white">汉</span>
          <span className="text-left">
            <span className="block text-lg font-bold leading-tight tracking-tight">Adilingo</span>
            <span className="block text-xs text-slate-500">{info.short}</span>
          </span>
        </button>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV.map((n) => navButton(n, 'side'))}
        </nav>
        <div className="mt-auto space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-orange-50 px-3 py-2.5 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
            <Flame className="h-5 w-5" aria-hidden />
            <span className="text-sm font-semibold">{streak}-day streak</span>
          </div>
          <button
            onClick={() => setShowSyncModal(true)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[14px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-rose-500" aria-hidden /> Cloud Sync
            </span>
            {getStoredSyncKey() && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Sync active" />
            )}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <SettingsIcon className="h-5 w-5" aria-hidden /> Settings
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Phones & tablets: top bar (with inline nav from md up) */}
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6">
            <button onClick={() => navigate('home')} className="flex items-center gap-2" aria-label="Adilingo home">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 font-hanzi text-xl font-bold text-white">汉</span>
              <span className="text-base font-bold tracking-tight md:hidden">Adilingo</span>
            </button>
            <nav className="ml-2 hidden flex-1 gap-1 overflow-x-auto md:flex" aria-label="Main">
              {NAV.map((n) => navButton(n, 'top'))}
            </nav>
            <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-orange-500 md:ml-0" title={`${streak}-day streak`}>
              <Flame className="h-5 w-5" aria-hidden /> {streak}
            </span>
            <button
              onClick={() => setShowSyncModal(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Cloud sync"
              title="Cloud sync"
            >
              <Zap className="h-5 w-5 text-rose-500" />
            </button>
            <button onClick={() => setShowSettings(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Settings">
              <SettingsIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        {loadWarning && (
          <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6 lg:px-10">
            <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <p>{loadWarning}</p>
              <p className="mt-1">Saving is paused so nothing is overwritten. Import a backup in Settings, or start fresh (the unreadable data stays stored under a separate key).</p>
              <button onClick={allowSave} className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700">
                Start fresh
              </button>
            </div>
          </div>
        )}

        <main
          className={`mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-10 lg:py-8 2xl:max-w-7xl short:py-3 ${
            studying ? 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]' : 'pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10'
          }`}
        >
          {content}
        </main>

        <footer className={`mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-slate-400 ${studying || !loaded ? 'hidden' : 'hidden md:block'}`}>
          {vocab.length.toLocaleString('en')} words · {info.name} · word data: complete-hsk-vocabulary (MIT), CC-CEDICT · example sentences: Tatoeba (CC-BY 2.0 FR) ·
          all progress stays on this device
        </footer>
      </div>

      {/* Phones: bottom tab bar (hidden while studying to keep the card and grade buttons in reach) */}
      {!studying && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95"
          aria-label="Main"
        >
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = view === n.id;
            return (
              <button
                key={n.id}
                onClick={() => navigate(n.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${active ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {n.short}
              </button>
            );
          })}
        </nav>
      )}

      {showSettings && (
        <SettingsModal
          state={state}
          backend={backend}
          speech={speech}
          onChangeSettings={(settings: Settings) => update((s) => ({ ...s, settings }))}
          onReplaceState={(s) => {
            replace(s);
            allowSave();
          }}
          onClose={() => setShowSettings(false)}
          onOpenSyncModal={() => {
            setShowSettings(false);
            setShowSyncModal(true);
          }}
        />
      )}

      {showSyncModal && (
        <SyncModal
          state={state}
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          onStateMerged={(mergedState) => {
            replace(mergedState);
            allowSave();
          }}
        />
      )}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
        aria-live="polite"
      >
        {toasts.slice(0, 1).map((b) => (
          <div key={b.id} className="animate-pop pointer-events-auto flex items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
            <span className="text-2xl" aria-hidden>
              {b.emoji}
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide opacity-70">Achievement unlocked</p>
              <p className="font-semibold">{b.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
