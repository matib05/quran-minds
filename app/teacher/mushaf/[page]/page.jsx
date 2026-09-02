import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guards';
import { getQuranRepository } from '@/lib/quran/local-repository';
import AyahView from '@/components/quran/ayah-view';
import AudioButton from '@/components/quran/audio-button';

export const dynamic = 'force-dynamic';
const repo = getQuranRepository();

export async function generateMetadata({ params }) {
  return { title: `Mushaf page ${params.page}` };
}

/** A plain, readable mushaf for reference and for checking a reference. */
export default async function MushafPage({ params }) {
  await requireRole('TEACHER', 'ADMIN');

  const pageNumber = Number(params.page);
  const page = repo.getPage(pageNumber);
  if (!page) notFound();

  const juz = repo.getJuz(page.juz);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Page {page.page}</h1>
          <p className="text-sm text-muted-foreground">
            Juz {page.juz} · {page.surahs.map((s) => s.nameTransliterated).join(', ')} ·{' '}
            {page.firstVerseKey} – {page.lastVerseKey}
          </p>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <PageLink to={page.page - 1} disabled={page.page <= 1} label="←" />
          <form action={`/teacher/mushaf`} className="flex items-center gap-1">
            <input
              name="page"
              type="number"
              min={1}
              max={604}
              defaultValue={page.page}
              aria-label="Go to page"
              className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
            />
            <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-muted">
              Go
            </button>
          </form>
          <PageLink to={page.page + 1} disabled={page.page >= 604} label="→" />
        </nav>
      </header>

      <p className="text-xs text-muted-foreground">
        Juz {juz.juz} runs from page {juz.firstPage} to {juz.lastPage}.
      </p>

      <article className="rounded-lg border surface-mushaf p-6 sm:p-10">
        {page.ayat.map((a, i) => {
          const surah = repo.getSurah(a.surah);
          const isSurahStart = a.ayah === 1;
          return (
            <div key={a.verseKey}>
              {isSurahStart || i === 0 ? (
                <p className="my-4 border-y py-2 text-center text-sm font-medium text-muted-foreground">
                  {surah.nameTransliterated} · <span className="quran">{surah.nameArabic}</span>
                </p>
              ) : null}
              <div className="group relative">
                <AyahView verseKey={a.verseKey} ayahNumber={a.ayah} words={repo.getAyahWords(a.verseKey)} size="md" />
                <div className="mb-3 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <AudioButton src={repo.getAudioUrl(a.verseKey)} label={`Listen to ${a.verseKey}`} className="text-xs" />
                </div>
              </div>
            </div>
          );
        })}
      </article>

      <p className="text-xs text-muted-foreground">
        To record a mistake on one of these words, open a student and choose “Record lesson” — the
        mushaf there is tappable.
      </p>
    </div>
  );
}

function PageLink({ to, disabled, label }) {
  if (disabled) {
    return <span className="rounded-md border px-3 py-1.5 opacity-40">{label}</span>;
  }
  return (
    <Link href={`/teacher/mushaf/${to}`} className="rounded-md border px-3 py-1.5 hover:bg-muted">
      {label}
    </Link>
  );
}
