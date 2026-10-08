import type { CourseId, Curriculum, HskLevel, TrackId } from '../types';

export type { CourseId, TrackId };

/** Top-level screens (hash routes). `study` is a session and is always reachable. */
export type ViewId = 'home' | 'learn' | 'grammar' | 'irregular' | 'topics' | 'dictionary' | 'insights' | 'achievements';
export const ALL_VIEW_IDS: ViewId[] = ['home', 'learn', 'grammar', 'irregular', 'topics', 'dictionary', 'insights', 'achievements'];

export interface CourseLevelInfo {
  level: HskLevel;
  code: string;
  name: string;
  short: string;
  description: string;
  tag: string;
}

export interface CourseConfig {
  id: CourseId;
  /** `language` = a full language track; `specialty` = a domain course built on a track. */
  kind: 'language' | 'specialty';
  /** Language machinery of this course; replaces checks like `course === 'english'`. */
  track: TrackId;
  /** Interface language used until the learner picks one. */
  defaultUiLanguage: 'en' | 'zh';
  /** Screens available in this course, in navigation order. Anything else redirects. */
  views: ViewId[];
  /** Subset shown in the phone bottom bar. */
  mobileViews: ViewId[];
  name: string;
  nativeName: string;
  flag: string;
  sourceLang: 'en' | 'zh';
  targetLang: 'zh' | 'en';
  speechLocale: 'zh-CN' | 'en-US';
  speechVoiceLang: 'zh' | 'en';
  defaultCurriculum: Curriculum;
  curricula: {
    id: Curriculum;
    name: string;
    short: string;
    description: string;
    levels: HskLevel[];
  }[];
  levels: CourseLevelInfo[];
  labels: {
    headword: string;
    pronunciation: string;
    translation: string;
    practicePrompt: string;
    dictionaryPlaceholder: string;
    levelPrefix: string;
  };
  features: {
    pinyin: boolean;
    tones: boolean;
    measureWords: boolean;
    radicals: boolean;
    /** `curated-packs` = hand-made packs of this course's words; `item-topics` = derived from each word's topics. */
    topics: 'curated-packs' | 'item-topics';
  };
}

