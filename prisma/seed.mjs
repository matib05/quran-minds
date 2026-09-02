/**
 * Demo data for Quran Minds.
 *
 * Builds one small Hifdh department with three weeks of plausible history:
 * lessons a teacher actually recorded, practice a student actually did, and
 * mistakes that recur in the way real mistakes recur. The dashboards are only
 * worth looking at if the data underneath them has shape.
 *
 * Run with:  npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth/password.js';
import { getQuranRepository } from '../lib/quran/local-repository.js';
import { resolveAssignment, suggestSabqiRange } from '../lib/hifdh/assignments.js';
import { computeWeaknessScores } from '../lib/hifdh/weakness.js';
import { nextSchedule } from '../lib/hifdh/scheduler.js';

const prisma = new PrismaClient();
const repo = getQuranRepository();

const DAY = 86400_000;
const TODAY = startOfDay(new Date());

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function daysAgo(n, hour = 17) {
  const d = new Date(TODAY.getTime() - n * DAY);
  d.setHours(hour, Math.floor(seededPick(n * 7, 60)), 0, 0);
  return d;
}
/** Small deterministic helper so re-seeding produces the same demo. */
function seededPick(seed, max) {
  let s = (seed * 2654435761) >>> 0;
  s ^= s << 13; s >>>= 0;
  s ^= s >> 17;
  s ^= s << 5; s >>>= 0;
  return (s / 4294967296) * max;
}
const pick = (seed, arr) => arr[Math.floor(seededPick(seed, arr.length))];

async function reset() {
  // Order matters only where cascades do not cover it.
  await prisma.$transaction([
    prisma.pointTransaction.deleteMany(),
    prisma.achievement.deleteMany(),
    prisma.weaknessScore.deleteMany(),
    prisma.ayahProgress.deleteMany(),
    prisma.practiceAttempt.deleteMany(),
    prisma.mistake.deleteMany(),
    prisma.practiceSession.deleteMany(),
    prisma.lessonEntry.deleteMany(),
    prisma.teacherLesson.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.parentLink.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.studentProfile.deleteMany(),
    prisma.classTeacher.deleteMany(),
    prisma.class.deleteMany(),
    prisma.program.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.school.deleteMany(),
  ]);
}

