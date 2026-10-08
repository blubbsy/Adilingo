import { beforeAll, describe, expect, it } from 'vitest';
import { createT, loadLocale } from '../index';
import { LocalizedError, describeMessage, errorText } from '../errors';
import { migrate } from '../../utils/storage';
import { levelLabel } from '../../data/vocab';
import { COURSES } from '../../data/courses';

describe('localized errors', () => {
  beforeAll(async () => {
    await Promise.all([loadLocale('zh'), loadLocale('de')]);
  });

  it('keep an English message for logs and translate on demand', () => {
    const err = new LocalizedError('errors.storage.newerVersion', { version: 9 });
    expect(err.message).toBe('This backup was made by a newer version of Adilingo (schema v9).');
    expect(errorText(createT('de'), err)).toBe('Dieses Backup stammt von einer neueren Adilingo-Version (Schema v9).');
    expect(errorText(createT('zh'), err)).toContain('v9');
  });

  it('pass plain errors and other values through unchanged', () => {
    expect(errorText(createT('de'), new Error('Network down'))).toBe('Network down');
    expect(errorText(createT('de'), 'oops')).toBe('oops');
  });

  it('describe a message together with the translated cause', () => {
    const cause = new LocalizedError('errors.backup.invalidJson');
    const text = describeMessage(createT('de'), { key: 'errors.storage.unreadable', vars: { storageKey: 'k1' }, cause });
    expect(text).toContain('Die Datei ist kein gültiges JSON.');
    expect(text).toContain('„k1“');
  });

  it('are what the storage layer throws', () => {
    expect(() => migrate({ version: 999 })).toThrowError(LocalizedError);
    try {
      migrate('nope');
    } catch (e) {
      expect(e).toBeInstanceOf(LocalizedError);
      expect((e as LocalizedError).key).toBe('errors.storage.notObject');
    }
  });
});

describe('level and course names follow the interface language', () => {
  beforeAll(async () => {
    await Promise.all([loadLocale('zh'), loadLocale('de')]);
  });

  it('names the English-course levels in each language, and keeps the Chinese labels without a translator', () => {
    expect(levelLabel(3, 'english', createT('en'))).toBe('B1 · Gaokao');
    expect(levelLabel(3, 'english', createT('zh'))).toBe('B1 · 高考');
    expect(levelLabel(3, 'english', createT('de'))).toBe('B1 · Gaokao');
    expect(levelLabel(3, 'english')).toBe('B1 · 高考');
  });

  it('leaves HSK labels language-neutral', () => {
    expect(levelLabel(2, 'chinese', createT('de'))).toBe('HSK 2');
    expect(levelLabel(7, 'chinese', createT('en'))).toBe('HSK 7–9');
  });

  it('has display texts for every course in every shipped language', () => {
    for (const lang of ['en', 'zh', 'de'] as const) {
      const t = createT(lang);
      for (const c of Object.values(COURSES)) {
        for (const key of [c.nameKey, c.nativeKey, c.switcherKey, c.cardTitleKey, c.cardSubtitleKey]) {
          expect(t(key), `${lang}:${key}`).not.toBe(key);
        }
      }
    }
  });
});
