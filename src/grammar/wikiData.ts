/** Concept-first Chinese grammar wiki (articles authored in `content/wiki/zh`, compiled by `npm run build:content`). */

export const WIKI_CATEGORIES = [
  'sentence-patterns',
  'particles',
  'aspect',
  'complements',
  'ba-bei',
  'comparison',
  'questions',
  'negation',
  'modal-verbs',
  'measure-words',
  'connectors',
  'time-place',
  'adverbs',
  'coverbs',
  'formal-written',
] as const;

export type WikiCategory = (typeof WIKI_CATEGORIES)[number];

export interface WikiExample {
  hanzi: string;
  pinyin: string;
  english: string;
}

export interface WikiRule {
  rule: string;
  highlight?: string;
  examples: WikiExample[];
}

export interface WikiArticle {
  id: string;
  title: string;
  titleHanzi?: string;
  category: WikiCategory;
  hskRange: [number, number];
  summary: string;
  pattern?: string;
  rules: WikiRule[];
  contrasts: { vs: string; text: string }[];
  pitfalls: string[];
  relatedPointIds: string[];
  keywords: string[];
  status?: 'draft' | 'reviewed';
}

let cache: Promise<WikiArticle[]> | null = null;

/** Loads the articles (separate chunk, only needed in the Chinese course's Wiki tab). */
export function loadWiki(): Promise<WikiArticle[]> {
  cache ??= import('../data/generated/zhWiki.json').then((m) => sortArticles(m.default as unknown as WikiArticle[]));
  return cache;
}

/** Category order first, then easier articles before harder ones. */
export function sortArticles(list: WikiArticle[]): WikiArticle[] {
  const rank = (c: string) => {
    const i = (WIKI_CATEGORIES as readonly string[]).indexOf(c);
    return i === -1 ? WIKI_CATEGORIES.length : i;
  };
  return [...list].sort((a, b) => rank(a.category) - rank(b.category) || a.hskRange[0] - b.hskRange[0] || a.title.localeCompare(b.title));
}

const stripTones = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ü/g, 'v')
    .toLowerCase();

/** Lower-case search text of an article: title, summary, keywords, hanzi of the examples and their toneless pinyin / English. */
function haystack(a: WikiArticle): string {
  const parts: string[] = [a.title, a.titleHanzi ?? '', a.summary, a.pattern ?? '', ...a.keywords];
  for (const r of a.rules) {
    parts.push(r.rule);
    for (const ex of r.examples) parts.push(ex.hanzi, ex.pinyin, ex.english);
  }
  const text = parts.join(' ');
  return `${text.toLowerCase()} ${stripTones(text)}`;
}

const haystackCache = new WeakMap<WikiArticle, string>();

/**
 * Articles matching every word of the query. Hanzi, toneless pinyin ("bu mei"), tone-marked pinyin and English all work.
 * Matches in the title/keywords rank above matches in the examples.
 */
export function searchWiki(articles: WikiArticle[], query: string): WikiArticle[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return articles;
  const scored: { a: WikiArticle; score: number }[] = [];
  for (const a of articles) {
    let hay = haystackCache.get(a);
    if (hay === undefined) {
      hay = haystack(a);
      haystackCache.set(a, hay);
    }
    if (!words.every((w) => hay!.includes(w) || hay!.includes(stripTones(w)))) continue;
    const head = `${a.title} ${a.titleHanzi ?? ''} ${a.keywords.join(' ')}`.toLowerCase();
    const headPlain = stripTones(head);
    const score = words.reduce((n, w) => n + (head.includes(w) || headPlain.includes(stripTones(w)) ? 2 : 0), 0);
    scored.push({ a, score });
  }
  return scored.sort((x, y) => y.score - x.score).map((s) => s.a);
}
