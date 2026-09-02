'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The whole Qur'an as 30 juz; click one to see its pages.
 *
 * A juz or page takes the state of its weakest tracked ayah, not its best:
 * a page with one weak ayah is a page that needs work, and averaging that
 * away would defeat the point of showing it.
 */
const STATE_ORDER = ['WEAK', 'NEEDS_REVISION', 'LEARNING', 'MEMORIZED', 'STRONG'];

const STATE_STYLE = {
  STRONG: { cls: 'bg-primary text-primary-foreground', label: 'Strong' },
  MEMORIZED: { cls: 'bg-primary/45 text-foreground', label: 'Memorized' },
  LEARNING: { cls: 'bg-accent/40 text-foreground', label: 'Learning' },
  NEEDS_REVISION: { cls: 'bg-warning/50 text-foreground', label: 'Needs revision' },
  WEAK: { cls: 'bg-destructive/50 text-foreground', label: 'Weak' },
  NOT_STARTED: { cls: 'bg-muted text-muted-foreground', label: 'Not started' },
};

export default function ProgressMap({ rows, juzPages }) {
  const [openJuz, setOpenJuz] = useState(null);

  const { juzState, pageState, counts } = useMemo(() => {
    const juzWorst = new Map();
    const pageWorst = new Map();
    const counts = {};

    const worse = (a, b) => {
      if (!a) return b;
      return STATE_ORDER.indexOf(b) < STATE_ORDER.indexOf(a) ? b : a;
    };

    for (const r of rows) {
      counts[r.state] = (counts[r.state] || 0) + 1;
      if (r.state === 'NOT_STARTED') continue;
      juzWorst.set(r.juz, worse(juzWorst.get(r.juz), r.state));
      pageWorst.set(r.page, worse(pageWorst.get(r.page), r.state));
    }
    return { juzState: juzWorst, pageState: pageWorst, counts };
  }, [rows]);

  // Page ranges come from the Qur'an repository on the server - this component
  // never hard-codes mushaf structure.
  const pagesOf = (juz) => {
    const range = juzPages?.[juz - 1];
    if (!range) return [];
    return Array.from({ length: range.lastPage - range.firstPage + 1 }, (_, i) => range.firstPage + i);
  };

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Memorization map</h2>
        <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {['STRONG', 'MEMORIZED', 'LEARNING', 'NEEDS_REVISION', 'WEAK', 'NOT_STARTED'].map((s) => (
            <li key={s} className="flex items-center gap-1">
              <span className={cn('inline-block h-3 w-3 rounded-sm', STATE_STYLE[s].cls)} />
              {STATE_STYLE[s].label}
              {counts[s] ? ` (${counts[s]})` : ''}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-10">
        {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => {
          const state = juzState.get(juz) || 'NOT_STARTED';
          return (
            <button
              key={juz}
              type="button"
              onClick={() => setOpenJuz(openJuz === juz ? null : juz)}
              aria-expanded={openJuz === juz}
              title={`Juz ${juz} — ${STATE_STYLE[state].label}`}
              className={cn(
                'aspect-square rounded-md text-xs font-medium transition-transform hover:scale-105',
                STATE_STYLE[state].cls,
                openJuz === juz && 'ring-2 ring-ring ring-offset-1',
              )}
            >
              {juz}
            </button>
          );
        })}
      </div>

      {openJuz ? (
        <div className="mt-4 animate-fade-in rounded-md border bg-background p-3">
          <p className="mb-2 text-sm font-medium">Juz {openJuz} — pages</p>
          <div className="flex flex-wrap gap-1">
            {pagesOf(openJuz).map((page) => {
              const state = pageState.get(page) || 'NOT_STARTED';
              return (
                <span
                  key={page}
                  title={`Page ${page} — ${STATE_STYLE[state].label}`}
                  className={cn(
                    'inline-flex h-7 w-9 items-center justify-center rounded text-[11px] tabular-nums',
                    STATE_STYLE[state].cls,
                  )}
                >
                  {page}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
