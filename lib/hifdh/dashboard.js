import 'server-only';
import prisma from '@/lib/prisma';
import { getQuranRepository } from '@/lib/quran/local-repository';
import { assignmentTitle, assignmentSubtitle } from './assignments';
import { weaknessBand, parseWordRef } from './weakness';
import { streakFromDates } from './points';
import { startOfDay } from './scheduler';

const repo = getQuranRepository();
const DAY = 86400_000;

/**
 * Everything the teacher dashboard needs about one student, in one pass.
 *
 * The shape is driven by the question a teacher actually opens the app with:
 * "who do I need to do something about today?" - so every field here either
 * answers that or feeds a flag that does.
 */
export async function studentSnapshot(studentId, { days = 14 } = {}) {
  const since = new Date(Date.now() - days * DAY);
  const today = startOfDay();

  const [profile, assignments, sessions, lessons, weakest, mistakeCount, progressCounts, points] =
    await Promise.all([
      prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: { user: true, enrollments: { include: { class: true } } },
      }),
      prisma.assignment.findMany({
        where: { studentId, active: true },
        orderBy: { assignedFor: 'desc' },
      }),
      prisma.practiceSession.findMany({
        where: { studentId, startedAt: { gte: since } },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.teacherLesson.findMany({
        where: { studentId },
        include: { entries: true, teacher: { select: { name: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      }),
      prisma.weaknessScore.findMany({
        where: { studentId, level: { in: ['AYAH', 'WORD'] } },
        orderBy: { score: 'desc' },
        take: 12,
      }),
      prisma.mistake.count({ where: { studentId, resolved: false } }),
      prisma.ayahProgress.groupBy({
        by: ['state'],
        where: { studentId },
        _count: { _all: true },
      }),
      prisma.pointTransaction.aggregate({ where: { studentId }, _sum: { amount: true } }),
    ]);

  if (!profile) return null;

  return buildSnapshot({
    profile,
    assignments,
    sessions,
    lessons,
    weakest,
    openMistakes: mistakeCount,
    stateRows: progressCounts,
    pagesMemorized: await pagesMemorized(studentId),
    juzMemorized: await juzMemorized(studentId),
    points: points._sum.amount || 0,
    today,
  });
}

/**
 * Assemble one snapshot from already-fetched rows.
 *
 * Both entry points funnel through here so a single student's page and the
 * roster table can never drift apart on what "practised today" or "this week"
 * means - the only difference between them is how the rows were fetched.
 */
function buildSnapshot({
  profile,
  assignments,
  sessions,
  lessons,
  weakest,
  openMistakes,
  stateRows,
  pagesMemorized: pages,
  juzMemorized: juz,
  points,
  today,
}) {
  const current = {};
  for (const category of ['SABAQ', 'SABQI', 'MANZIL']) {
    const a = assignments.find((x) => x.category === category);
    current[category] = a
      ? { ...a, title: assignmentTitle(a), subtitle: assignmentSubtitle(a) }
      : null;
  }

  const dayOf = (d) => startOfDay(d).getTime();
  const practicedToday = sessions.some((s) => dayOf(s.startedAt) === today.getTime());
  const practicedYesterday = sessions.some((s) => dayOf(s.startedAt) === today.getTime() - DAY);

  const weekAgo = new Date(today.getTime() - 6 * DAY);
  const daysThisWeek = new Set(
    sessions.filter((s) => s.startedAt >= weekAgo).map((s) => dayOf(s.startedAt)),
  ).size;

  const avg = (key) => {
    const vals = sessions.map((s) => s[key]).filter((v) => v != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const stateCounts = Object.fromEntries(stateRows.map((r) => [r.state, r._count._all]));
  const trackedStates = new Set(['MEMORIZED', 'STRONG', 'NEEDS_REVISION', 'WEAK']);
  const ayatMemorized = stateRows
    .filter((r) => trackedStates.has(r.state))
    .reduce((n, r) => n + r._count._all, 0);

  const snapshot = {
    id: profile.id,
    name: profile.user.name,
    email: profile.user.email,
    classes: (profile.enrollments || []).map((e) => e.class),
    profile,

    assignments: current,

    practicedToday,
    practicedYesterday,
    daysThisWeek,
    streak: streakFromDates(sessions.map((s) => s.startedAt)),
    totalMinutes: Math.round(sessions.reduce((n, s) => n + s.activeSeconds, 0) / 60),
    lastSession: sessions[0] || null,
    minutesToday: Math.round(
      sessions
        .filter((s) => dayOf(s.startedAt) === today.getTime())
        .reduce((n, s) => n + s.activeSeconds, 0) / 60,
    ),

    sabaqAccuracy: avg('sabaqAccuracy'),
    sabqiAccuracy: avg('sabqiAccuracy'),
    manzilAccuracy: avg('manzilAccuracy'),

    lessons,
    lastLesson: lessons[0] || null,
    openMistakes,
    stateCounts,
    ayatMemorized,
    pagesMemorized: pages,
    juzMemorized: juz,
    points,

    weakSpots: weakest.map(decorateWeakness),
  };

  snapshot.flags = attentionFlags(snapshot, sessions);
  return snapshot;
}

/** Attach the human-readable Qur'an reference to a weakness row. */
export function decorateWeakness(row) {
  if (row.level === 'WORD') {
    const { verseKey, wordPosition } = parseWordRef(row.refKey);
    const word = repo.getWord(verseKey, wordPosition);
    const ayah = repo.getAyah(verseKey);
    return {
      ...row,
      band: weaknessBand(row.score),
      verseKey,
      wordPosition,
      text: word?.text ?? null,
      label: `${repo.getSurah(ayah.surah).nameTransliterated} ${ayah.ayah}, word ${wordPosition}`,
      page: ayah.page,
    };
  }
  if (row.level === 'AYAH') {
    const ayah = repo.getAyah(row.refKey);
    if (!ayah) return { ...row, band: weaknessBand(row.score), label: row.refKey };
    return {
      ...row,
      band: weaknessBand(row.score),
      verseKey: row.refKey,
      text: ayah.text,
      label: `${repo.getSurah(ayah.surah).nameTransliterated} ${ayah.ayah}`,
      page: ayah.page,
    };
  }
  if (row.level === 'PAGE') {
    const page = Number(row.refKey.slice(2));
    return { ...row, band: weaknessBand(row.score), page, label: `Page ${page}` };
  }
  if (row.level === 'JUZ') {
    return { ...row, band: weaknessBand(row.score), label: `Juz ${row.refKey.slice(2)}` };
  }
  const surah = repo.getSurah(Number(row.refKey.slice(2)));
  return { ...row, band: weaknessBand(row.score), label: surah ? `Surah ${surah.nameTransliterated}` : row.refKey };
}

/**
 * The "needs attention" logic. Each flag names a specific thing the teacher can
 * act on today; nothing here is a generic "low score" warning.
 */
export function attentionFlags(s, sessions) {
  const flags = [];

  if (!s.practicedToday && !s.practicedYesterday) {
    flags.push({ level: 'high', code: 'NO_PRACTICE', label: 'No practice yesterday or today' });
  } else if (!s.practicedToday) {
    flags.push({ level: 'low', code: 'NOT_YET_TODAY', label: 'Has not practised yet today' });
  }

  // Only a genuinely HIGH weakness earns the teacher's attention here: a
  // handful of scattered slips across a page is normal practice, not a
  // problem, and flagging those would make the column meaningless.
  const repeated = s.weakSpots.filter(
    (w) => w.level === 'AYAH' && w.band === 'HIGH' && w.mistakeCount >= 3,
  );
  if (repeated.length) {
    flags.push({
      level: 'high',
      code: 'REPEATED_MISTAKE',
      label: `Missed ${repeated[0].label} ${repeated[0].mistakeCount} times`,
    });
  }

  // Manzil sliding across the three most recent sessions that recorded it.
  const manzil = sessions.filter((x) => x.manzilAccuracy != null).slice(0, 3);
  if (manzil.length === 3 && manzil[0].manzilAccuracy < manzil[1].manzilAccuracy && manzil[1].manzilAccuracy < manzil[2].manzilAccuracy) {
    flags.push({
      level: 'high',
      code: 'MANZIL_SLIPPING',
      label: `Manzil accuracy falling (${manzil[2].manzilAccuracy}% → ${manzil[0].manzilAccuracy}%)`,
    });
  }

  const lastEntries = s.lastLesson?.entries || [];
  const sabaq = lastEntries.find((e) => e.category === 'SABAQ');
  if (sabaq && sabaq.status === 'INCOMPLETE') {
    flags.push({ level: 'medium', code: 'SABAQ_INCOMPLETE', label: 'Last Sabaq was incomplete' });
  }
  if (lastEntries.some((e) => e.rating === 'REPEAT_TOMORROW')) {
    flags.push({ level: 'medium', code: 'REPEAT', label: 'Marked to repeat' });
  }
  if (s.sabqiAccuracy != null && s.sabqiAccuracy < 80) {
    flags.push({ level: 'medium', code: 'SABQI_LOW', label: `Sabqi averaging ${s.sabqiAccuracy}%` });
  }

  if (!flags.length && s.daysThisWeek >= 5 && (s.sabaqAccuracy ?? 0) >= 90) {
    flags.push({ level: 'good', code: 'STRONG_WEEK', label: 'Strong week' });
  }
  return flags;
}

/** A page counts as memorized when every ayah on it is. */
export async function pagesMemorized(studentId) {
  const rows = await prisma.ayahProgress.groupBy({
    by: ['page'],
    where: { studentId, state: { in: ['MEMORIZED', 'STRONG', 'NEEDS_REVISION'] } },
    _count: { _all: true },
  });
  let complete = 0;
  for (const row of rows) {
    const page = repo.getPage(row.page);
    if (page && row._count._all >= page.ayat.length) complete += 1;
  }
  return complete;
}

export async function juzMemorized(studentId) {
  const rows = await prisma.ayahProgress.groupBy({
    by: ['juz'],
    where: { studentId, state: { in: ['MEMORIZED', 'STRONG', 'NEEDS_REVISION'] } },
    _count: { _all: true },
  });
  let complete = 0;
  for (const row of rows) {
    const juz = repo.getJuz(row.juz);
    if (juz && row._count._all >= juz.ayahCount) complete += 1;
  }
  return complete;
}

/**
 * Compact rows for the dashboard table - cheaper than a full snapshot per
 * student, and still enough to compute every attention flag.
 */
export async function rosterSnapshots(students, { days = 14 } = {}) {
  const ids = students.map((s) => s.id);
  if (!ids.length) return [];

  const since = new Date(Date.now() - days * DAY);
  const today = startOfDay();

  // Nine queries for the whole roster, not ten per student. The per-student
  // version fired ~60 concurrent queries for a class of six, which saturates
  // Prisma's connection pool and surfaces as "Timed out fetching a new
  // connection" on whatever request happens to arrive next - including a login.
  const [assignments, sessions, lessons, weakness, openMistakes, stateCounts, pageCounts, juzCounts, points] =
    await Promise.all([
      prisma.assignment.findMany({
        where: { studentId: { in: ids }, active: true },
        orderBy: { assignedFor: 'desc' },
      }),
      prisma.practiceSession.findMany({
        where: { studentId: { in: ids }, startedAt: { gte: since } },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.teacherLesson.findMany({
        where: { studentId: { in: ids } },
        include: { entries: true, teacher: { select: { name: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.weaknessScore.findMany({
        where: { studentId: { in: ids }, level: { in: ['AYAH', 'WORD'] } },
        orderBy: { score: 'desc' },
      }),
      prisma.mistake.groupBy({
        by: ['studentId'],
        where: { studentId: { in: ids }, resolved: false },
        _count: { _all: true },
      }),
      prisma.ayahProgress.groupBy({
        by: ['studentId', 'state'],
        where: { studentId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.ayahProgress.groupBy({
        by: ['studentId', 'page'],
        where: { studentId: { in: ids }, state: { in: MEMORIZED_STATES } },
        _count: { _all: true },
      }),
      prisma.ayahProgress.groupBy({
        by: ['studentId', 'juz'],
        where: { studentId: { in: ids }, state: { in: MEMORIZED_STATES } },
        _count: { _all: true },
      }),
      prisma.pointTransaction.groupBy({
        by: ['studentId'],
        _sum: { amount: true },
        where: { studentId: { in: ids } },
      }),
    ]);

  const byStudent = (rows) => {
    const map = new Map(ids.map((id) => [id, []]));
    for (const row of rows) map.get(row.studentId)?.push(row);
    return map;
  };

  const assignmentsBy = byStudent(assignments);
  const sessionsBy = byStudent(sessions);
  const lessonsBy = byStudent(lessons);
  const weaknessBy = byStudent(weakness);
  const stateBy = byStudent(stateCounts);
  const pagesBy = byStudent(pageCounts);
  const juzBy = byStudent(juzCounts);
  const openBy = new Map(openMistakes.map((r) => [r.studentId, r._count._all]));
  const pointsBy = new Map(points.map((r) => [r.studentId, r._sum.amount || 0]));

  return students.map((student) => {
    const mine = sessionsBy.get(student.id) || [];
    const snapshot = buildSnapshot({
      profile: student,
      assignments: assignmentsBy.get(student.id) || [],
      sessions: mine,
      lessons: (lessonsBy.get(student.id) || []).slice(0, 10),
      weakest: (weaknessBy.get(student.id) || []).slice(0, 12),
      openMistakes: openBy.get(student.id) || 0,
      stateRows: stateBy.get(student.id) || [],
      pagesMemorized: countCompletePages(pagesBy.get(student.id) || []),
      juzMemorized: countCompleteJuz(juzBy.get(student.id) || []),
      points: pointsBy.get(student.id) || 0,
      today,
    });
    return snapshot;
  });
}

const MEMORIZED_STATES = ['MEMORIZED', 'STRONG', 'NEEDS_REVISION'];

function countCompletePages(rows) {
  let complete = 0;
  for (const row of rows) {
    const page = repo.getPage(row.page);
    if (page && row._count._all >= page.ayat.length) complete += 1;
  }
  return complete;
}

function countCompleteJuz(rows) {
  let complete = 0;
  for (const row of rows) {
    const juz = repo.getJuz(row.juz);
    if (juz && row._count._all >= juz.ayahCount) complete += 1;
  }
  return complete;
}
