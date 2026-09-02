import 'server-only';
import prisma from '@/lib/prisma';
import { getQuranRepository } from '@/lib/quran/local-repository';
import { splitIntoPhrases } from '@/lib/quran/phrases';
import { vanishingRounds, nextWordDrill, completeAyahDrill, nextAyahDrill } from '@/lib/quran/drills';
import { assignmentTitle, assignmentSubtitle } from './assignments';
import { weakestAyat } from './weakness';
import { dueForRevision } from './scheduler';

const repo = getQuranRepository();

/**
 * A whole mushaf page can be thirty phrases, and thirty phrases at five
 * repetitions across three steps is over four hundred taps. That is not a
 * memorization session, it is an endurance test - so one sitting covers this
 * many phrases and the student comes back for the rest.
 */
const MAX_PHRASES_PER_SESSION = 8;

/**
 * Build the whole of today's practice, on the server, in one go.
 *
 * The entire plan - every ayah, every phrase, every distractor - is sent to
 * the browser up front. That is what makes the session survive a dropped
 * connection: once "Start today's Hifdh" has loaded, the student can finish
 * without the network, and the results sync when it comes back.
 *
 * Stages follow the order a Hifdh session actually runs in:
 *   1. learn today's Sabaq          4. drill what is weak
 *   2. test today's Sabaq           5. revise Manzil
 *   3. revise Sabqi                 6. summary
 */
