import { describe, expect, test } from 'vitest';
import { normalize, normalizeStrict, wordsMatch } from '@/lib/quran/normalize';
import { compareRecitation, checkPhrase } from '@/lib/quran/compare';
import { getQuranRepository } from '@/lib/quran/local-repository';
import { splitIntoPhrases } from '@/lib/quran/phrases';
import { vanishingRounds, nextWordDrill, completeAyahDrill, nextAyahDrill, findSimilarAyat } from '@/lib/quran/drills';

const repo = getQuranRepository();

/** Pair up two space-separated passages word by word. */
const zip = (a, b) => a.split(' ').map((w, i) => [w, b.split(' ')[i]]);

describe('normalization', () => {
  test('strips harakat so a student need not type tashkeel', () => {
    // The dagger alif in al-'aalameen means the primary keys differ by design;
    // matching is defined over the accepted-spelling sets, not string equality.
    const canonical = repo.getAyah('1:2').text;
    expect(wordsMatch('رَبِّ', 'رب')).toBe(true);
    for (const [a, b] of zip(canonical, 'الحمد لله رب العالمين')) {
      expect(wordsMatch(a, b)).toBe(true);
    }
  });

  test('accepts the spellings students actually type for Uthmani long vowels', () => {
    // dagger alif written as a full alif
    expect(wordsMatch(repo.getWord('1:2', 4).text, 'العالمين')).toBe(true);
    // dagger alif not written at all (ar-Rahmaan)
    expect(wordsMatch(repo.getWord('1:1', 3).text, 'الرحمن')).toBe(true);
    // waw + dagger alif written as an alif (as-Salaah)
    expect(wordsMatch(repo.getWord('2:3', 5).text, 'الصلاة')).toBe(true);
    // and a genuinely different word is still a miss
    expect(wordsMatch(repo.getWord('1:2', 4).text, 'الناس')).toBe(false);
  });

  test('unifies alif wasla, hamza seats, alif maqsura and ta marbuta', () => {
    expect(normalize('ٱلله')).toBe(normalize('الله'));
    expect(normalize('إن')).toBe(normalize('ان'));
    expect(normalize('موسى')).toBe(normalize('موسي'));
    expect(normalize('رحمة')).toBe(normalize('رحمه'));
  });

  test('strict mode keeps harakat', () => {
    const canonical = repo.getAyah('1:2').text;
    expect(normalizeStrict(canonical)).not.toBe(normalizeStrict('الحمد لله رب العالمين'));
    expect(normalizeStrict(canonical)).toBe(normalizeStrict(canonical));
  });

  test('never returns a match for empty input', () => {
    expect(wordsMatch('', '')).toBe(false);
    expect(normalize('123 ...')).toBe('');
  });

  test('leaves the canonical text itself untouched', () => {
    // normalize() is only ever a comparison key - the source must be intact.
    const before = repo.getAyah('2:255').text;
    normalize(before);
    expect(repo.getAyah('2:255').text).toBe(before);
  });
});

describe('typed-answer scoring', () => {
  const canonical = repo.getAyah('1:2').text; // 4 words

  test('an exact answer scores 100', () => {
    const r = compareRecitation(canonical, canonical);
    expect(r.accuracy).toBe(100);
    expect(r.exact).toBe(true);
    expect(r.mistakes).toHaveLength(0);
  });

  test('an unvocalised but correct answer scores 100', () => {
    const r = compareRecitation(canonical, 'الحمد لله رب العالمين');
    expect(r.accuracy).toBe(100);
    expect(r.exact).toBe(true);
  });

  test('a missing word is reported at its canonical position', () => {
    const r = compareRecitation(canonical, 'الحمد لله العالمين');
    expect(r.correctCount).toBe(3);
    const miss = r.wordResults.find((w) => w.status === 'missing');
    expect(miss.position).toBe(3); // rabbi
    expect(r.mistakes).toEqual([{ wordPosition: 3, mistakeType: 'FORGOTTEN_WORD' }]);
  });

  test('a wrong word is reported as WRONG_WORD, not as a deletion', () => {
    const r = compareRecitation(canonical, 'الحمد لله ملك العالمين');
    const bad = r.wordResults.find((w) => w.status === 'incorrect');
    expect(bad.position).toBe(3);
    expect(bad.typed).toBe('ملك');
    expect(r.mistakes).toEqual([{ wordPosition: 3, mistakeType: 'WRONG_WORD' }]);
  });

  test('an added word is reported separately from the canonical words', () => {
    const r = compareRecitation(canonical, 'الحمد لله رب رب العالمين');
    expect(r.correctCount).toBe(4);
    expect(r.extras).toHaveLength(1);
    expect(r.exact).toBe(false);
    expect(r.mistakes.some((m) => m.mistakeType === 'ADDED_WORD')).toBe(true);
  });

  test('a swapped pair is reported as a word-order problem, not two omissions', () => {
    const r = compareRecitation(canonical, 'الحمد لله العالمين رب');
    const kinds = new Set(r.mistakes.map((m) => m.mistakeType));
    expect(kinds.has('WORD_ORDER')).toBe(true);
    expect(kinds.has('FORGOTTEN_WORD')).toBe(false);
  });

  test('an empty attempt scores 0 and flags every word', () => {
    const r = compareRecitation(canonical, '');
    expect(r.accuracy).toBe(0);
    expect(r.mistakes).toHaveLength(4);
  });

  test('scales to a long ayah', () => {
    const kursi = repo.getAyah('2:255').text;
    expect(compareRecitation(kursi, kursi).accuracy).toBe(100);
    const words = repo.getAyahWords('2:255').map((w) => w.text);
    words.splice(6, 1);
    const r = compareRecitation(kursi, words.join(' '));
    expect(r.correctCount).toBe(49);
    expect(r.mistakes).toEqual([{ wordPosition: 7, mistakeType: 'FORGOTTEN_WORD' }]);
  });

  test('word results stay in canonical order for highlighting', () => {
    const r = compareRecitation(canonical, 'الحمد ملك العالمين');
    expect(r.wordResults.map((w) => w.position)).toEqual([1, 2, 3, 4]);
  });

  test('checkPhrase short-circuits an exact phrase', () => {
    expect(checkPhrase('رب العالمين', 'رب العالمين').correct).toBe(true);
    expect(checkPhrase('رب العالمين', 'رب الناس').correct).toBe(false);
  });
});

