/**
 * Points.
 *
 * Every award is tied to something we actually want a student to do:
 * finishing the portion the teacher set, being accurate, coming back
 * tomorrow, and fixing something they used to get wrong.
 *
 * Deliberately absent: points for elapsed time. Leaving the app open earns
 * nothing, because that is the behaviour a time-based score would teach.
 */

export const AWARDS = {
  SABAQ_COMPLETE: { amount: 30, reason: 'Completed Sabaq' },
  SABQI_COMPLETE: { amount: 20, reason: 'Completed Sabqi' },
  MANZIL_COMPLETE: { amount: 20, reason: 'Completed Manzil' },
  DAILY_GOAL: { amount: 10, reason: 'Met the daily practice goal' },
  WEAK_SPOT_FIXED: { amount: 15, reason: 'Fixed a weak ayah' },
  TEACHER_MASTERY: { amount: 25, reason: 'Teacher confirmed mastery' },
  STREAK_7: { amount: 50, reason: '7-day practice streak' },
  STREAK_30: { amount: 200, reason: '30-day practice streak' },
};

/**
 * Accuracy bonus: nothing below 70%, up to 10 points at 100%.
 * Rewards precision without making a bad day feel punitive.
 */
export function accuracyBonus(accuracy) {
  if (accuracy == null || accuracy < 70) return 0;
  return Math.min(10, Math.round((accuracy - 70) / 3));
}

/**
 * Points for one completed daily session. Returns the transactions to write,
 * so the caller can show the student exactly where each point came from.
 */
export function pointsForSession({
  sabaqComplete,
  sabqiComplete,
  manzilComplete,
  metDailyGoal,
  weakSpotsFixed = 0,
  averageAccuracy,
  streakDays = 0,
}) {
  const tx = [];
  if (sabaqComplete) tx.push({ ...AWARDS.SABAQ_COMPLETE });
  if (sabqiComplete) tx.push({ ...AWARDS.SABQI_COMPLETE });
  if (manzilComplete) tx.push({ ...AWARDS.MANZIL_COMPLETE });
  if (metDailyGoal) tx.push({ ...AWARDS.DAILY_GOAL });

  for (let i = 0; i < weakSpotsFixed; i++) tx.push({ ...AWARDS.WEAK_SPOT_FIXED });

  const bonus = accuracyBonus(averageAccuracy);
  if (bonus > 0) tx.push({ amount: bonus, reason: `Accuracy bonus (${Math.round(averageAccuracy)}%)` });

  if (streakDays === 7) tx.push({ ...AWARDS.STREAK_7 });
  if (streakDays === 30) tx.push({ ...AWARDS.STREAK_30 });

  return tx;
}

/** Consecutive days ending today (or yesterday) that have a practice session. */
export function streakFromDates(dates, today = new Date()) {
  const days = new Set(
    dates.map((d) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x.getTime();
    }),
  );
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  // A streak survives until the end of today: if today has no session yet but
  // yesterday did, the student has not lost it.
  let cursor = days.has(start.getTime()) ? start.getTime() : start.getTime() - 86400_000;
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 86400_000;
  }
  return streak;
}

export async function awardPoints(prisma, studentId, transactions) {
  if (!transactions.length) return 0;
  await prisma.pointTransaction.createMany({
    data: transactions.map((t) => ({ studentId, amount: t.amount, reason: t.reason, meta: t.meta ?? undefined })),
  });
  return transactions.reduce((n, t) => n + t.amount, 0);
}

export async function totalPoints(prisma, studentId) {
  const agg = await prisma.pointTransaction.aggregate({
    where: { studentId },
    _sum: { amount: true },
  });
  return agg._sum.amount || 0;
}
