/**
 * Phrase segmentation for the memorization assistant.
 *
 * IMPORTANT: these boundaries are a *pedagogical convenience* for breaking an
 * ayah into learnable chunks. They are NOT waqf (pause) rulings. The Tanzil
 * Uthmani-minimal text carries no waqf marks, and this module does not invent
 * them. The UI must never present a phrase boundary as a place it is correct
 * to stop reciting.
 *
 * The heuristic is deliberately simple and explainable:
 *   1. take roughly `target` words at a time;
 *   2. never end a chunk on a word that grammatically binds to what follows
 *      (prepositions, particles like inna / an / maa);
 *   3. prefer to start a chunk on a word carrying the wa- / fa- prefix, which
 *      in practice opens a new clause;
 *   4. never leave a one-word chunk dangling at the end.
 */
import { normalize } from './normalize.js';

/** Particles and prepositions that must not be the last word of a phrase. */
const BINDERS = new Set(
  [
    'من', 'في', 'على', 'الي', 'عن', 'مع', 'عند', 'بين', 'بعد', 'قبل', 'دون',
    'ان', 'انه', 'ما', 'لا', 'ثم', 'بل', 'قد', 'لم', 'لن', 'يا', 'ذو', 'ذا',
    'هل', 'او', 'ام', 'كل', 'غير', 'حتي', 'اذ', 'اذا', 'لو', 'كي', 'اي',
    'الذي', 'التي', 'الذين', 'هذا', 'هذه', 'ذلك', 'تلك', 'كان', 'كانوا',
    'قال', 'قالوا', 'يا', 'اي', 'رب', 'الا', 'وان', 'ولا', 'وما',
  ].map(normalize),
);

/** A word that tends to open a clause: wa-, fa-, thumma. */
function opensClause(word) {
  const w = normalize(word);
  return w.length > 2 && (w.startsWith('و') || w.startsWith('ف'));
}

function isBinder(word) {
  return BINDERS.has(normalize(word));
}

/**
 * Split an ayah's words into phrases.
 *
 * @param {{position:number,text:string}[]} words from QuranRepository.getAyahWords
 * @param {{target?:number, min?:number, max?:number}} options
 * @returns {{index:number, text:string, words:object[], startPosition:number, endPosition:number}[]}
 */
export function splitIntoPhrases(words, { target = 4, min = 2, max = 7 } = {}) {
  if (!Array.isArray(words) || words.length === 0) return [];
  if (words.length <= min) {
    return [makePhrase(0, words)];
  }

  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const remaining = words.length - i;
    if (remaining <= max && remaining <= target + 2) {
      chunks.push(words.slice(i));
      break;
    }

    let end = Math.min(i + target, words.length); // exclusive
    // Prefer a boundary where the next word opens a clause, within +/-1.
    const candidates = [end, end + 1, end - 1].filter(
      (e) => e > i + min - 1 && e < words.length && e - i <= max,
    );
    let chosen = end;
    for (const c of candidates) {
      if (opensClause(words[c].text) && !isBinder(words[c - 1].text)) {
        chosen = c;
        break;
      }
    }
    // Never end on a binding particle - pull the next word in.
    let guard = 0;
    while (chosen < words.length && isBinder(words[chosen - 1].text) && chosen - i < max && guard++ < max) {
      chosen++;
    }
    chunks.push(words.slice(i, chosen));
    i = chosen;
  }

  // A trailing single word is not a phrase - fold it back.
  if (chunks.length > 1 && chunks[chunks.length - 1].length === 1) {
    const tail = chunks.pop();
    chunks[chunks.length - 1] = chunks[chunks.length - 1].concat(tail);
  }

  return chunks.map((c, idx) => makePhrase(idx, c));
}

function makePhrase(index, words) {
  return {
    index,
    words,
    text: words.map((w) => w.text).join(' '),
    startPosition: words[0].position,
    endPosition: words[words.length - 1].position,
  };
}

/**
 * Phrases for a whole assignment: a flat, ordered list across several ayat,
 * each tagged with the verse it came from.
 */
export function phrasesForAyat(ayat, repo, options) {
  const out = [];
  for (const ayah of ayat) {
    const phrases = splitIntoPhrases(repo.getAyahWords(ayah.verseKey), options);
    for (const p of phrases) {
      out.push({ ...p, index: out.length, verseKey: ayah.verseKey });
    }
  }
  return out;
}
