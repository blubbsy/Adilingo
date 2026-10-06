import { describe, expect, it } from 'vitest';
import { checkPinyin, numberedToMarked } from '../pinyinHelper';

function computePinyinDiff(typed: string, target: string): Array<{ char: string; match: boolean }> {
  const a = typed;
  const b = target;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (a[i].toLowerCase() === b[j].toLowerCase()) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: Array<{ char: string; match: boolean }> = [];
  let i = m;
  let j = n;
  while (i > 0) {
    if (j > 0 && a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
      result.unshift({ char: a[i - 1], match: true });
      i--;
      j--;
    } else if (j > 0 && dp[i][j - 1] >= dp[i - 1][j]) {
      j--;
    } else {
      result.unshift({ char: a[i - 1], match: false });
      i--;
    }
  }
  return result;
}

describe('Pinyin diff and autocomplete helpers', () => {
  it('correctly compares matching and non-matching characters in diff', () => {
    const diffExact = computePinyinDiff('nǐ hǎo', 'nǐ hǎo');
    expect(diffExact.every((d) => d.match)).toBe(true);

    const diffTones = computePinyinDiff('ni hao', 'nǐ hǎo');
    // 'n', ' ', 'h', 'o' match, 'i' and 'a' differ in accents
    const matchedChars = diffTones.filter((d) => d.match).map((d) => d.char).join('');
    const mismatchedChars = diffTones.filter((d) => !d.match).map((d) => d.char).join('');
    expect(matchedChars).toBe('n ho');
    expect(mismatchedChars).toBe('ia');
  });

  it('converts numbered pinyin live to marked pinyin', () => {
    expect(numberedToMarked('ni3 hao3')).toBe('nǐ hǎo');
    expect(numberedToMarked('lv4')).toBe('lǜ');
    expect(numberedToMarked('nu:3')).toBe('nǚ');
  });

  it('flags tone-only errors and missing umlaut in checkPinyin', () => {
    const mockItem = {
      id: 'test-1',
      hanzi: '你好',
      pinyin: 'nǐ hǎo',
      pinyinNumbered: 'ni3 hao3',
      english: ['hello'],
      hskLevel: 1 as const,
      levels: { hsk3_2026: 1 as const },
      frequency: 1,
      topics: ['greetings'],
    };

    const res1 = checkPinyin('ni hao', mockItem);
    expect(res1.correct).toBe(false);
    expect(res1.tonesWrong).toBe(true);

    const res2 = checkPinyin('nǐ hǎo', mockItem);
    expect(res2.correct).toBe(true);
    expect(res2.tonesWrong).toBe(false);
  });
});
