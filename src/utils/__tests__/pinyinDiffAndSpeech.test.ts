import { describe, expect, it } from 'vitest';
import { checkPinyin, numberedToMarked } from '../pinyinHelper';
import { buildAudioUrls, findVoice } from '../speech';

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

describe('Multilingual TTS URL Generation & Fallbacks', () => {
  it('generates multi-tiered endpoints for short Chinese words including Youdao & Google lr-tts', () => {
    const urls = buildAudioUrls('苹果', 'zh');
    expect(urls.length).toBeGreaterThanOrEqual(3);
    // Short word includes Youdao dictionary voice
    expect(urls.some((u) => u.includes('dict.youdao.com/dictvoice') && u.includes('le=zh'))).toBe(true);
    // Includes Google lr-language-tts endpoint which is immune to Referer blocking
    expect(urls.some((u) => u.includes('google.com/speech-api/v1/synthesize') && u.includes('lang=zh-CN'))).toBe(true);
    // Includes Google translate TTS
    expect(urls.some((u) => u.includes('translate.google.com/translate_tts'))).toBe(true);
  });

  it('generates proper endpoints for Chinese full sentences without crashing Youdao', () => {
    const urls = buildAudioUrls('今天天气很好，我们一起去公园散步吧。', 'zh');
    expect(urls.length).toBeGreaterThanOrEqual(3);
    // Sentences with punctuation should exclude Youdao dictvoice (which returns 500 on sentences)
    expect(urls.some((u) => u.includes('dict.youdao.com/dictvoice'))).toBe(false);
    // Uses Google lr-language-tts & Google Translate & Baidu
    expect(urls.some((u) => u.includes('google.com/speech-api/v1/synthesize') && u.includes('lang=zh-CN'))).toBe(true);
    expect(urls.some((u) => u.includes('fanyi.baidu.com/gettts') && u.includes('lan=zh'))).toBe(true);
  });

  it('generates multi-tiered endpoints for English vocabulary and sentences', () => {
    const wordUrls = buildAudioUrls('apple', 'en');
    expect(wordUrls.some((u) => u.includes('dict.youdao.com/dictvoice') && u.includes('type=2'))).toBe(true);
    expect(wordUrls.some((u) => u.includes('google.com/speech-api/v1/synthesize') && u.includes('lang=en'))).toBe(true);

    const sentenceUrls = buildAudioUrls('He wrote a letter to his friend yesterday.', 'en');
    expect(sentenceUrls.some((u) => u.includes('google.com/speech-api/v1/synthesize') && u.includes('lang=en'))).toBe(true);
    expect(sentenceUrls.some((u) => u.includes('translate.google.com/translate_tts') && u.includes('tl=en'))).toBe(true);
  });

  it('auto-detects Chinese characters in text regardless of default targetLang', () => {
    // If text contains Hanzi characters, it should automatically route to Chinese endpoints
    const urls = buildAudioUrls('学习', 'en');
    expect(urls.some((u) => u.includes('lang=zh-CN') || u.includes('le=zh'))).toBe(true);
  });

  it('findVoice returns null when no language-matching voice is present (preventing silent English default voice usage)', () => {
    // Mock speechSynthesis with only English voices
    const mockEnglishVoices = [
      { name: 'Microsoft David Desktop', lang: 'en-US', localService: true, default: true, voiceURI: 'david' },
      { name: 'Microsoft Zira Desktop', lang: 'en-US', localService: true, default: false, voiceURI: 'zira' },
    ] as unknown as SpeechSynthesisVoice[];

    const origWindow = (globalThis as unknown as { window?: unknown }).window;
    try {
      (globalThis as unknown as { window: unknown }).window = {
        speechSynthesis: {
          getVoices: () => mockEnglishVoices,
        },
        SpeechSynthesisUtterance: class {},
      };

      // When looking for Chinese, it MUST return null (not David or Zira) so it falls back to streaming
      const zhVoice = findVoice('zh');
      expect(zhVoice).toBeNull();

      // When looking for English, it finds David or Zira
      const enVoice = findVoice('en');
      expect(enVoice).not.toBeNull();
      expect(enVoice?.lang).toBe('en-US');
    } finally {
      (globalThis as unknown as { window?: unknown }).window = origWindow;
    }
  });
});
