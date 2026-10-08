import { beforeAll, describe, expect, it } from 'vitest';
import { BADGES, CATEGORY_LABELS, recommendations } from '../analytics';
import { badgeDescription, badgeTitle, metricUnit, metricUnitKey } from '../badgeText';
import { createI18n } from '../../i18n/react';
import { hasMessage, loadLocale } from '../../i18n';
import { createDefaultState } from '../storage';
import { addDays, dayKey } from '../dates';
import { zh } from '../../i18n/locales/zh';
import { de } from '../../i18n/locales/de';

describe('badge texts are fully translated', () => {
  it('every badge has a title, description and (if it has a metric) a unit key in English, Chinese and German', () => {
    for (const badge of BADGES) {
      for (const key of [`badge.${badge.id}.title`, `badge.${badge.id}.desc`]) {
        expect(hasMessage(key), key).toBe(true);
        expect((zh as Record<string, string>)[key], `zh:${key}`).toBeTruthy();
        expect((de as Record<string, string>)[key], `de:${key}`).toBeTruthy();
      }
      if (badge.metric?.unit) {
        const key = metricUnitKey(badge.metric.unit);
        expect(hasMessage(key), key).toBe(true);
        expect((de as Record<string, string>)[key], `de:${key}`).toBeTruthy();
      }
    }
  });

  it('categories and tiers are translated', () => {
    for (const category of Object.keys(CATEGORY_LABELS)) expect(hasMessage(`badge.category.${category}`)).toBe(true);
    for (const tier of ['bronze', 'silver', 'gold', 'diamond', 'legendary']) expect(hasMessage(`badge.tier.${tier}`)).toBe(true);
  });

  it('the English text of a badge matches its definition (the key table never drifts from the data)', () => {
    const en = createI18n('en');
    for (const badge of BADGES) {
      expect(badgeTitle(en, badge)).toBe(badge.title);
      expect(badgeDescription(en, badge)).toBe(badge.description);
    }
  });

  it('falls back to the given text for badges without translations (e.g. synced toasts)', () => {
    const i18n = createI18n('de');
    expect(badgeTitle(i18n, { id: 'sync-paired-123', title: 'Device linked' })).toBe('Device linked');
    expect(metricUnit(i18n, 'unheard-of unit')).toBe('unheard-of unit');
  });
});

describe('localized recommendations', () => {
  beforeAll(async () => {
    await Promise.all([loadLocale('zh'), loadLocale('de')]);
  });

  function stateWithDueAndStreak() {
    const s = createDefaultState();
    s.stats.currentStreak = 5;
    s.stats.lastActiveDate = dayKey(addDays(new Date(), -1));
    return s;
  }

  it('renders the streak reminder in each language with the number filled in', () => {
    const state = stateWithDueAndStreak();
    const pick = (lang: 'en' | 'zh' | 'de') => recommendations(state, [], new Date(), createI18n(lang)).find((r) => r.id === 'streak');
    expect(pick('en')?.title).toBe('Keep your 5-day streak alive');
    expect(pick('de')?.title).toBe('Halte deine 5-Tage-Serie am Leben');
    expect(pick('zh')?.title).toContain('5');
    expect(pick('zh')?.title).not.toMatch(/Keep your/);
  });

  it('keeps working without a translator (English default)', () => {
    const state = stateWithDueAndStreak();
    expect(recommendations(state, []).find((r) => r.id === 'streak')?.body).toBe('One short review today keeps the flame burning.');
  });
});