async function main() {
  console.log('Resetting demo data...');
  await reset();

  const password = await hashPassword('Password123');

  const school = await prisma.school.create({
    data: {
      name: 'Al-Furqan Academy',
      slug: 'al-furqan',
      timezone: 'America/New_York',
      settings: { gamificationDefault: true },
    },
  });

  const mkUser = (email, name, role) =>
    prisma.user.create({ data: { email, name, role, passwordHash: password, schoolId: school.id } });

  const admin = await mkUser('admin@quranminds.app', 'Sr. Khadijah Rahman', 'ADMIN');
  const ustadhYusuf = await mkUser('yusuf@quranminds.app', 'Ustadh Yusuf Adam', 'TEACHER');
  const ustadhaAmina = await mkUser('amina@quranminds.app', 'Ustadha Amina Farouk', 'TEACHER');

  const program = await prisma.program.create({ data: { schoolId: school.id, name: 'Full-time Hifdh' } });
  const level2 = await prisma.class.create({
    data: { schoolId: school.id, programId: program.id, name: 'Hifdh Level 2' },
  });
  const level3 = await prisma.class.create({
    data: { schoolId: school.id, programId: program.id, name: 'Hifdh Level 3' },
  });

  await prisma.classTeacher.createMany({
    data: [
      { classId: level2.id, teacherId: ustadhYusuf.id },
      { classId: level3.id, teacherId: ustadhYusuf.id },
      // A student may have more than one teacher.
      { classId: level2.id, teacherId: ustadhaAmina.id },
    ],
  });

  // ---------------------------------------------------------------- students
  //
  // Each student is written to demonstrate a different thing the dashboard has
  // to surface, so the "needs attention" column is not decorative.
  const roster = [
    {
      email: 'ahmad@quranminds.app', name: 'Ahmad Yusuf', klass: level2,
      sabaqPage: 76, manzilJuz: 30, dailyGoal: 25,
      // The scenario from the product brief: strong, consistent, one stubborn word.
      story: 'consistent', practiceDays: [0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14],
      recurring: [{ verseKey: '67:3', wordPosition: 6, on: [1, 4, 8, 13] }],
    },
    {
      email: 'maryam@quranminds.app', name: 'Maryam Siddiqui', klass: level2,
      sabaqPage: 108, manzilJuz: 29, dailyGoal: 20,
      // Repeatedly misses the ending of one ayah - a targeted-drill case.
      story: 'endings', practiceDays: [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13],
      recurring: [{ verseKey: '78:24', wordPosition: 3, on: [2, 5, 9, 12], type: 'ENDING_ERROR' }],
    },
    {
      email: 'bilal@quranminds.app', name: 'Bilal Osman', klass: level2,
      sabaqPage: 47, manzilJuz: 28, dailyGoal: 20,
      // Stopped practising four days ago - the "did not practise" flag.
      story: 'lapsed', practiceDays: [5, 6, 7, 9, 10, 11, 13, 14],
      recurring: [{ verseKey: '2:286', wordPosition: 12, on: [6, 10] }],
    },
    {
      email: 'zaynab@quranminds.app', name: 'Zaynab Ali', klass: level3,
      sabaqPage: 205, manzilJuz: 26, dailyGoal: 30,
      // Manzil accuracy sliding across three sessions.
      story: 'manzil-slipping', practiceDays: [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 14],
      recurring: [{ verseKey: '39:53', wordPosition: 8, on: [0, 2, 5] }],
    },
    {
      email: 'ibrahim@quranminds.app', name: 'Ibrahim Khan', klass: level3,
      sabaqPage: 312, manzilJuz: 22, dailyGoal: 30,
      story: 'strong', practiceDays: Array.from({ length: 15 }, (_, i) => i),
      recurring: [],
    },
    {
      email: 'fatimah@quranminds.app', name: 'Fatimah Noor', klass: level3,
      sabaqPage: 21, manzilJuz: 1, dailyGoal: 15,
      // Newest student - little history, still LEARNING.
      story: 'beginner', practiceDays: [0, 1, 3, 4, 6],
      recurring: [{ verseKey: '2:127', wordPosition: 4, on: [1, 4] }],
    },
  ];

  const parent = await mkUser('parent@quranminds.app', 'Br. Yusuf Adnan', 'PARENT');

  const students = [];
  for (const [i, r] of roster.entries()) {
    const user = await mkUser(r.email, r.name, 'STUDENT');
    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        schoolId: school.id,
        sabqiWindowPages: 5,
        repetitionTarget: 5,
        dailyGoalMinutes: r.dailyGoal,
        gamificationOn: r.story !== 'strong' ? true : true,
      },
    });
    await prisma.enrollment.create({ data: { classId: r.klass.id, studentId: profile.id } });
    students.push({ ...r, user, profile, seed: i + 1 });
  }

  await prisma.parentLink.createMany({
    data: [
      { parentId: parent.id, studentId: students[0].profile.id, relation: 'father' },
      { parentId: parent.id, studentId: students[5].profile.id, relation: 'father' },
    ],
  });

  // ------------------------------------------------------------- assignments
  for (const s of students) {
    const sabaq = resolveAssignment({ scope: 'PAGE_RANGE', pageStart: s.sabaqPage, pageEnd: s.sabaqPage });
    const sabqi = suggestSabqiRange(sabaq.fromVerseKey, 5);
    const manzil = resolveAssignment({ scope: 'JUZ', juzNumber: s.manzilJuz });

    await prisma.assignment.createMany({
      data: [
        {
          studentId: s.profile.id, teacherId: ustadhYusuf.id, category: 'SABAQ', scope: 'PAGE_RANGE',
          fromVerseKey: sabaq.fromVerseKey, toVerseKey: sabaq.toVerseKey, ayahCount: sabaq.ayahCount,
          pageStart: sabaq.pageStart, pageEnd: sabaq.pageEnd, lineStart: 1, lineEnd: 8,
          assignedFor: TODAY, notes: null,
        },
        {
          studentId: s.profile.id, teacherId: ustadhYusuf.id, category: 'SABQI', scope: 'PAGE_RANGE',
          fromVerseKey: sabqi.fromVerseKey, toVerseKey: sabqi.toVerseKey, ayahCount: sabqi.ayahCount,
          pageStart: sabqi.pageStart, pageEnd: sabqi.pageEnd,
          assignedFor: TODAY,
        },
        {
          studentId: s.profile.id, teacherId: ustadhYusuf.id, category: 'MANZIL', scope: 'JUZ',
          fromVerseKey: manzil.fromVerseKey, toVerseKey: manzil.toVerseKey, ayahCount: manzil.ayahCount,
          pageStart: manzil.pageStart, pageEnd: manzil.pageEnd, juzNumber: s.manzilJuz,
          assignedFor: TODAY,
        },
      ],
    });
    s.ranges = { sabaq, sabqi, manzil };
  }

  // ----------------------------------------------------- history: 15 days ---
  console.log('Writing lesson and practice history...');

  for (const s of students) {
    const mistakeRows = [];
    let totalPoints = 0;

    for (let day = 14; day >= 0; day--) {
      const practised = s.practiceDays.includes(day);
      const isSchoolDay = new Date(TODAY.getTime() - day * DAY).getDay() !== 6; // no Saturday lesson

      // --- practice session the student did at home ------------------------
      let session = null;
      if (practised) {
        const trend = s.story === 'manzil-slipping' ? Math.max(0, 6 - day) * 2 : 0;
        const base = s.story === 'strong' ? 94 : s.story === 'beginner' ? 78 : 88;
        const sabaqAcc = clamp(base + seededPick(s.seed * 100 + day, 8) - 4);
        const sabqiAcc = clamp(base + seededPick(s.seed * 200 + day, 10) - 5);
        const manzilAcc = clamp(base + seededPick(s.seed * 300 + day, 8) - 4 - trend);

        const minutes = Math.round(s.dailyGoal * (0.7 + seededPick(s.seed * 400 + day, 70) / 100));
        const sabaqSec = Math.round(minutes * 60 * 0.45);
        const sabqiSec = Math.round(minutes * 60 * 0.3);
        const manzilSec = minutes * 60 - sabaqSec - sabqiSec;

        session = await prisma.practiceSession.create({
          data: {
            studentId: s.profile.id,
            startedAt: daysAgo(day, 17),
            endedAt: new Date(daysAgo(day, 17).getTime() + minutes * 60_000),
            activeSeconds: minutes * 60,
            sabaqSeconds: sabaqSec,
            sabqiSeconds: sabqiSec,
            manzilSeconds: manzilSec,
            ayatPracticed: 8 + Math.floor(seededPick(s.seed + day, 10)),
            repetitions: 15 + Math.floor(seededPick(s.seed * 2 + day, 25)),
            exercisesCompleted: 6 + Math.floor(seededPick(s.seed * 3 + day, 8)),
            sabaqAccuracy: sabaqAcc,
            sabqiAccuracy: sabqiAcc,
            manzilAccuracy: manzilAcc,
            completed: true,
          },
        });

        // A handful of real attempts against real ayat in the assigned range.
        const range = repo.getRange(s.ranges.sabaq.fromVerseKey, s.ranges.sabaq.toVerseKey);
        const attempts = [];
        for (let k = 0; k < 6; k++) {
          const ayah = range[Math.floor(seededPick(s.seed * 500 + day * 10 + k, range.length))];
          if (!ayah) continue;
          const correct = seededPick(s.seed * 600 + day * 10 + k, 100) < sabaqAcc;
          attempts.push({
            sessionId: session.id,
            studentId: s.profile.id,
            category: 'SABAQ',
            mode: pick(s.seed + k, ['TYPE_FROM_MEMORY', 'VANISHING_WORDS', 'NEXT_WORD', 'COMPLETE_AYAH']),
            verseKey: ayah.verseKey,
            correct,
            accuracy: correct ? 100 : Math.round(40 + seededPick(s.seed + k + day, 40)),
            durationMs: 8000 + Math.round(seededPick(s.seed * 7 + k, 20000)),
            repetitions: 1,
            createdAt: new Date(session.startedAt.getTime() + k * 90_000),
          });
        }
        if (attempts.length) await prisma.practiceAttempt.createMany({ data: attempts });

        totalPoints += 30 + 20 + 20 + (minutes >= s.dailyGoal ? 10 : 0);
      }

      // --- the lesson the teacher recorded ---------------------------------
      if (!isSchoolDay) continue;

      const heardBy = day % 5 === 0 ? ustadhaAmina : ustadhYusuf;
      const lesson = await prisma.teacherLesson.create({
        data: {
          studentId: s.profile.id,
          teacherId: heardBy.id,
          date: daysAgo(day, 9),
          notes:
            day === 1 && s.story === 'consistent'
              ? 'Sabaq very clean. Watch the third ayah of al-Mulk - same word again.'
              : null,
          createdAt: daysAgo(day, 9),
        },
      });

      const ratingFor = (acc) =>
        acc >= 95 ? 'EXCELLENT' : acc >= 85 ? 'GOOD' : acc >= 70 ? 'NEEDS_WORK' : 'REPEAT_TOMORROW';

      for (const category of ['SABAQ', 'SABQI', 'MANZIL']) {
        const acc = practised
          ? clamp(88 + seededPick(s.seed * 900 + day + category.length, 12) - 6)
          : clamp(64 + seededPick(s.seed * 950 + day, 16));
        const mistakes = practised ? Math.floor(seededPick(s.seed + day + category.length, 4)) : 3 + Math.floor(seededPick(s.seed + day, 5));
        await prisma.lessonEntry.create({
          data: {
            lessonId: lesson.id,
            category,
            status: practised || acc > 70 ? 'COMPLETE' : 'INCOMPLETE',
            rating: ratingFor(acc),
            mistakeCount: mistakes,
          },
        });
      }

      // --- mistakes the teacher tapped on the mushaf ------------------------
      for (const rec of s.recurring) {
        if (!rec.on.includes(day)) continue;
        const ayah = repo.getAyah(rec.verseKey);
        mistakeRows.push({
          studentId: s.profile.id,
          verseKey: rec.verseKey,
          wordPosition: rec.wordPosition,
          mistakeType: rec.type || 'FORGOTTEN_WORD',
          source: 'TEACHER',
          category: 'MANZIL',
          teacherId: heardBy.id,
          lessonId: lesson.id,
          page: ayah.page,
          juz: ayah.juz,
          resolved: false,
          createdAt: daysAgo(day, 9),
        });
      }

      // Plus ordinary scattered slips - spread across the Sabaq page and the
      // Sabqi pages behind it, the way real slips are distributed.
      const sabaqAyat = repo.getRange(s.ranges.sabqi.fromVerseKey, s.ranges.sabaq.toVerseKey);
      const scatter = Math.floor(seededPick(s.seed * 11 + day, 2.4));
      for (let k = 0; k < scatter; k++) {
        const ayah = sabaqAyat[Math.floor(seededPick(s.seed * 13 + day * 3 + k, sabaqAyat.length))];
        if (!ayah) continue;
        const wordCount = repo.getAyahWords(ayah.verseKey).length;
        mistakeRows.push({
          studentId: s.profile.id,
          verseKey: ayah.verseKey,
          wordPosition: 1 + Math.floor(seededPick(s.seed * 17 + day + k, wordCount)),
          mistakeType: pick(s.seed + day + k, ['FORGOTTEN_WORD', 'WRONG_WORD', 'HESITATION', 'TAJWID']),
          source: 'TEACHER',
          category: 'SABAQ',
          teacherId: heardBy.id,
          lessonId: lesson.id,
          page: ayah.page,
          juz: ayah.juz,
          resolved: day > 9,
          createdAt: daysAgo(day, 9),
        });
      }
    }

    if (mistakeRows.length) await prisma.mistake.createMany({ data: mistakeRows });

    // --------------------------------------------------------- progress -----
    // Everything up to the end of the current Sabaq page counts as memorized;
    // the schedule is then derived by the real scheduler, not hand-written.
    const lastIndex = repo.indexOf(s.ranges.sabaq.toVerseKey);
    const progressRows = [];
    const startIndex = Math.max(0, lastIndex - 260); // keep the demo dataset small
    for (let i = startIndex; i <= lastIndex; i++) {
      const key = repo.keyAt(i);
      const ayah = repo.getAyah(key);
      const age = lastIndex - i;
      const successes = age > 200 ? 5 : age > 120 ? 4 : age > 60 ? 3 : age > 20 ? 2 : 1;
      let p = { intervalDays: 1, consecutiveSuccess: 0, state: 'NOT_STARTED', reviewCount: 0 };
      for (let n = 0; n < successes; n++) p = nextSchedule(p, 96, new Date(TODAY.getTime() - (successes - n) * DAY));
      progressRows.push({
        studentId: s.profile.id,
        verseKey: key,
        page: ayah.page,
        juz: ayah.juz,
        firstMemorizedAt: new Date(TODAY.getTime() - (age + 3) * DAY),
        lastReviewedAt: p.lastReviewedAt,
        nextReviewAt: p.nextReviewAt,
        intervalDays: p.intervalDays,
        consecutiveSuccess: p.consecutiveSuccess,
        reviewCount: p.reviewCount,
        lastAccuracy: p.lastAccuracy,
        state: age < 10 ? 'LEARNING' : p.state,
      });
    }
    // Mark the recurring-mistake ayat as genuinely weak.
    for (const rec of s.recurring) {
      const ayah = repo.getAyah(rec.verseKey);
      const existing = progressRows.find((r) => r.verseKey === rec.verseKey);
      const row = {
        studentId: s.profile.id,
        verseKey: rec.verseKey,
        page: ayah.page,
        juz: ayah.juz,
        state: 'WEAK',
        intervalDays: 1,
        consecutiveSuccess: 0,
        reviewCount: 6,
        lastAccuracy: 62,
        lastReviewedAt: daysAgo(1, 9),
        nextReviewAt: TODAY,
        firstMemorizedAt: new Date(TODAY.getTime() - 200 * DAY),
      };
      if (existing) Object.assign(existing, row);
      else progressRows.push(row);
    }
    await prisma.ayahProgress.createMany({ data: progressRows });

    // --------------------------------------------------------- weakness -----
    const [allMistakes, failed] = await Promise.all([
      prisma.mistake.findMany({
        where: { studentId: s.profile.id },
        select: { verseKey: true, wordPosition: true, mistakeType: true, source: true, page: true, juz: true, resolved: true, createdAt: true },
      }),
      prisma.practiceAttempt.findMany({
        where: { studentId: s.profile.id, correct: false },
        select: { verseKey: true, createdAt: true },
      }),
    ]);
    const scores = computeWeaknessScores(allMistakes, failed);
    if (scores.length) {
      await prisma.weaknessScore.createMany({ data: scores.map((r) => ({ ...r, studentId: s.profile.id })) });
    }

    // ----------------------------------------------------------- points -----
    await prisma.pointTransaction.create({
      data: {
        studentId: s.profile.id,
        amount: totalPoints,
        reason: 'Practice history (demo seed)',
        createdAt: daysAgo(1),
      },
    });

    console.log(`  ${s.name}: ${mistakeRows.length} mistakes, ${progressRows.length} ayat tracked, ${totalPoints} pts`);
  }

  console.log('\nDone. Sign in with any of:');
  console.log('  teacher  yusuf@quranminds.app   / Password123');
  console.log('  teacher  amina@quranminds.app   / Password123');
  console.log('  student  ahmad@quranminds.app   / Password123');
  console.log('  parent   parent@quranminds.app  / Password123');
  console.log('  admin    admin@quranminds.app   / Password123');
}

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
