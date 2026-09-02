import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStudent } from '@/lib/auth/guards';
import { getQuranRepository } from '@/lib/quran/local-repository';
import { assignmentTitle, assignmentSubtitle } from '@/lib/hifdh/assignments';
import { streakFromDates, totalPoints } from '@/lib/hifdh/points';
import { startOfDay } from '@/lib/hifdh/scheduler';
import { weakestAyat } from '@/lib/hifdh/weakness';
import AyahView from '@/components/quran/ayah-view';

export const metadata = { title: 'Today’s Hifdh' };
export const dynamic = 'force-dynamic';

const repo = getQuranRepository();
const DAY = 86400_000;

export default async function StudentHome() {
  const { user, student } = await requireStudent();
  const today = startOfDay();

  const [assignments, sessions, weak, points, lastLesson] = await Promise.all([
    prisma.assignment.findMany({ where: { studentId: student.id, active: true } }),
    prisma.practiceSession.findMany({
      where: { studentId: student.id, startedAt: { gte: new Date(Date.now() - 30 * DAY) } },
      orderBy: { startedAt: 'desc' },
    }),
    weakestAyat(prisma, student.id, 3),
    totalPoints(prisma, student.id),
    prisma.teacherLesson.findFirst({
      where: { studentId: student.id },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { entries: true, teacher: { select: { name: true } } },
    }),
  ]);

  const todaysSessions = sessions.filter((s) => startOfDay(s.startedAt).getTime() === today.getTime());
  const minutesToday = Math.round(todaysSessions.reduce((n, s) => n + s.activeSeconds, 0) / 60);
  const doneToday = todaysSessions.find((s) => s.completed) || null;
  const streak = streakFromDates(sessions.map((s) => s.startedAt));

  const byCategory = Object.fromEntries(assignments.map((a) => [a.category, a]));
  const goalPct = Math.min(100, Math.round((minutesToday / Math.max(1, student.dailyGoalMinutes)) * 100));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Today’s Hifdh</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <PortionCard
          category="SABAQ"
          arabic="سَبَق"
          name="Sabaq"
          hint="New memorization"
          assignment={byCategory.SABAQ}
          accuracy={doneToday?.sabaqAccuracy}
        />
        <PortionCard
          category="SABQI"
          arabic="سَبْقِي"
          name="Sabqi"
          hint="Recent revision"
          assignment={byCategory.SABQI}
          accuracy={doneToday?.sabqiAccuracy}
        />
        <PortionCard
          category="MANZIL"
          arabic="مَنْزِل"
          name="Manzil"
          hint="Long-term revision"
          assignment={byCategory.MANZIL}
          accuracy={doneToday?.manzilAccuracy}
        />
      </section>

      <section className="rounded-lg border bg-card p-5">
        {doneToday ? (
          <>
            <h2 className="font-semibold">Today’s Hifdh is done — {minutesToday} minutes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sabaq {fmt(doneToday.sabaqAccuracy)} · Sabqi {fmt(doneToday.sabqiAccuracy)} · Manzil{' '}
              {fmt(doneToday.manzilAccuracy)}
            </p>
            <Link
              href="/student/practice"
              className="mt-4 inline-flex h-11 items-center rounded-md border px-5 font-medium hover:bg-muted"
            >
              Practise again
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold">
              {minutesToday > 0 ? 'Carry on where you left off' : 'Ready when you are'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sabaq, then Sabqi, then your weak ayat, then Manzil. About {student.dailyGoalMinutes} minutes.
            </p>
            <Link
              href="/student/practice"
              className="mt-4 inline-flex h-12 items-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start today’s Hifdh
            </Link>
          </>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Practice today" value={`${minutesToday} min`} sub={`${goalPct}% of goal`} />
          <Stat label="Streak" value={`${streak} day${streak === 1 ? '' : 's'}`} />
          <Stat
            label="Accuracy"
            value={doneToday ? fmt(averageOf(doneToday)) : '—'}
            sub="last session"
          />
          {student.gamificationOn ? <Stat label="Points" value={points} /> : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Weak ayat to review</h2>
            <Link href="/student/weak-spots" className="text-sm text-muted-foreground hover:underline">
              See all
            </Link>
          </div>
          {weak.length ? (
            <ul className="mt-3 space-y-3">
              {weak.map((w) => {
                const ayah = repo.getAyah(w.refKey);
                if (!ayah) return null;
                return (
                  <li key={w.refKey} className="rounded-md border surface-mushaf p-3">
                    <p className="text-xs text-muted-foreground">
                      {repo.getSurah(ayah.surah).nameTransliterated} {ayah.ayah}
                    </p>
                    <AyahView verseKey={ayah.verseKey} words={repo.getAyahWords(ayah.verseKey)} size="sm" />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing flagged. Keep going — weak ayat appear here once your teacher or your practice
              finds them.
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold">From your teacher</h2>
          {lastLesson ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                {lastLesson.teacher.name} ·{' '}
                {new Date(lastLesson.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {lastLesson.entries.map((e) => (
                  <li key={e.id} className="flex justify-between border-b pb-1.5 last:border-0">
                    <span className="capitalize">{e.category.toLowerCase()}</span>
                    <span className="text-muted-foreground">
                      {e.rating ? e.rating.toLowerCase().replace(/_/g, ' ') : e.status.toLowerCase()}
                      {e.mistakeCount ? ` · ${e.mistakeCount} mistake${e.mistakeCount === 1 ? '' : 's'}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              {lastLesson.notes ? (
                <p className="mt-3 rounded-md bg-muted/60 p-3 text-sm italic">{lastLesson.notes}</p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No lessons recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function PortionCard({ arabic, name, hint, assignment, accuracy }) {
  return (
    <div className="rounded-lg border surface-mushaf p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="quran text-xl text-primary">{arabic}</span>
          <h2 className="font-semibold">{name}</h2>
        </div>
        {accuracy != null ? (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
            {accuracy}%
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      {assignment ? (
        <>
          <p className="mt-2 font-medium">{assignmentTitle(assignment)}</p>
          <p className="text-xs text-muted-foreground">{assignmentSubtitle(assignment)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{assignment.ayahCount} ayat</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Nothing assigned yet.</p>
      )}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

const fmt = (n) => (n == null ? '—' : `${n}%`);

function averageOf(session) {
  const vals = [session.sabaqAccuracy, session.sabqiAccuracy, session.manzilAccuracy].filter((v) => v != null);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}
