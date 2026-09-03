/**
 * The weakness engine.
 *
 * Turns the mistake log into a ranked picture of what a student is actually
 * struggling with, at word, ayah, page, surah and juz level - and feeds that
 * back into practice so the app strengthens weak material instead of merely
 * reporting it.
 *
 * The scoring is deliberately a transparent weighted sum rather than a fitted
 * model: a teacher must be able to look at "5 mistakes, 3 of them this week"
 * and understand why an ayah is flagged.
 */

const DAY_MS = 86400_000;

/** How much each kind of error says about weakness. */
const TYPE_WEIGHT = {
  FORGOTTEN_WORD: 1.0,
  SKIPPED_WORD: 0.9,
  WRONG_WORD: 0.9,
  MUTASHABIHAT: 1.0,
  WORD_ORDER: 0.7,
  ADDED_WORD: 0.6,
  BEGINNING_ERROR: 0.9,
  ENDING_ERROR: 0.8,
  HESITATION: 0.5,
  TAJWID: 0.4,
  PRONUNCIATION: 0.4,
};

/**
 * A mistake the teacher heard is stronger evidence than a typo in a drill.
 * Recitation is scored low because the experimental evaluator is not reliable
 * enough to drive assessment on its own.
 */
const SOURCE_WEIGHT = {
  TEACHER: 1.0,
  QUIZ: 0.7,
  TYPING: 0.6,
  RECITATION: 0.4,
};

/** A mistake loses half its weight every two weeks. */
const HALF_LIFE_DAYS = 14;

export function recencyFactor(date, now = Date.now()) {
  const ageDays = Math.max(0, (now - new Date(date).getTime()) / DAY_MS);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export function mistakeWeight(mistake, now = Date.now()) {
  const type = TYPE_WEIGHT[mistake.mistakeType] ?? 0.6;
  const source = SOURCE_WEIGHT[mistake.source] ?? 0.6;
  const recency = recencyFactor(mistake.createdAt, now);
  const unresolved = mistake.resolved ? 0.35 : 1;
  return type * source * recency * unresolved;
}

/**
 * Bands, calibrated against the weights above so the labels mean something
 * concrete. One fresh teacher-observed omission scores 1.0, so:
 *   HIGH   ~ three or more recent misses of the same thing
 *   MEDIUM ~ a repeated miss, or one very recent serious one
 *   LOW    ~ a single miss, or an older one still fading
 */
export const WEAKNESS_HIGH = 3;
export const WEAKNESS_MEDIUM = 1.2;
export const WEAKNESS_FLOOR = 0.3;

/** Human band for a score, used for colour and sorting in the UI. */
export function weaknessBand(score) {
  if (score >= WEAKNESS_HIGH) return 'HIGH';
  if (score >= WEAKNESS_MEDIUM) return 'MEDIUM';
  if (score > WEAKNESS_FLOOR) return 'LOW';
  return 'NONE';
}

export const WORD_REF = (verseKey, position) => `${verseKey}#${position}`;
export const PAGE_REF = (page) => `p:${page}`;
export const SURAH_REF = (surah) => `s:${surah}`;
export const JUZ_REF = (juz) => `j:${juz}`;

/**
 * Roll a student's mistakes up into scores at every level.
 *
 * @param {Array} mistakes rows from the `mistakes` table
 * @param {Array} failedAttempts practice attempts with correct = false
 * @returns {{level:string, refKey:string, score:number, mistakeCount:number, lastMistakeAt:Date|null}[]}
 */
export function computeWeaknessScores(mistakes, failedAttempts = [], now = Date.now()) {
  /** @type {Map<string, {level:string, refKey:string, score:number, mistakeCount:number, lastMistakeAt:Date|null}>} */
  const acc = new Map();

  const add = (level, refKey, weight, at) => {
    const id = `${level}|${refKey}`;
    const row = acc.get(id) || { level, refKey, score: 0, mistakeCount: 0, lastMistakeAt: null };
    row.score += weight;
    row.mistakeCount += 1;
    const when = at ? new Date(at) : null;
    if (when && (!row.lastMistakeAt || when > row.lastMistakeAt)) row.lastMistakeAt = when;
    acc.set(id, row);
  };

  for (const m of mistakes) {
    const w = mistakeWeight(m, now);
    if (m.wordPosition != null) add('WORD', WORD_REF(m.verseKey, m.wordPosition), w, m.createdAt);
    add('AYAH', m.verseKey, w, m.createdAt);
    add('PAGE', PAGE_REF(m.page), w, m.createdAt);
    const surah = Number(String(m.verseKey).split(':')[0]);
    if (surah) add('SURAH', SURAH_REF(surah), w, m.createdAt);
    add('JUZ', JUZ_REF(m.juz), w, m.createdAt);
  }

  // A failed recall attempt is weaker evidence than a logged mistake, but it
  // is evidence: it is exactly the "failed recall" signal the product needs.
  for (const a of failedAttempts) {
    const w = 0.5 * recencyFactor(a.createdAt, now);
    add('AYAH', a.verseKey, w, a.createdAt);
  }

  return [...acc.values()].map((r) => ({ ...r, score: Number(r.score.toFixed(4)) }));
}

/**
 * Recompute and persist every weakness score for one student.
 * Cheap enough to run after each lesson or practice session.
 */
export async function recomputeWeakness(prisma, studentId) {
  const [mistakes, failedAttempts] = await Promise.all([
    prisma.mistake.findMany({
      where: { studentId },
      select: {
        verseKey: true, wordPosition: true, mistakeType: true, source: true,
        page: true, juz: true, resolved: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    }),
    prisma.practiceAttempt.findMany({
      where: { studentId, correct: false },
      select: { verseKey: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    }),
  ]);

  const rows = computeWeaknessScores(mistakes, failedAttempts);

  await prisma.$transaction([
    prisma.weaknessScore.deleteMany({ where: { studentId } }),
    ...(rows.length
      ? [prisma.weaknessScore.createMany({ data: rows.map((r) => ({ ...r, studentId })) })]
      : []),
  ]);

  return rows;
}

/**
 * The student's weakest ayat, ready to drill.
 * `limit` is small on purpose: a drill of 30 ayat is a punishment, not practice.
 */
export async function weakestAyat(prisma, studentId, limit = 5) {
  return prisma.weaknessScore.findMany({
    where: { studentId, level: 'AYAH', score: { gt: WEAKNESS_FLOOR } },
    orderBy: { score: 'desc' },
    take: limit,
  });
}

export async function weakestWords(prisma, studentId, limit = 10) {
  return prisma.weaknessScore.findMany({
    where: { studentId, level: 'WORD', score: { gt: WEAKNESS_FLOOR } },
    orderBy: { score: 'desc' },
    take: limit,
  });
}

export async function weakestPages(prisma, studentId, limit = 8) {
  return prisma.weaknessScore.findMany({
    where: { studentId, level: 'PAGE', score: { gt: WEAKNESS_FLOOR } },
    orderBy: { score: 'desc' },
    take: limit,
  });
}

/** Parse a WORD refKey back into its parts. */
export function parseWordRef(refKey) {
  const [verseKey, pos] = String(refKey).split('#');
  return { verseKey, wordPosition: Number(pos) };
}
