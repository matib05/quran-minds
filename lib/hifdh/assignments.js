/**
 * Assignment resolution.
 *
 * A teacher thinks in pages, juz and surahs. The rest of the system needs one
 * unambiguous thing: a verse range. Everything a teacher can type is resolved
 * here, once, and stored alongside the original expression so the assignment
 * still reads the way it was written.
 */
import { getQuranRepository } from '../quran/local-repository.js';

const repo = getQuranRepository();

/**
 * @param {{scope:string, pageStart?:number, pageEnd?:number, surahNumber?:number,
 *          juzNumber?:number, hizbNumber?:number, fromVerseKey?:string,
 *          toVerseKey?:string}} input
 * @returns {{fromVerseKey:string, toVerseKey:string, ayahCount:number,
 *            pageStart:number, pageEnd:number, label:string}}
 * @throws when the reference does not exist
 */
export function resolveAssignment(input) {
  const { scope } = input;

  let fromVerseKey;
  let toVerseKey;

  switch (scope) {
    case 'PAGE_RANGE': {
      const start = Number(input.pageStart);
      const end = Number(input.pageEnd ?? input.pageStart);
      const a = repo.getPage(start);
      const b = repo.getPage(end);
      if (!a || !b) throw new Error(`Mushaf pages must be between 1 and ${repo.pageCount}`);
      fromVerseKey = a.firstVerseKey;
      toVerseKey = b.lastVerseKey;
      break;
    }
    case 'JUZ': {
      const juz = repo.getJuz(Number(input.juzNumber));
      if (!juz) throw new Error('Juz must be between 1 and 30');
      fromVerseKey = juz.firstVerseKey;
      toVerseKey = juz.lastVerseKey;
      break;
    }
    case 'HIZB': {
      const hizb = repo.getHizb(Number(input.hizbNumber));
      if (!hizb) throw new Error('Hizb must be between 1 and 60');
      fromVerseKey = hizb.firstVerseKey;
      toVerseKey = hizb.lastVerseKey;
      break;
    }
    case 'SURAH': {
      const surah = repo.getSurah(Number(input.surahNumber));
      if (!surah) throw new Error('Surah must be between 1 and 114');
      fromVerseKey = `${surah.number}:1`;
      toVerseKey = `${surah.number}:${surah.ayahCount}`;
      break;
    }
    case 'AYAH_RANGE':
    case 'CUSTOM':
    default: {
      fromVerseKey = input.fromVerseKey;
      toVerseKey = input.toVerseKey || input.fromVerseKey;
      break;
    }
  }

  const fromIndex = repo.indexOf(fromVerseKey);
  const toIndex = repo.indexOf(toVerseKey);
  if (fromIndex == null || toIndex == null) {
    throw new Error(`Not a valid Qur’an reference: ${fromVerseKey} - ${toVerseKey}`);
  }
  if (toIndex < fromIndex) {
    throw new Error('The end of the range comes before the start');
  }

  return {
    fromVerseKey: repo.keyAt(fromIndex),
    toVerseKey: repo.keyAt(toIndex),
    ayahCount: toIndex - fromIndex + 1,
    pageStart: repo.pageOf(fromIndex),
    pageEnd: repo.pageOf(toIndex),
    label: describeRange(fromVerseKey, toVerseKey),
  };
}

/** Readable label, e.g. "Al-Baqarah 255-257" or "An-Naba 1 - An-Nazi'at 12". */
export function describeRange(fromVerseKey, toVerseKey) {
  const from = repo.getAyah(fromVerseKey);
  const to = repo.getAyah(toVerseKey);
  if (!from || !to) return '';
  const sFrom = repo.getSurah(from.surah);
  if (from.surah === to.surah) {
    const surah = sFrom.nameTransliterated;
    return from.ayah === to.ayah ? `${surah} ${from.ayah}` : `${surah} ${from.ayah}-${to.ayah}`;
  }
  return `${sFrom.nameTransliterated} ${from.ayah} - ${repo.getSurah(to.surah).nameTransliterated} ${to.ayah}`;
}

/**
 * Sabqi default: the `windowPages` mushaf pages immediately behind the
 * student's current Sabaq. This is what "recent memorization" means in
 * practice, and a teacher can always override it.
 */
export function suggestSabqiRange(sabaqFromVerseKey, windowPages = 5) {
  const sabaqPage = repo.pageOfKey(sabaqFromVerseKey);
  if (!sabaqPage) return null;
  const end = Math.max(1, sabaqPage - 1);
  const start = Math.max(1, end - windowPages + 1);
  if (end < 1 || start > end) return null;
  const a = repo.getPage(start);
  const b = repo.getPage(end);
  return {
    scope: 'PAGE_RANGE',
    pageStart: start,
    pageEnd: end,
    fromVerseKey: a.firstVerseKey,
    toVerseKey: b.lastVerseKey,
    ayahCount: repo.countRange(a.firstVerseKey, b.lastVerseKey),
    label: `Pages ${start}-${end}`,
  };
}

/** Short display string for an assignment row, used all over the UI. */
export function assignmentTitle(assignment) {
  if (!assignment) return null;
  if (assignment.scope === 'PAGE_RANGE') {
    const pages =
      assignment.pageStart === assignment.pageEnd
        ? `Page ${assignment.pageStart}`
        : `Pages ${assignment.pageStart}-${assignment.pageEnd}`;
    const lines =
      assignment.lineStart != null
        ? assignment.lineStart === assignment.lineEnd
          ? `, line ${assignment.lineStart}`
          : `, lines ${assignment.lineStart}-${assignment.lineEnd}`
        : '';
    return `${pages}${lines}`;
  }
  if (assignment.scope === 'JUZ') return `Juz ${assignment.juzNumber}`;
  if (assignment.scope === 'HIZB') return `Hizb ${assignment.hizbNumber}`;
  if (assignment.scope === 'SURAH') {
    const s = repo.getSurah(assignment.surahNumber);
    return s ? `Surah ${s.nameTransliterated}` : `Surah ${assignment.surahNumber}`;
  }
  return assignment.label || describeRange(assignment.fromVerseKey, assignment.toVerseKey);
}

/** Full subtitle: the ayah range behind whatever the teacher typed. */
export function assignmentSubtitle(assignment) {
  if (!assignment) return null;
  return describeRange(assignment.fromVerseKey, assignment.toVerseKey);
}
