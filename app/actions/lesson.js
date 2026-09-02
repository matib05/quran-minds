'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma, { DB_SCHEMA } from '@/lib/prisma';
import { requireRole, assertCanAccessStudent } from '@/lib/auth/guards';
import { getQuranRepository } from '@/lib/quran/local-repository';
import { recomputeWeakness } from '@/lib/hifdh/weakness';
import { startOfDay, INTERVALS } from '@/lib/hifdh/scheduler';
import { AWARDS, awardPoints } from '@/lib/hifdh/points';

const repo = getQuranRepository();

const CATEGORIES = ['SABAQ', 'SABQI', 'MANZIL'];

const lessonSchema = z.object({
  studentId: z.string().min(1),
  notes: z.string().max(2000).optional().nullable(),
  entries: z
    .array(
      z.object({
        category: z.enum(['SABAQ', 'SABQI', 'MANZIL']),
        status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'INCOMPLETE']),
        rating: z.enum(['EXCELLENT', 'GOOD', 'NEEDS_WORK', 'REPEAT_TOMORROW']).nullable().optional(),
        assignmentId: z.string().nullable().optional(),
      }),
    )
    .max(3),
  mistakes: z
    .array(
      z.object({
        verseKey: z.string(),
        wordPosition: z.number().int().positive().nullable().optional(),
        mistakeType: z.enum([
          'FORGOTTEN_WORD', 'WRONG_WORD', 'SKIPPED_WORD', 'ADDED_WORD', 'WORD_ORDER',
          'HESITATION', 'BEGINNING_ERROR', 'ENDING_ERROR', 'MUTASHABIHAT', 'TAJWID', 'PRONUNCIATION',
        ]),
        category: z.enum(['SABAQ', 'SABQI', 'MANZIL']).nullable().optional(),
      }),
    )
    .max(200),
});

/** A teacher's rating, expressed as the accuracy it stands in for. */
const RATING_ACCURACY = {
  EXCELLENT: 98,
  GOOD: 90,
  NEEDS_WORK: 75,
  REPEAT_TOMORROW: 55,
};

/**
 * Save one day's lesson: the verdict on each portion, plus every word the
 * teacher tapped. One round trip - the teacher should never be waiting on us.
 */
export async function saveLesson(input) {
  const user = await requireRole('TEACHER', 'ADMIN');
  const data = lessonSchema.parse(input);
  await assertCanAccessStudent(user, data.studentId);

  const today = startOfDay();

  // Reject anything that is not a real Qur'an reference before it reaches the
  // database - a mistake row that points nowhere is worse than no row.
  const mistakes = data.mistakes.map((m) => {
    const ayah = repo.getAyah(m.verseKey);
    if (!ayah) throw new Error(`Unknown verse: ${m.verseKey}`);
    if (m.wordPosition != null && !repo.getWord(m.verseKey, m.wordPosition)) {
      throw new Error(`Verse ${m.verseKey} has no word ${m.wordPosition}`);
    }
    return { ...m, page: ayah.page, juz: ayah.juz };
  });

  const mistakesByCategory = countBy(mistakes, (m) => m.category);

  const lesson = await prisma.$transaction(async (tx) => {
    // One lesson per teacher per student per day: re-saving edits that day
    // rather than stacking duplicates.
    const existing = await tx.teacherLesson.findFirst({
      where: { studentId: data.studentId, teacherId: user.id, date: today },
    });

    const record = existing
      ? await tx.teacherLesson.update({
          where: { id: existing.id },
          data: { notes: data.notes || null },
        })
      : await tx.teacherLesson.create({
          data: { studentId: data.studentId, teacherId: user.id, date: today, notes: data.notes || null },
        });

    if (existing) {
      await tx.lessonEntry.deleteMany({ where: { lessonId: record.id } });
      await tx.mistake.deleteMany({ where: { lessonId: record.id } });
    }

    await tx.lessonEntry.createMany({
      data: data.entries.map((e) => ({
        lessonId: record.id,
        category: e.category,
        status: e.status,
        rating: e.rating || null,
        assignmentId: e.assignmentId || null,
        mistakeCount: mistakesByCategory[e.category] || 0,
      })),
    });

    if (mistakes.length) {
      await tx.mistake.createMany({
        data: mistakes.map((m) => ({
          studentId: data.studentId,
          verseKey: m.verseKey,
          wordPosition: m.wordPosition ?? null,
          mistakeType: m.mistakeType,
          source: 'TEACHER',
          category: m.category || null,
          teacherId: user.id,
          lessonId: record.id,
          page: m.page,
          juz: m.juz,
        })),
      });
    }

    return record;
  });

  await applyLessonToSchedule(data.studentId, data.entries, mistakes);
  await recomputeWeakness(prisma, data.studentId);

  // A teacher calling something excellent is the strongest mastery signal we
  // have, so it is the only place TEACHER_MASTERY is awarded.
  const excellent = data.entries.filter((e) => e.rating === 'EXCELLENT').length;
  if (excellent) {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: data.studentId },
      select: { gamificationOn: true },
    });
    if (profile?.gamificationOn) {
      await awardPoints(
        prisma,
        data.studentId,
        Array.from({ length: excellent }, () => ({ ...AWARDS.TEACHER_MASTERY })),
      );
    }
  }

  revalidatePath('/teacher');
  revalidatePath(`/teacher/students/${data.studentId}`);
  return { ok: true, lessonId: lesson.id, mistakeCount: mistakes.length };
}

