'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveLesson } from '@/app/actions/lesson';
import AyahView from '@/components/quran/ayah-view';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { key: 'SABAQ', label: 'Sabaq', arabic: 'سَبَق', hint: 'New memorization' },
  { key: 'SABQI', label: 'Sabqi', arabic: 'سَبْقِي', hint: 'Recent revision' },
  { key: 'MANZIL', label: 'Manzil', arabic: 'مَنْزِل', hint: 'Long-term revision' },
];

const RATINGS = [
  { key: 'EXCELLENT', label: 'Excellent' },
  { key: 'GOOD', label: 'Good' },
  { key: 'NEEDS_WORK', label: 'Needs work' },
  { key: 'REPEAT_TOMORROW', label: 'Repeat tomorrow' },
];

const MISTAKE_TYPES = [
  { key: 'FORGOTTEN_WORD', label: 'Forgot' },
  { key: 'WRONG_WORD', label: 'Wrong word' },
  { key: 'SKIPPED_WORD', label: 'Skipped' },
  { key: 'ADDED_WORD', label: 'Added' },
  { key: 'HESITATION', label: 'Hesitation' },
  { key: 'BEGINNING_ERROR', label: 'Beginning' },
  { key: 'ENDING_ERROR', label: 'Ending' },
  { key: 'MUTASHABIHAT', label: 'Similar ayah' },
  { key: 'TAJWID', label: 'Tajwid' },
  { key: 'PRONUNCIATION', label: 'Pronunciation' },
];

const mistakeKey = (m) => `${m.verseKey}#${m.wordPosition}`;

/**
 * The whole lesson on one screen.
 *
 * The design target is 30-60 seconds: three taps for the verdicts, taps on the
 * mushaf for each word the student missed, save. There is no form to fill in -
 * the mistake type defaults to "forgot" and is only changed when the teacher
 * wants to be more specific.
 */