export async function buildDailyPlan(studentId, { seed = Date.now() } = {}) {
  const [profile, assignments, weak, due] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { id: studentId }, include: { user: true } }),
    prisma.assignment.findMany({ where: { studentId, active: true } }),
    weakestAyat(prisma, studentId, 4),
    dueForRevision(prisma, studentId, { limit: 12 }),
  ]);
  if (!profile) return null;

  const byCategory = Object.fromEntries(assignments.map((a) => [a.category, a]));
  const stages = [];

  // --- 1 & 2. Sabaq: learn it, then prove it ------------------------------
  const sabaq = byCategory.SABAQ;
  if (sabaq) {
    const ayat = repo.getRange(sabaq.fromVerseKey, sabaq.toVerseKey).slice(0, 8);
    const phrases = [];
    for (const ayah of ayat) {
      for (const p of splitIntoPhrases(repo.getAyahWords(ayah.verseKey))) {
        if (phrases.length >= MAX_PHRASES_PER_SESSION) break;
        phrases.push({
          id: `${ayah.verseKey}-${p.index}`,
          verseKey: ayah.verseKey,
          surahName: repo.getSurah(ayah.surah).nameTransliterated,
          ayahNumber: ayah.ayah,
          text: p.text,
          words: p.words.map((w) => ({ position: w.position, text: w.text })),
          audioUrl: repo.getAudioUrl(ayah.verseKey),
        });
      }
    }

    stages.push({
      key: 'sabaq-learn',
      category: 'SABAQ',
      mode: 'FIVE_BY_FIVE',
      title: 'Learn today’s Sabaq',
      subtitle: `${assignmentTitle(sabaq)} · ${assignmentSubtitle(sabaq)}`,
      repetitionTarget: profile.repetitionTarget,
      phrases,
      totalPhrases: countPhrases(ayat),
    });

    stages.push({
      key: 'sabaq-test',
      category: 'SABAQ',
      mode: 'TYPE_FROM_MEMORY',
      title: 'Sabaq recall test',
      subtitle: 'Type each ayah from memory',
      items: ayat.map((a) => ({
        id: `type-${a.verseKey}`,
        verseKey: a.verseKey,
        label: `${repo.getSurah(a.surah).nameTransliterated} ${a.ayah}`,
        expected: a.text,
        wordCount: a.wordCount,
        audioUrl: repo.getAudioUrl(a.verseKey),
      })),
    });
  }

  // --- 3. Sabqi: recent pages, tested by continuation ----------------------
  const sabqi = byCategory.SABQI;
  if (sabqi) {
    const ayat = repo.getRange(sabqi.fromVerseKey, sabqi.toVerseKey);
    const sample = evenSample(ayat, 6).filter((a) => repo.getNextAyah(a.verseKey));
    const items = sample
      .map((a, i) => {
        const drill = nextAyahDrill(repo, a.verseKey, { seed: seed + i });
        if (!drill) return null;
        return {
          id: `next-${a.verseKey}`,
          verseKey: a.verseKey,
          label: `${repo.getSurah(a.surah).nameTransliterated} ${a.ayah}`,
          prompt: drill.prompt,
          answer: drill.answer,
          options: drill.options,
          audioUrl: repo.getAudioUrl(a.verseKey),
        };
      })
      .filter(Boolean);

    if (items.length) {
      stages.push({
        key: 'sabqi',
        category: 'SABQI',
        mode: 'NEXT_AYAH',
        title: 'Sabqi revision',
        subtitle: `${assignmentTitle(sabqi)} · which ayah comes next?`,
        items,
      });
    }
  }

  // --- 4. Weak spots: the whole point of recording mistakes ----------------
  const weakKeys = [...new Set([...weak.map((w) => w.refKey), ...due.map((d) => d.verseKey)])].slice(0, 4);
  const weakItems = weakKeys
    .map((verseKey, i) => {
      const ayah = repo.getAyah(verseKey);
      if (!ayah) return null;
      const words = repo.getAyahWords(verseKey);
      // Short ayat get "complete the ayah"; longer ones get vanishing words,
      // which is a fairer test of a passage than blanking two words out of forty.
      if (words.length <= 6) {
        const drill = completeAyahDrill(repo, verseKey, { difficulty: 1 });
        if (!drill) return null;
        return {
          id: `weak-${verseKey}`,
          kind: 'COMPLETE_AYAH',
          verseKey,
          label: `${repo.getSurah(ayah.surah).nameTransliterated} ${ayah.ayah}`,
          prompt: drill.prompt,
          expected: drill.answer,
          audioUrl: repo.getAudioUrl(verseKey),
        };
      }
      const rounds = vanishingRounds(words, { rounds: 4, seed: seed + i });
      return {
        id: `weak-${verseKey}`,
        kind: 'VANISHING_WORDS',
        verseKey,
        label: `${repo.getSurah(ayah.surah).nameTransliterated} ${ayah.ayah}`,
        words: words.map((w) => ({ position: w.position, text: w.text })),
        rounds,
        expected: ayah.text,
        audioUrl: repo.getAudioUrl(verseKey),
      };
    })
    .filter(Boolean);

  if (weakItems.length) {
    stages.push({
      key: 'weak',
      category: null,
      mode: 'VANISHING_WORDS',
      title: 'Weak spots',
      subtitle: 'The ayat you have been missing',
      items: weakItems,
    });
  }

  // --- 5. Manzil: a sample across the assigned range -----------------------
  const manzil = byCategory.MANZIL;
  if (manzil) {
    const ayat = repo.getRange(manzil.fromVerseKey, manzil.toVerseKey);
    const sample = evenSample(ayat, 6);
    const items = sample
      .map((a, i) => {
        const words = repo.getAyahWords(a.verseKey);
        const position = Math.max(2, Math.min(words.length, 2 + (i % Math.max(1, words.length - 2))));
        const drill = nextWordDrill(repo, a.verseKey, position, { seed: seed + i });
        if (!drill) return null;
        return {
          id: `manzil-${a.verseKey}`,
          kind: 'NEXT_WORD',
          verseKey: a.verseKey,
          label: `${repo.getSurah(a.surah).nameTransliterated} ${a.ayah}`,
          prompt: drill.prompt,
          answer: drill.answer,
          options: drill.options,
          wordPosition: position,
          audioUrl: repo.getAudioUrl(a.verseKey),
        };
      })
      .filter(Boolean);

    if (items.length) {
      stages.push({
        key: 'manzil',
        category: 'MANZIL',
        mode: 'NEXT_WORD',
        title: 'Manzil revision',
        subtitle: `${assignmentTitle(manzil)} · what is the next word?`,
        items,
      });
    }
  }

  return {
    studentId,
    studentName: profile.user.name,
    dailyGoalMinutes: profile.dailyGoalMinutes,
    repetitionTarget: profile.repetitionTarget,
    strictTashkeel: profile.strictTashkeel,
    gamificationOn: profile.gamificationOn,
    stages,
  };
}

/** How many phrases the full Sabaq comes to, so the UI can say so honestly. */
function countPhrases(ayat) {
  return ayat.reduce((n, a) => n + splitIntoPhrases(repo.getAyahWords(a.verseKey)).length, 0);
}

/** Spread n picks evenly across a list instead of clustering at the start. */
function evenSample(list, n) {
  if (list.length <= n) return list;
  const step = list.length / n;
  return Array.from({ length: n }, (_, i) => list[Math.floor(i * step)]);
}
