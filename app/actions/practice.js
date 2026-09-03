'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireStudent } from '@/lib/auth/guards';
import { getQuranRepository } from '@/lib/quran/local-repository';
import { compareRecitation } from '@/lib/quran/compare';
import { recomputeWeakness } from '@/lib/hifdh/weakness';
import { nextSchedule, startOfDay, PASS_THRESHOLD } from '@/lib/hifdh/scheduler';
import { pointsForSession, awardPoints, streakFromDates } from '@/lib/hifdh/points';

const repo = getQuranRepository();

/**
 * Below this accuracy, an attempt says "I do not know this ayah yet" rather
 * than "I missed these particular words". Writing forty word-level mistakes
 * for one abandoned attempt would swamp the weakness engine with noise and
 * make the student's Weak Spots screen useless. The attempt is still stored,
 * and the weakness engine counts failed recalls at ayah level, so the signal
 * is not lost - only the false precision is.
 */
const WORD_MISTAKE_FLOOR = 30;

/** One attempt never contributes more than this many word-level mistakes. */
const MAX_WORD_MISTAKES = 8;

/** Open a session. One per sitting; the client holds the id from here on. */
export async function startPracticeSession() {
  const { student } = await requireStudent();
  const session = await prisma.practiceSession.create({
    data: { studentId: student.id },
    select: { id: true, startedAt: true },
  });
  return { sessionId: session.id, startedAt: session.startedAt.toISOString() };
}

const attemptSchema = z.object({
  sessionId: z.string().min(1),
  mode: z.enum([
    'LISTEN_FOLLOW', 'FIVE_BY_FIVE', 'TYPE_FROM_MEMORY', 'VANISHING_WORDS',
    'NEXT_WORD', 'COMPLETE_AYAH', 'NEXT_AYAH', 'MUTASHABIHAT', 'RECITATION',
  ]),
  category: z.enum(['SABAQ', 'SABQI', 'MANZIL']).nullable().optional(),
  verseKey: z.string(),
  /** What the student typed, when the mode asks them to type. */
  typed: z.string().max(4000).optional().nullable(),
  /** What the exercise expected - a phrase, an ayah, or a single word. */
  expected: z.string().max(4000).optional().nullable(),
  /** For choice-based modes the client reports the verdict directly. */
  correct: z.boolean().optional(),
  accuracy: z.number().int().min(0).max(100).optional(),
  durationMs: z.number().int().min(0).max(3_600_000).default(0),
  repetitions: z.number().int().min(1).max(100).default(1),
});

/**
 * Record one exercise attempt.
 *
 * Typed answers are graded **on the server** against the canonical text: the
 * browser is never the authority on whether a recitation was correct, and the
 * expected text is re-read from the repository rather than trusted from the
 * request.
 */
export async function recordAttempt(input) {
  const { student } = await requireStudent();
  const data = attemptSchema.parse(input);

  const session = await prisma.practiceSession.findFirst({
    where: { id: data.sessionId, studentId: student.id },
    select: { id: true },
  });
  if (!session) throw new Error('Practice session not found');

  const ayah = repo.getAyah(data.verseKey);
  if (!ayah) throw new Error(`Unknown verse: ${data.verseKey}`);

  let correct = data.correct ?? false;
  let accuracy = data.accuracy ?? (correct ? 100 : 0);
  let comparison = null;

  if (typeof data.typed === 'string' && data.expected) {
    // Only accept an `expected` string that really is part of this ayah.
    const canonical = ayah.text;
    const expected = canonical.includes(data.expected.trim()) ? data.expected.trim() : canonical;
    comparison = compareRecitation(expected, data.typed, { strict: student.strictTashkeel });
    correct = comparison.exact;
    accuracy = comparison.accuracy;
  }

  await prisma.practiceAttempt.create({
    data: {
      sessionId: data.sessionId,
      studentId: student.id,
      category: data.category || null,
      mode: data.mode,
      verseKey: data.verseKey,
      correct,
      accuracy,
      durationMs: data.durationMs,
      repetitions: data.repetitions,
    },
  });

  // A word the student got wrong while typing is a mistake, and it feeds the
  // same weakness engine the teacher's taps feed - but only when it carries
  // signal. See WORD_MISTAKE_FLOOR / MAX_WORD_MISTAKES below.
  if (comparison) {
    const worthRecording =
      comparison.accuracy >= WORD_MISTAKE_FLOOR
        ? comparison.mistakes.filter((m) => m.wordPosition != null).slice(0, MAX_WORD_MISTAKES)
        : [];

    if (worthRecording.length) {
      await prisma.mistake.createMany({
        data: worthRecording.map((m) => ({
          studentId: student.id,
          verseKey: data.verseKey,
          wordPosition: m.wordPosition,
          mistakeType: m.mistakeType,
          source: 'TYPING',
          category: data.category || null,
          practiceSessionId: data.sessionId,
          page: ayah.page,
          juz: ayah.juz,
        })),
      });
    }
  }

  return {
    correct,
    accuracy,
    wordResults: comparison?.wordResults ?? null,
    extras: comparison?.extras ?? null,
  };
}

