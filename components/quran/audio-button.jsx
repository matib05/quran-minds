'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Plays one ayah's recitation.
 *
 * Audio is the one part of the app that genuinely depends on the network, so
 * failure is handled explicitly: the button reports that audio is unavailable
 * and the rest of the practice session carries on unaffected.
 */
export default function AudioButton({ src, label = 'Listen', className, onEnded }) {
  const audioRef = useRef(null);
  const [state, setState] = useState('idle'); // idle | loading | playing | error

  // Reset when the ayah changes. This is React's documented way to adjust state
  // on a prop change - an effect that calls setState would cascade a render.
  const [loadedSrc, setLoadedSrc] = useState(src);
  if (src !== loadedSrc) {
    setLoadedSrc(src);
    setState('idle');
  }

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  }, [src]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el || !src) return;
    if (state === 'playing') {
      el.pause();
      setState('idle');
      return;
    }
    try {
      setState('loading');
      await el.play();
      setState('playing');
    } catch {
      setState('error');
    }
  };

  if (!src) return null;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={state === 'error'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors',
          state === 'error'
            ? 'cursor-not-allowed border-dashed text-muted-foreground'
            : 'hover:bg-muted',
          className,
        )}
      >
        <span aria-hidden className="text-base leading-none">
          {state === 'playing' ? '❙❙' : '▶'}
        </span>
        {state === 'error' ? 'Audio unavailable' : state === 'loading' ? 'Loading…' : label}
      </button>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onEnded={() => {
          setState('idle');
          onEnded?.();
        }}
        onError={() => setState('error')}
      />
    </>
  );
}
