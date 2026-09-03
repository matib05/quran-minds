import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireRole, canAccessStudent } from '@/lib/auth/guards';
import { studentSnapshot, decorateWeakness } from '@/lib/hifdh/dashboard';
import { getQuranRepository } from '@/lib/quran/local-repository';
import { dueForRevision, groupIntoRuns, describeSuggestion } from '@/lib/hifdh/scheduler';
import AyahView from '@/components/quran/ayah-view';
import ProgressMap from '@/components/hifdh/progress-map';

export const dynamic = 'force-dynamic';
const repo = getQuranRepository();

export async function generateMetadata({ params }) {
  const { id } = await params;
  const s = await prisma.studentProfile.findUnique({
    where: { id },
    select: { user: { select: { name: true } } },
  });
  return { title: s?.user.name ?? 'Student' };
}

export default async function StudentPage({ params }) {
  const { id } = await params;
  const user = await requireRole('TEACHER', 'ADMIN');
  if (!(await canAccessStudent(user, id))) notFound();

  const snapshot = await studentSnapshot(id, { days: 30 });
  if (!snapshot) notFound();

  const [pageWeakness, due, progressRows, recentMistakes] = await Promise.all([
    prisma.weaknessScore.findMany({
      where: { studentId: id, level: 'PAGE' },
      orderBy: { score: 'desc' },
      take: 6,
    }),
    dueForRevision(prisma, id, { limit: 40 }),
    prisma.ayahProgress.findMany({
      where: { studentId: id },
      select: { juz: true, page: true, state: true },
    }),
    prisma.mistake.findMany({
      where: { studentId: id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { teacher: { select: { name: true } } },
    }),
  ]);

  const runs = groupIntoRuns(due.map((d) => d.verseKey), repo);
  const suggestion = buildSuggestion(snapshot, runs, pageWeakness);

  const weakAyat = snapshot.weakSpots.filter((w) => w.level === 'AYAH' && w.band !== 'NONE').slice(0, 5);
  const weakWordList = snapshot.weakSpots.filter((w) => w.level === 'WORD' && w.band !== 'NONE').slice(0, 8);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/teacher" className="text-sm text-muted-foreground hover:underline">
            ← All students
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{snapshot.name}</h1>
          <p className="text-sm text-muted-foreground">
            {snapshot.classes.map((c) => c.name).join(', ')} · {snapshot.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/teacher/students/${snapshot.id}/assign`}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            Assignments
          </Link>
          <Link
            href={`/teacher/students/${snapshot.id}/lesson`}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Record lesson
          </Link>
        </div>
      </header>

      {suggestion ? (
        <section className="rounded-lg border border-accent/40 bg-accent/5 p-4">
          <h2 className="text-sm font-semibold">Suggested next step</h2>
          <p className="mt-1 text-sm">{suggestion}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            A suggestion only — assignments change only when you change them.
          </p>
        </section>
      ) : null}

      {/* --- today --- */}
      <section className="grid gap-3 sm:grid-cols-3">
        {['SABAQ', 'SABQI', 'MANZIL'].map((category) => {
          const a = snapshot.assignments[category];
          const accuracy = snapshot[`${category.toLowerCase()}Accuracy`];
          return (
            <div key={category} className="rounded-lg border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold capitalize">{category.toLowerCase()}</h3>
                {accuracy != null ? <span className="text-sm text-muted-foreground">{accuracy}%</span> : null}
              </div>
              {a ? (
                <>
                  <p className="mt-1 font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.subtitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.ayahCount} ayat</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Not assigned</p>
              )}
            </div>
          );
        })}
      </section>

      {/* --- practice + progress --- */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Practised today"
          value={snapshot.practicedToday ? `Yes · ${snapshot.minutesToday} min` : 'No'}
          tone={snapshot.practicedToday ? 'good' : 'warn'}
        />
        <Metric label="This week" value={`${snapshot.daysThisWeek}/7 days`} />
        <Metric label="Streak" value={`${snapshot.streak} days`} />
        <Metric label="Practice time (30d)" value={`${snapshot.totalMinutes} min`} />
        <Metric label="Pages memorized" value={snapshot.pagesMemorized} />
        <Metric label="Juz complete" value={snapshot.juzMemorized} />
        <Metric label="Open mistakes" value={snapshot.openMistakes} tone={snapshot.openMistakes > 10 ? 'warn' : null} />
        <Metric label="Points" value={snapshot.points} />
      </section>

      <ProgressMap rows={progressRows} juzPages={juzPageRanges()} />

      {/* --- weak spots --- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Most difficult ayat</h2>
          {weakAyat.length ? (
            <ul className="mt-3 space-y-3">
              {weakAyat.map((w) => (
                <li key={w.refKey} className="rounded-md surface-mushaf border p-3">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{w.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {w.mistakeCount}× · page {w.page}
                    </span>
                  </div>
                  <AyahView
                    verseKey={w.verseKey}
                    words={repo.getAyahWords(w.verseKey)}
                    size="sm"
                    className="mt-1"
                    markedPositions={wordMarks(w.verseKey, weakWordList)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nothing flagged yet.</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Frequently missed words</h2>
            {weakWordList.length ? (
              <ul className="mt-3 space-y-2">
                {weakWordList.map((w) => (
                  <li key={w.refKey} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
                    <span className="quran-sm">{w.text}</span>
                    <span className="text-right text-xs text-muted-foreground">
                      <span className="block">{w.label}</span>
                      <span>
                        {w.mistakeCount}× · last{' '}
                        {w.lastMistakeAt ? relativeDays(w.lastMistakeAt) : 'unknown'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Nothing flagged yet.</p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Pages needing revision</h2>
            {pageWeakness.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {pageWeakness.map(decorateWeakness).filter((p) => p.band !== 'NONE').map((p) => (
                  <li key={p.refKey} className="flex justify-between">
                    <Link href={`/teacher/mushaf/${p.page}`} className="hover:underline">
                      {p.label}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {p.mistakeCount} mistake{p.mistakeCount === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Nothing flagged yet.</p>
            )}
          </div>
        </div>
      </section>

      {/* --- history --- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Recent lessons</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {snapshot.lessons.slice(0, 6).map((l) => (
              <li key={l.id} className="border-b pb-2 last:border-0">
                <div className="flex justify-between">
                  <span>{new Date(l.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                  <span className="text-xs text-muted-foreground">{l.teacher.name}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {l.entries.map((e) => (
                    <span key={e.id}>
                      {e.category.toLowerCase()}: {e.rating ? e.rating.toLowerCase().replace(/_/g, ' ') : e.status.toLowerCase()}
                      {e.mistakeCount ? ` (${e.mistakeCount})` : ''}
                    </span>
                  ))}
                </div>
                {l.notes ? <p className="mt-1 text-xs italic">{l.notes}</p> : null}
              </li>
            ))}
            {snapshot.lessons.length === 0 ? (
              <li className="text-muted-foreground">No lessons recorded yet.</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Latest mistakes</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {recentMistakes.map((m) => {
              const ayah = repo.getAyah(m.verseKey);
              const word = m.wordPosition ? repo.getWord(m.verseKey, m.wordPosition) : null;
              return (
                <li key={m.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                  <span>
                    {word ? <span className="quran-sm mr-2">{word.text}</span> : null}
                    <span className="text-xs text-muted-foreground">
                      {repo.getSurah(ayah.surah).nameTransliterated} {ayah.ayah}
                      {m.wordPosition ? `, word ${m.wordPosition}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    <span className="block">{m.mistakeType.toLowerCase().replace(/_/g, ' ')}</span>
                    {relativeDays(m.createdAt)}
                  </span>
                </li>
              );
            })}
            {recentMistakes.length === 0 ? (
              <li className="text-muted-foreground">Nothing recorded yet.</li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}

/**
 * Turn the signals into one sentence a teacher can act on. Deliberately a
 * single recommendation - a list of five suggestions is a list nobody reads.
 */
function buildSuggestion(snapshot, runs, pageWeakness) {
  const repeated = snapshot.weakSpots.find((w) => w.level === 'AYAH' && w.band === 'HIGH');
  if (repeated) {
    return `${snapshot.name} has missed ${repeated.label} ${repeated.mistakeCount} times. Recommended: a targeted phrase drill on that ayah before moving Sabaq on.`;
  }

  const slipping = snapshot.flags.find((f) => f.code === 'MANZIL_SLIPPING');
  if (slipping) {
    const pages = pageWeakness.slice(0, 2).map((p) => p.refKey.slice(2));
    return `Manzil accuracy has fallen for three sessions. Recommended: reduce tomorrow's Sabaq and revise ${pages.length ? `pages ${pages.join(' and ')}` : 'the weakest pages'}.`;
  }

  if (snapshot.flags.some((f) => f.code === 'NO_PRACTICE')) {
    return `No practice recorded yesterday or today. Recommended: check in before assigning new Sabaq.`;
  }

  if (runs.length) {
    const repoRef = describeSuggestion(runs, repo);
    return `${runs.reduce((n, r) => n + r.count, 0)} ayat are due for revision — ${repoRef}.`;
  }
  return null;
}

/** First and last mushaf page of every juz, straight from the repository. */
function juzPageRanges() {
  return Array.from({ length: 30 }, (_, i) => {
    const juz = repo.getJuz(i + 1);
    return { juz: juz.juz, firstPage: juz.firstPage, lastPage: juz.lastPage };
  });
}

function wordMarks(verseKey, weakWords) {
  const marks = {};
  for (const w of weakWords) {
    if (w.verseKey === verseKey && w.wordPosition) marks[w.wordPosition] = 'weak';
  }
  return marks;
}

function relativeDays(date) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
}

function Metric({ label, value, tone }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
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
