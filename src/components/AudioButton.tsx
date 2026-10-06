import { Volume2, VolumeX } from 'lucide-react';
import type { SpeechApi } from '../utils/speech';

interface Props {
  speech: SpeechApi;
  text: string;
  rate: number;
  size?: 'sm' | 'lg';
  label?: string;
  onPlay?: () => void;
}

/** Speaker button with an animated waveform while speech is playing. */
export function AudioButton({ speech, text, rate, size = 'sm', label, onPlay }: Props) {
  const big = size === 'lg';
  const active = speech.speakingText === text;
  if (!speech.supported) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400" title="Speech synthesis is not available in this browser">
        <VolumeX className="h-4 w-4" /> no audio
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        speech.speak(text, rate);
        onPlay?.();
      }}
      aria-label={label ?? `Play pronunciation (${rate}×)`}
      title={`Play (${rate}×) — shortcut: Space`}
      className={`group inline-flex items-center gap-2 rounded-full border transition ${
        active
          ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
          : 'border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
      } ${big ? 'px-6 py-4' : 'px-3 py-1.5'}`}
    >
      <Volume2 className={big ? 'h-8 w-8' : 'h-4 w-4'} />
      <Wave active={active} big={big} />
      {label && <span className={big ? 'text-base font-medium' : 'text-sm'}>{label}</span>}
    </button>
  );
}

function Wave({ active, big }: { active: boolean; big: boolean }) {
  const h = big ? 'h-7' : 'h-4';
  return (
    <span className={`flex items-center gap-[3px] ${h}`} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-[3px] origin-center rounded-full bg-current ${active ? 'animate-wave' : 'opacity-40'}`}
          style={{ height: `${[45, 80, 100, 70, 50][i]}%`, animationDelay: `${i * 0.12}s`, transform: active ? undefined : 'scaleY(0.35)' }}
        />
      ))}
    </span>
  );
}
