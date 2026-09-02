import { requireRole, visibleStudents } from '@/lib/auth/guards';
import { studentSnapshot } from '@/lib/hifdh/dashboard';
import AppShell from '@/components/shell/app-shell';

export const metadata = { title: 'Your children' };
export const dynamic = 'force-dynamic';

/**
 * The parent view.
 *
 * Deliberately narrow: what was assigned, whether it was practised, for how
 * long, how the memorization is growing, and what the teacher said. Word-level
 * mistake data is left out - a parent seeing "missed word 6 of 67:3 four times"
 * mostly produces pressure at home, and it is the teacher's material to use.
 */
export default async function ParentPage() {
  const user = await requireRole('PARENT');
  const children = await visibleStudents(user);
  const snapshots = (await Promise.all(children.map((c) => studentSnapshot(c.id, { days: 30 })))).filter(Boolean);

  return (
    <AppShell user={user} nav={[{ key: 'home', href: '/parent', label: 'Home' }]} current="home">
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Your children’s Hifdh</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </header>

        {snapshots.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No students are linked to your account yet. Ask the school to link them.
          </p>
        ) : null}

        {snapshots.map((s) => (
          <section key={s.id} className="rounded-lg border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{s.name}</h2>
              <span className="text-sm text-muted-foreground">{s.classes.map((c) => c.name).join(', ')}</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {['SABAQ', 'SABQI', 'MANZIL'].map((category) => {
                const a = s.assignments[category];
                return (
                  <div key={category} className="rounded-md border surface-mushaf p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {category.toLowerCase()}
                    </p>
                    <p className="mt-0.5 font-medium">{a ? a.title : 'Not assigned'}</p>
                    {a ? <p className="text-xs text-muted-foreground">{a.subtitle}</p> : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact
                label="Practised today"
                value={s.practicedToday ? 'Yes' : 'Not yet'}
                tone={s.practicedToday ? 'good' : 'warn'}
              />
              <Fact label="Minutes today" value={s.minutesToday} />
              <Fact label="Days this week" value={`${s.daysThisWeek}/7`} />
              <Fact label="Streak" value={`${s.streak} days`} />
              <Fact label="Pages memorized" value={s.pagesMemorized} />
              <Fact label="Juz complete" value={s.juzMemorized} />
              <Fact label="Practice (30 days)" value={`${s.totalMinutes} min`} />
              {s.profile.gamificationOn ? <Fact label="Points" value={s.points} /> : null}
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold">Teacher’s last note</h3>
              {s.lastLesson ? (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.lastLesson.teacher.name} ·{' '}
                    {new Date(s.lastLesson.date).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {s.lastLesson.entries.map((e) => (
                      <li key={e.id} className="capitalize">
                        {e.category.toLowerCase()}:{' '}
                        {e.rating ? e.rating.toLowerCase().replace(/_/g, ' ') : e.status.toLowerCase()}
                      </li>
                    ))}
                  </ul>
                  {s.lastLesson.notes ? (
                    <p className="mt-2 rounded-md bg-muted/60 p-3 text-sm italic">{s.lastLesson.notes}</p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">No lessons recorded yet.</p>
              )}
            </div>

            {s.flags.some((f) => f.code === 'NO_PRACTICE') ? (
              <p className="mt-4 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
                {s.name} has not practised in the last two days. A quiet twenty minutes today would
                put them back on track.
              </p>
            ) : null}
          </section>
        ))}
      </div>
    </AppShell>
  );
}

function Fact({ label, value, tone }) {
  return (
    <div>
      <div
        className={
          tone === 'good'
            ? 'text-lg font-semibold text-success'
            : tone === 'warn'
              ? 'text-lg font-semibold text-warning'
              : 'text-lg font-semibold'
        }
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
