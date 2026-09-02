import prisma from '@/lib/prisma';
import { requireStudent } from '@/lib/auth/guards';
import { getQuranRepository } from '@/lib/quran/local-repository';
import { splitIntoPhrases } from '@/lib/quran/phrases';
import { assignmentTitle } from '@/lib/hifdh/assignments';
import MemorizationAssistant from './memorization-assistant';

export const metadata = { title: 'Memorization assistant' };
export const dynamic = 'force-dynamic';

const repo = getQuranRepository();

/**
 * The assistant on its own, outside the guided daily flow: pick any surah or
 * page (or jump straight to today's Sabaq) and work through it phrase by
 * phrase.
 */
export default async function MemorizePage({ searchParams }) {
  const { student } = await requireStudent();
  const query = await searchParams;

  const sabaq = await prisma.assignment.findFirst({
    where: { studentId: student.id, category: 'SABAQ', active: true },
  });

  const surahNumber = Number(query?.surah) || null;
  const pageNumber = Number(query?.page) || null;

  let selection = null;
  if (pageNumber) {
    const page = repo.getPage(pageNumber);
    if (page) {
      selection = { kind: 'page', label: `Page ${page.page}`, ayat: page.ayat };
    }
  } else if (surahNumber) {
    const surah = repo.getSurah(surahNumber);
    if (surah) {
      selection = {
        kind: 'surah',
        label: `Surah ${surah.nameTransliterated}`,
        ayat: repo.getSurahAyat(surahNumber),
      };
    }
  } else if (sabaq) {
    selection = {
      kind: 'sabaq',
      label: `Today’s Sabaq · ${assignmentTitle(sabaq)}`,
      ayat: repo.getRange(sabaq.fromVerseKey, sabaq.toVerseKey),
    };
  }

  // Long selections are trimmed: the assistant is for learning a portion, not
  // for scrolling a juz.
  const ayat = (selection?.ayat ?? []).slice(0, 15);

  const units = ayat.map((a) => ({
    verseKey: a.verseKey,
    label: `${repo.getSurah(a.surah).nameTransliterated} ${a.ayah}`,
    text: a.text,
    audioUrl: repo.getAudioUrl(a.verseKey),
    words: repo.getAyahWords(a.verseKey).map((w) => ({ position: w.position, text: w.text })),
    phrases: splitIntoPhrases(repo.getAyahWords(a.verseKey)).map((p) => ({
      index: p.index,
      text: p.text,
      words: p.words.map((w) => ({ position: w.position, text: w.text })),
    })),
  }));

  return (
    <MemorizationAssistant
      title={selection?.label ?? 'Memorization assistant'}
      units={units}
      repetitionTarget={student.repetitionTarget}
      surahs={repo.listSurahs().map((s) => ({ number: s.number, name: s.nameTransliterated, ayahCount: s.ayahCount }))}
      hasSabaq={Boolean(sabaq)}
    />
  );
}