const heartbeatSchema = z.object({
  sessionId: z.string().min(1),
  /** Seconds of *active* practice since the last heartbeat, per category. */
  sabaqSeconds: z.number().int().min(0).max(600).default(0),
  sabqiSeconds: z.number().int().min(0).max(600).default(0),
  manzilSeconds: z.number().int().min(0).max(600).default(0),
  otherSeconds: z.number().int().min(0).max(600).default(0),
  repetitions: z.number().int().min(0).max(500).default(0),
});

/**
 * Add active practice time.
 *
 * The client only sends seconds during which the student actually interacted,
 * and each heartbeat is capped, so a tab left open overnight adds nothing.
 */
export async function recordActivity(input) {
  const { student } = await requireStudent();
  const data = heartbeatSchema.parse(input);
  const total = data.sabaqSeconds + data.sabqiSeconds + data.manzilSeconds + data.otherSeconds;
  if (total === 0) return { ok: true };

  const updated = await prisma.practiceSession.updateMany({
    where: { id: data.sessionId, studentId: student.id },
    data: {
      activeSeconds: { increment: total },
      sabaqSeconds: { increment: data.sabaqSeconds },
      sabqiSeconds: { increment: data.sabqiSeconds },
      manzilSeconds: { increment: data.manzilSeconds },
      repetitions: { increment: data.repetitions },
    },
  });
  return { ok: updated.count === 1 };
}

/**
 * Close the session: score each portion, move the schedule on, award points.
 * Everything here is derived from stored attempts, never from the client.
 */
