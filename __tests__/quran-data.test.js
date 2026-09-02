import { describe, expect, test } from 'vitest';
import { getQuranRepository } from '@/lib/quran/local-repository';
import meta from '@/lib/quran/data/meta.js';

const repo = getQuranRepository();

describe('dataset integrity', () => {
  test('contains the whole Qur’an', () => {
    expect(repo.totalAyat).toBe(6236);
    expect(repo.listSurahs()).toHaveLength(114);
    expect(repo.pageCount).toBe(604);
    expect(meta.juzStarts).toHaveLength(30);
    expect(meta.hizbQuarterStarts).toHaveLength(240);
    expect(meta.rukuStarts).toHaveLength(556);
    expect(meta.manzilStarts).toHaveLength(7);
    expect(meta.sajdas).toHaveLength(15);
  });

  test('every surah has its canonical ayah count', () => {
    // Spot checks across the mushaf, all well-known values.
    const expected = { 1: 7, 2: 286, 3: 200, 9: 129, 18: 110, 36: 83, 55: 78, 67: 30, 78: 40, 112: 4, 114: 6 };
    for (const [surah, count] of Object.entries(expected)) {
      expect(repo.getSurah(Number(surah)).ayahCount).toBe(count);
    }
  });

  test('no ayah is empty and every ayah has at least one word', () => {
    for (let i = 0; i < repo.totalAyat; i++) {
      const key = repo.keyAt(i);
      const ayah = repo.getAyah(key);
      expect(ayah.text.length).toBeGreaterThan(0);
      expect(ayah.wordCount).toBeGreaterThan(0);
    }
  });

  test('index <-> verse key round-trips for every ayah', () => {
    for (let i = 0; i < repo.totalAyat; i++) {
      expect(repo.indexOf(repo.keyAt(i))).toBe(i);
    }
  });

  test('rejects references that do not exist', () => {
    expect(repo.getAyah('2:287')).toBeNull(); // al-Baqarah has 286
    expect(repo.getAyah('115:1')).toBeNull();
    expect(repo.getAyah('nonsense')).toBeNull();
    expect(repo.getPage(605)).toBeNull();
    expect(repo.getJuz(31)).toBeNull();
  });
});

describe('structural lookups', () => {
  test('known juz boundaries', () => {
    expect(repo.getJuz(1).firstVerseKey).toBe('1:1');
    expect(repo.getJuz(29).firstVerseKey).toBe('67:1'); // Tabarak
    expect(repo.getJuz(30).firstVerseKey).toBe('78:1'); // 'Amma
    expect(repo.getJuz(30).lastVerseKey).toBe('114:6');
  });

  test('al-Faatiha is in juz 1, not juz 0', () => {
    // The juz column of resources/quran-text.txt says 0 here; metadata wins.
    expect(repo.getAyah('1:1').juz).toBe(1);
  });

  test('known mushaf pages', () => {
    expect(repo.getPage(1).firstVerseKey).toBe('1:1');
    expect(repo.getPage(2).firstVerseKey).toBe('2:1');
    expect(repo.getPage(604).lastVerseKey).toBe('114:6');
    expect(repo.pageOfKey('2:255')).toBe(42); // Ayat al-Kursi
  });

  test('pages tile the mushaf with no gaps or overlaps', () => {
    let expectedStart = 0;
    for (let p = 1; p <= repo.pageCount; p++) {
      const page = repo.getPage(p);
      expect(page.startIndex).toBe(expectedStart);
      expect(page.endIndex).toBeGreaterThanOrEqual(page.startIndex);
      expectedStart = page.endIndex + 1;
    }
    expect(expectedStart).toBe(6236);
  });

  test('neighbours cross surah boundaries correctly', () => {
    expect(repo.getNextAyah('1:7').verseKey).toBe('2:1');
    expect(repo.getPreviousAyah('2:1').verseKey).toBe('1:7');
    expect(repo.getNextAyah('114:6')).toBeNull();
    expect(repo.getPreviousAyah('1:1')).toBeNull();
  });

  test('ranges are inclusive and ordered', () => {
    const r = repo.getRange('2:255', '2:257');
    expect(r.map((a) => a.verseKey)).toEqual(['2:255', '2:256', '2:257']);
    expect(repo.countRange('2:255', '2:257')).toBe(3);
    expect(repo.countRange('78:1', '114:6')).toBe(564); // juz 'Amma
  });
});

describe('word addressing', () => {
  test('Ayat al-Kursi has 50 words', () => {
    expect(repo.getAyahWords('2:255')).toHaveLength(50);
  });

  test('word positions are 1-based and stable', () => {
    const words = repo.getAyahWords('1:2');
    expect(words[0].position).toBe(1);
    expect(repo.getWord('1:2', 1).text).toBe(words[0].text);
    expect(repo.getWord('1:2', 999)).toBeNull();
  });

  test('joining words reproduces the canonical text exactly', () => {
    for (const key of ['1:1', '2:255', '36:1', '67:3', '114:6']) {
      const joined = repo.getAyahWords(key).map((w) => w.text).join(' ');
      expect(joined).toBe(repo.getAyah(key).text);
    }
  });
});

describe('audio', () => {
  test('builds per-ayah recitation URLs', () => {
    expect(repo.getAudioUrl('2:255')).toBe('https://everyayah.com/data/Alafasy_128kbps/002255.mp3');
    expect(repo.getAudioUrl('bad')).toBeNull();
  });

  test('reports honestly that it has no word timestamps', () => {
    expect(repo.getWordTimestamps('2:255')).toBeNull();
  });
});