export default function LessonRecorder({ studentId, studentName, portions, weakWords, existing }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [active, setActive] = useState('SABAQ');
  const [mistakeType, setMistakeType] = useState('FORGOTTEN_WORD');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [pageOffset, setPageOffset] = useState({ SABAQ: 0, SABQI: 0, MANZIL: 0 });

  const [entries, setEntries] = useState(() => {
    const base = { SABAQ: { status: 'NOT_STARTED', rating: null }, SABQI: { status: 'NOT_STARTED', rating: null }, MANZIL: { status: 'NOT_STARTED', rating: null } };
    for (const e of existing?.entries || []) base[e.category] = { status: e.status, rating: e.rating };
    return base;
  });

  const [mistakes, setMistakes] = useState(() => {
    const map = new Map();
    for (const m of existing?.mistakes || []) map.set(mistakeKey(m), m);
    return map;
  });

  const portion = portions.find((p) => p.category === active);
  const currentPage = portion?.pages?.[pageOffset[active]] ?? null;

  const countsByCategory = useMemo(() => {
    const counts = { SABAQ: 0, SABQI: 0, MANZIL: 0 };
    for (const m of mistakes.values()) if (counts[m.category] != null) counts[m.category] += 1;
    return counts;
  }, [mistakes]);

  const markedPositions = useMemo(() => {
    const byVerse = {};
    for (const m of mistakes.values()) {
      byVerse[m.verseKey] = byVerse[m.verseKey] || {};
      byVerse[m.verseKey][m.wordPosition] = 'mistake';
    }
    return byVerse;
  }, [mistakes]);

  const toggleWord = (verseKey, word) => {
    const key = `${verseKey}#${word.position}`;
    setMistakes((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, { verseKey, wordPosition: word.position, mistakeType, category: active });
      return next;
    });
  };

  const setEntry = (category, patch) =>
    setEntries((prev) => ({ ...prev, [category]: { ...prev[category], ...patch } }));

  const submit = () => {
    startTransition(async () => {
      try {
        const result = await saveLesson({
          studentId,
          notes: notes.trim() || null,
          entries: CATEGORIES.map((c) => ({
            category: c.key,
            status: entries[c.key].status,
            rating: entries[c.key].rating,
            assignmentId: portions.find((p) => p.category === c.key)?.assignment?.id ?? null,
          })),
          mistakes: [...mistakes.values()],
        });
        toast({
          title: 'Lesson saved',
          description: `${studentName} · ${result.mistakeCount} mistake${result.mistakeCount === 1 ? '' : 's'} recorded`,
        });
        router.push(`/teacher/students/${studentId}`);
        router.refresh();
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Could not save the lesson',
          description: error?.message ?? 'Please try again.',
        });
      }
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      {/* ---- verdicts ---- */}
      <div className="space-y-3">
        {CATEGORIES.map((c) => {
          const portionFor = portions.find((p) => p.category === c.key);
          const entry = entries[c.key];
          return (
            <section
              key={c.key}
              className={cn(
                'rounded-lg border bg-card p-3 transition-colors',
                active === c.key && 'ring-2 ring-ring',
              )}
            >
              <button
                type="button"
                onClick={() => setActive(c.key)}
                className="flex w-full items-baseline justify-between gap-2 text-left"
              >
                <span>
                  <span className="quran mr-2 text-lg text-primary">{c.arabic}</span>
                  <span className="font-semibold">{c.label}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {countsByCategory[c.key]} marked
                </span>
              </button>

              <p className="mt-0.5 text-sm">
                {portionFor?.assignment ? (
                  <>
                    <span className="font-medium">{portionFor.assignment.title}</span>
                    <span className="block text-xs text-muted-foreground">{portionFor.assignment.subtitle}</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Not assigned</span>
                )}
              </p>

              <div className="mt-2 flex gap-1">
                <Chip
                  active={entry.status === 'COMPLETE'}
                  tone="success"
                  onClick={() => setEntry(c.key, { status: 'COMPLETE' })}
                >
                  Completed
                </Chip>
                <Chip
                  active={entry.status === 'INCOMPLETE'}
                  tone="warn"
                  onClick={() => setEntry(c.key, { status: 'INCOMPLETE' })}
                >
                  Incomplete
                </Chip>
              </div>

              <div className="mt-1.5 flex flex-wrap gap-1">
                {RATINGS.map((r) => (
                  <Chip
                    key={r.key}
                    active={entry.rating === r.key}
                    onClick={() => setEntry(c.key, { rating: entry.rating === r.key ? null : r.key })}
                  >
                    {r.label}
                  </Chip>
                ))}
              </div>
            </section>
          );
        })}

        <div className="rounded-lg border bg-card p-3">
          <label htmlFor="notes" className="text-sm font-medium">
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional — anything the next teacher should know."
            className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Saving…' : `Save lesson (${mistakes.size} mistake${mistakes.size === 1 ? '' : 's'})`}
        </button>
      </div>

      {/* ---- mushaf ---- */}
      <div className="rounded-lg border surface-mushaf">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <div className="text-sm">
            <span className="font-medium">Tap a word {studentName} missed</span>
            <span className="ml-2 text-muted-foreground">
              marking as <span className="font-medium">{MISTAKE_TYPES.find((t) => t.key === mistakeType)?.label}</span> in{' '}
              <span className="font-medium">{CATEGORIES.find((c) => c.key === active)?.label}</span>
            </span>
          </div>
          {portion?.pages?.length > 1 ? (
            <div className="flex items-center gap-1 text-sm">
              <button
                type="button"
                disabled={pageOffset[active] === 0}
                onClick={() => setPageOffset((p) => ({ ...p, [active]: p[active] - 1 }))}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                ←
              </button>
              <span className="tabular-nums">Page {currentPage?.page}</span>
              <button
                type="button"
                disabled={pageOffset[active] >= portion.pages.length - 1}
                onClick={() => setPageOffset((p) => ({ ...p, [active]: p[active] + 1 }))}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                →
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1 border-b px-4 py-2">
          {MISTAKE_TYPES.map((t) => (
            <Chip key={t.key} active={mistakeType === t.key} onClick={() => setMistakeType(t.key)}>
              {t.label}
            </Chip>
          ))}
        </div>

        {currentPage ? (
          <div className="px-4 py-5 sm:px-6">
            <p className="mb-3 text-xs text-muted-foreground">
              Page {currentPage.page} · Juz {currentPage.juz} · {currentPage.surahNames.join(', ')}
            </p>
            <div className="space-y-1">
              {currentPage.ayat.map((a) => (
                <AyahView
                  key={a.verseKey}
                  verseKey={a.verseKey}
                  ayahNumber={a.ayah}
                  words={a.words}
                  size="md"
                  markedPositions={{
                    ...weakMarksFor(a.verseKey, a.words, weakWords),
                    ...(markedPositions[a.verseKey] || {}),
                  }}
                  onWordClick={(w) => toggleWord(a.verseKey, w)}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No portion assigned for {CATEGORIES.find((c) => c.key === active)?.label}.
          </p>
        )}
      </div>
    </div>
  );
}

/** Existing weak words are shaded so the teacher sees history while listening. */
function weakMarksFor(verseKey, words, weakWords) {
  const marks = {};
  for (const w of words) {
    if (weakWords[`${verseKey}#${w.position}`]) marks[w.position] = 'weak';
  }
  return marks;
}

function Chip({ active, tone, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? tone === 'success'
            ? 'border-success bg-success text-primary-foreground'
            : tone === 'warn'
              ? 'border-warning bg-warning text-primary-foreground'
              : 'border-primary bg-primary text-primary-foreground'
          : 'bg-background hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
