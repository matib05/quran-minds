'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { recordAttempt, recordActivity, completePracticeSession } from '@/app/actions/practice';
import AyahView from '@/components/quran/ayah-view';
import AudioButton from '@/components/quran/audio-button';
import ArabicKeyboard from '@/components/hifdh/arabic-keyboard';
import { useActiveTime } from '@/components/hifdh/use-active-time';
import { cn } from '@/lib/utils';

/**
 * Runs today's practice, stage by stage.
 *
 * The whole plan arrives from the server before the first screen, so the
 * session keeps working if the connection drops; results are posted as they
 * happen and the summary is computed server-side at the end.
 */
export default function PracticeRunner({ plan, sessionId }) {
  const router = useRouter();
  const [stageIndex, setStageIndex] = useState(0);
  const [summary, setSummary] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [results, setResults] = useState([]);

  const stage = plan.stages[stageIndex];
  const done = stageIndex >= plan.stages.length;

  const flushActivity = useCallback((payload) => recordActivity(payload), []);
  useActiveTime({ sessionId, category: stage?.category ?? null, onFlush: flushActivity });

  const submitAttempt = useCallback(
    async (payload) => {
      const result = await recordAttempt({ sessionId, ...payload });
      setResults((r) => [...r, { verseKey: payload.verseKey, accuracy: result.accuracy }]);
      return result;
    },
    [sessionId],
  );

  const nextStage = () => {
    setStageIndex((i) => {
      const next = i + 1;
      // Closing the session is the consequence of leaving the last stage, so
      // trigger it here rather than from an effect watching `done` - a setState
      // fired synchronously inside an effect cascades an extra render.
      if (next >= plan.stages.length) finish();
      return next;
    });
  };

  const finishing_ = useRef(false);
  const finish = async () => {
    if (finishing_.current) return;
    finishing_.current = true;
    setFinishing(true);
    try {
      const s = await completePracticeSession(sessionId);
      setSummary(s);
      router.refresh();
    } finally {
      setFinishing(false);
    }
  };

  if (done) {
    return <Summary summary={summary} plan={plan} />;
  }

  return (
    <div className="space-y-4">
      <StageHeader plan={plan} stageIndex={stageIndex} stage={stage} />
      {stage.mode === 'FIVE_BY_FIVE' ? (
        <FiveByFive stage={stage} onAttempt={submitAttempt} onDone={nextStage} />
      ) : stage.mode === 'TYPE_FROM_MEMORY' ? (
        <TypeFromMemory stage={stage} onAttempt={submitAttempt} onDone={nextStage} />
      ) : stage.mode === 'NEXT_AYAH' ? (
        <ChoiceDrill stage={stage} kind="NEXT_AYAH" onAttempt={submitAttempt} onDone={nextStage} />
      ) : stage.mode === 'NEXT_WORD' ? (
        <ChoiceDrill stage={stage} kind="NEXT_WORD" onAttempt={submitAttempt} onDone={nextStage} />
      ) : (
        <WeakSpotDrill stage={stage} onAttempt={submitAttempt} onDone={nextStage} />
      )}
    </div>
  );
}

function StageHeader({ plan, stageIndex, stage }) {
  return (
    <header>
      <div className="flex items-center gap-1.5" aria-label={`Stage ${stageIndex + 1} of ${plan.stages.length}`}>
        {plan.stages.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              i < stageIndex ? 'bg-primary' : i === stageIndex ? 'bg-accent' : 'bg-muted',
            )}
          />
        ))}
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{stage.title}</h1>
      <p className="text-sm text-muted-foreground">{stage.subtitle}</p>
    </header>
  );
}

/**
 * A mutable timestamp that is never read or written during render.
 * `useRef(Date.now())` would call an impure function while rendering.
 */
/**
 * Milliseconds since the stopwatch ref was stamped.
 *
 * The ref starts null rather than at `Date.now()`: calling Date.now() while
 * rendering is impure, and the first stamp always happens in a handler anyway.
 */
