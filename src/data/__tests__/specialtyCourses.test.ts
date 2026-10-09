import { describe, expect, it } from 'vitest';
import { COURSES, courseVars, fallbackView, getCourseConfig, isViewAvailable, specialtyCourses, trackOf } from '../courses';
import { DOMAINS, domainCourseId, parseDomainCourse } from '../domains';
import { levelLabel, loadLibrary, vocabForCurriculum } from '../vocab';

const CJK = /[一-鿿]/;

describe('specialty course registry', () => {
  it('registers a course per domain and language track', () => {
    expect(DOMAINS.length).toBeGreaterThanOrEqual(5);
    expect(specialtyCourses()).toHaveLength(DOMAINS.length * 2);
    for (const d of DOMAINS) {
      for (const track of ['chinese', 'english'] as const) {
        const c = COURSES[domainCourseId(d.id, track)];
        expect(c.kind).toBe('specialty');
        expect(c.track).toBe(track);
        expect(trackOf(c.id)).toBe(track);
        expect(c.domain).toBe(d.id);
        expect(parseDomainCourse(c.id)).toEqual({ track, domain: d.id });
      }
    }
  });

  it('shows learning paths but no grammar, irregular verbs or placement test', () => {
    for (const c of specialtyCourses()) {
      expect(isViewAvailable(c.id, 'irregular'), `${c.id}/irregular`).toBe(false);
      expect(isViewAvailable(c.id, 'learn'), `${c.id}/learn`).toBe(true);
      expect(c.features.grammar).toBe(false);
      expect(c.features.placement).toBe(false);
      expect(c.features.topics).toBe('item-topics');
      expect(c.views).toContain('home');
      expect(isViewAvailable(c.id, fallbackView(c.id))).toBe(true);
    }
    // the language courses are unchanged
    expect(isViewAvailable('chinese', 'learn')).toBe(true);
    expect(getCourseConfig('english').features.grammar).toBe(true);
  });

  it('keeps the track machinery of the language (pinyin for Chinese terms, IPA for English terms)', () => {
    const zh = getCourseConfig('chinese:emotor');
    const en = getCourseConfig('english:emotor');
    expect(zh.features.pinyin).toBe(true);
    expect(en.features.pinyin).toBe(false);
    expect(zh.speechLocale).toBe('zh-CN');
    expect(en.speechLocale).toBe('en-US');
  });

  it('derives the domain texts from the manifest in both interface languages', () => {
    const c = getCourseConfig('chinese:emotor');
    expect(courseVars(c, 'en')?.domain).toBe('Electric Motor Design');
    expect(courseVars(c, 'zh')?.domain).toBe('电机设计');
    expect(courseVars(getCourseConfig('chinese'), 'en')).toBeUndefined();
  });
});

describe('specialty vocabulary', () => {
  for (const d of DOMAINS) {
    for (const track of ['chinese', 'english'] as const) {
      it(`${track}:${d.id} loads a clean, isolated library`, async () => {
        const id = domainCourseId(d.id, track);
        const lib = await loadLibrary(id);
        expect(lib.all).toHaveLength(d.count);
        const words = vocabForCurriculum(lib, 'domain');
        expect(words).toHaveLength(d.count);
        expect(new Set(words.map((w) => w.id)).size).toBe(words.length);
        for (const w of words) {
          expect(w.id.startsWith(`d:${d.id}:`)).toBe(true);
          expect([1, 2, 3]).toContain(w.hskLevel);
          expect(w.definition, w.id).toBeTruthy();
          expect(w.exampleSentence?.hanzi, w.id).toBeTruthy();
          // Chinese terms are written in hanzi; only code-like names (standards such as "IEC 61000") stay in Latin script
          if (track === 'chinese') expect(CJK.test(w.hanzi) || /^[A-Za-z0-9 ./\-+()]+$/.test(w.hanzi), w.id).toBe(true);
          else expect(CJK.test(w.hanzi), w.id).toBe(false);
          expect(w.english.length, w.id).toBeGreaterThan(0);
        }
        expect(levelLabel(1, id)).toBeTruthy();
      });
    }
  }

  it('ids never collide between courses, so progress cannot leak', async () => {
    const seen = new Map<string, string>();
    for (const c of specialtyCourses()) {
      for (const w of (await loadLibrary(c.id)).all) {
        expect(seen.get(w.id), w.id).toBeUndefined();
        seen.set(w.id, c.id);
      }
    }
  });

  it('English terms that are spelled out letter by letter carry a speech respelling', async () => {
    const lib = await loadLibrary('english:power-electronics');
    const igbt = lib.all.find((w) => w.abbr === 'IGBT');
    expect(igbt?.speakAs).toMatch(/eye/i);
  });
});
