import { beforeAll, describe, expect, it } from 'vitest';
import { SLOW_REPLAY_RATE, SPEECH_RATES, applyAudioRate, buildAudioUrls, nextSpeechRate } from '../speech';
import { loadLocale, t } from '../../i18n';

describe('nextSpeechRate', () => {
  it('cycles through every configured speed and wraps around', () => {
    let rate = SPEECH_RATES[0];
    const seen: number[] = [rate];
    for (let i = 0; i < SPEECH_RATES.length; i++) {
      rate = nextSpeechRate(rate);
      seen.push(rate);
    }
    expect(seen.slice(0, SPEECH_RATES.length)).toEqual(SPEECH_RATES);
    expect(seen[SPEECH_RATES.length]).toBe(SPEECH_RATES[0]);
  });

  it('snaps an off-grid saved value (e.g. 0.75 / 1.25 from older settings) to the nearest step before advancing', () => {
    expect(nextSpeechRate(1.5)).toBe(0.5); // last step wraps around
    expect(nextSpeechRate(0.6)).toBe(1); // nearest is 0.5
    expect(nextSpeechRate(1.25)).toBe(1.5); // old saved value: a tie snaps to the lower step (1), then advances
    expect(nextSpeechRate(0.75)).toBe(1); // old saved value: tie snaps to 0.5, then advances
  });

  it('keeps the slow replay speed slower than normal speech', () => {
    expect(SLOW_REPLAY_RATE).toBeLessThan(1);
    expect(SLOW_REPLAY_RATE).toBeGreaterThanOrEqual(0.5);
  });
});

describe('applyAudioRate', () => {
  it('sets playbackRate, defaultPlaybackRate and pitch preservation', () => {
    const audio = {} as HTMLAudioElement & { webkitPreservesPitch?: boolean; mozPreservesPitch?: boolean };
    applyAudioRate(audio, 1.5);
    expect(audio.playbackRate).toBe(1.5);
    expect(audio.defaultPlaybackRate).toBe(1.5);
    expect(audio.preservesPitch).toBe(true);
    expect(audio.webkitPreservesPitch).toBe(true);
    expect(audio.mozPreservesPitch).toBe(true);
  });

  it('can be re-applied to change speed of an element that is already playing', () => {
    const audio = {} as HTMLAudioElement;
    applyAudioRate(audio, 1);
    applyAudioRate(audio, 0.5);
    expect(audio.playbackRate).toBe(0.5);
  });

  it('never throws when the browser rejects the rate', () => {
    const audio = {} as HTMLAudioElement;
    Object.defineProperty(audio, 'playbackRate', {
      set() {
        throw new DOMException('NotSupportedError');
      },
    });
    expect(() => applyAudioRate(audio, 0.5)).not.toThrow();
  });
});

describe('speech fallback cascade is unchanged by speed support (GEMINI §2 regression guard)', () => {
  it('keeps Youdao only for short Chinese words and never for Chinese sentences', () => {
    expect(buildAudioUrls('你好', 'zh')[0]).toContain('dict.youdao.com');
    expect(buildAudioUrls('今天天气很好，我们去公园玩吧。', 'zh').some((u) => u.includes('youdao'))).toBe(false);
  });

  it('keeps Youdao last for English sentences', () => {
    const urls = buildAudioUrls('She eats an apple every morning.', 'en');
    expect(urls[0]).toContain('google.com/speech-api');
    expect(urls[urls.length - 1]).toContain('youdao');
  });
});

describe('speed control i18n', () => {
  beforeAll(async () => {
    await loadLocale('zh');
  });

  it('has English and Chinese labels with the rate placeholder', () => {
    expect(t('speed.label', 'en')).toBe('Playback speed');
    expect(t('speed.label', 'zh')).toBe('播放速度');
    expect(t('speed.cycle', 'en', { rate: 1.5 })).toContain('1.5');
    expect(t('speed.cycle', 'zh', { rate: 0.5 })).toContain('0.5');
  });
});
