/**
 * The revision engine.
 *
 * Spaced repetition, adapted for Hifdh rather than borrowed wholesale from
 * flashcards. Two rules make it Qur'an-shaped rather than card-shaped:
 *
 *  1. **The teacher always wins.** Whatever the algorithm suggests, an active
 *     teacher assignment is what the student is shown. Suggestions only fill
 *     the space the teacher left.
 *  2. **The Qur'an is sequential.** Due ayat are grouped back into contiguous
 *     runs and presented in mushaf order, because reciting 17:23, 4:11 and
 *     67:9 in isolation is not how anyone revises.
 */

const DAY_MS = 86400_000;

/** Interval ladder in days. A success moves one rung up; a failure resets. */
export const INTERVALS = [1, 3, 7, 14, 30, 60];

/** An attempt at or above this accuracy counts as a successful recall. */
export const PASS_THRESHOLD = 85;

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * DAY_MS);
}

/**
 * Next scheduling state for one ayah after a review.
 *
 * @param {{intervalDays:number, consecutiveSuccess:number, state:string, reviewCount:number}} progress
 * @param {number} accuracy 0-100
 */
export function nextSchedule(progress, accuracy, now = new Date()) {
  const passed = accuracy >= PASS_THRESHOLD;
  const consecutiveSuccess = passed ? (progress.consecutiveSuccess || 0) + 1 : 0;

  const rung = passed ? Math.min(consecutiveSuccess - 1, INTERVALS.length - 1) : 0;
  const intervalDays = INTERVALS[Math.max(0, rung)];

  let state;
  if (!passed) {
    state = accuracy < 60 ? 'WEAK' : 'NEEDS_REVISION';
  } else if (consecutiveSuccess >= 4) {
    state = 'STRONG';
  } else if (consecutiveSuccess >= 2) {
    state = 'MEMORIZED';
  } else {
    // One good recall of something previously shaky is not yet mastery.
    state = progress.state === 'NOT_STARTED' || progress.state === 'LEARNING' ? 'LEARNING' : 'MEMORIZED';
  }

  return {
    state,
    intervalDays,
    consecutiveSuccess,
    lastAccuracy: Math.round(accuracy),
    lastReviewedAt: now,
    nextReviewAt: addDays(startOfDay(now), intervalDays),
    reviewCount: (progress.reviewCount || 0) + 1,
  };
}

/**
 * Record a review against a student's ayah progress, creating the row on
 * first contact.
 */
export async function recordReview(prisma, { studentId, verseKey, page, juz, accuracy, now = new Date() }) {
  const existing = await prisma.ayahProgress.findUnique({
    where: { studentId_verseKey: { studentId, verseKey } },
  });

  const base = existing || { intervalDays: 1, consecutiveSuccess: 0, state: 'NOT_STARTED', reviewCount: 0 };
  const next = nextSchedule(base, accuracy, now);

  return prisma.ayahProgress.upsert({
    where: { studentId_verseKey: { studentId, verseKey } },
    create: {
      studentId,
      verseKey,
      page,
      juz,
      firstMemorizedAt: accuracy >= PASS_THRESHOLD ? now : null,
      ...next,
    },
    update: {
      ...next,
      firstMemorizedAt:
        existing?.firstMemorizedAt ?? (accuracy >= PASS_THRESHOLD ? now : null),
    },
  });
}

/**
 * Ayat the algorithm thinks are due, newest-weakness first, then in mushaf
 * order. Used only to *suggest* - see rule 1 above.
 */
export async function dueForRevision(prisma, studentId, { limit = 20, now = new Date() } = {}) {
  const rows = await prisma.ayahProgress.findMany({
    where: {
      studentId,
      nextReviewAt: { lte: now },
      state: { in: ['LEARNING', 'MEMORIZED', 'STRONG', 'NEEDS_REVISION', 'WEAK'] },
    },
    orderBy: [{ nextReviewAt: 'asc' }],
    take: limit,
  });
  return rows;
}

/**
 * Group scattered verse keys into contiguous runs so revision reads as
 * passages rather than as flashcards.
 *
 * @param {string[]} verseKeys
 * @param {{indexOf:Function, keyAt:Function}} repo
 * @returns {{fromVerseKey:string, toVerseKey:string, count:number}[]}
 */
export function groupIntoRuns(verseKeys, repo) {
  const indexes = [...new Set(verseKeys)]
    .map((k) => repo.indexOf(k))
    .filter((i) => i != null)
    .sort((a, b) => a - b);
  if (!indexes.length) return [];

  const runs = [];
  let start = indexes[0];
  let prev = indexes[0];
  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] === prev + 1) {
      prev = indexes[i];
      continue;
    }
    runs.push({ fromVerseKey: repo.keyAt(start), toVerseKey: repo.keyAt(prev), count: prev - start + 1 });
    start = indexes[i];
    prev = indexes[i];
  }
  runs.push({ fromVerseKey: repo.keyAt(start), toVerseKey: repo.keyAt(prev), count: prev - start + 1 });
  return runs;
}

/**
 * A concrete suggestion a teacher can act on, phrased as a recommendation and
 * never applied automatically.
 */
export function describeSuggestion(runs, repo) {
  if (!runs.length) return null;
  return runs
    .slice(0, 3)
    .map((r) => {
      const from = repo.getAyah(r.fromVerseKey);
      const to = repo.getAyah(r.toVerseKey);
      const surah = repo.getSurah(from.surah);
      return from.verseKey === to.verseKey
        ? `${surah.nameTransliterated} ${from.ayah}`
        : `${surah.nameTransliterated} ${from.ayah}-${to.ayah}`;
    })
    .join(', ');
}
