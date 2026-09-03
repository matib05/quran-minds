/**
 * Arabic / Qur'anic text normalization.
 *
 * Used ONLY for comparing what a student produced against the canonical text.
 * The canonical Uthmani text is never rewritten by these functions - display
 * always uses the verified source text from lib/quran/data/uthmani.json.
 *
 * Every Arabic codepoint below is written as an ASCII \u escape on purpose:
 * combining marks are invisible in an editor, and a stray one inside a
 * character class is impossible to review.
 *
 * ## Why a word has more than one key
 *
 * Uthmani orthography and the modern spelling a student types on a phone
 * disagree about long vowels in a handful of systematic ways:
 *
 *   canonical                 student types      why
 *   ---------------------------------------------------------------------
 *   \u0627\u0644\u0639\u064e\u0640\u0670\u0644\u064e\u0645\u0650\u064a\u0646\u064e   ...\u0639\u0627\u0644\u0645\u064a\u0646     dagger alif = a written alif
 *   \u0627\u0644\u0631\u064e\u0651\u062d\u0652\u0645\u064e\u0640\u0670\u0646\u0650    ...\u0631\u062d\u0645\u0646        dagger alif = no alif at all
 *   \u0627\u0644\u0635\u064e\u0651\u0644\u064e\u0648\u0670\u0629\u064e     ...\u0635\u0644\u0627\u0629        waw + dagger alif = alif
 *
 * No single collapse handles all three, so each canonical word carries a small
 * set of acceptable keys and a match is a non-empty intersection. This is
 * generous about spelling and strict about memorization, which is the right
 * trade: we are testing whether the student knows the words, not whether they
 * can reproduce mushaf orthography on a touchscreen.
 */

const DAGGER_ALIF = '\u0670';
const ALIF = '\u0627';
const YA = '\u064a';
const HA = '\u0647';
const HAMZA = '\u0621';
const WAW = '\u0648';

// U+0610-061A  Qur'anic annotation signs
// U+064B-065F  tanwin, harakat, shadda, sukun, maddah, hamza above/below
// U+06D6-06ED  waqf marks and the Qur'anic small letters (small waw/yeh etc.)
// U+0670 is handled separately - see the variant rules above.
const DIACRITICS = new RegExp('[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]', 'g');

// U+0640 tatweel / kashida - a rendering filler, never meaningful for matching.
const TATWEEL = new RegExp('\u0640', 'g');

// Arabic number signs, end-of-ayah, rub-el-hizb, sajda sign, ligature honorifics.
const QURANIC_MARKS = new RegExp('[\u0600-\u0605\u06DD\u06DE\u06E9\uFDF0-\uFDFD]', 'g');

// After the passes above, anything that is not an Arabic letter or a space.
const NON_LETTER = new RegExp('[^\u0621-\u063A\u0641-\u064A\u0671-\u06D3 ]', 'g');

const ALIF_VARIANTS = new RegExp('[\u0622\u0623\u0625\u0627\u0671]', 'g');
const ALIF_MAQSURA = new RegExp('\u0649', 'g');
const TA_MARBUTA = new RegExp('\u0629', 'g');
const HAMZA_SEATS = new RegExp('[\u0624\u0626]', 'g'); // hamza on waw / on ya

const WAW_DAGGER = new RegExp('\u0648\u0670', 'g');
const YA_DAGGER = new RegExp('\u064a\u0670', 'g');
const DAGGER = new RegExp('\u0670', 'g');

/** Shared tail of every variant: unify letter shapes, drop everything else. */
function finish(text) {
  return text
    .replace(DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(QURANIC_MARKS, '')
    .replace(ALIF_VARIANTS, ALIF)
    .replace(ALIF_MAQSURA, YA)
    .replace(TA_MARBUTA, HA)
    .replace(HAMZA_SEATS, HAMZA)
    .replace(NON_LETTER, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Primary comparison key: dagger alif dropped, which is the spelling a student
 * sees in the mushaf letter-for-letter.
 */
export function normalize(text) {
  if (!text) return '';
  return finish(text.replace(DAGGER, ''));
}

/**
 * All spellings we accept for one word. Order is stable; index 0 is the
 * primary key used for grouping and caching.
 */
export function normalizeVariants(text) {
  if (!text) return [];
  const raw = String(text);
  const seen = new Set();
  const push = (v) => {
    const k = finish(v);
    if (k) seen.add(k);
  };
  push(raw.replace(DAGGER, ''));                       // \u0627\u0644\u0631\u062d\u0645\u0646
  push(raw.replace(DAGGER, ALIF));                     // \u0627\u0644\u0639\u0627\u0644\u0645\u064a\u0646
  if (WAW_DAGGER.test(raw)) {
    WAW_DAGGER.lastIndex = 0;
    push(raw.replace(WAW_DAGGER, ALIF));               // \u0627\u0644\u0635\u0644\u0627\u0629
  }
  WAW_DAGGER.lastIndex = 0;
  if (YA_DAGGER.test(raw)) {
    YA_DAGGER.lastIndex = 0;
    push(raw.replace(YA_DAGGER, ALIF));
  }
  YA_DAGGER.lastIndex = 0;
  return [...seen];
}

/**
 * Keeps harakat but strips ornamental marks and tatweel. Used when a school
 * configures strict (tashkeel-sensitive) grading.
 */
export function normalizeStrict(text) {
  if (!text) return '';
  return text
    .replace(TATWEEL, '')
    .replace(QURANIC_MARKS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split into words, dropping empties. */
export function words(text) {
  if (!text) return [];
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Word list with its accepted keys. `position` is the 1-based word position
 * within the ayah - the same value stored on every Mistake row.
 */
export function tokenize(text, { strict = false } = {}) {
  return words(text)
    .map((w, i) => ({
      position: i + 1,
      text: w,
      key: strict ? normalizeStrict(w) : normalize(w),
      keys: strict ? [normalizeStrict(w)].filter(Boolean) : normalizeVariants(w),
    }))
    .filter((w) => w.keys.length > 0);
}

/** True when two tokenized words share at least one accepted spelling. */
export function keysMatch(a, b) {
  for (const k of a) if (b.includes(k)) return true;
  return false;
}

/** True when two words match under the configured normalization. */
export function wordsMatch(a, b, { strict = false } = {}) {
  if (strict) {
    const na = normalizeStrict(a);
    return na.length > 0 && na === normalizeStrict(b);
  }
  return keysMatch(normalizeVariants(a), normalizeVariants(b));
}