function elapsed(ref) {
  if (ref.current === null) {
    ref.current = Date.now();
    return 0;
  }
  return Date.now() - ref.current;
}

function useStopwatch() {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current === null) ref.current = Date.now();
  }, []);
  return ref;
}

/* ------------------------------------------------------------------ 5-5-5 -- */

const STEPS = [
  { key: 'listen', label: 'Listen and read', instruction: 'Listen to the phrase and follow the words.' },
  { key: 'repeat', label: 'Repeat while looking', instruction: 'Say it out loud while you read it.' },
  { key: 'recall', label: 'Recite from memory', instruction: 'The words are hidden. Recite it from memory.' },
];

/**
 * The 5-5-5 method: listen five times, repeat five times looking, then five
 * times from memory. Completing the repetitions is recorded as repetitions -
 * it is explicitly not recorded as mastery, which is what the recall test
 * afterwards is for.
 */
function FiveByFive({ stage, onAttempt, onDone }) {
  const target = stage.repetitionTarget || 5;
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [count, setCount] = useState(0);
  const startedAt = useRef(null);

  const phrase = stage.phrases[index];
  if (!phrase) return <Continue onDone={onDone} label="Start the recall test" />;

  const advance = async () => {
    const next = count + 1;
    if (next < target) {
      setCount(next);
      return;
    }
    setCount(0);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    await onAttempt({
      mode: 'FIVE_BY_FIVE',
      category: stage.category,
      verseKey: phrase.verseKey,
      correct: true,
      accuracy: 100,
      repetitions: target * STEPS.length,
      durationMs: elapsed(startedAt),
    });
    startedAt.current = Date.now();
    setStep(0);
    setIndex(index + 1);
  };

  const skipPhrase = () => {
    setCount(0);
    setStep(0);
    startedAt.current = Date.now();
    setIndex(index + 1);
  };

  const hidden = STEPS[step].key === 'recall';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border surface-mushaf p-5 sm:p-8">
        <p className="mb-3 text-xs text-muted-foreground">
          {phrase.surahName} {phrase.ayahNumber} · phrase {index + 1} of {stage.phrases.length}
          {stage.totalPhrases > stage.phrases.length
            ? ` (${stage.totalPhrases} in the full portion)`
            : ''}
        </p>
        <AyahView
          verseKey={phrase.verseKey}
          words={phrase.words}
          size="lg"
          hiddenPositions={hidden ? phrase.words.map((w) => w.position) : []}
        />
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <AudioButton src={phrase.audioUrl} label="Listen to the ayah" />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            Step {step + 1} of 3 — {STEPS[step].label}
          </h2>
          <span className="text-sm text-muted-foreground">
            {count} of {target}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{STEPS[step].instruction}</p>

        <div className="mt-3 flex gap-1.5" aria-hidden>
          {Array.from({ length: target }, (_, i) => (
            <span
              key={i}
              className={cn('h-2 flex-1 rounded-full', i < count ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={advance}
          className="mt-4 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-foreground hover:opacity-90"
        >
          {count + 1 >= target
            ? step === STEPS.length - 1
              ? 'Done — next phrase'
              : `Done — ${STEPS[step + 1].label.toLowerCase()}`
            : `Done (${count + 1} of ${target})`}
        </button>

        {/* A student who already has a phrase should not have to tap fifteen
            times to prove it - the recall test that follows is the real check. */}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={skipPhrase}
            className="flex-1 rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            I already know this phrase
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Skip to the recall test
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ type from memory -- */

function TypeFromMemory({ stage, onAttempt, onDone }) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const [studying, setStudying] = useState(true);
  const [keyboard, setKeyboard] = useState(false);
  const inputRef = useRef(null);
  const startedAt = useRef(null);

  const item = stage.items[index];
  if (!item) return <Continue onDone={onDone} label="Continue" />;

  const check = async () => {
    const res = await onAttempt({
      mode: 'TYPE_FROM_MEMORY',
      category: stage.category,
      verseKey: item.verseKey,
      typed,
      expected: item.expected,
      durationMs: elapsed(startedAt),
    });
    setResult(res);
  };

  const next = () => {
    setResult(null);
    setTyped('');
    setStudying(true);
    startedAt.current = Date.now();
    setIndex(index + 1);
  };

  const retry = () => {
    setResult(null);
    setTyped('');
    startedAt.current = Date.now();
  };

  const insert = (ch) => {
    setTyped((t) => t + ch);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border surface-mushaf p-5 sm:p-8">
        <p className="mb-3 text-xs text-muted-foreground">
          {item.label} · {index + 1} of {stage.items.length} · {item.wordCount} words
        </p>

        {studying ? (
          <>
            <p className="quran-lg">{item.expected}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <AudioButton src={item.audioUrl} />
              <button
                type="button"
                onClick={() => {
                  setStudying(false);
                  startedAt.current = Date.now();
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Hide it — I’m ready
              </button>
            </div>
          </>
        ) : result ? (
          <>
            <AyahView
              verseKey={item.verseKey}
              words={wordResultsToWords(result.wordResults)}
              size="lg"
              markedPositions={statusMarks(result.wordResults)}
            />
            {result.extras?.length ? (
              <p className="mt-3 text-sm text-destructive">
                Extra word{result.extras.length === 1 ? '' : 's'}:{' '}
                <span className="quran-sm">{result.extras.map((e) => e.text).join('، ')}</span>
              </p>
            ) : null}
          </>
        ) : (
          <p className="quran-lg text-muted-foreground/60">
            {'—'.repeat(Math.min(24, item.wordCount * 2))}
          </p>
        )}
      </div>

      {!studying ? (
        <div className="rounded-lg border bg-card p-5">
          {result ? (
            <>
              <p
                className={cn(
                  'text-lg font-semibold',
                  result.accuracy >= 85 ? 'text-success' : 'text-warning',
                )}
              >
                {result.accuracy}% — {result.correct ? 'exactly right' : scoreLabel(result.accuracy)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Correct words are green, wrong words red, and words you left out are outlined.
              </p>
              <div className="mt-4 flex gap-2">
                {!result.correct ? (
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                  >
                    Try this one again
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={next}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  {index + 1 < stage.items.length ? 'Next ayah' : 'Finish this stage'}
                </button>
              </div>
            </>
          ) : (
            <>
              <label htmlFor="answer" className="text-sm font-medium">
                Type it from memory
              </label>
              <textarea
                id="answer"
                ref={inputRef}
                dir="rtl"
                lang="ar"
                rows={3}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="quran-sm mt-2 w-full rounded-md border border-input bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Harakat are not required — the words are what matter.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={check}
                  disabled={!typed.trim()}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Check my answer
                </button>
                <button
                  type="button"
                  onClick={() => setKeyboard((k) => !k)}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                >
                  {keyboard ? 'Hide' : 'Show'} Arabic keyboard
                </button>
                <button
                  type="button"
                  onClick={() => setStudying(true)}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                >
                  Look again
                </button>
              </div>

              {keyboard ? (
                <ArabicKeyboard
                  className="mt-3"
                  onInsert={insert}
                  onSpace={() => insert(' ')}
                  onBackspace={() => setTyped((t) => t.slice(0, -1))}
                />
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- choice drills -- */

function ChoiceDrill({ stage, kind, onAttempt, onDone }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const startedAt = useRef(null);

  const item = stage.items[index];
  if (!item) return <Continue onDone={onDone} label="Continue" />;

  const answerValue = (o) => (kind === 'NEXT_AYAH' ? o.verseKey : o);
  const answerText = (o) => (kind === 'NEXT_AYAH' ? o.text : o);

  const choose = async (option) => {
    if (picked) return;
    const correct = answerValue(option) === item.answer;
    setPicked({ option, correct });
    await onAttempt({
      mode: kind,
      category: stage.category,
      verseKey: item.verseKey,
      correct,
      accuracy: correct ? 100 : 0,
      durationMs: elapsed(startedAt),
    });
  };

  const next = () => {
    setPicked(null);
    startedAt.current = Date.now();
    setIndex(index + 1);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border surface-mushaf p-5 sm:p-8">
        <p className="mb-3 text-xs text-muted-foreground">
          {item.label} · {index + 1} of {stage.items.length}
        </p>
        <p className="quran-lg">{item.prompt}</p>
        {kind === 'NEXT_WORD' ? (
          <p className="mt-2 text-sm text-muted-foreground">Which word comes next?</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Which ayah comes next?</p>
        )}
        <div className="mt-4">
          <AudioButton src={item.audioUrl} label="Listen to this ayah" />
        </div>
      </div>

      <div className="grid gap-2">
        {item.options.map((option, i) => {
          const value = answerValue(option);
          const isAnswer = value === item.answer;
          const isPicked = picked && answerValue(picked.option) === value;
          return (
            <button
              key={`${value}-${i}`}
              type="button"
              onClick={() => choose(option)}
              disabled={Boolean(picked)}
              className={cn(
                'rounded-lg border p-4 text-right transition-colors',
                !picked && 'hover:border-primary hover:bg-muted/60',
                picked && isAnswer && 'border-success bg-success/10',
                picked && isPicked && !isAnswer && 'border-destructive bg-destructive/10',
                picked && !isAnswer && !isPicked && 'opacity-50',
              )}
            >
              <span className={kind === 'NEXT_WORD' ? 'quran-md' : 'quran-sm'}>{answerText(option)}</span>
            </button>
          );
        })}
      </div>

      {picked ? (
        <div className="rounded-lg border bg-card p-4">
          <p className={cn('font-semibold', picked.correct ? 'text-success' : 'text-destructive')}>
            {picked.correct ? 'Correct' : 'Not quite — the right answer is highlighted'}
          </p>
          <button
            type="button"
            onClick={next}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {index + 1 < stage.items.length ? 'Next' : 'Finish this stage'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ weak spots -- */

/** Vanishing words for longer ayat, complete-the-ayah for short ones. */
function WeakSpotDrill({ stage, onAttempt, onDone }) {
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const startedAt = useRef(null);

  const item = stage.items[index];
  if (!item) return <Continue onDone={onDone} label="Continue" />;

  const advanceItem = () => {
    setRound(0);
    setTyped('');
    setResult(null);
    startedAt.current = Date.now();
    setIndex(index + 1);
  };

  if (item.kind === 'COMPLETE_AYAH') {
    const check = async () => {
      const res = await onAttempt({
        mode: 'COMPLETE_AYAH',
        category: stage.category,
        verseKey: item.verseKey,
        typed,
        expected: item.expected,
        durationMs: elapsed(startedAt),
      });
      setResult(res);
    };
    return (
      <div className="space-y-4">
        <div className="rounded-lg border surface-mushaf p-5 sm:p-8">
          <p className="mb-3 text-xs text-muted-foreground">
            {item.label} · {index + 1} of {stage.items.length}
          </p>
          <p className="quran-lg">
            {item.prompt} <span className="text-muted-foreground/60">………</span>
          </p>
          <div className="mt-4">
            <AudioButton src={item.audioUrl} />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          {result ? (
            <>
              <p className={cn('font-semibold', result.correct ? 'text-success' : 'text-warning')}>
                {result.accuracy}% — {result.correct ? 'exactly right' : 'the ending was'}
              </p>
              {!result.correct ? <p className="quran-md mt-1">{item.expected}</p> : null}
              <button
                type="button"
                onClick={advanceItem}
                className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                {index + 1 < stage.items.length ? 'Next' : 'Finish this stage'}
              </button>
            </>
          ) : (
            <>
              <label htmlFor="complete" className="text-sm font-medium">
                Complete the ayah
              </label>
              <input
                id="complete"
                dir="rtl"
                lang="ar"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="quran-sm mt-2 w-full rounded-md border border-input bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={check}
                disabled={!typed.trim()}
                className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Check
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Vanishing words.
  const current = item.rounds[round];
  const isLastRound = round >= item.rounds.length - 1;

  const nextRound = async () => {
    if (!isLastRound) {
      setRound(round + 1);
      return;
    }
    await onAttempt({
      mode: 'VANISHING_WORDS',
      category: stage.category,
      verseKey: item.verseKey,
      typed,
      expected: item.expected,
      durationMs: elapsed(startedAt),
    });
    advanceItem();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border surface-mushaf p-5 sm:p-8">
        <p className="mb-3 text-xs text-muted-foreground">
          {item.label} · {index + 1} of {stage.items.length} · {current.visiblePercent}% visible
        </p>
        <AyahView
          verseKey={item.verseKey}
          words={item.words}
          size="lg"
          hiddenPositions={current.hiddenPositions}
        />
        <div className="mt-4">
          <AudioButton src={item.audioUrl} />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          Recite the whole ayah out loud, filling in the missing words.
          {isLastRound ? ' On this last round, type it out so it can be checked.' : ''}
        </p>
        {isLastRound ? (
          <textarea
            dir="rtl"
            lang="ar"
            rows={2}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type the full ayah from memory"
            className="quran-sm mt-2 w-full rounded-md border border-input bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : null}
        <button
          type="button"
          onClick={nextRound}
          disabled={isLastRound && !typed.trim()}
          className="mt-3 h-11 w-full rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isLastRound ? 'Check and continue' : `Next round — ${item.rounds[round + 1].visiblePercent}% visible`}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- shared -- */

function Continue({ onDone, label }) {
  return (
    <div className="rounded-lg border bg-card p-6 text-center">
      <p className="font-medium">Stage complete</p>
      <button
        type="button"
        onClick={onDone}
        className="mt-3 rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:opacity-90"
      >
        {label}
      </button>
    </div>
  );
}

function Summary({ summary, plan }) {
  if (!summary) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">Saving today’s practice…</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <header className="text-center">
        <p className="quran-md text-primary" dir="rtl">
          الْحَمْدُ لِلَّهِ
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Today’s practice</h1>
        <p className="text-sm text-muted-foreground">
          {summary.minutes} minutes · {summary.exercises} exercises · {summary.ayatPracticed} ayat
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Score label="Sabaq" value={summary.sabaqAccuracy} />
        <Score label="Sabqi" value={summary.sabqiAccuracy} />
        <Score label="Manzil" value={summary.manzilAccuracy} />
      </div>

      {summary.weakSpotsFixed > 0 ? (
        <p className="rounded-lg border border-success/40 bg-success/5 p-4 text-sm">
          You cleared {summary.weakSpotsFixed} weak {summary.weakSpotsFixed === 1 ? 'ayah' : 'ayat'} today.
        </p>
      ) : null}

      {summary.weakSpots.length ? (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Still weak</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {summary.weakSpots.map((w) => (
              <li key={w.verseKey}>{w.label}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            These will come first in tomorrow’s practice.
          </p>
        </div>
      ) : null}

      {plan.gamificationOn && summary.pointsAwarded > 0 ? (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">{summary.pointsAwarded} points</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {summary.transactions.map((t, i) => (
              <li key={i} className="flex justify-between">
                <span>{t.reason}</span>
                <span>+{t.amount}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link
        href="/student"
        className="flex h-12 items-center justify-center rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90"
      >
        Back to today
      </Link>
    </div>
  );
}

function Score({ label, value }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <div className="text-2xl font-semibold">{value == null ? '—' : `${value}%`}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function scoreLabel(accuracy) {
  if (accuracy >= 70) return 'close';
  if (accuracy >= 40) return 'keep working on this one';
  return 'this one needs more time';
}

/** Rebuild a word list from the grader's per-word verdicts, for highlighting. */
function wordResultsToWords(wordResults) {
  return (wordResults || []).map((w) => ({ position: w.position, text: w.text }));
}

function statusMarks(wordResults) {
  const marks = {};
  for (const w of wordResults || []) marks[w.position] = w.status;
  return marks;
}
