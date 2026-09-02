import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requireStudent } from '@/lib/auth/guards';
import { getQuranRepository } from '@/lib/quran/local-repository';
import { decorateWeakness } from '@/lib/hifdh/dashboard';
import { findSimilarAyat } from '@/lib/quran/drills';
import AyahView from '@/components/quran/ayah-view';

export const metadata = { title: 'Weak spots' };
export const dynamic = 'force-dynamic';

const repo = getQuranRepository();

export default async function WeakSpotsPage() {
  const { student } = await requireStudent();

  const [ayahRows, wordRows, pageRows, improvement] = await Promise.all([
    prisma.weaknessScore.findMany({
      where: { studentId: student.id, level: 'AYAH' },
      orderBy: { score: 'desc' },
      take: 10,
    }),
    prisma.weaknessScore.findMany({
      where: { studentId: student.id, level: 'WORD' },
      orderBy: { score: 'desc' },
      take: 12,
    }),
    prisma.weaknessScore.findMany({
      where: { studentId: student.id, level: 'PAGE' },
      orderBy: { score: 'desc' },
      take: 8,
    }),
    prisma.mistake.groupBy({
      by: ['resolved'],
      where: { studentId: student.id },
      _count: { _all: true },
    }),
  ]);

  const ayat = ayahRows.map(decorateWeakness).filter((w) => w.band !== 'NONE');
  const words = wordRows.map(decorateWeakness).filter((w) => w.band !== 'NONE');
  const pages = pageRows.map(decorateWeakness).filter((w) => w.band !== 'NONE');

  const resolved = improvement.find((r) => r.resolved)?._count._all ?? 0;
  const open = improvement.find((r) => !r.resolved)?._count._all ?? 0;

  // Similar passages for the single weakest ayah - the confusions worth drilling
  // are the ones this student is actually making.
  const similar = ayat[0] ? findSimilarAyat(repo, ayat[0].verseKey, { minRun: 3, limit: 3 }) : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Weak spots</h1>
        <p className="text-sm text-muted-foreground">
          What your teacher and your practice have found. These come first in your next session.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Still to fix" value={open} />
        <Metric label="Fixed so far" value={resolved} tone="good" />
        <Metric
          label="Improvement"
          value={open + resolved > 0 ? `${Math.round((resolved / (open + resolved)) * 100)}%` : '—'}
        />
      </section>

      <section>
        <h2 className="font-semibold">Most difficult ayat</h2>
        {ayat.length ? (
          <ul className="mt-3 space-y-3">
            {ayat.map((w) => (
              <li key={w.refKey} className="rounded-lg border surface-mushaf p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{w.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {w.mistakeCount} mistake{w.mistakeCount === 1 ? '' : 's'} · page {w.page}
                  </span>
                </div>
                <AyahView
                  verseKey={w.verseKey}
                  words={repo.getAyahWords(w.verseKey)}
                  size="md"
                  className="mt-2"
                  markedPositions={marksFor(w.verseKey, words)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nothing flagged. Weak ayat appear here when your teacher marks a word, or when a drill
            catches one.
          </p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Words you keep missing</h2>
          {words.length ? (
            <ul className="mt-3 space-y-2">
              {words.map((w) => (
                <li key={w.refKey} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
                  <span className="quran-sm">{w.text}</span>
                  <span className="text-right text-xs text-muted-foreground">
                    <span className="block">{w.label}</span>
                    <span>{w.mistakeCount}×</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nothing flagged yet.</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Pages needing revision</h2>
            {pages.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {pages.map((p) => (
                  <li key={p.refKey} className="rounded-md border px-2.5 py-1 text-sm">
                    Page {p.page}
                    <span className="ml-1.5 text-xs text-muted-foreground">{p.mistakeCount}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Nothing flagged yet.</p>
            )}
          </div>

          {similar.length ? (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="font-semibold">Similar ayat to be careful with</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                These share an opening or ending with {ayat[0].label}, which is where mix-ups happen.
              </p>
              <ul className="mt-3 space-y-2">
                {similar.map((s) => (
                  <li key={s.verseKey} className="rounded-md border surface-mushaf p-3">
                    <p className="text-xs text-muted-foreground">
                      {labelOf(s.verseKey)} · {s.relation === 'SIMILAR_OPENING' ? 'same opening' : 'same ending'}
                    </p>
                    <AyahView verseKey={s.verseKey} words={repo.getAyahWords(s.verseKey)} size="sm" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <Link
        href="/student/practice"
        className="flex h-12 items-center justify-center rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90"
      >
        Practise these now
      </Link>
    </div>
  );
}

function marksFor(verseKey, words) {
  const marks = {};
  for (const w of words) {
    if (w.verseKey === verseKey && w.wordPosition) marks[w.wordPosition] = 'weak';
  }
  return marks;
}

function labelOf(verseKey) {
  const ayah = repo.getAyah(verseKey);
  return ayah ? `${repo.getSurah(ayah.surah).nameTransliterated} ${ayah.ayah}` : verseKey;
}

function Metric({ label, value, tone }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className={tone === 'good' ? 'text-xl font-semibold text-success' : 'text-xl font-semibold'}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
