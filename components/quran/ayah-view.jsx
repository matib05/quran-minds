'use client';

import { Fragment } from 'react';
import { cn } from '@/lib/utils';

/**
 * Renders one ayah as individually addressable words.
 *
 * Every word carries its 1-based canonical position, so a tap here and a
 * Mistake row in the database refer to exactly the same word. Text is never
 * transformed - it is the verified Uthmani string, split on spaces.
 */
export default function AyahView({
  verseKey,
  ayahNumber,
  words,
  size = 'md',
  hiddenPositions = [],
  markedPositions = {},
  onWordClick,
  className,
}) {
  const hidden = new Set(hiddenPositions);
  const sizeClass = size === 'lg' ? 'quran-lg' : size === 'sm' ? 'quran-sm' : 'quran-md';
  const interactive = typeof onWordClick === 'function';

  return (
    <p className={cn(sizeClass, className)} data-verse-key={verseKey}>
      {words.map((word) => {
        const mark = markedPositions[word.position];
        const isHidden = hidden.has(word.position);
        const content = isHidden ? <Blank width={word.text.length} /> : word.text;

        // Each word is its own element so it can be addressed and marked, which
        // means the space between words has to be written explicitly - inline
        // elements swallow the whitespace JSX would otherwise leave behind.
        if (!interactive) {
          return (
            <Fragment key={word.position}>
              <span className={cn('inline-block rounded-md px-0.5', markClass(mark))}>{content}</span>{' '}
            </Fragment>
          );
        }

        return (
          <Fragment key={word.position}>
            <button
              type="button"
              onClick={() => onWordClick(word)}
              aria-label={`Word ${word.position}${mark ? ', marked' : ''}`}
              aria-pressed={Boolean(mark)}
              className={cn(
                'quran-word hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                markClass(mark),
              )}
            >
              {content}
            </button>{' '}
          </Fragment>
        );
      })}
      {ayahNumber != null ? <AyahNumber n={ayahNumber} /> : null}
    </p>
  );
}

/** Statuses a word can carry, shared by the teacher marker and drill review. */
function markClass(mark) {
  switch (mark) {
    case 'mistake':
      return 'bg-destructive/15 text-destructive ring-1 ring-destructive/30';
    case 'weak':
      return 'bg-warning/20 ring-1 ring-warning/40';
    case 'correct':
      return 'bg-success/15 text-success';
    case 'incorrect':
      return 'bg-destructive/15 text-destructive line-through decoration-destructive/50';
    case 'missing':
      return 'bg-destructive/10 text-destructive/70 ring-1 ring-dashed ring-destructive/40';
    case 'misordered':
      return 'bg-warning/20 ring-1 ring-warning/40';
    case 'highlight':
      return 'bg-accent/20';
    default:
      return '';
  }
}

/** A blank the width of the word it replaces, so the line does not reflow. */
function Blank({ width }) {
  return (
    <span
      aria-label="hidden word"
      className="inline-block translate-y-[-0.15em] border-b-2 border-dashed border-muted-foreground/50 align-middle"
      style={{ width: `${Math.max(2.2, width * 0.55)}ch` }}
    >
      &nbsp;
    </span>
  );
}

/** The ayah number marker, in Arabic-Indic digits inside a rosette. */
function AyahNumber({ n }) {
  const arabic = String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  return (
    <span className="mx-1 inline-flex h-[1.5em] w-[1.5em] items-center justify-center rounded-full border border-accent/40 text-[0.5em] text-accent">
      {arabic}
    </span>
  );
}
