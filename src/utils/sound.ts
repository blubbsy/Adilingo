import type { ToneKey } from '../types';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore if denied */
  }
}

/** Plays a soft, celebratory harmonic chime on correct recall */
export function playCorrect(enabled = true): void {
  vibrate([15, 30, 20]);
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Two gentle sine tones: C5 (523.25 Hz) then E5 (659.25 Hz)
  const notes = [
    { freq: 523.25, time: now, dur: 0.18 },
    { freq: 659.25, time: now + 0.08, dur: 0.24 },
  ];

  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(n.freq, n.time);

    gain.gain.setValueAtTime(0, n.time);
    gain.gain.linearRampToValueAtTime(0.12, n.time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, n.time + n.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(n.time);
    osc.stop(n.time + n.dur);
  }
}

/** Plays a gentle, non-jarring low thud on an incorrect answer */
export function playError(enabled = true): void {
  vibrate(35);
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.2);
}

/** Plays a light tactile click */
export function playClick(enabled = true): void {
  vibrate(8);
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, now);
  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.03);
}

/**
 * Synthesizes the authentic Mandarin Chao pitch contour (55, 35, 214, 51)
 * so learners hear the pitch trajectory directly.
 */
export function playTonePitch(tone: ToneKey, enabled = true): void {
  vibrate(12);
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';

  let duration = 0.35;
  switch (tone) {
    case '1': // 55 (high flat)
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(440, now + 0.3);
      duration = 0.35;
      break;
    case '2': // 35 (rising)
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.3);
      duration = 0.35;
      break;
    case '3': // 214 (dipping)
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(210, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.4);
      duration = 0.45;
      break;
    case '4': // 51 (falling)
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.25);
      duration = 0.3;
      break;
    case '0': // Neutral (light, short)
    default:
      osc.frequency.setValueAtTime(300, now);
      duration = 0.15;
      break;
  }

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
  gain.gain.setValueAtTime(0.12, now + duration - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

/** Celebratory fanfare on session completion */
export function playFanfare(enabled = true): void {
  vibrate([30, 40, 30, 40, 60]);
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const arpeggio = [
    { freq: 523.25, time: now + 0.0, dur: 0.12 }, // C5
    { freq: 659.25, time: now + 0.1, dur: 0.12 }, // E5
    { freq: 783.99, time: now + 0.2, dur: 0.14 }, // G5
    { freq: 1046.5, time: now + 0.32, dur: 0.35 }, // C6
  ];

  for (const n of arpeggio) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(n.freq, n.time);

    gain.gain.setValueAtTime(0, n.time);
    gain.gain.linearRampToValueAtTime(0.14, n.time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, n.time + n.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(n.time);
    osc.stop(n.time + n.dur);
  }
}
