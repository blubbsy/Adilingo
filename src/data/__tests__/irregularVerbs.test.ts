import { describe, expect, it } from 'vitest';
import { IRREGULAR_VERBS } from '../irregularVerbs';

describe('Irregular Verbs Training Data', () => {
  it('contains categorized irregular verbs with valid patterns', () => {
    expect(IRREGULAR_VERBS.length).toBeGreaterThanOrEqual(10);

    const patterns = new Set(IRREGULAR_VERBS.map((v) => v.pattern));
    expect(patterns.has('AAA')).toBe(true);
    expect(patterns.has('ABB')).toBe(true);
    expect(patterns.has('ABC')).toBe(true);
    expect(patterns.has('ABA')).toBe(true);
  });

  it('validates each verb has non-empty V1, V2, V3, and IPA pronunciations', () => {
    for (const v of IRREGULAR_VERBS) {
      expect(v.v1.length).toBeGreaterThan(0);
      expect(v.v2.length).toBeGreaterThan(0);
      expect(v.v3.length).toBeGreaterThan(0);
      expect(v.meaningZh.length).toBeGreaterThan(0);
      expect(v.ipaV1).toMatch(/^\/.*\/$/);
      expect(v.exampleSentence.v1.length).toBeGreaterThan(0);
      expect(v.exampleSentence.v2.length).toBeGreaterThan(0);
      expect(v.exampleSentence.v3.length).toBeGreaterThan(0);
    }
  });

  it('verifies pattern mathematical identities', () => {
    for (const v of IRREGULAR_VERBS) {
      if (v.pattern === 'AAA') {
        expect(v.v1).toBe(v.v2);
        expect(v.v2).toBe(v.v3);
      } else if (v.pattern === 'ABB') {
        expect(v.v2).toBe(v.v3);
        expect(v.v1).not.toBe(v.v2);
      } else if (v.pattern === 'ABA') {
        expect(v.v1).toBe(v.v3);
        expect(v.v1).not.toBe(v.v2);
      } else if (v.pattern === 'ABC') {
        expect(v.v1).not.toBe(v.v2);
        expect(v.v2).not.toBe(v.v3);
        expect(v.v1).not.toBe(v.v3);
      }
    }
  });
});
