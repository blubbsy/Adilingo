import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Languages, Loader2, Settings as SettingsIcon, Zap } from 'lucide-react';
import type { Grade, SessionCard, SessionRequest, Settings, UserState } from './types';
import { useUserState } from './hooks/useUserState';
import { useSpeech } from './utils/speech';
import { buildSession, effectiveStreak, recordReview } from './utils/srsEngine';
import { newlyUnlocked, type Badge } from './utils/analytics';
import { curriculumInfo, loadLibrary, vocabForCurriculum, type VocabLibrary } from './data/vocab';
import { ALL_VIEW_IDS, fallbackView, getCourseConfig, isViewAvailable, languageCourses, type CourseId, type ViewId } from './data/courses';
import { mobileNavItemsFor, navItemsFor, type NavItem } from './utils/navigation';
import { Dashboard } from './components/Dashboard';
import { StudySession } from './components/StudySession';
import { Insights } from './components/Insights';
import { Achievements } from './components/Achievements';
import { Dictionary } from './components/Dictionary';
import { TopicTraining } from './components/TopicTraining';
import { SettingsModal } from './components/SettingsModal';
import { SyncModal } from './components/SyncModal';
import { EnglishGrammarGuide } from './components/EnglishGrammarGuide';
import { EnglishLearningHub } from './components/EnglishLearningHub';
import { IrregularVerbsTrainer } from './components/IrregularVerbsTrainer';
import { type UiLanguage } from './i18n';
import { I18nContext, createI18n, useDocumentLanguage, useLoadedLanguage } from './i18n/react';
import { LanguageMenu } from './components/LanguageMenu';
import type { CardResult } from './components/ReviewCard';
import { GrammarHub } from './grammar';
import {
  getStoredSyncKey,
  setStoredSyncKey,
  syncBidirectional,
  pushVault,
  DeviceRevokedError,
} from './utils/syncService';

type View = ViewId | 'study';
type NavView = ViewId;
const NAV_IDS: NavView[] = ALL_VIEW_IDS;

