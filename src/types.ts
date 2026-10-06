/** 1–6, plus 7 = the HSK 3.0 advanced band (levels 7–9 share one word list). */
export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Curriculum = 'hsk3_2026' | 'hsk3_2021' | 'hsk2';
export type ThemePref = 'system' | 'light' | 'dark';
export type ToneKey = '1' | '2' | '3' | '4' | '0';
export type StudyMode = 'mixed' | 'hanzi' | 'pinyin' | 'audio' | 'tone' | 'english';
/** The concrete prompt shown on a single card (mixed mode resolves to one of these). */
export type PromptKind = 'hanzi' | 'pinyin' | 'english' | 'audio' | 'tone';
export type Grade = 1 | 2 | 3 | 4;

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
  /** Extensions (optional so v1 backups without them stay valid). */
  correct?: boolean;
  mode?: PromptKind;
  latencyMs?: number;
  /** In-session repeat of an already-failed card; does not affect scheduling. */
  learningStep?: boolean;
}

export interface CardProgress {
  easeFactor: number;
  interval: number;
  repetitions: number;
  dueDate: string;
  lastReviewed?: string;
  isLeech: boolean;
  history: HistoryEntry[];
  consecutiveCorrect: number;
  failureCount: number;
  /** Set once the card has been a leech and was later recalled 3× in a row. */
  curedLeech?: boolean;
}

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
}

export interface SessionRequest {
  label: string;
  mode: StudyMode;
  levels: HskLevel[];
  topics: string[];
  wordIds?: string[];
  /** Fill up with not-yet-due words (targeted / extra practice). */
  includeNotDue?: boolean;
  /** Ignore the daily cap (explicit targeted reviews). */
  ignoreCap?: boolean;
  limit?: number;
}

export interface SessionCard {
  item: VocabItem;
  prompt: PromptKind;
  isNew: boolean;
  /** In-session repeat of a card failed earlier in this session. */
  learningStep?: boolean;
}
