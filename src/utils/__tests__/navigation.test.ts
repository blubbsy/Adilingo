import { beforeAll, describe, expect, it } from 'vitest';
import { COURSES, fallbackView, isViewAvailable, languageCourses } from '../../data/courses';
import { mobileNavItemsFor, navItemsFor } from '../navigation';
import { loadLocale } from '../../i18n';

describe('navigation is derived from the course registry', () => {
  beforeAll(async () => {
    await Promise.all([loadLocale('zh'), loadLocale('de')]);
  });

  it('lists exactly the views each course declares, in order, with labels in all UI languages', () => {
    for (const course of Object.values(COURSES)) {
      for (const lang of ['en', 'zh', 'de'] as const) {
        const items = navItemsFor(course.id, lang);
        expect(items.map((i) => i.id)).toEqual(course.views);
        const mobile = mobileNavItemsFor(course.id, lang);
        expect(mobile.map((i) => i.id)).toEqual(course.mobileViews);
        for (const item of [...items, ...mobile]) {
          expect(item.label.length, `${course.id}/${item.id}/${lang}`).toBeGreaterThan(0);
          expect(item.short.length).toBeGreaterThan(0);
          expect(item.label).not.toMatch(/^(nav|common)\./); // an untranslated key would show up as itself
          expect(item.short).not.toMatch(/^(nav|common)\./);
        }
      }
    }
  });

  it('keeps the existing navigation of both courses and translates to German', () => {
    expect(navItemsFor('chinese', 'en').map((i) => i.label)).toEqual([
      'Dashboard', 'Paths & Grammar', 'Topic Training', 'Dictionary', 'Insights', 'Badges',
    ]);
    expect(navItemsFor('english', 'zh').map((i) => i.id)).toEqual([
      'home', 'learn', 'grammar', 'irregular', 'topics', 'dictionary', 'insights', 'achievements',
    ]);
    expect(navItemsFor('english', 'zh')[1].label).toBe('分级路径');
    expect(mobileNavItemsFor('chinese', 'en').map((i) => i.short)).toEqual(['Home', 'Learn', 'Topics', 'Words', 'Stats']);
    expect(mobileNavItemsFor('english', 'zh').map((i) => i.short)).toEqual(['首页', '路径', '语法', '动词', '词典']);
    expect(mobileNavItemsFor('chinese', 'de').map((i) => i.short)).toEqual(['Start', 'Lernen', 'Themen', 'Wörter', 'Statistik']);
    expect(mobileNavItemsFor('english', 'de').map((i) => i.short)).toEqual(['Start', 'Pfade', 'Grammatik', 'Verben', 'Wörter']);
  });

  it('redirects unavailable views to a view the course does have', () => {
    for (const course of Object.values(COURSES)) {
      expect(isViewAvailable(course.id, fallbackView(course.id))).toBe(true);
    }
    expect(fallbackView('chinese')).toBe('learn');
  });

  it('offers every language course in the quick switchers', () => {
    expect(languageCourses().map((c) => c.id)).toEqual(['chinese', 'english']);
    for (const c of languageCourses()) {
      expect(c.switcherKey && c.chipLabel && c.badge && c.cardTitleKey && c.cardSubtitleKey && c.nameKey && c.nativeKey && c.speechSample).toBeTruthy();
    }
  });
});
