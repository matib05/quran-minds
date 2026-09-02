'use client';

import { useCallback, useEffect, useRef } from 'react';

const TICK_MS = 1000;
/** Interaction older than this means the student has stopped working. */
const IDLE_AFTER_MS = 45_000;
const FLUSH_EVERY_S = 20;

/**
 * Measures how long a student was *actually practising*.
 *
 * A timer that runs while the tab is open measures whether a tab is open, and
 * nothing else. This counts a second only when all of these hold:
 *   - the document is visible,
 *   - the window has focus,
 *   - the student interacted within the last 45 seconds.
 *
 * Time is attributed to whichever portion is on screen, and flushed to the
 * server periodically, so a closed laptop lid loses at most 20 seconds.
 */
export function useActiveTime({ sessionId, category, onFlush }) {
  const buckets = useRef({ SABAQ: 0, SABQI: 0, MANZIL: 0, OTHER: 0 });
  const pending = useRef(0);
  const lastInteraction = useRef(Date.now());
  const categoryRef = useRef(category);
  categoryRef.current = category;

  const markInteraction = useCallback(() => {
    lastInteraction.current = Date.now();
  }, []);

  const flush = useCallback(async () => {
    const b = buckets.current;
    const payload = {
      sessionId,
      sabaqSeconds: Math.round(b.SABAQ),
      sabqiSeconds: Math.round(b.SABQI),
      manzilSeconds: Math.round(b.MANZIL),
      otherSeconds: Math.round(b.OTHER),
    };
    const total =
      payload.sabaqSeconds + payload.sabqiSeconds + payload.manzilSeconds + payload.otherSeconds;
    if (!sessionId || total === 0) return;
    buckets.current = { SABAQ: 0, SABQI: 0, MANZIL: 0, OTHER: 0 };
    pending.current = 0;
    try {
      await onFlush(payload);
    } catch {
      // Losing one heartbeat is not worth interrupting practice over.
    }
  }, [sessionId, onFlush]);

  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart'];
    for (const e of events) window.addEventListener(e, markInteraction, { passive: true });

    const id = setInterval(() => {
      const active =
        document.visibilityState === 'visible' &&
        document.hasFocus() &&
        Date.now() - lastInteraction.current < IDLE_AFTER_MS;
      if (!active) return;

      const key = categoryRef.current || 'OTHER';
      buckets.current[key] = (buckets.current[key] || 0) + 1;
      pending.current += 1;
      if (pending.current >= FLUSH_EVERY_S) flush();
    }, TICK_MS);

    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      for (const e of events) window.removeEventListener(e, markInteraction);
      flush();
    };
  }, [flush, markInteraction]);

  return { flush, markInteraction };
}
