import prisma from '@/lib/prisma';
import { requireStudent } from '@/lib/auth/guards';
import { getQuranRepository } from '@/lib/quran/local-repository';
import { pagesMemorized, juzMemorized } from '@/lib/hifdh/dashboard';
import { streakFromDates } from '@/lib/hifdh/points';
import ProgressMap from '@/components/hifdh/progress-map';

export const metadata = { title: 'Progress' };
export const dynamic = 'force-dynamic';

const repo = getQuranRepository();
const DAY = 86400_000;

export default async function ProgressPage() {
  const { student } = await requireStudent();

  const [rows, sessions, pages, juz] = await Promise.all([
    prisma.ayahProgress.findMany({
      where: { studentId: student.id },
      select: { juz: true, page: true, state: true },
    }),
    prisma.practiceSession.findMany({
      where: { studentId: student.id, startedAt: { gte: new Date(Date.now() - 56 * DAY) } },
      orderBy: { startedAt: 'asc' },
    }),
    pagesMemorized(student.id),
    juzMemorized(student.id),
  ]);

  const byWeek = groupByWeek(sessions);
  const maxMinutes = Math.max(1, ...byWeek.map((w) => w.minutes));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Your progress</h1>
        <p className="text-sm text-muted-foreground">Every juz, every page, and how it is holding up.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="Pages memorized" value={pages} />
        <Metric label="Juz complete" value={juz} />
        <Metric label="Ayat tracked" value={rows.length} />
        <Metric label="Streak" value={`${streakFromDates(sessions.map((s) => s.startedAt))} days`} />
      </section>

      <ProgressMap rows={rows} juzPages={juzPageRanges()} />

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Practice over the last 8 weeks</h2>
        <div className="mt-4 flex h-32 items-end gap-2" role="img" aria-label="Weekly practice minutes">
          {byWeek.map((w) => (
            <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-primary/70"
                style={{ height: `${Math.round((w.minutes / maxMinutes) * 100)}%` }}
                title={`${w.label}: ${w.minutes} minutes over ${w.days} days`}
              />
              <span className="text-[10px] text-muted-foreground">{w.label}</span>
            </div>
          ))}
        </div>
        {byWeek.every((w) => w.minutes === 0) ? (
          <p className="mt-2 text-sm text-muted-foreground">No practice recorded yet.</p>
        ) : null}
      </section>
    </div>
  );
}

function juzPageRanges() {
  return Array.from({ length: 30 }, (_, i) => {
    const j = repo.getJuz(i + 1);
    return { juz: j.juz, firstPage: j.firstPage, lastPage: j.lastPage };
  });
}

/** Bucket sessions into the last eight calendar weeks. */
function groupByWeek(sessions) {
  const weeks = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = 7; i >= 0; i--) {
    const end = new Date(now.getTime() - i * 7 * DAY);
    const start = new Date(end.getTime() - 6 * DAY);
    const inWeek = sessions.filter((s) => s.startedAt >= start && s.startedAt <= new Date(end.getTime() + DAY));
    weeks.push({
      label: `${start.getDate()}/${start.getMonth() + 1}`,
      minutes: Math.round(inWeek.reduce((n, s) => n + s.activeSeconds, 0) / 60),
      days: new Set(inWeek.map((s) => new Date(s.startedAt).toDateString())).size,
    });
  }
  return weeks;
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
