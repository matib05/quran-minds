/**
 * Qur'an reference helpers: verse keys, ranges, and conversions between the
 * addressing schemes teachers actually use (surah:ayah, page, juz, hizb, rub).
 *
 * A "global index" is the 0-based position of an ayah in mushaf order,
 * 0 = 1:1 and 6235 = 114:6. Everything internal is stored as a verse key
 * ("2:255"); global indexes are an implementation detail of lookups.
 */

export function parseVerseKey(key) {
  if (typeof key !== 'string') return null;
  const m = key.trim().match(/^(\d{1,3}):(\d{1,3})$/);
  if (!m) return null;
  const surah = Number(m[1]);
  const ayah = Number(m[2]);
  if (surah < 1 || surah > 114 || ayah < 1) return null;
  return { surah, ayah };
}

export function verseKey(surah, ayah) {
  return `${surah}:${ayah}`;
}

/** Binary search: index of the last boundary start that is <= idx. */
export function boundaryOf(starts, idx) {
  let lo = 0;
  let hi = starts.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= idx) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans; // 0-based; callers add 1 for human numbering
}

/** Inclusive list of verse keys between two keys, in mushaf order. */
export function expandRange(repo, fromKey, toKey) {
  const a = repo.indexOf(fromKey);
  const b = repo.indexOf(toKey);
  if (a == null || b == null) return [];
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  const out = [];
  for (let i = lo; i <= hi; i++) out.push(repo.keyAt(i));
  return out;
}

/** Human label for an assignment range, e.g. "Al-Baqarah 255-257". */
export function rangeLabel(repo, fromKey, toKey) {
  const a = parseVerseKey(fromKey);
  const b = parseVerseKey(toKey);
  if (!a || !b) return '';
  const sa = repo.getSurah(a.surah);
  if (a.surah === b.surah) {
    return a.ayah === b.ayah
      ? `${sa.nameTransliterated} ${a.ayah}`
      : `${sa.nameTransliterated} ${a.ayah}-${b.ayah}`;
  }
  const sb = repo.getSurah(b.surah);
  return `${sa.nameTransliterated} ${a.ayah} - ${sb.nameTransliterated} ${b.ayah}`;
}
