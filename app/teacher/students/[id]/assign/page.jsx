import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireRole, canAccessStudent } from '@/lib/auth/guards';
import { getQuranRepository } from '@/lib/quran/local-repository';
import { assignmentTitle, assignmentSubtitle, suggestSabqiRange } from '@/lib/hifdh/assignments';
import AssignmentEditor from './assignment-editor';

export const metadata = { title: 'Assignments' };
export const dynamic = 'force-dynamic';

const repo = getQuranRepository();

export default async function AssignPage({ params }) {
  const { id } = await params;
  const user = await requireRole('TEACHER', 'ADMIN');
  if (!(await canAccessStudent(user, id))) notFound();

  const [student, active, history] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { id }, include: { user: true } }),
    prisma.assignment.findMany({ where: { studentId: id, active: true } }),
    prisma.assignment.findMany({
      where: { studentId: id, active: false },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { teacher: { select: { name: true } } },
    }),
  ]);
  if (!student) notFound();

  const current = Object.fromEntries(
    ['SABAQ', 'SABQI', 'MANZIL'].map((category) => {
      const a = active.find((x) => x.category === category);
      return [
        category,
        a
          ? {
              id: a.id,
              scope: a.scope,
              pageStart: a.pageStart,
              pageEnd: a.pageEnd,
              lineStart: a.lineStart,
              lineEnd: a.lineEnd,
              surahNumber: a.surahNumber,
              juzNumber: a.juzNumber,
              hizbNumber: a.hizbNumber,
              fromVerseKey: a.fromVerseKey,
              toVerseKey: a.toVerseKey,
              ayahCount: a.ayahCount,
              notes: a.notes,
              title: assignmentTitle(a),
              subtitle: assignmentSubtitle(a),
            }
          : null,
      ];
    }),
  );

  const sabaq = active.find((a) => a.category === 'SABAQ');
  const suggestion = sabaq ? suggestSabqiRange(sabaq.fromVerseKey, student.sabqiWindowPages) : null;

  return (
    <div className="space-y-6">
      <header>
        <Link href={`/teacher/students/${student.id}`} className="text-sm text-muted-foreground hover:underline">
          ← {student.user.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
        <p className="text-sm text-muted-foreground">
          Set today’s Sabaq, Sabqi and Manzil. Assignments always override anything the app suggests.
        </p>
      </header>

      <AssignmentEditor
        studentId={student.id}
        current={current}
        suggestion={suggestion}
        surahs={repo.listSurahs().map((s) => ({
          number: s.number,
          name: s.nameTransliterated,
          ayahCount: s.ayahCount,
        }))}
        settings={{
          sabqiWindowPages: student.sabqiWindowPages,
          repetitionTarget: student.repetitionTarget,
          dailyGoalMinutes: student.dailyGoalMinutes,
          strictTashkeel: student.strictTashkeel,
          gamificationOn: student.gamificationOn,
        }}
      />

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Previous assignments</h2>
        {history.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {history.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0">
                <span>
                  <span className="font-medium capitalize">{a.category.toLowerCase()}</span> ·{' '}
                  {assignmentTitle(a)}
                  <span className="ml-2 text-xs text-muted-foreground">{assignmentSubtitle(a)}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {a.teacher?.name ?? 'Unknown'} ·{' '}
                  {new Date(a.assignedFor).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Nothing retired yet.</p>
        )}
      </section>
    </div>
  );
}
