import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const SPEECH_RATES = [0.5, 0.75, 1, 1.25];

export function speechSupported(): boolean {
  return typeof window !== 'undefined';
}

function hasWebSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * Searches for a native browser speech synthesis voice strictly matching the target language.
 * Returns null if no suitable voice is installed in the OS/browser, preventing silent failures.
 */
export function findVoice(targetLang: 'zh' | 'en' | string = 'zh'): SpeechSynthesisVoice | null {
  if (!hasWebSpeechSynthesis()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const target = targetLang.toLowerCase();

  if (target === 'en') {
    const score = (v: SpeechSynthesisVoice) => {
      const lang = v.lang.toLowerCase().replace('_', '-');
      const name = v.name.toLowerCase();
      if (lang === 'en-us') return 10;
      if (lang === 'en-gb') return 9;
      if (lang.startsWith('en')) return 7;
      if (name.includes('english')) return 5;
      return 0;
    };
    const ranked = voices.filter((v) => score(v) > 0).sort((a, b) => score(b) - score(a) || Number(b.localService) - Number(a.localService));
    return ranked[0] ?? null;
  }

  if (target === 'zh') {
    const score = (v: SpeechSynthesisVoice) => {
      const lang = v.lang.toLowerCase().replace('_', '-');
      const name = v.name.toLowerCase();
      if (lang === 'zh-cn' || lang === 'cmn-hans-cn') return 10;
      if (lang.startsWith('cmn')) return 8;
      if (lang.startsWith('zh') && !lang.includes('hk') && !lang.includes('yue')) return 7;
      if (lang.startsWith('zh')) return 5;
      if (name.includes('chinese') || name.includes('mandarin') || name.includes('普通话') || name.includes('中文')) return 6;
      return 0;
    };
    const ranked = voices.filter((v) => score(v) > 0).sort((a, b) => score(b) - score(a) || Number(b.localService) - Number(a.localService));
    return ranked[0] ?? null;
  }

  // Generic fallback for any other language code (e.g. 'de', 'es', 'fr', 'ja')
  const generic = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(target));
  return generic[0] ?? null;
}

/**
 * Generates an ordered cascade of multi-tiered audio streaming URLs for the given text and language.
 * Ensures that if one endpoint fails, is blocked by CORS/anti-hotlink, or times out,
 * subsequent endpoints can pick up playback reliably.
 */
export function buildAudioUrls(text: string, lang: 'zh' | 'en' | string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const encoded = encodeURIComponent(trimmed);
  const urls: string[] = [];

  const isChinese = lang === 'zh' || /[\u4e00-\u9fa5]/.test(trimmed);

  if (isChinese) {
    // Youdao dictionary voice works exceptionally well for short vocabulary words & phrases
    const isShortWord = [...trimmed].length <= 5 && !/[，。！？、；：“”‘’—….,!?]/.test(trimmed);
    if (isShortWord) {
      urls.push(`https://dict.youdao.com/dictvoice?audio=${encoded}&le=zh`);
    }

    // Google Speech API lr-language-tts endpoint: highly reliable, works with and without Referer headers
    urls.push(
      `https://www.google.com/speech-api/v1/synthesize?text=${encoded}&enc=mpeg&lang=zh-CN&speed=0.5&client=lr-language-tts`,
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=zh-CN&client=tw-ob`,
      `https://fanyi.baidu.com/gettts?lan=zh&text=${encoded}&spd=5&source=web`,
    );
  } else {
    // English or Latin languages
    const isShortWord = !trimmed.includes(' ') && trimmed.length <= 30;
    if (isShortWord) {
      urls.push(`https://dict.youdao.com/dictvoice?audio=${encoded}&type=2`);
    }

    urls.push(
      `https://www.google.com/speech-api/v1/synthesize?text=${encoded}&enc=mpeg&lang=en&speed=0.5&client=lr-language-tts`,
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=en&client=tw-ob`,
      `https://fanyi.baidu.com/gettts?lan=en&text=${encoded}&spd=5&source=web`,
    );
    if (!isShortWord) {
      urls.push(`https://dict.youdao.com/dictvoice?audio=${encoded}&type=2`);
    }
  }

  return urls;
}

