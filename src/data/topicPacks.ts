import type { CourseId, SessionRequest, StudyMode, VocabItem } from '../types';
import { getCourseConfig } from './courses';
import enTopics from './generated/enTopics.json';

const TOPIC_EMOJI: Record<string, string> = Object.fromEntries((enTopics as { name: string; emoji: string }[]).map((t) => [t.name, t.emoji]));

export type TopicTheme =
  | 'home'
  | 'nature'
  | 'food'
  | 'health'
  | 'travel'
  | 'work'
  | 'lifestyle'
  | 'social';

export const THEME_LABELS: Record<TopicTheme, string> = {
  home: 'Home & Living',
  nature: 'Nature & Animals',
  food: 'Food & Dining',
  health: 'Body & Health',
  travel: 'Travel & Transport',
  work: 'Work & Office',
  lifestyle: 'Daily Lifestyle',
  social: 'Social & People',
};

export interface TopicPack {
  id: string;
  title: string;
  chineseTitle: string;
  emoji: string;
  theme: TopicTheme;
  description: string;
  /** Curated Hanzi words to look up from the curriculum vocabulary library. */
  curatedWords: string[];
  /** Supplementary full items for essential real-world terms not in core HSK lists. */
  supplementaryWords?: VocabItem[];
  /** Built from the course's own word topics; the description is generated when shown (localized). */
  derived?: boolean;
}

let chinesePacks: Promise<TopicPack[]> | null = null;

/**
 * The curated Chinese packs. Their words are authored in `content/topics/zh` and compiled into a lazy chunk
 * (`npm run build:content`), because they hold several thousand entries.
 */
export function loadChinesePacks(): Promise<TopicPack[]> {
  chinesePacks ??= import('./generated/zhTopics.json').then((m) =>
    (m.default as unknown as { id: string; title: string; chineseTitle: string; emoji: string; theme: TopicTheme; description: string; words: string[]; supp: VocabItem[] }[]).map(
      (p): TopicPack => ({
        id: p.id,
        title: p.title,
        chineseTitle: p.chineseTitle,
        emoji: p.emoji,
        theme: p.theme,
        description: p.description,
        curatedWords: p.words,
        supplementaryWords: p.supp,
      }),
    ),
  );
  return chinesePacks;
}

/**
 * Resolves all words for a given topic pack using the loaded curriculum vocabulary,
 * combining curated matches with supplementary items.
 */
export function resolveTopicWords(pack: TopicPack, allVocab: VocabItem[]): VocabItem[] {
  const mapByHanzi = new Map<string, VocabItem>();
  for (const item of allVocab) {
    if (!mapByHanzi.has(item.hanzi)) {
      mapByHanzi.set(item.hanzi, item);
    }
  }
  const suppByHanzi = new Map<string, VocabItem>();
  for (const supp of pack.supplementaryWords ?? []) {
    if (!suppByHanzi.has(supp.hanzi)) suppByHanzi.set(supp.hanzi, supp);
  }

  const results: VocabItem[] = [];
  const addedIds = new Set<string>();
  const add = (item: VocabItem | undefined) => {
    if (item && !addedIds.has(item.id)) {
      results.push(item);
      addedIds.add(item.id);
    }
  };

  // 1. Pack order: the course's own entry when the library has the word, else the pack's own entry
  for (const hanzi of pack.curatedWords) add(mapByHanzi.get(hanzi) ?? suppByHanzi.get(hanzi));
  // 2. Pack-only entries that are not listed in `curatedWords` (derived packs)
  for (const supp of pack.supplementaryWords ?? []) add(supp);

  return results;
}

/**
 * Packs for the active course. Curated packs list Chinese words, so they exist only for the Chinese
 * course (never show Chinese-script words in the English course). Other courses get one pack per
 * topic found on their own vocabulary.
 */
export function packsForCourse(course: CourseId | undefined, vocab: VocabItem[], curated: TopicPack[] = []): TopicPack[] {
  if (getCourseConfig(course).features.topics === 'curated-packs') return curated;

  const byTopic = new Map<string, VocabItem[]>();
  for (const item of vocab) {
    for (const topic of item.topics) {
      const list = byTopic.get(topic) ?? [];
      list.push(item);
      byTopic.set(topic, list);
    }
  }
  return [...byTopic.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([topic, words]) => ({
      id: `topic:${topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: topic,
      chineseTitle: topic,
      emoji: TOPIC_EMOJI[topic] ?? '📚',
      theme: 'lifestyle' as TopicTheme,
      description: '',
      derived: true,
      curatedWords: [],
      supplementaryWords: words,
    }));
}

/**
 * The session request for drilling a topic pack. Pack words are matched by id only (a `topics` filter
 * would drop curated words that do not carry the pack title) and supplementary words that are not in
 * the course library travel with the request so the session pool can contain them.
 */
export function buildTopicSessionRequest(
  words: VocabItem[],
  mode: StudyMode,
  label: string,
  limit?: number,
): SessionRequest {
  return {
    label,
    mode,
    levels: [],
    topics: [],
    wordIds: words.map((w) => w.id),
    extraItems: words,
    includeNotDue: true,
    ignoreCap: true,
    limit,
  };
}
