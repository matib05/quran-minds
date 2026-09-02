/**
 * Exercise generators for the practice modes.
 *
 * Everything here selects and hides *existing* canonical text. Nothing in this
 * module writes Arabic: distractors are always real Qur'anic words or ayat
 * pulled from the repository, chosen for plausibility from nearby or similar
 * passages rather than at random.
 */
import { normalize } from './normalize.js';
import { splitIntoPhrases } from './phrases.js';

/** Deterministic PRNG so a given session replays identically on the server. */
export function seededRandom(seed) {
  let s = typeof seed === 'string'
    ? [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
    : seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * MODE 4 - vanishing words.
 * Round 1 shows everything; each later round hides a larger share, and the
 * words hidden in an earlier round stay hidden, so the student never sees a
 * word reappear.
 */
export function vanishingRounds(words, { rounds = 5, seed = 1 } = {}) {
  const rand = seededRandom(seed);
  const order = shuffle(words.map((w) => w.position), rand);
  const out = [];
  for (let r = 0; r < rounds; r++) {
    const hiddenShare = r / (rounds - 1); // 0, .25, .5, .75, 1
    const hideCount = Math.round(hiddenShare * words.length);
    const hidden = new Set(order.slice(0, hideCount));
    out.push({
      round: r + 1,
      visiblePercent: Math.round((1 - hiddenShare) * 100),
      hiddenPositions: [...hidden].sort((a, b) => a - b),
    });
  }
  return out;
}

/**
 * MODE 5 - next word.
 * Shows the ayah up to `position - 1` and asks for the word at `position`.
 * Distractors are drawn from the same page so they are always plausible.
 */
export function nextWordDrill(repo, verseKey, position, { choices = 4, seed = 1 } = {}) {
  const words = repo.getAyahWords(verseKey);
  const target = words.find((w) => w.position === Number(position));
  if (!target || position < 2) return null;

  const rand = seededRandom(`${verseKey}:${position}:${seed}`);
  const page = repo.getPage(repo.pageOfKey(verseKey));
  const pool = new Map();
  for (const ayah of page.ayat) {
    for (const w of repo.getAyahWords(ayah.verseKey)) {
      const key = normalize(w.text);
      if (key && key !== target.simple && !pool.has(key)) pool.set(key, w.text);
    }
  }
  // Prefer distractors of a similar length - a one-letter option gives the
  // answer away.
  const ranked = [...pool.values()].sort(
    (a, b) => Math.abs(a.length - target.text.length) - Math.abs(b.length - target.text.length),
  );
  const distractors = shuffle(ranked.slice(0, Math.max(choices * 3, 12)), rand).slice(0, choices - 1);

  return {
    mode: 'NEXT_WORD',
    verseKey,
    position: Number(position),
    prompt: words.filter((w) => w.position < position).map((w) => w.text).join(' '),
    answer: target.text,
    options: shuffle([target.text, ...distractors], rand),
  };
}

/**
 * MODE 6 - complete the ayah.
 * Hides a trailing phrase; difficulty controls how much is hidden.
 */
export function completeAyahDrill(repo, verseKey, { difficulty = 1 } = {}) {
  const words = repo.getAyahWords(verseKey);
  if (words.length < 3) return null;
  const phrases = splitIntoPhrases(words);
  const hideCount = Math.min(phrases.length - 1, Math.max(1, difficulty));
  const shown = phrases.slice(0, phrases.length - hideCount);
  const hidden = phrases.slice(phrases.length - hideCount);
  if (!shown.length) return null;

  return {
    mode: 'COMPLETE_AYAH',
    verseKey,
    prompt: shown.map((p) => p.text).join(' '),
    answer: hidden.map((p) => p.text).join(' '),
    blankWordCount: hidden.reduce((n, p) => n + p.words.length, 0),
  };
}

/**
 * MODE 7 - next ayah.
 * Distractors come from ayat that *look like* the right answer: same page or
 * juz first, and openings that share the first word are preferred, because
 * those are exactly the confusions worth drilling.
 */
export function nextAyahDrill(repo, verseKey, { choices = 4, seed = 1 } = {}) {
  const next = repo.getNextAyah(verseKey);
  const current = repo.getAyah(verseKey);
  if (!next || !current) return null;

  const rand = seededRandom(`${verseKey}:next:${seed}`);
  const juz = repo.getJuz(current.juz);
  const neighbourhood = repo
    .getRangeByIndex(Math.max(juz.startIndex, current.index - 25), Math.min(juz.endIndex, current.index + 25))
    .filter((a) => a.verseKey !== next.verseKey && a.verseKey !== verseKey && a.wordCount > 1);

  const firstWordOf = (a) => normalize(repo.getAyahWords(a.verseKey)[0]?.text || '');
  const nextFirst = firstWordOf(next);

  const similarOpening = neighbourhood.filter((a) => firstWordOf(a) === nextFirst);
  const rest = neighbourhood.filter((a) => firstWordOf(a) !== nextFirst);
  const picked = [
    ...shuffle(similarOpening, rand).slice(0, choices - 1),
    ...shuffle(rest, rand),
  ].slice(0, choices - 1);

  return {
    mode: 'NEXT_AYAH',
    verseKey,
    prompt: current.text,
    answer: next.verseKey,
    options: shuffle(
      [next, ...picked].map((a) => ({ verseKey: a.verseKey, text: a.text })),
      rand,
    ),
  };
}

/**
 * MODE 3 - type from memory. The unit is a phrase (beginner) or a whole ayah.
 */
export function typingDrill(repo, verseKey, { unit = 'ayah', phraseIndex = 0 } = {}) {
  const ayah = repo.getAyah(verseKey);
  if (!ayah) return null;
  if (unit === 'ayah') {
    return { mode: 'TYPE_FROM_MEMORY', verseKey, expected: ayah.text, wordCount: ayah.wordCount };
  }
  const phrases = splitIntoPhrases(repo.getAyahWords(verseKey));
  const p = phrases[phraseIndex];
  if (!p) return null;
  return {
    mode: 'TYPE_FROM_MEMORY',
    verseKey,
    phraseIndex,
    phraseCount: phrases.length,
    expected: p.text,
    wordCount: p.words.length,
  };
}

/**
 * MODE 8 - mutashabihat.
 * Finds ayat elsewhere in the Qur'an that share a long opening or closing run
 * of words with the given ayah. This is a text-similarity search over the
 * canonical text, not a scholarly classification of mutashabihat.
 */
export function findSimilarAyat(repo, verseKey, { minRun = 3, limit = 5 } = {}) {
  const words = repo.getAyahWords(verseKey).map((w) => w.simple);
  if (words.length < minRun) return [];
  const opening = words.slice(0, minRun).join(' ');
  const closing = words.slice(-minRun).join(' ');

  const hits = [];
  for (let i = 0; i < repo.totalAyat && hits.length < limit * 4; i++) {
    const key = repo.keyAt(i);
    if (key === verseKey) continue;
    const other = repo.getAyahWords(key).map((w) => w.simple);
    if (other.length < minRun) continue;
    const otherOpening = other.slice(0, minRun).join(' ');
    const otherClosing = other.slice(-minRun).join(' ');
    if (otherOpening === opening) hits.push({ verseKey: key, relation: 'SIMILAR_OPENING' });
    else if (otherClosing === closing) hits.push({ verseKey: key, relation: 'SIMILAR_ENDING' });
  }
  return hits.slice(0, limit).map((h) => ({ ...h, text: repo.getAyah(h.verseKey).text }));
}
