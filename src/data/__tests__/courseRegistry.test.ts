import { describe, expect, it } from 'vitest';
import { ALL_VIEW_IDS, COURSES, getCourseConfig, isCourseId, isViewAvailable, trackOf } from '../courses';
import { migrate, createDefaultState } from '../../utils/storage';
import type { CardProgress, UserState } from '../../types';

const card: CardProgress = { manuallyMarkedKnown: true };

describe('course registry', () => {
  it('every course declares a valid track, views and bottom-bar subset', () => {
    for (const [id, c] of Object.entries(COURSES)) {
      expect(c.id).toBe(id);
      expect(trackOf(id)).toBe(c.track);
      expect(c.views.length).toBeGreaterThan(0);
      expect(c.views).toContain('home');
      for (const v of c.views) expect(ALL_VIEW_IDS).toContain(v);
      for (const v of c.mobileViews) expect(c.views).toContain(v);
      expect(c.mobileViews.length).toBeLessThanOrEqual(5);
    }
  });

  it('keeps course content isolated: irregular verbs exist only in the English course, both language courses share the same screens', () => {
    expect(isViewAvailable('chinese', 'irregular')).toBe(false);
    expect(isViewAvailable('english', 'irregular')).toBe(true);
    for (const v of ['home', 'learn', 'topics', 'dictionary', 'insights', 'achievements'] as const) {
      expect(isViewAvailable('chinese', v), v).toBe(true);
      expect(isViewAvailable('english', v), v).toBe(true);
    }
  });

  it('recognises only registered ids and falls back to Chinese for unknown ones', () => {
    expect(isCourseId('chinese')).toBe(true);
    expect(isCourseId('english')).toBe(true);
    expect(isCourseId('klingon')).toBe(false);
    expect(isCourseId('chinese:retired-domain')).toBe(false);
    expect(isCourseId(undefined)).toBe(false);
    expect(isCourseId('constructor')).toBe(false);
    expect(getCourseConfig('chinese:retired-domain').id).toBe('chinese');
  });

  it('derives the language track from namespaced ids', () => {
    expect(trackOf('english:power-electronics')).toBe('english');
    expect(trackOf('chinese:emotor-design')).toBe('chinese');
    expect(trackOf(undefined)).toBe('chinese');
  });
});

describe('storage keeps data of courses this build does not know', () => {
  function rawState(course: string): Record<string, unknown> {
    const d = createDefaultState();
    return {
      ...d,
      settings: { ...d.settings, course },
      progress: { unk1: card },
      knownLevels: [2],
      starredWords: ['unk1'],
      courseProgress: { chinese: { zh1: card }, english: { en1: card } },
      starredWordsByCourse: { chinese: ['zh1'] },
      knownLevelsByCourse: { chinese: [1] },
      stats: { ...d.stats, dailyByCourse: { 'chinese:retired-domain': { '2026-10-01': { reviewed: 4, correct: 3, newCards: 2 } } } },
    };
  }

  it('files the unknown course under its own id instead of mixing it into Chinese', () => {
    const s: UserState = migrate(rawState('chinese:retired-domain'));
    expect(s.settings.course).toBe('chinese');
    expect(Object.keys(s.progress)).toEqual(['zh1']);
    expect(Object.keys(s.courseProgress?.['chinese:retired-domain'] ?? {})).toEqual(['unk1']);
    expect(s.starredWords).toEqual(['zh1']);
    expect(s.knownLevels).toEqual([1]);
    expect(s.starredWordsByCourse?.['chinese:retired-domain']).toEqual(['unk1']);
    expect(s.knownLevelsByCourse?.['chinese:retired-domain']).toEqual([2]);
    // Other courses and well-formed unknown daily logs survive
    expect(Object.keys(s.courseProgress?.english ?? {})).toEqual(['en1']);
    expect(s.stats.dailyByCourse?.['chinese:retired-domain' as never]?.['2026-10-01']?.reviewed).toBe(4);
  });

  it('starts with empty Chinese progress when no Chinese snapshot exists, without losing the unknown course', () => {
    const raw = rawState('english:retired');
    raw.courseProgress = {};
    raw.starredWordsByCourse = undefined;
    raw.knownLevelsByCourse = undefined;
    const s = migrate(raw);
    expect(s.settings.course).toBe('chinese');
    expect(s.progress).toEqual({});
    expect(Object.keys(s.courseProgress?.['english:retired' as never] ?? {})).toEqual(['unk1']);
  });

  it('keeps known courses untouched and sets the course default UI language', () => {
    const withoutUiLanguage = (course: string) => ({ ...rawState(course), settings: { ...createDefaultState().settings, course, uiLanguage: undefined } });
    const en = migrate(withoutUiLanguage('english'));
    expect(en.settings.course).toBe('english');
    expect(Object.keys(en.progress)).toEqual(['unk1']);
    expect(en.settings.uiLanguage).toBe('zh');
    expect(migrate(withoutUiLanguage('chinese')).settings.uiLanguage).toBe('en');
  });

  it('ignores malformed course ids in daily logs', () => {
    const raw = rawState('chinese');
    (raw.stats as { dailyByCourse: Record<string, unknown> }).dailyByCourse = { '__proto__x': {}, 'bad id': {}, english: { '2026-10-01': { reviewed: 1, correct: 1, newCards: 1 } } };
    const s = migrate(raw);
    expect(Object.keys(s.stats.dailyByCourse ?? {})).toEqual(['english']);
  });
});