/** "#/dictionary" → "dictionary"; anything unknown → home. */
function viewFromHash(): NavView {
  const id = window.location.hash.replace(/^#\/?/, '') as NavView;
  return NAV_IDS.includes(id) ? id : 'home';
}

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
  const activeCourse = state.settings.course ?? 'chinese';
  const courseConfig = getCourseConfig(activeCourse);
  const handleSpeechRateChange = useCallback(
    (rate: number) => update((s) => (s.settings.speechRate === rate ? s : { ...s, settings: { ...s.settings, speechRate: rate } })),
    [update],
  );
  const speech = useSpeech(state.settings.speechRate, courseConfig.speechVoiceLang, handleSpeechRateChange);
  const [library, setLibrary] = useState<VocabLibrary | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [view, setView] = useState<View>(viewFromHash);
  const [session, setSession] = useState<{ request: SessionRequest; cards: SessionCard[]; key: number; returnTo: View } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [toasts, setToasts] = useState<Badge[]>([]);
  const undoSnapshot = useRef<UserState | null>(null);

  // The language the learner wants, and the one whose strings are loaded and can be shown right now
  const wantedLang: UiLanguage = state.settings.uiLanguage ?? courseConfig.defaultUiLanguage;
  const { shown: lang, ready: langReady } = useLoadedLanguage(wantedLang);
  const i18n = useMemo(() => createI18n(lang), [lang]);
  const { t } = i18n;
  const tRef = useRef(t);
  tRef.current = t;
  useDocumentLanguage(lang);
  const setUiLanguage = useCallback((next: UiLanguage) => update((s) => ({ ...s, settings: { ...s.settings, uiLanguage: next } })), [update]);

  useTheme(state.settings.theme);

  // Auto-pair if URL contains syncKey (from QR code scan)
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
          setToasts((tList) => [
            ...tList,
            {
              id: `sync-paired-${Date.now()}`,
              title: tRef.current('app.syncPaired.title'),
              description: tRef.current('app.syncPaired.desc'),
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
            setToasts((tList) => [
              ...tList,
              {
                id: `sync-revoked-${Date.now()}`,
                title: tRef.current('app.syncRevoked.title'),
                description: tRef.current('app.syncRevoked.desc'),
                emoji: '⚠️',
                category: 'special',
                tier: 'bronze',
                progress: () => 1,
              },
            ]);
            setStoredSyncKey(null);
          }
        });
    };

    runBackgroundSync();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') runBackgroundSync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [ready, state, replace, allowSave]);

  // Auto-backup to vault on local progress updates (debounced)
  const prevSyncStateRef = useRef<string>('');
  useEffect(() => {
    if (!ready) return;
    const key = getStoredSyncKey();
    if (!key) return;

    const stateStr = JSON.stringify({ p: state.progress, s: state.stats.totalReviewed });
    if (prevSyncStateRef.current === stateStr) return;
    prevSyncStateRef.current = stateStr;

    const tTimer = setTimeout(() => {
      pushVault(key, state).catch(() => {});
    }, 4000);
    return () => clearTimeout(tTimer);
  }, [ready, state]);

  // Load the active course's vocabulary library
  useEffect(() => {
    let cancelled = false;
    setLibrary(null);
    setLibraryError(null);
    loadLibrary(activeCourse)
      .then((lib) => {
        if (!cancelled) setLibrary(lib);
      })
      .catch((err) => {
        if (!cancelled) setLibraryError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCourse]);

  // Course switching logic with route sanitization
  const switchCourse = useCallback(
    (newCourse: CourseId) => {
      if (newCourse === activeCourse) return;

      update((s) => {
        const curCourse = s.settings.course ?? 'chinese';
        const courseProgress: NonNullable<UserState['courseProgress']> = {
          ...(s.courseProgress ?? {}),
          [curCourse]: s.progress,
        };
        const knownLevelsByCourse: NonNullable<UserState['knownLevelsByCourse']> = {
          ...(s.knownLevelsByCourse ?? {}),
          [curCourse]: s.knownLevels ?? [],
        };
        const starredWordsByCourse: NonNullable<UserState['starredWordsByCourse']> = {
          ...(s.starredWordsByCourse ?? {}),
          [curCourse]: s.starredWords ?? [],
        };

        const targetProg = courseProgress[newCourse] ?? {};
        const targetKnown = knownLevelsByCourse[newCourse] ?? [];
        const targetStarred = starredWordsByCourse[newCourse] ?? [];
        const newCourseConfig = getCourseConfig(newCourse);
        const defaultLang: UiLanguage = newCourseConfig.defaultUiLanguage;

        return {
          ...s,
          settings: {
            ...s.settings,
            course: newCourse,
            curriculum: newCourseConfig.defaultCurriculum,
            uiLanguage: s.settings.uiLanguage ?? defaultLang,
          },
          progress: targetProg,
          courseProgress,
          knownLevels: targetKnown,
          knownLevelsByCourse,
          starredWords: targetStarred,
          starredWordsByCourse,
        };
      });
    },
    [activeCourse, update],
  );

  const curriculum = state.settings.curriculum;
  const vocab = useMemo(() => (library ? vocabForCurriculum(library, curriculum) : []), [library, curriculum]);
  // Show the app once state, vocabulary and the interface language are ready; later language switches never blank the screen
  const booted = useRef(false);
  const loaded = ready && library !== null && (langReady || booted.current);
  if (loaded) booted.current = true;

  // Badge unlocks
  useEffect(() => {
    if (!loaded) return;
    const fresh = newlyUnlocked(state, vocab);
    if (!fresh.length) return;
    update((s) => ({ ...s, unlockedBadges: [...s.unlockedBadges, ...fresh.map((b) => b.id)] }));
    setToasts((tList) => [...tList, ...fresh]);
  }, [state, loaded, vocab, update]);

  useEffect(() => {
    if (!toasts.length) return;
    const tTimer = window.setTimeout(() => setToasts((ts) => ts.slice(1)), 4000);
    return () => window.clearTimeout(tTimer);
  }, [toasts]);

  // Hash routing
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

  // Route guard: a screen the active course does not offer redirects (never renders another course's content).
  useEffect(() => {
    if (!ready || view === 'study' || isViewAvailable(activeCourse, view)) return;
    const target = fallbackView(activeCourse);
    if (window.location.hash !== `#/${target}`) window.location.hash = `/${target}`;
    setView(target);
  }, [ready, view, activeCourse]);
  const shownView: View = !ready || view === 'study' || isViewAvailable(activeCourse, view) ? view : fallbackView(activeCourse);

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

  useEffect(() => {
    if (view === 'study' && !session) navigate('home');
  }, [view, session, navigate]);
  const studying = view === 'study' && session !== null;
  const info = curriculumInfo(curriculum);

  const content = useMemo(() => {
    if (libraryError) {
      return (
        <div role="alert" className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {t('app.loadError', { error: libraryError })}
        </div>
      );
    }
    if (!loaded) {
      return (
        <div className="flex flex-col items-center gap-3 py-24 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          {library ? t('app.loadingProgress') : t('app.loadingVocabulary')}
        </div>
      );
    }
    switch (shownView) {
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
            onExit={() => navigate(session.returnTo === 'study' ? 'home' : session.returnTo)}
            onRestart={() =>
              startSession({
                ...session.request,
                includeNotDue: true,
                ignoreCap: true,
                limit: session.request.limit || (state.settings.sessionSize ?? 15),
              })
            }
          />
        ) : null;
      case 'grammar':
        return <EnglishGrammarGuide speech={speech} onOpenIrregularVerbs={() => navigate('irregular')} />;
      case 'irregular':
        return <IrregularVerbsTrainer speech={speech} onBack={() => navigate('home')} />;
      case 'learn':
        if (courseConfig.track === 'english') {
          return (
            <EnglishLearningHub
              vocab={vocab}
              state={state}
              speech={speech}
              onStartVocabSession={startSession}
              onNavigate={(v) => navigate(v as NavView)}
            />
          );
        }
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
        return (
          <Dashboard
            vocab={vocab}
            state={state}
            onStart={startSession}
            onNavigate={navigate}
            onUpdateState={(ns) => update(() => ns)}
            onOpenGrammarGuide={() => navigate('grammar')}
            onOpenIrregularVerbs={() => navigate('irregular')}
          />
        );
    }
  }, [libraryError, loaded, library, shownView, session, vocab, state, speech, handleReview, handleUndo, handleToggleStar, navigate, startSession, curriculum, update, courseConfig.track, t]);

  // Navigation is derived from the views the active course declares
  const navItems = useMemo(() => navItemsFor(activeCourse, lang), [activeCourse, lang]);
  const mobileNavItems = useMemo(() => mobileNavItemsFor(activeCourse, lang), [activeCourse, lang]);

  const navButton = (n: NavItem, variant: 'side' | 'top') => {
    const Icon = n.icon;
    const active = shownView === n.id || (shownView === 'study' && session?.returnTo === n.id);
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
    <I18nContext.Provider value={i18n}>
    <div className="min-h-dvh lg:flex">
      {/* Desktop / large tablet landscape: persistent sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex xl:w-72 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between px-2">
          <button onClick={() => navigate('home')} className="flex items-center gap-3" aria-label={t('app.home')}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 font-hanzi text-2xl font-bold text-white">
              {courseConfig.badge}
            </span>
            <span className="text-left">
              <span className="block text-lg font-bold leading-tight tracking-tight">Adilingo</span>
              <span className="block text-xs text-slate-500">{courseConfig.nativeName}</span>
            </span>
          </button>
        </div>

        {/* Course Track Switcher Tab */}
        <div className="mb-3 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${languageCourses().length}, minmax(0, 1fr))` }}>
            {languageCourses().map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => switchCourse(c.id)}
                aria-pressed={activeCourse === c.id}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold transition ${
                  activeCourse === c.id
                    ? 'bg-white shadow text-slate-900 dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <span>{c.flag}</span>
                <span>{c.switcherLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* UI Language Quick Switcher */}
        <div className="mb-4 flex items-center justify-between px-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <Languages className="h-3.5 w-3.5" /> {t('header.lang')}
          </span>
          <LanguageMenu value={wantedLang} onChange={setUiLanguage} />
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto" aria-label={t('app.mainNav')}>
          {navItems.map((n) => navButton(n, 'side'))}
        </nav>
        <div className="mt-auto space-y-2 pt-2">
          <div className="flex items-center gap-3 rounded-xl bg-orange-50 px-3 py-2.5 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
            <Flame className="h-5 w-5" aria-hidden />
            <span className="text-sm font-semibold">{t('app.streak', { count: streak })}</span>
          </div>
          <button
            onClick={() => setShowSyncModal(true)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[14px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-rose-500" aria-hidden /> {t('header.sync')}
            </span>
            {getStoredSyncKey() && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title={t('app.syncActive')} />
            )}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <SettingsIcon className="h-5 w-5" aria-hidden /> {t('nav.settings')}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Phones & tablets: top bar (with inline nav from md up) */}
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6">
            <button onClick={() => navigate('home')} className="flex items-center gap-2" aria-label={t('app.home')}>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 font-hanzi text-xl font-bold text-white">
                {courseConfig.badge}
              </span>
              <span className="text-base font-bold tracking-tight md:hidden">Adilingo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const list = languageCourses();
                const idx = list.findIndex((c) => c.id === activeCourse);
                switchCourse(list[(idx + 1) % list.length].id);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              title={t('app.switchCourse', { name: courseConfig.name })}
            >
              <span>{courseConfig.flag}</span>
              <span>{courseConfig.chipLabel}</span>
            </button>

            <LanguageMenu variant="compact" value={wantedLang} onChange={setUiLanguage} />

            <nav className="ml-2 hidden flex-1 gap-1 overflow-x-auto md:flex" aria-label={t('app.mainNav')}>
              {navItems.map((n) => navButton(n, 'top'))}
            </nav>
            <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-orange-500 md:ml-0" title={t('app.streak', { count: streak })}>
              <Flame className="h-5 w-5" aria-hidden /> {streak}
            </span>
            <button
              onClick={() => setShowSyncModal(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label={t('app.cloudSync')}
              title={t('app.cloudSync')}
            >
              <Zap className="h-5 w-5 text-rose-500" />
            </button>
            <button onClick={() => setShowSettings(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={t('nav.settings')}>
              <SettingsIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        {loadWarning && (
          <div role="alert" className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <span>{loadWarning}</span>
              <button onClick={allowSave} className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700">
                {t('app.startFresh')}
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
          {t(courseConfig.track === 'english' ? 'app.footer.english' : 'app.footer.chinese', { words: vocab.length, curriculum: info.name })}
        </footer>
      </div>

      {/* Phones: bottom tab bar (hidden while studying to keep the card and grade buttons in reach) */}
      {!studying && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95"
          aria-label={t('app.mainNav')}
        >
          {mobileNavItems.map((n) => {
            const Icon = n.icon;
            const active = shownView === n.id;
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
          onSwitchCourse={switchCourse}
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
              <p className="text-xs uppercase tracking-wide opacity-70">{t('app.achievementUnlocked')}</p>
              <p className="font-semibold">{b.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
    </I18nContext.Provider>
  );
}
