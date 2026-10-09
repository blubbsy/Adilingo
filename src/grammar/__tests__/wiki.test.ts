import { beforeAll, describe, expect, it } from 'vitest';
import { GRAMMAR_BY_ID } from '../grammarData';
import { WIKI_CATEGORIES, loadWiki, searchWiki, type WikiArticle } from '../wikiData';

let articles: WikiArticle[] = [];
beforeAll(async () => {
  articles = await loadWiki();
});

describe('Chinese grammar wiki content', () => {
  it('ships a substantial set of articles with unique ids', () => {
    expect(articles.length).toBeGreaterThanOrEqual(40);
    expect(new Set(articles.map((a) => a.id)).size).toBe(articles.length);
  });

  it('every article is complete and only links to existing lessons', () => {
    for (const a of articles) {
      expect(WIKI_CATEGORIES, a.id).toContain(a.category);
      expect(a.rules.length, a.id).toBeGreaterThanOrEqual(2);
      for (const r of a.rules) {
        expect(r.examples.length, a.id).toBeGreaterThanOrEqual(1);
        for (const ex of r.examples) expect(ex.hanzi && ex.pinyin && ex.english, a.id).toBeTruthy();
      }
      for (const id of a.relatedPointIds) expect(GRAMMAR_BY_ID.has(id), `${a.id} → ${id}`).toBe(true);
      expect(a.hskRange[0]).toBeLessThanOrEqual(a.hskRange[1]);
    }
  });
});

describe('searchWiki', () => {
  it('finds articles by hanzi, toneless pinyin, tone-marked pinyin and English', () => {
    expect(searchWiki(articles, '了').length).toBeGreaterThan(0);
    expect(searchWiki(articles, 'bu mei').some((a) => a.id.includes('bu-vs-mei'))).toBe(true);
    expect(searchWiki(articles, 'méi').length).toBeGreaterThan(0);
    expect(searchWiki(articles, 'negation').length).toBeGreaterThan(0);
  });

  it('returns everything for an empty query and nothing for nonsense', () => {
    expect(searchWiki(articles, '  ')).toHaveLength(articles.length);
    expect(searchWiki(articles, 'zzzzqqqq')).toHaveLength(0);
  });

  it('requires every word of the query to match', () => {
    const both = searchWiki(articles, '把 passive');
    const one = searchWiki(articles, '把');
    expect(both.length).toBeLessThanOrEqual(one.length);
  });
});