/**
 * Fold the lesson into the student's revision schedule.
 *
 * Ayat the teacher flagged come back tomorrow. The rest of each portion the
 * teacher heard and passed moves one rung up the interval ladder - done as a
 * single statement per portion because Manzil can be a whole juz, and 560
 * individual updates is not a thing to do while a teacher waits.
 */
async function applyLessonToSchedule(studentId, entries, mistakes) {
  const now = new Date();

  // 1. Everything the teacher tapped is weak, regardless of the overall rating.
  const flagged = [...new Set(mistakes.map((m) => m.verseKey))];
  for (const verseKey of flagged) {
    const ayah = repo.getAyah(verseKey);
    await prisma.ayahProgress.upsert({
      where: { studentId_verseKey: { studentId, verseKey } },
      create: {
        studentId, verseKey, page: ayah.page, juz: ayah.juz,
        state: 'WEAK', intervalDays: 1, consecutiveSuccess: 0, reviewCount: 1,
        lastReviewedAt: now, nextReviewAt: startOfDay(now),
      },
      update: {
        state: 'WEAK', intervalDays: 1, consecutiveSuccess: 0,
        reviewCount: { increment: 1 },
        lastReviewedAt: now, nextReviewAt: startOfDay(now),
      },
    });
  }

  // 2. The rest of each passed portion advances.
  const assignments = await prisma.assignment.findMany({
    where: { studentId, active: true, category: { in: CATEGORIES } },
  });

  for (const entry of entries) {
    const accuracy = RATING_ACCURACY[entry.rating] ?? null;
    if (accuracy == null || accuracy < 85 || entry.status !== 'COMPLETE') continue;

    const assignment = assignments.find((a) => a.category === entry.category);
    if (!assignment) continue;

    const fromPage = repo.pageOfKey(assignment.fromVerseKey);
    const toPage = repo.pageOfKey(assignment.toVerseKey);
    if (fromPage == null || toPage == null) continue;

    // Advance one rung on the same interval ladder the scheduler uses. The
    // ladder is inlined as SQL rather than bound as parameters so Postgres sees
    // a genuine int[] - bound integers arrive as bigint, which make_interval
    // will not accept.
    const ladder = Prisma.raw(INTERVALS.join(', '));
    const topRung = Prisma.raw(String(INTERVALS.length));
    const strongAfter = Prisma.raw('4');
    // Raw SQL does not inherit Prisma's schema, so qualify explicitly.
    const table = Prisma.raw(`"${DB_SCHEMA}"."ayah_progress"`);
    const stateType = Prisma.raw(`"${DB_SCHEMA}"."MemorizationState"`);

    await prisma.$executeRaw`
      WITH ladder AS (SELECT ARRAY[${ladder}]::int[] AS d)
      UPDATE ${table} AS p
      SET "consecutiveSuccess" = LEAST(p."consecutiveSuccess" + 1, ${topRung}),
          "intervalDays"       = ladder.d[LEAST(p."consecutiveSuccess" + 1, ${topRung})],
          "lastReviewedAt"     = ${now},
          "nextReviewAt"       = ${now} + make_interval(
                                   days => ladder.d[LEAST(p."consecutiveSuccess" + 1, ${topRung})]),
          "reviewCount"        = p."reviewCount" + 1,
          "lastAccuracy"       = ${accuracy},
          "state"              = CASE
                                   WHEN p."consecutiveSuccess" + 1 >= ${strongAfter}
                                     THEN 'STRONG'::${stateType}
                                   ELSE 'MEMORIZED'::${stateType}
                                 END,
          "updatedAt"          = ${now}
      FROM ladder
      WHERE p."studentId" = ${studentId}
        AND p."page" BETWEEN ${fromPage} AND ${toPage}
        AND p."verseKey" <> ALL(${flagged}::text[])
    `;
  }
}

function countBy(list, fn) {
  return list.reduce((acc, item) => {
    const key = fn(item);
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

/** Mark a recorded mistake resolved (or reopen it) from the weak-spots screen. */
export async function setMistakeResolved(mistakeId, resolved) {
  const user = await requireRole('TEACHER', 'ADMIN');
  const mistake = await prisma.mistake.findUnique({ where: { id: mistakeId } });
  if (!mistake) throw new Error('Mistake not found');
  await assertCanAccessStudent(user, mistake.studentId);

  await prisma.mistake.update({
    where: { id: mistakeId },
    data: { resolved: Boolean(resolved), resolvedAt: resolved ? new Date() : null },
  });
  await recomputeWeakness(prisma, mistake.studentId);
  revalidatePath(`/teacher/students/${mistake.studentId}`);
  return { ok: true };
}