export interface SpeechApi {
  supported: boolean;
  voice: SpeechSynthesisVoice | null;
  voicesLoaded: boolean;
  speaking: boolean;
  speakingText: string | null;
  speak: (text: string, rate?: number) => boolean;
  cancel: () => void;
}

// Global active references to prevent Chromium garbage collection during playback
let currentAudio: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeStreamGeneration = 0;
let watchdogTimeoutId: ReturnType<typeof setTimeout> | null = null;

function clearWatchdog() {
  if (watchdogTimeoutId) {
    clearTimeout(watchdogTimeoutId);
    watchdogTimeoutId = null;
  }
}

function stopCurrentAudio() {
  activeStreamGeneration++;
  clearWatchdog();
  if (currentAudio) {
    try {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
}

/**
 * Fallback streaming native audio via HTML5 Audio element across multiple reliable CDN endpoints.
 */
function playNativeAudioStream(
  text: string,
  rate = 1,
  onEnd: () => void,
  onError: () => void,
  targetLang: 'zh' | 'en' | string = 'zh',
): boolean {
  stopCurrentAudio();
  const generation = activeStreamGeneration;
  const trimmed = text.trim();
  if (!trimmed) {
    onError();
    return false;
  }

  const isLatinOnly = !/[\u4e00-\u9fa5]/.test(trimmed);
  const lang = targetLang === 'en' || isLatinOnly ? (targetLang === 'zh' && isLatinOnly ? 'zh' : targetLang) : 'zh';
  const urls = buildAudioUrls(trimmed, lang);

  if (urls.length === 0) {
    onError();
    return false;
  }

  let index = 0;

  function tryNext() {
    if (generation !== activeStreamGeneration) return;
    if (index >= urls.length) {
      if (currentAudio) currentAudio = null;
      onError();
      return;
    }

    const url = urls[index++];
    try {
      const audio = new Audio(url);
      audio.playbackRate = rate;
      currentAudio = audio;

      let settled = false;
      let loadTimeout: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (loadTimeout) {
          clearTimeout(loadTimeout);
          loadTimeout = null;
        }
        audio.onended = null;
        audio.onerror = null;
      };

      // Watchdog: If an audio URL hangs indefinitely (e.g. network stall), advance to next URL after 5s
      loadTimeout = setTimeout(() => {
        if (generation !== activeStreamGeneration || settled) return;
        settled = true;
        cleanup();
        if (currentAudio === audio) currentAudio = null;
        tryNext();
      }, 5000);

      const handleEnd = () => {
        if (generation !== activeStreamGeneration) return;
        if (!settled) {
          settled = true;
          cleanup();
          if (currentAudio === audio) currentAudio = null;
          onEnd();
        }
      };

      const handleFail = () => {
        if (generation !== activeStreamGeneration) return;
        if (!settled) {
          settled = true;
          cleanup();
          if (currentAudio === audio) currentAudio = null;
          tryNext();
        }
      };

      audio.onended = handleEnd;
      audio.onerror = handleFail;

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err: unknown) => {
          if (generation !== activeStreamGeneration) return;
          // If browser policy blocked playback due to missing user gesture, abort cascade
          if (err instanceof Error && err.name === 'NotAllowedError') {
            settled = true;
            cleanup();
            if (currentAudio === audio) currentAudio = null;
            onError();
            return;
          }
          handleFail();
        });
      }
    } catch {
      if (generation !== activeStreamGeneration) return;
      tryNext();
    }
  }

  tryNext();
  return true;
}