describe('phrase segmentation', () => {
  test('short ayat stay whole', () => {
    const phrases = splitIntoPhrases(repo.getAyahWords('1:3')); // 2 words
    expect(phrases).toHaveLength(1);
  });

  test('phrases reassemble into the exact canonical ayah', () => {
    for (const key of ['1:2', '2:255', '36:1', '67:3', '78:1', '114:6']) {
      const phrases = splitIntoPhrases(repo.getAyahWords(key));
      expect(phrases.map((p) => p.text).join(' ')).toBe(repo.getAyah(key).text);
    }
  });

  test('no phrase is left dangling with a single word', () => {
    for (let i = 0; i < 500; i++) {
      const key = repo.keyAt(i);
      const phrases = splitIntoPhrases(repo.getAyahWords(key));
      if (phrases.length > 1) {
        expect(phrases.every((p) => p.words.length >= 2)).toBe(true);
      }
    }
  });

  test('positions are contiguous and 1-based', () => {
    const phrases = splitIntoPhrases(repo.getAyahWords('2:255'));
    expect(phrases[0].startPosition).toBe(1);
    for (let i = 1; i < phrases.length; i++) {
      expect(phrases[i].startPosition).toBe(phrases[i - 1].endPosition + 1);
    }
    expect(phrases[phrases.length - 1].endPosition).toBe(50);
  });
});

describe('drill generation', () => {
  test('vanishing rounds go 100% -> 0% and never un-hide a word', () => {
    const words = repo.getAyahWords('93:1');
    const rounds = vanishingRounds(words, { rounds: 5, seed: 3 });
    expect(rounds.map((r) => r.visiblePercent)).toEqual([100, 75, 50, 25, 0]);
    for (let i = 1; i < rounds.length; i++) {
      const prev = new Set(rounds[i - 1].hiddenPositions);
      for (const p of prev) expect(rounds[i].hiddenPositions).toContain(p);
    }
    expect(rounds[4].hiddenPositions).toHaveLength(words.length);
  });

  test('next-word options contain the answer and only real Qur’anic words', () => {
    const drill = nextWordDrill(repo, '2:255', 5, { seed: 9 });
    expect(drill.options).toContain(drill.answer);
    expect(new Set(drill.options).size).toBe(drill.options.length);
    expect(drill.answer).toBe(repo.getWord('2:255', 5).text);
    expect(drill.prompt.split(' ')).toHaveLength(4);
  });

  test('next-word refuses to ask for the first word of an ayah', () => {
    expect(nextWordDrill(repo, '2:255', 1)).toBeNull();
  });

  test('complete-the-ayah hides a real trailing phrase', () => {
    const drill = completeAyahDrill(repo, '2:255', { difficulty: 1 });
    expect(`${drill.prompt} ${drill.answer}`).toBe(repo.getAyah('2:255').text);
    expect(drill.blankWordCount).toBeGreaterThan(0);
  });

  test('harder difficulty hides more', () => {
    const easy = completeAyahDrill(repo, '2:255', { difficulty: 1 });
    const hard = completeAyahDrill(repo, '2:255', { difficulty: 3 });
    expect(hard.blankWordCount).toBeGreaterThan(easy.blankWordCount);
  });

  test('next-ayah answer is the true successor and distractors are real ayat', () => {
    const drill = nextAyahDrill(repo, '93:1', { seed: 4 });
    expect(drill.answer).toBe('93:2');
    expect(drill.options.map((o) => o.verseKey)).toContain('93:2');
    for (const o of drill.options) {
      expect(repo.getAyah(o.verseKey).text).toBe(o.text);
    }
    expect(drill.options).toHaveLength(4);
  });

  test('next-ayah never offers the prompt itself as an option', () => {
    const drill = nextAyahDrill(repo, '2:255', { seed: 2 });
    expect(drill.options.map((o) => o.verseKey)).not.toContain('2:255');
  });

  test('similar-ayah search finds genuine repeated openings', () => {
    // 55:13 "So which of the favours of your Lord will you deny" recurs 31x.
    const hits = findSimilarAyat(repo, '55:13', { minRun: 3, limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.verseKey).not.toBe('55:13');
      expect(repo.getAyah(h.verseKey)).not.toBeNull();
    }
  });
});
