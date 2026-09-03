import { describe, expect, test } from 'vitest';
import {
  computeWeaknessScores,
  mistakeWeight,
  weaknessBand,
  recencyFactor,
  parseWordRef,
} from '@/lib/hifdh/weakness';
import { nextSchedule, groupIntoRuns, INTERVALS, PASS_THRESHOLD } from '@/lib/hifdh/scheduler';
import { pointsForSession, accuracyBonus, streakFromDates } from '@/lib/hifdh/points';
import { resolveAssignment, suggestSabqiRange, describeRange, assignmentTitle } from '@/lib/hifdh/assignments';
import { getQuranRepository } from '@/lib/quran/local-repository';

const repo = getQuranRepository();
const NOW = new Date('2026-09-02T09:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 86400_000);

const mistake = (over = {}) => ({
  verseKey: '67:3',
  wordPosition: 6,
  mistakeType: 'FORGOTTEN_WORD',
  source: 'TEACHER',
  page: 562,
  juz: 29,
  resolved: false,
  createdAt: daysAgo(0),
  ...over,
});

describe('weakness scoring', () => {
  test('a recent teacher-observed omission carries full weight', () => {
    expect(mistakeWeight(mistake(), NOW)).toBeCloseTo(1, 3);
  });

  test('weight halves every two weeks', () => {
    expect(recencyFactor(daysAgo(14), NOW)).toBeCloseTo(0.5, 3);
    expect(recencyFactor(daysAgo(28), NOW)).toBeCloseTo(0.25, 3);
  });

  test('a teacher-heard mistake outweighs the same mistake from a typing drill', () => {
    const byTeacher = mistakeWeight(mistake({ source: 'TEACHER' }), NOW);
    const byTyping = mistakeWeight(mistake({ source: 'TYPING' }), NOW);
    const byAsr = mistakeWeight(mistake({ source: 'RECITATION' }), NOW);
    expect(byTeacher).toBeGreaterThan(byTyping);
    expect(byTyping).toBeGreaterThan(byAsr);
  });

  test('a resolved mistake still counts, but much less', () => {
    const open = mistakeWeight(mistake({ resolved: false }), NOW);
    const fixed = mistakeWeight(mistake({ resolved: true }), NOW);
    expect(fixed).toBeGreaterThan(0);
    expect(fixed).toBeLessThan(open / 2);
  });

  test('tajwid weighs less than a forgotten word', () => {
    expect(mistakeWeight(mistake({ mistakeType: 'TAJWID' }), NOW))
      .toBeLessThan(mistakeWeight(mistake({ mistakeType: 'FORGOTTEN_WORD' }), NOW));
  });

  test('one mistake rolls up to every level', () => {
    const rows = computeWeaknessScores([mistake()], [], NOW);
    const levels = Object.fromEntries(rows.map((r) => [r.level, r]));
    expect(levels.WORD.refKey).toBe('67:3#6');
    expect(levels.AYAH.refKey).toBe('67:3');
    expect(levels.PAGE.refKey).toBe('p:562');
    expect(levels.SURAH.refKey).toBe('s:67');
    expect(levels.JUZ.refKey).toBe('j:29');
    for (const r of rows) expect(r.mistakeCount).toBe(1);
  });

  test('the repeatedly-missed word ranks above a one-off', () => {
    const rows = computeWeaknessScores(
      [
        mistake({ createdAt: daysAgo(0) }),
        mistake({ createdAt: daysAgo(2) }),
        mistake({ createdAt: daysAgo(5) }),
        mistake({ createdAt: daysAgo(9) }),
        mistake({ verseKey: '78:24', wordPosition: 3, page: 583, createdAt: daysAgo(1) }),
      ],
      [],
      NOW,
    );
    const words = rows.filter((r) => r.level === 'WORD').sort((a, b) => b.score - a.score);
    expect(words[0].refKey).toBe('67:3#6');
    expect(words[0].mistakeCount).toBe(4);
    expect(weaknessBand(words[0].score)).toBe('HIGH');
    expect(weaknessBand(words[1].score)).toBe('LOW');
  });

  test('an old mistake decays out of the high band', () => {
    const rows = computeWeaknessScores([mistake({ createdAt: daysAgo(90) })], [], NOW);
    expect(weaknessBand(rows.find((r) => r.level === 'AYAH').score)).toBe('NONE');
  });

  test('failed recall attempts count as evidence at ayah level', () => {
    const rows = computeWeaknessScores([], [{ verseKey: '2:286', createdAt: daysAgo(1) }], NOW);
    const ayah = rows.find((r) => r.level === 'AYAH');
    expect(ayah.refKey).toBe('2:286');
    expect(ayah.score).toBeGreaterThan(0);
  });

  test('word refs round-trip', () => {
    expect(parseWordRef('67:3#6')).toEqual({ verseKey: '67:3', wordPosition: 6 });
  });
});

describe('revision scheduling', () => {
  const fresh = { intervalDays: 1, consecutiveSuccess: 0, state: 'NOT_STARTED', reviewCount: 0 };

  test('the ladder is 1 -> 3 -> 7 -> 14 days on consecutive successes', () => {
    let p = fresh;
    const seen = [];
    for (let i = 0; i < 4; i++) {
      p = nextSchedule(p, 95, new Date(NOW));
      seen.push(p.intervalDays);
    }
    expect(seen).toEqual([1, 3, 7, 14]);
    expect(INTERVALS.slice(0, 4)).toEqual([1, 3, 7, 14]);
  });

  test('a weak ayah comes back tomorrow', () => {
    const p = nextSchedule({ ...fresh, consecutiveSuccess: 3, intervalDays: 7 }, 40, new Date(NOW));
    expect(p.intervalDays).toBe(1);
    expect(p.consecutiveSuccess).toBe(0);
    expect(p.state).toBe('WEAK');
  });

  test('a near-miss is flagged for revision, not marked weak', () => {
    expect(nextSchedule(fresh, 80, new Date(NOW)).state).toBe('NEEDS_REVISION');
    expect(PASS_THRESHOLD).toBe(85);
  });

  test('one good recall is not called mastery', () => {
    expect(nextSchedule(fresh, 100, new Date(NOW)).state).toBe('LEARNING');
    let p = nextSchedule(fresh, 100, new Date(NOW));
    p = nextSchedule(p, 100, new Date(NOW));
    expect(p.state).toBe('MEMORIZED');
    p = nextSchedule(p, 100, new Date(NOW));
    p = nextSchedule(p, 100, new Date(NOW));
    expect(p.state).toBe('STRONG');
  });

  test('next review lands on a future day', () => {
    const p = nextSchedule(fresh, 95, new Date(NOW));
    expect(p.nextReviewAt.getTime()).toBeGreaterThan(NOW - 86400_000);
  });

  test('scattered due ayat are regrouped into contiguous passages', () => {
    const runs = groupIntoRuns(['67:3', '67:1', '67:2', '78:24', '2:255'], repo);
    expect(runs).toEqual([
      { fromVerseKey: '2:255', toVerseKey: '2:255', count: 1 },
      { fromVerseKey: '67:1', toVerseKey: '67:3', count: 3 },
      { fromVerseKey: '78:24', toVerseKey: '78:24', count: 1 },
    ]);
  });

  test('runs join across a surah boundary when the ayat really are adjacent', () => {
    expect(groupIntoRuns(['1:7', '2:1'], repo)).toEqual([
      { fromVerseKey: '1:7', toVerseKey: '2:1', count: 2 },
    ]);
  });
});

describe('points', () => {
  test('finishing all three portions beats a long unfocused session', () => {
    const full = pointsForSession({
      sabaqComplete: true, sabqiComplete: true, manzilComplete: true,
      metDailyGoal: true, averageAccuracy: 92,
    });
    expect(full.reduce((n, t) => n + t.amount, 0)).toBe(30 + 20 + 20 + 10 + 7);
  });

  test('no award exists for time spent', () => {
    const nothingDone = pointsForSession({
      sabaqComplete: false, sabqiComplete: false, manzilComplete: false,
      metDailyGoal: false, averageAccuracy: 0,
    });
    expect(nothingDone).toEqual([]);
  });

  test('accuracy bonus only rewards genuine precision', () => {
    expect(accuracyBonus(69)).toBe(0);
    expect(accuracyBonus(70)).toBe(0);
    expect(accuracyBonus(85)).toBe(5);
    expect(accuracyBonus(100)).toBe(10);
  });

  test('fixing a weak ayah is worth more than showing up', () => {
    const fixed = pointsForSession({ weakSpotsFixed: 1 })[0];
    expect(fixed.amount).toBeGreaterThan(10);
  });

  test('streak counts back from today', () => {
    const today = new Date('2026-09-02T20:00:00');
    const d = (n) => new Date(`2026-09-0${n}T10:00:00`);
    expect(streakFromDates([d(2), d(1)], today)).toBe(2);
    expect(streakFromDates([d(1)], today)).toBe(1); // yesterday only - not lost yet
    expect(streakFromDates([], today)).toBe(0);
    expect(streakFromDates([d(3), d(2), d(1)], today)).toBe(2); // future date ignored
  });
});

describe('assignment resolution', () => {
  test('a page range resolves to a real verse range', () => {
    const r = resolveAssignment({ scope: 'PAGE_RANGE', pageStart: 1, pageEnd: 1 });
    expect(r.fromVerseKey).toBe('1:1');
    expect(r.toVerseKey).toBe('1:7');
    expect(r.ayahCount).toBe(7);
  });

  test('juz 30 resolves to An-Naba 1 through An-Nas 6', () => {
    const r = resolveAssignment({ scope: 'JUZ', juzNumber: 30 });
    expect(r.fromVerseKey).toBe('78:1');
    expect(r.toVerseKey).toBe('114:6');
    expect(r.ayahCount).toBe(564);
    expect(r.pageStart).toBe(582);
    expect(r.pageEnd).toBe(604);
  });

  test('a surah resolves to its whole span', () => {
    const r = resolveAssignment({ scope: 'SURAH', surahNumber: 67 });
    expect(r.fromVerseKey).toBe('67:1');
    expect(r.toVerseKey).toBe('67:30');
  });

  test('bad references are rejected rather than silently clamped', () => {
    expect(() => resolveAssignment({ scope: 'PAGE_RANGE', pageStart: 700 })).toThrow();
    expect(() => resolveAssignment({ scope: 'JUZ', juzNumber: 31 })).toThrow();
    expect(() => resolveAssignment({ scope: 'AYAH_RANGE', fromVerseKey: '2:300', toVerseKey: '2:301' })).toThrow();
    expect(() =>
      resolveAssignment({ scope: 'AYAH_RANGE', fromVerseKey: '2:10', toVerseKey: '2:5' }),
    ).toThrow(/end of the range/i);
  });

  test('Sabqi defaults to the pages just behind Sabaq', () => {
    const s = suggestSabqiRange(repo.getPage(76).firstVerseKey, 5);
    expect(s.pageStart).toBe(71);
    expect(s.pageEnd).toBe(75);
    expect(s.label).toBe('Pages 71-75');
  });

  test('Sabqi suggestion is honest at the very start of the mushaf', () => {
    expect(suggestSabqiRange('1:1', 5).pageStart).toBe(1);
  });

  test('labels read the way a teacher writes them', () => {
    expect(describeRange('2:255', '2:257')).toBe('Al-Baqara 255-257');
    expect(describeRange('114:1', '114:6')).toBe('An-Naas 1-6');
    expect(assignmentTitle({ scope: 'PAGE_RANGE', pageStart: 76, pageEnd: 76, lineStart: 1, lineEnd: 8 }))
      .toBe('Page 76, lines 1-8');
    expect(assignmentTitle({ scope: 'JUZ', juzNumber: 30 })).toBe('Juz 30');
  });
});
