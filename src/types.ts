/** 1–6, plus 7 = the HSK 3.0 advanced band (levels 7–9 share one word list). */
export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Curriculum = 'hsk3_2026' | 'hsk3_2021' | 'hsk2';
export type ThemePref = 'system' | 'light' | 'dark';
export type ToneKey = '1' | '2' | '3' | '4' | '0';
export type StudyMode = 'mixed' | 'hanzi' | 'pinyin' | 'audio' | 'tone' | 'english';
/** The concrete prompt shown on a single card. */
export type PromptKind = 'hanzi' | 'pinyin' | 'english' | 'audio' | 'tone';
export type Grade = 1 | 2 | 3 | 4;

/** Direction of study: recognition (Hanzi -> Meaning) vs recall (Meaning -> Hanzi). */
export type CardDirection = 'recognition' | 'recall';

export interface VocabItem {
  id: string;
  hanzi: string;
  pinyin: string;
  pinyinNumbered: string;
  english: string[];
  /** Level in the active curriculum. */
  hskLevel: HskLevel;
  /** Level in every standard that lists the word. */
  levels: Partial<Record<Curriculum, HskLevel>>;
  /** Corpus frequency rank (lower = more common; 0 = hand-curated starter word). */
  frequency: number;
  topics: string[];
  measureWord?: { hanzi: string; pinyin: string };
  radical?: string;
  exampleSentence?: {
    hanzi: string;
    pinyin: string;
    english: string;
    /** Tatoeba sentence id (CC-BY 2.0 FR) when the example comes from Tatoeba. */
    source?: string;
  };
}

export interface HistoryEntry {
  date: string;
  grade: number;
  correct?: boolean;
  mode?: PromptKind;
  latencyMs?: number;
  learningStep?: boolean;
  stability?: number;
}

/** FSRS state for a single direction of a card. */
export interface DirectionProgress {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number; // 0: New, 1: Learning, 2: Review, 3: Relearning
  last_review?: string;
  history: HistoryEntry[];
  failureCount: number;
  consecutiveCorrect: number;
  isLeech: boolean;
  curedLeech?: boolean;
}

/** Word-level progress holding both directional schedules and bulk known flags. */
export interface CardProgress {
  recognition?: DirectionProgress;
  recall?: DirectionProgress;
  manuallyMarkedKnown?: boolean;
}

export type WordProgress = CardProgress;

export interface DailyLog {
  reviewed: number;
  correct: number;
  newCards: number;
}

export interface ToneTally {
  correct: number;
  total: number;
}

export interface Settings {
  speechRate: number;
  colorTones: boolean;
  dailyCap: number;
  defaultMode: StudyMode;
  newCardsPerDay: number;
  curriculum: Curriculum;
  theme: ThemePref;
  soundEffects: boolean;
}

export interface UserState {
  version: number;
  settings: Settings;
  progress: Record<string, CardProgress>;
  stats: {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string;
    totalReviewed: number;
    toneAccuracy: Record<ToneKey, ToneTally>;
    totalCorrect: number;
    totalLatencyMs: number;
    latencySamples: number;
    modeCounts: Record<PromptKind, number>;
    /** toneConfusion[expected][given] = count */
    toneConfusion: Record<ToneKey, Record<ToneKey, number>>;
    /** Keyed by local date YYYY-MM-DD. */
    daily: Record<string, DailyLog>;
  };
  unlockedBadges: string[];
  starredWords: string[];
  /** Levels bulk marked as known by user */
  knownLevels?: HskLevel[];
  /** Outcome of placement test */
  placementResult?: {
    estimatedLevel: HskLevel;
    date: string;
    score: number;
    total: number;
  };
}

export interface SessionRequest {
  label: string;
  mode: StudyMode;
  levels: HskLevel[];
  topics: string[];
  wordIds?: string[];
  direction?: CardDirection;
  /** Fill up with not-yet-due words (targeted / extra practice). */
  includeNotDue?: boolean;
  /** Ignore the daily cap (explicit targeted reviews). */
  ignoreCap?: boolean;
  limit?: number;
}

export interface SessionCard {
  item: VocabItem;
  direction: CardDirection;
  prompt: PromptKind;
  isNew: boolean;
  /** In-session repeat of a card failed earlier in this session. */
  learningStep?: boolean;
}