export function useSpeech(defaultRate = 1, targetLang: 'zh' | 'en' | string = 'zh'): SpeechApi {
  const supported = speechSupported();
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(() => findVoice(targetLang));
  const [voicesLoaded, setVoicesLoaded] = useState(() => hasWebSpeechSynthesis() && window.speechSynthesis.getVoices().length > 0);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const speakingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasWebSpeechSynthesis()) {
      setVoicesLoaded(true);
      return;
    }
    const update = () => {
      setVoice(findVoice(targetLang));
      setVoicesLoaded(window.speechSynthesis.getVoices().length > 0);
    };
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    const t = window.setTimeout(() => setVoicesLoaded(true), 1200);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', update);
      window.clearTimeout(t);
    };
  }, [targetLang]);

  useEffect(() => {
    speakingRef.current = speakingText;
  }, [speakingText]);

  useEffect(() => () => {
    stopCurrentAudio();
    if (hasWebSpeechSynthesis()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    if (activeUtterance) activeUtterance = null;
  }, []);

  const cancel = useCallback(() => {
    stopCurrentAudio();
    if (hasWebSpeechSynthesis()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    if (activeUtterance) {
      activeUtterance.onend = null;
      activeUtterance.onerror = null;
      activeUtterance = null;
    }
    setSpeakingText(null);
  }, []);

  const speak = useCallback(
    (text: string, rate = defaultRate) => {
      if (!text || !text.trim()) return false;

      // Stop any prior playback
      stopCurrentAudio();

      const done = () => {
        if (speakingRef.current === text) {
          setSpeakingText(null);
        }
      };

      setSpeakingText(text);

      const hasChinese = /[\u4e00-\u9fa5]/.test(text);
      const effectiveLang: 'zh' | 'en' | string = hasChinese
        ? 'zh'
        : (targetLang === 'en' ? 'en' : (targetLang === 'zh' ? 'zh' : targetLang));

      // Check whether a native voice is ACTUALLY installed for this language.
      // If no native voice exists (e.g. Chinese training on an English-only OS),
      // we MUST NOT feed it to WebSpeech because Chromium will use the default voice,
      // silently skipping the text and producing no sound.
      const matchingVoice = voice ?? findVoice(effectiveLang);

      if (hasWebSpeechSynthesis() && matchingVoice !== null) {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.cancel();

          const u = new SpeechSynthesisUtterance(text);
          u.lang = effectiveLang === 'zh' ? 'zh-CN' : (effectiveLang === 'en' ? 'en-US' : effectiveLang);
          u.voice = matchingVoice;
          u.rate = rate;

          activeUtterance = u;
          let hasSpoken = false;
          const startTime = Date.now();

          // Watchdog: If WebSpeech gets stuck or doesn't start within 600ms, fail over to stream
          clearWatchdog();
          watchdogTimeoutId = setTimeout(() => {
            if (!hasSpoken && activeUtterance === u) {
              try {
                window.speechSynthesis.cancel();
              } catch {
                /* ignore */
              }
              activeUtterance = null;
              playNativeAudioStream(text, rate, done, done, effectiveLang);
            }
          }, 600);

          u.onstart = () => {
            hasSpoken = true;
            clearWatchdog();
          };

          u.onend = () => {
            clearWatchdog();
            if (activeUtterance === u) activeUtterance = null;
            // If utterance completed unnaturally fast without real speech (< 80ms for > 1 char),
            // it indicates synthesizer dropped the characters silently; fall back to stream.
            const elapsed = Date.now() - startTime;
            if (elapsed < 80 && text.trim().length > 1) {
              playNativeAudioStream(text, rate, done, done, effectiveLang);
              return;
            }
            done();
          };

          u.onerror = (e) => {
            clearWatchdog();
            if (activeUtterance === u) activeUtterance = null;
            if (!hasSpoken && (e.error !== 'canceled' || speakingRef.current === text)) {
              playNativeAudioStream(text, rate, done, done, effectiveLang);
            } else {
              done();
            }
          };

          window.speechSynthesis.speak(u);
          return true;
        } catch {
          clearWatchdog();
          // Fall through to streaming audio
        }
      }

      // No native voice installed, or native speech synthesis failed/unavailable:
      // Stream directly from high-fidelity native audio endpoints.
      return playNativeAudioStream(text, rate, done, done, effectiveLang);
    },
    [voice, defaultRate, targetLang],
  );

  return useMemo<SpeechApi>(
    () => ({
      supported,
      voice,
      voicesLoaded,
      speaking: speakingText !== null,
      speakingText,
      speak,
      cancel,
    }),
    [supported, voice, voicesLoaded, speakingText, speak, cancel],
  );
}