export async function completePracticeSession(sessionId) {
  const { student } = await requireStudent();

  const session = await prisma.practiceSession.findFirst({
    where: { id: sessionId, studentId: student.id },
    include: { attempts: true },
  });
  if (!session) throw new Error('Practice session not found');

  const scoreFor = (category) => {
    const list = session.attempts.filter((a) => a.category === category);
    if (!list.length) return null;
    return Math.round(list.reduce((n, a) => n + a.accuracy, 0) / list.length);
  };

  const sabaqAccuracy = scoreFor('SABAQ');
  const sabqiAccuracy = scoreFor('SABQI');
  const manzilAccuracy = scoreFor('MANZIL');

  const graded = session.attempts.filter((a) => a.accuracy != null);
  const averageAccuracy = graded.length
    ? Math.round(graded.reduce((n, a) => n + a.accuracy, 0) / graded.length)
    : 0;

  // Move each attempted ayah along its own schedule, using the best attempt of
  // the session - a student who got it right on the second try knows it.
  const bestByVerse = new Map();
  for (const a of session.attempts) {
    const prev = bestByVerse.get(a.verseKey);
    if (!prev || a.accuracy > prev) bestByVerse.set(a.verseKey, a.accuracy);
  }

  // Read every affected progress row at once, compute the new schedules in
  // memory, then write them in a single transaction. Doing this verse by verse
  // is three round trips per ayah, which on a hosted database turned a session
  // summary into a fifteen-second wait.
  const verseKeys = [...bestByVerse.keys()];
  const existing = await prisma.ayahProgress.findMany({
    where: { studentId: student.id, verseKey: { in: verseKeys } },
  });
  const existingByKey = new Map(existing.map((r) => [r.verseKey, r]));

  const now = new Date();
  const writes = [];
  const fixedKeys = [];

  for (const [verseKey, accuracy] of bestByVerse) {
    const ayah = repo.getAyah(verseKey);
    if (!ayah) continue;

    const before = existingByKey.get(verseKey);
    const base = before ?? { intervalDays: 1, consecutiveSuccess: 0, state: 'NOT_STARTED', reviewCount: 0 };
    const next = nextSchedule(base, accuracy, now);

    writes.push(
      prisma.ayahProgress.upsert({
        where: { studentId_verseKey: { studentId: student.id, verseKey } },
        create: {
          studentId: student.id,
          verseKey,
          page: ayah.page,
          juz: ayah.juz,
          firstMemorizedAt: accuracy >= PASS_THRESHOLD ? now : null,
          ...next,
        },
        update: {
          ...next,
          firstMemorizedAt: before?.firstMemorizedAt ?? (accuracy >= PASS_THRESHOLD ? now : null),
        },
      }),
    );

    // An ayah that was weak and came back at 95%+ is genuinely repaired, so the
    // mistakes behind it are closed and the student is told about it.
    if (before && (before.state === 'WEAK' || before.state === 'NEEDS_REVISION') && accuracy >= 95) {
      fixedKeys.push(verseKey);
    }
  }

  if (fixedKeys.length) {
    writes.push(
      prisma.mistake.updateMany({
        where: { studentId: student.id, verseKey: { in: fixedKeys }, resolved: false },
        data: { resolved: true, resolvedAt: now },
      }),
    );
  }

  if (writes.length) await prisma.$transaction(writes);
  const weakSpotsFixed = fixedKeys.length;

  const minutes = Math.round(session.activeSeconds / 60);
  const recentSessions = await prisma.practiceSession.findMany({
    where: { studentId: student.id, completed: true },
    select: { startedAt: true },
    orderBy: { startedAt: 'desc' },
    take: 60,
  });
  const streak = streakFromDates([...recentSessions.map((s) => s.startedAt), session.startedAt]);

  await prisma.practiceSession.update({
    where: { id: session.id },
    data: {
      endedAt: new Date(),
      completed: true,
      sabaqAccuracy,
      sabqiAccuracy,
      manzilAccuracy,
      ayatPracticed: bestByVerse.size,
      exercisesCompleted: session.attempts.length,
    },
  });

  let pointsAwarded = 0;
  let transactions = [];
  if (student.gamificationOn) {
    transactions = pointsForSession({
      sabaqComplete: sabaqAccuracy != null,
      sabqiComplete: sabqiAccuracy != null,
      manzilComplete: manzilAccuracy != null,
      metDailyGoal: minutes >= student.dailyGoalMinutes,
      weakSpotsFixed,
      averageAccuracy,
      streakDays: streak,
    });
    pointsAwarded = await awardPoints(prisma, student.id, transactions);
  }

  await recomputeWeakness(prisma, student.id);

  // The weakest ayat *after* this session - what to work on tomorrow.
  const remainingWeak = await prisma.weaknessScore.findMany({
    where: { studentId: student.id, level: 'AYAH', score: { gt: 1 } },
    orderBy: { score: 'desc' },
    take: 3,
  });

  revalidatePath('/student');
  revalidatePath('/teacher');

  return {
    minutes,
    sabaqAccuracy,
    sabqiAccuracy,
    manzilAccuracy,
    averageAccuracy,
    exercises: session.attempts.length,
    ayatPracticed: bestByVerse.size,
    weakSpotsFixed,
    streak,
    pointsAwarded,
    transactions,
    weakSpots: remainingWeak.map((w) => {
      const ayah = repo.getAyah(w.refKey);
      return {
        verseKey: w.refKey,
        label: ayah ? `${repo.getSurah(ayah.surah).nameTransliterated} ${ayah.ayah}` : w.refKey,
      };
    }),
  };
}

/** Has the student already practised today? Used to avoid a duplicate session. */
export async function todaysSession() {
  const { student } = await requireStudent();
  return prisma.practiceSession.findFirst({
    where: { studentId: student.id, startedAt: { gte: startOfDay() } },
    orderBy: { startedAt: 'desc' },
  });
}
