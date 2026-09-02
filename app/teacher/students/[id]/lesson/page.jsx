import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireRole, canAccessStudent } from '@/lib/auth/guards';
import { getQuranRepository } from '@/lib/quran/local-repository';
import { assignmentTitle, assignmentSubtitle } from '@/lib/hifdh/assignments';
import { startOfDay } from '@/lib/hifdh/scheduler';
import { decorateWeakness } from '@/lib/hifdh/dashboard';
import LessonRecorder from './lesson-recorder';

export const metadata = { title: 'Record lesson' };
export const dynamic = 'force-dynamic';

const repo = getQuranRepository();

export default async function LessonPage({ params }) {
  const user = await requireRole('TEACHER', 'ADMIN');
  if (!(await canAccessStudent(user, params.id))) notFound();

  const [student, assignments, todaysLesson, weakness] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { id: params.id }, include: { user: true } }),
    prisma.assignment.findMany({ where: { studentId: params.id, active: true } }),
    prisma.teacherLesson.findFirst({
      where: { studentId: params.id, teacherId: user.id, date: startOfDay() },
      include: { entries: true, mistakes: true },
    }),
    prisma.weaknessScore.findMany({
      where: { studentId: params.id, level: 'WORD' },
      orderBy: { score: 'desc' },
      take: 40,
    }),
  ]);

  if (!student) notFound();

  // Materialise the actual Qur'anic text for each assigned portion, once, on
  // the server. The teacher's device never asks a Qur'an API for anything.
  const portions = ['SABAQ', 'SABQI', 'MANZIL'].map((category) => {
    const assignment = assignments.find((a) => a.category === category) || null;
    if (!assignment) return { category, assignment: null, pages: [] };

    const fromPage = repo.pageOfKey(assignment.fromVerseKey);
    const toPage = repo.pageOfKey(assignment.toVerseKey);
    // A whole juz is 20+ pages; load the first few and let the teacher page
    // through the rest rather than shipping a juz of text into the browser.
    const pageNumbers = [];
    for (let p = fromPage; p <= Math.min(toPage, fromPage + 2); p++) pageNumbers.push(p);

    return {
      category,
      assignment: {
        id: assignment.id,
        title: assignmentTitle(assignment),
        subtitle: assignmentSubtitle(assignment),
        fromVerseKey: assignment.fromVerseKey,
        toVerseKey: assignment.toVerseKey,
        firstPage: fromPage,
        lastPage: toPage,
      },
      pages: pageNumbers.map(serializePage),
    };
  });

  const weakWords = {};
  for (const row of weakness.map(decorateWeakness)) {
    if (row.band === 'NONE') continue;
    weakWords[`${row.verseKey}#${row.wordPosition}`] = row.band;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href={`/teacher/students/${student.id}`} className="text-sm text-muted-foreground hover:underline">
            ← {student.user.name}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Record today’s lesson</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <LessonRecorder
        studentId={student.id}
        studentName={student.user.name}
        portions={portions}
        weakWords={weakWords}
        existing={
          todaysLesson
            ? {
                notes: todaysLesson.notes || '',
                entries: todaysLesson.entries.map((e) => ({
                  category: e.category,
                  status: e.status,
                  rating: e.rating,
                })),
                mistakes: todaysLesson.mistakes.map((m) => ({
                  verseKey: m.verseKey,
                  wordPosition: m.wordPosition,
                  mistakeType: m.mistakeType,
                  category: m.category,
                })),
              }
            : null
        }
      />
    </div>
  );
}

/** A mushaf page reduced to exactly what the recorder needs to render it. */
export function serializePage(pageNumber) {
  const page = repo.getPage(pageNumber);
  if (!page) return null;
  return {
    page: page.page,
    juz: page.juz,
    surahNames: page.surahs.map((s) => s.nameTransliterated),
    ayat: page.ayat.map((a) => ({
      verseKey: a.verseKey,
      surah: a.surah,
      ayah: a.ayah,
      words: repo.getAyahWords(a.verseKey).map((w) => ({ position: w.position, text: w.text })),
    })),
  };
}
