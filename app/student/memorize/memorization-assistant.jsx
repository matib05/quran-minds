'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AyahView from '@/components/quran/ayah-view';
import AudioButton from '@/components/quran/audio-button';
import ArabicKeyboard from '@/components/hifdh/arabic-keyboard';
import { compareRecitation } from '@/lib/quran/compare';
import { cn } from '@/lib/utils';

const MODES = [
  { key: 'listen', label: 'Listen & follow' },
  { key: 'phrases', label: 'Phrase by phrase' },
  { key: 'vanish', label: 'Vanishing words' },
  { key: 'type', label: 'Type from memory' },
];

/**
 * Free-practice assistant.
 *
 * Nothing here is scored against the student's record - it is a place to work,
 * not a test. Typing is checked in the browser using the same comparison the
 * server uses, so a student with a poor connection can still practise; the
 * graded version lives in the daily flow.
 */
export default function MemorizationAssistant({ title, units, repetitionTarget, surahs, hasSabaq }) {
  const router = useRouter();
  const [mode, setMode] = useState('listen');
  const [index, setIndex] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [reps, setReps] = useState(0);
  const [hideLevel, setHideLevel] = useState(0);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const [keyboard, setKeyboard] = useState(false);

  const unit = units[index];

  const hiddenPositions = useMemo(() => {
    if (!unit || mode !== 'vanish' || hideLevel === 0) return [];
    const share = hideLevel / 4;
    const count = Math.round(share * unit.words.length);
    // Hide from the end backwards: the ending is where recall usually fails.
    return unit.words.slice(unit.words.length - count).map((w) => w.position);
  }, [unit, mode, hideLevel]);

  if (!units.length) {
    return (
      <div className="space-y-4">
        <Picker surahs={surahs} hasSabaq={hasSabaq} onGo={(href) => router.push(href)} />
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Choose a surah or a mushaf page to begin.
        </p>
      </div>
    );
  }

  const check = () => setResult(compareRecitation(unit.text, typed));

  const reset = () => {
    setReps(0);
    setHideLevel(0);
    setTyped('');
    setResult(null);
  };

  const go = (i) => {
    setIndex(Math.max(0, Math.min(units.length - 1, i)));
    setPhraseIndex(0);
    reset();
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {unit.label} · ayah {index + 1} of {units.length}
          </p>
        </div>
        <Picker surahs={surahs} hasSabaq={hasSabaq} onGo={(href) => router.push(href)} />
      </header>

      <div className="flex flex-wrap gap-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              setMode(m.key);
              reset();
            }}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              mode === m.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border surface-mushaf p-5 sm:p-8">
        {mode === 'phrases' ? (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              Phrase {phraseIndex + 1} of {unit.phrases.length}
            </p>
            <AyahView
              verseKey={unit.verseKey}
              words={unit.phrases[phraseIndex]?.words ?? []}
              size="lg"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Phrase breaks are here to make the ayah learnable — they are not places it is correct
              to stop reciting.
            </p>
          </>
        ) : mode === 'type' && result ? (
          <AyahView
            verseKey={unit.verseKey}
            words={result.wordResults.map((w) => ({ position: w.position, text: w.text }))}
            size="lg"
            markedPositions={Object.fromEntries(result.wordResults.map((w) => [w.position, w.status]))}
          />
        ) : mode === 'type' ? (
          <p className="quran-lg text-muted-foreground/50">
            {'—'.repeat(Math.min(24, unit.words.length * 2))}
          </p>
        ) : (
          <AyahView
            verseKey={unit.verseKey}
            words={unit.words}
            size="lg"
            hiddenPositions={hiddenPositions}
          />
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <AudioButton src={unit.audioUrl} />
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Previous ayah
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index >= units.length - 1}
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Next ayah
          </button>
        </div>
      </div>

      {/* --- mode controls --- */}
      {mode === 'listen' ? (
        <Panel>
          <p className="text-sm text-muted-foreground">
            Play the recitation and follow the words. Repeat it until the shape of the ayah is
            familiar, then move on to phrase by phrase.
          </p>
          <RepCounter reps={reps} target={repetitionTarget} onCount={() => setReps((r) => r + 1)} />
        </Panel>
      ) : null}

      {mode === 'phrases' ? (
        <Panel>
          <p className="text-sm text-muted-foreground">
            Read this phrase {repetitionTarget} times, then hide it and say it from memory.
          </p>
          <RepCounter reps={reps} target={repetitionTarget} onCount={() => setReps((r) => r + 1)} />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPhraseIndex(Math.max(0, phraseIndex - 1));
                setReps(0);
              }}
              disabled={phraseIndex === 0}
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-40"
            >
              Previous phrase
            </button>
            <button
              type="button"
              onClick={() => {
                setPhraseIndex(Math.min(unit.phrases.length - 1, phraseIndex + 1));
                setReps(0);
              }}
              disabled={phraseIndex >= unit.phrases.length - 1}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              Next phrase
            </button>
          </div>
        </Panel>
      ) : null}

      {mode === 'vanish' ? (
        <Panel>
          <p className="text-sm text-muted-foreground">
            {[100, 75, 50, 25, 0][hideLevel]}% visible. Recite the whole ayah out loud each round.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setHideLevel(Math.max(0, hideLevel - 1))}
              disabled={hideLevel === 0}
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-40"
            >
              Show more
            </button>
            <button
              type="button"
              onClick={() => setHideLevel(Math.min(4, hideLevel + 1))}
              disabled={hideLevel >= 4}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              Hide more
            </button>
          </div>
        </Panel>
      ) : null}

      {mode === 'type' ? (
        <Panel>
          {result ? (
            <>
              <p className={cn('font-semibold', result.exact ? 'text-success' : 'text-warning')}>
                {result.accuracy}% — {result.correctCount} of {result.expectedCount} words
              </p>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setTyped('');
                }}
                className="mt-3 rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                Try again
              </button>
            </>
          ) : (
            <>
              <label htmlFor="free-type" className="text-sm font-medium">
                Type this ayah from memory
              </label>
              <textarea
                id="free-type"
                dir="rtl"
                lang="ar"
                rows={3}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="quran-sm mt-2 w-full rounded-md border border-input bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={check}
                  disabled={!typed.trim()}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  Check
                </button>
                <button
                  type="button"
                  onClick={() => setKeyboard((k) => !k)}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                >
                  {keyboard ? 'Hide' : 'Show'} Arabic keyboard
                </button>
              </div>
              {keyboard ? (
                <ArabicKeyboard
                  className="mt-3"
                  onInsert={(ch) => setTyped((t) => t + ch)}
                  onSpace={() => setTyped((t) => `${t} `)}
                  onBackspace={() => setTyped((t) => t.slice(0, -1))}
                />
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Practice here is not recorded against your progress — use “Start today’s Hifdh” for that.
              </p>
            </>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function Panel({ children }) {
  return <div className="rounded-lg border bg-card p-5">{children}</div>;
}

function RepCounter({ reps, target, onCount }) {
  return (
    <>
      <div className="mt-3 flex gap-1.5" aria-label={`${reps} of ${target} repetitions`}>
        {Array.from({ length: target }, (_, i) => (
          <span key={i} className={cn('h-2 flex-1 rounded-full', i < reps ? 'bg-primary' : 'bg-muted')} />
        ))}
      </div>
      <button
        type="button"
        onClick={onCount}
        className="mt-3 h-11 w-full rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90"
      >
        Done ({Math.min(reps + 1, target)} of {target})
      </button>
    </>
  );
}

function Picker({ surahs, hasSabaq, onGo }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasSabaq ? (
        <button
          type="button"
          onClick={() => onGo('/student/memorize')}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Today’s Sabaq
        </button>
      ) : null}
      <select
        defaultValue=""
        onChange={(e) => e.target.value && onGo(`/student/memorize?surah=${e.target.value}`)}
        aria-label="Choose a surah"
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">Choose a surah…</option>
        {surahs.map((s) => (
          <option key={s.number} value={s.number}>
            {s.number}. {s.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={604}
        placeholder="Page"
        aria-label="Go to mushaf page"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value) onGo(`/student/memorize?page=${e.currentTarget.value}`);
        }}
        className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
      />
    </div>
  );
}