export const COURSES: Record<CourseId, CourseConfig> = {
  chinese: {
    id: 'chinese',
    kind: 'language',
    track: 'chinese',
    defaultUiLanguage: 'en',
    views: ['home', 'learn', 'topics', 'dictionary', 'insights', 'achievements'],
    mobileViews: ['home', 'learn', 'topics', 'dictionary', 'insights'],
    name: 'Mandarin Chinese',
    nativeName: '中文 (HSK)',
    flag: '🇨🇳',
    sourceLang: 'en',
    targetLang: 'zh',
    speechLocale: 'zh-CN',
    speechVoiceLang: 'zh',
    defaultCurriculum: 'hsk3_2026',
    curricula: [
      {
        id: 'hsk3_2026',
        name: 'HSK 3.0 (2026 community draft)',
        short: 'HSK 3.0 · 2026',
        description: 'Community draft syllabus for HSK 3.0: levels 1–6 plus the advanced 7–9 band (~10,000 words).',
        levels: [1, 2, 3, 4, 5, 6, 7],
      },
      {
        id: 'hsk3_2021',
        name: 'HSK 3.0 (2021 standard)',
        short: 'HSK 3.0 · 2021',
        description: 'The 2021 nine-level standard (~11,000 words).',
        levels: [1, 2, 3, 4, 5, 6, 7],
      },
      {
        id: 'hsk2',
        name: 'HSK 2.0 (classic)',
        short: 'HSK 2.0',
        description: 'The classic six-level exam (~5,000 words).',
        levels: [1, 2, 3, 4, 5, 6],
      },
    ],
    levels: [
      { level: 1, code: 'HSK 1', name: 'HSK Level 1', short: 'HSK 1', description: 'Basic daily communication (150–500 words)', tag: 'Beginner' },
      { level: 2, code: 'HSK 2', name: 'HSK Level 2', short: 'HSK 2', description: 'Simple exchanges and routines (300–1272 words)', tag: 'Elementary' },
      { level: 3, code: 'HSK 3', name: 'HSK Level 3', short: 'HSK 3', description: 'Life, study, and work tasks (600–2245 words)', tag: 'Intermediate' },
      { level: 4, code: 'HSK 4', name: 'HSK Level 4', short: 'HSK 4', description: 'Conversations on a wide range of topics (1200–3245 words)', tag: 'Upper-Intermediate' },
      { level: 5, code: 'HSK 5', name: 'HSK Level 5', short: 'HSK 5', description: 'Reading newspapers, watching films, speeches (2500–4316 words)', tag: 'Advanced' },
      { level: 6, code: 'HSK 6', name: 'HSK Level 6', short: 'HSK 6', description: 'Fluent expression in speech and writing (5000+ words)', tag: 'Mastery' },
      { level: 7, code: 'HSK 7–9', name: 'HSK Level 7–9', short: 'HSK 7–9', description: 'Specialized academic and professional proficiency (11,000+ words)', tag: 'Expert' },
    ],
    labels: {
      headword: '汉字 (Hànzì)',
      pronunciation: 'Pinyin',
      translation: 'English Meaning',
      practicePrompt: 'What does this mean?',
      dictionaryPlaceholder: 'Search by hanzi, pinyin (ni3 hao3), or English...',
      levelPrefix: 'HSK',
    },
    features: {
      pinyin: true,
      tones: true,
      measureWords: true,
      radicals: true,
      topics: 'curated-packs',
    },
  },
  english: {
    id: 'english',
    kind: 'language',
    track: 'english',
    defaultUiLanguage: 'zh',
    views: ['home', 'learn', 'grammar', 'irregular', 'topics', 'dictionary', 'insights', 'achievements'],
    mobileViews: ['home', 'learn', 'grammar', 'irregular', 'dictionary'],
    name: 'English for Chinese Learners',
    nativeName: '英语 (CEFR / 四六级)',
    flag: '🇬🇧',
    sourceLang: 'zh',
    targetLang: 'en',
    speechLocale: 'en-US',
    speechVoiceLang: 'en',
    defaultCurriculum: 'cefr',
    curricula: [
      {
        id: 'cefr',
        name: 'CEFR International Framework (A1–C2)',
        short: 'CEFR A1–C2',
        description: 'International language scale aligned with Oxford 3000/5000 and Cambridge benchmarks.',
        levels: [1, 2, 3, 4, 5, 6],
      },
      {
        id: 'cet',
        name: '中国升学考级体系 (中考·高考·四六级·考研)',
        short: '中考 / 高考 / 四六级',
        description: '全国升学标准词汇库：初中中考、高中高考、大学英语四级(CET-4)、六级(CET-6)与考研。',
        levels: [1, 2, 3, 4, 5, 6],
      },
    ],
    levels: [
      { level: 1, code: 'A1', name: 'CEFR A1 · 基础启蒙 (初中小学)', short: 'A1 · 基础', description: 'Basic daily words and greeting phrases (~1000 words)', tag: 'Beginner' },
      { level: 2, code: 'A2', name: 'CEFR A2 · 初中中考核心', short: 'A2 · 中考', description: 'Common situations and basic school English (~1800 words)', tag: 'Elementary' },
      { level: 3, code: 'B1', name: 'CEFR B1 · 高中高考通关', short: 'B1 · 高考', description: 'Independent communication and high school reading (~3500 words)', tag: 'Intermediate' },
      { level: 4, code: 'B2', name: 'CEFR B2 · 大学四级 (CET-4)', short: 'B2 · 四级', description: 'College English Band 4 core vocabulary & fluency (~4500 words)', tag: 'Upper-Intermediate' },
      { level: 5, code: 'C1', name: 'CEFR C1 · 大学六级 (CET-6)', short: 'C1 · 六级', description: 'College English Band 6 advanced vocabulary (~6000 words)', tag: 'Advanced' },
      { level: 6, code: 'C2', name: 'CEFR C2 · 考研 / 雅思 / 托福', short: 'C2 · 考研', description: 'Academic papers, international exams & nuance (~8000+ words)', tag: 'Mastery' },
    ],
    labels: {
      headword: 'English Word',
      pronunciation: 'Phonetic [IPA]',
      translation: '中文释义 (Meaning)',
      practicePrompt: '这个单词是什么意思？',
      dictionaryPlaceholder: '输入英文单词、音标或中文意思搜索...',
      levelPrefix: 'Level',
    },
    features: {
      pinyin: false,
      tones: false,
      measureWords: false,
      radicals: false,
      topics: 'item-topics',
    },
  },
};

export const BASE_COURSE_IDS: TrackId[] = ['chinese', 'english'];

/** True for ids that exist in the registry. Unknown ids (e.g. from a newer app version) are not courses here. */
export function isCourseId(value: unknown): value is CourseId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(COURSES, value);
}

export function getCourseConfig(courseId: CourseId = 'chinese'): CourseConfig {
  return COURSES[courseId] ?? COURSES.chinese;
}

/** Language track of any course id, including ones this build does not know (`english:foo` -> `english`). */
export function trackOf(courseId: string | undefined): TrackId {
  const base = (courseId ?? 'chinese').split(':')[0];
  return base === 'english' ? 'english' : 'chinese';
}

/** Whether `view` may be shown in the course. Unavailable views must redirect, never render another course's content. */
export function isViewAvailable(courseId: CourseId | undefined, view: ViewId): boolean {
  return getCourseConfig(courseId).views.includes(view);
}

export function courseLevelLabel(course: CourseConfig, level: number): string {
  const found = course.levels.find((l) => l.level === level);
  if (found) return found.short;
  return `${course.labels.levelPrefix} ${level}`;
}
