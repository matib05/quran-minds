import Link from 'next/link';
import { requireRole, visibleStudents } from '@/lib/auth/guards';
import { rosterSnapshots } from '@/lib/hifdh/dashboard';
import RosterTable from './roster-table';

export const metadata = { title: 'Students' };
export const dynamic = 'force-dynamic';

export default async function TeacherDashboard({ searchParams }) {
  const filters = await searchParams;
  const user = await requireRole('TEACHER', 'ADMIN');
  const students = await visibleStudents(user);
  const snapshots = (await rosterSnapshots(students)).filter(Boolean);

  const needsAttention = snapshots.filter((s) => s.flags.some((f) => f.level === 'high'));
  const practicedToday = snapshots.filter((s) => s.practicedToday).length;

  const classes = [
    ...new Map(
      snapshots.flatMap((s) => s.classes.map((c) => [c.id, c])),
    ).values(),
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today’s Hifdh</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Stat label="Students" value={snapshots.length} />
          <Stat label="Practised today" value={`${practicedToday}/${snapshots.length}`} />
          <Stat
            label="Need attention"
            value={needsAttention.length}
            tone={needsAttention.length ? 'warn' : 'ok'}
          />
        </div>
      </header>

      {needsAttention.length > 0 ? (
        <section className="rounded-lg border border-warning/40 bg-warning/5 p-4">
          <h2 className="text-sm font-semibold">Needs attention</h2>
          <ul className="mt-2 space-y-1.5">
            {needsAttention.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <Link href={`/teacher/students/${s.id}`} className="font-medium underline-offset-2 hover:underline">
                  {s.name}
                </Link>
                <span className="text-muted-foreground">
                  {s.flags.filter((f) => f.level === 'high').map((f) => f.label).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <RosterTable snapshots={serialize(snapshots)} classes={classes} initialFilters={filters} />
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-center">
      <div
        className={
          tone === 'warn'
            ? 'text-lg font-semibold text-warning'
            : tone === 'ok'
              ? 'text-lg font-semibold text-success'
              : 'text-lg font-semibold'
        }
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** Trim the snapshot to what the client table renders. */
function serialize(snapshots) {
  return snapshots.map((s) => ({
    id: s.id,
    name: s.name,
    classes: s.classes.map((c) => ({ id: c.id, name: c.name })),
    sabaq: s.assignments.SABAQ ? { title: s.assignments.SABAQ.title, subtitle: s.assignments.SABAQ.subtitle } : null,
    sabqi: s.assignments.SABQI ? { title: s.assignments.SABQI.title, subtitle: s.assignments.SABQI.subtitle } : null,
    manzil: s.assignments.MANZIL ? { title: s.assignments.MANZIL.title, subtitle: s.assignments.MANZIL.subtitle } : null,
    practicedToday: s.practicedToday,
    minutesToday: s.minutesToday,
    daysThisWeek: s.daysThisWeek,
    streak: s.streak,
    totalMinutes: s.totalMinutes,
    pagesMemorized: s.pagesMemorized,
    juzMemorized: s.juzMemorized,
    sabaqAccuracy: s.sabaqAccuracy,
    sabqiAccuracy: s.sabqiAccuracy,
    manzilAccuracy: s.manzilAccuracy,
    openMistakes: s.openMistakes,
    lastLessonAt: s.lastLesson?.date ? s.lastLesson.date.toISOString() : null,
    lastSessionAt: s.lastSession?.startedAt ? s.lastSession.startedAt.toISOString() : null,
    flags: s.flags,
    topWeakness: s.weakSpots[0]
      ? { label: s.weakSpots[0].label, band: s.weakSpots[0].band, count: s.weakSpots[0].mistakeCount }
      : null,
    juz: s.assignments.MANZIL?.juzNumber ?? null,
  }));
}
