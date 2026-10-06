import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const SPEECH_RATES = [0.5, 0.75, 1, 1.25];

export function speechSupported(): boolean {
  return typeof window !== 'undefined';
}

function hasWebSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function findChineseVoice(): SpeechSynthesisVoice | null {
  if (!hasWebSpeechSynthesis()) return null;
  const voices = window.speechSynthesis.getVoices();
  const score = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    if (lang === 'zh-cn') return 4;
    if (lang.startsWith('cmn')) return 3;
    if (lang.startsWith('zh') && !lang.includes('hk') && !lang.includes('yue')) return 2;
    if (lang.startsWith('zh')) return 1;
    return 0;
  };
  const ranked = voices.filter((v) => score(v) > 0).sort((a, b) => score(b) - score(a) || Number(b.localService) - Number(a.localService));
  return ranked[0] ?? null;
}

export interface SpeechApi {
  supported: boolean;
  /** null if no local Chinese voice is installed (stream audio is used instead). */
  voice: SpeechSynthesisVoice | null;
  voicesLoaded: boolean;
  speaking: boolean;
  /** Text currently being spoken, so only the matching button animates. */
  speakingText: string | null;
  speak: (text: string, rate?: number) => boolean;
  cancel: () => void;
}

// Global active references to prevent Chromium garbage collection during playback
let currentAudio: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeStreamGeneration = 0;

function stopCurrentAudio() {
  activeStreamGeneration++;
  if (currentAudio) {
    try {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.src = '';
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
}

/**
 * Streams authentic native Chinese audio via HTML5 Audio element.
 * For sentences: uses Google Translate TTS and Baidu TTS (supporting long natural sentences without crashing).
 * For words: uses Youdao Chinese Voice, Google Translate TTS, and Baidu TTS.
 */
function playNativeAudioStream(
  text: string,
  rate = 1,
  onEnd: () => void,
  onError: () => void,
): boolean {
  stopCurrentAudio();
  const generation = activeStreamGeneration;
  const trimmed = text.trim();
  if (!trimmed) {
    onError();
    return false;
  }

  // Detect whether the text is a full sentence or a short vocabulary word.
  // Full sentences cause Youdao's dictionary voice to return HTTP 500, so we use Google/Baidu for sentences.
  const isSentence = [...trimmed].length > 4 || /[，。！？、；：“”‘’—….,!?]/.test(trimmed);

  const urls: string[] = [];
  const encoded = encodeURIComponent(trimmed);

  if (isSentence) {
    urls.push(
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=zh-CN&client=tw-ob`,
      `https://fanyi.baidu.com/gettts?lan=zh&text=${encoded}&spd=5&source=web`,
    );
  } else {
    urls.push(
      `https://dict.youdao.com/dictvoice?audio=${encoded}&le=zh`,
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=zh-CN&client=tw-ob`,
      `https://fanyi.baidu.com/gettts?lan=zh&text=${encoded}&spd=5&source=web`,
    );
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
      try {
        (audio as unknown as { referrerPolicy?: string }).referrerPolicy = 'no-referrer';
      } catch {
        /* ignore */
      }
      currentAudio = audio;

      let ended = false;
      const handleEnd = () => {
        if (generation !== activeStreamGeneration) return;
        if (!ended) {
          ended = true;
          audio.onended = null;
          audio.onerror = null;
          if (currentAudio === audio) currentAudio = null;
          onEnd();
        }
      };

      const handleFail = () => {
        if (generation !== activeStreamGeneration) return;
        if (!ended) {
          ended = true;
          audio.onended = null;
          audio.onerror = null;
          if (currentAudio === audio) currentAudio = null;
          tryNext();
        }
      };

      audio.onended = handleEnd;
      audio.onerror = handleFail;

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          if (generation !== activeStreamGeneration) return;
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

export function useSpeech(defaultRate = 1): SpeechApi {
  const supported = speechSupported();
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(() => findChineseVoice());
  const [voicesLoaded, setVoicesLoaded] = useState(() => hasWebSpeechSynthesis() && window.speechSynthesis.getVoices().length > 0);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const speakingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasWebSpeechSynthesis()) {
      setVoicesLoaded(true);
      return;
    }
    const update = () => {
      setVoice(findChineseVoice());
      setVoicesLoaded(window.speechSynthesis.getVoices().length > 0);
    };
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    const t = window.setTimeout(() => setVoicesLoaded(true), 1200);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', update);
      window.clearTimeout(t);
    };
  }, []);

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
      if (!text.trim()) return false;

      // Cancel previous speech/audio
      stopCurrentAudio();
      if (hasWebSpeechSynthesis()) {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
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

      const done = () => {
        if (speakingRef.current === text) {
          setSpeakingText(null);
        }
      };

      setSpeakingText(text);

      // If a validated local Chinese voice is installed, try native Web Speech synthesis
      const isChineseVoice = voice && (
        voice.lang.toLowerCase().startsWith('zh') ||
        voice.lang.toLowerCase().startsWith('cmn')
      );

      if (hasWebSpeechSynthesis() && isChineseVoice) {
        try {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = voice.lang;
          u.voice = voice;
          u.rate = rate;

          // Retain module reference to prevent Chromium GC premature termination
          activeUtterance = u;

          let hasSpoken = false;
          u.onstart = () => {
            hasSpoken = true;
          };

          u.onend = () => {
            if (activeUtterance === u) activeUtterance = null;
            done();
          };

          u.onerror = (e) => {
            if (activeUtterance === u) activeUtterance = null;
            // If native synthesis errors out or was canceled by browser, fallback to native audio stream
            if (!hasSpoken && e.error !== 'canceled') {
              playNativeAudioStream(text, rate, done, done);
            } else {
              done();
            }
          };

          window.speechSynthesis.speak(u);
          return true;
        } catch {
          // Fall through to native audio streaming
        }
      }

      // If no local Chinese voice is installed, or native synthesis is not available/failed:
      // Play via high-quality native studio audio stream
      return playNativeAudioStream(text, rate, done, done);
    },
    [voice, defaultRate],
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
