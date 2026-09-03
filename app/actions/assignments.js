'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireRole, assertCanAccessStudent } from '@/lib/auth/guards';
import { resolveAssignment, suggestSabqiRange } from '@/lib/hifdh/assignments';
import { startOfDay } from '@/lib/hifdh/scheduler';

const schema = z.object({
  studentId: z.string().min(1),
  category: z.enum(['SABAQ', 'SABQI', 'MANZIL']),
  scope: z.enum(['AYAH_RANGE', 'PAGE_RANGE', 'SURAH', 'JUZ', 'HIZB', 'CUSTOM']),
  pageStart: z.coerce.number().int().min(1).max(604).optional().nullable(),
  pageEnd: z.coerce.number().int().min(1).max(604).optional().nullable(),
  lineStart: z.coerce.number().int().min(1).max(15).optional().nullable(),
  lineEnd: z.coerce.number().int().min(1).max(15).optional().nullable(),
  surahNumber: z.coerce.number().int().min(1).max(114).optional().nullable(),
  juzNumber: z.coerce.number().int().min(1).max(30).optional().nullable(),
  hizbNumber: z.coerce.number().int().min(1).max(60).optional().nullable(),
  fromVerseKey: z.string().optional().nullable(),
  toVerseKey: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

/**
 * Set (or replace) one of a student's three portions.
 *
 * The teacher's own words are kept - "page 76, lines 1-8" - and the canonical
 * verse range is resolved alongside, so practice never has to interpret.
 * Setting a portion retires the previous one rather than deleting it: the
 * history of what was assigned is part of the record.
 */
export async function setAssignment(input) {
  const user = await requireRole('TEACHER', 'ADMIN');
  const data = schema.parse(input);
  await assertCanAccessStudent(user, data.studentId);

  const resolved = resolveAssignment(data);

  const [, created] = await prisma.$transaction([
    prisma.assignment.updateMany({
      where: { studentId: data.studentId, category: data.category, active: true },
      data: { active: false },
    }),
    prisma.assignment.create({
      data: {
        studentId: data.studentId,
        teacherId: user.id,
        category: data.category,
        scope: data.scope,
        fromVerseKey: resolved.fromVerseKey,
        toVerseKey: resolved.toVerseKey,
        ayahCount: resolved.ayahCount,
        pageStart: resolved.pageStart,
        pageEnd: resolved.pageEnd,
        lineStart: data.lineStart ?? null,
        lineEnd: data.lineEnd ?? null,
        surahNumber: data.surahNumber ?? null,
        juzNumber: data.juzNumber ?? null,
        hizbNumber: data.hizbNumber ?? null,
        label: resolved.label,
        assignedFor: startOfDay(),
        notes: data.notes || null,
      },
    }),
  ]);

  revalidatePath('/teacher');
  revalidatePath(`/teacher/students/${data.studentId}`);
  revalidatePath('/student');
  return { ok: true, assignment: serialize(created), resolved };
}

/**
 * What Sabqi should be, given where Sabaq is: the pages immediately behind it.
 * Offered as a default the teacher can accept or ignore.
 */
export async function sabqiSuggestion(studentId) {
  const user = await requireRole('TEACHER', 'ADMIN');
  await assertCanAccessStudent(user, studentId);

  const [sabaq, profile] = await Promise.all([
    prisma.assignment.findFirst({ where: { studentId, category: 'SABAQ', active: true } }),
    prisma.studentProfile.findUnique({ where: { id: studentId }, select: { sabqiWindowPages: true } }),
  ]);
  if (!sabaq) return null;
  return suggestSabqiRange(sabaq.fromVerseKey, profile?.sabqiWindowPages ?? 5);
}

/** How many recent pages count as Sabqi for this student. */
export async function setSabqiWindow(studentId, pages) {
  const user = await requireRole('TEACHER', 'ADMIN');
  await assertCanAccessStudent(user, studentId);
  const value = z.coerce.number().int().min(1).max(60).parse(pages);
  await prisma.studentProfile.update({ where: { id: studentId }, data: { sabqiWindowPages: value } });
  revalidatePath(`/teacher/students/${studentId}/assign`);
  return { ok: true, sabqiWindowPages: value };
}

/** Per-student teaching settings a teacher controls. */
export async function updateStudentSettings(studentId, settings) {
  const user = await requireRole('TEACHER', 'ADMIN');
  await assertCanAccessStudent(user, studentId);

  const data = z
    .object({
      repetitionTarget: z.coerce.number().int().min(1).max(20).optional(),
      dailyGoalMinutes: z.coerce.number().int().min(5).max(240).optional(),
      strictTashkeel: z.coerce.boolean().optional(),
      gamificationOn: z.coerce.boolean().optional(),
    })
    .parse(settings);

  await prisma.studentProfile.update({ where: { id: studentId }, data });
  revalidatePath(`/teacher/students/${studentId}/assign`);
  revalidatePath('/student');
  return { ok: true };
}

function serialize(a) {
  return { ...a, assignedFor: a.assignedFor.toISOString(), createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString() };
}
