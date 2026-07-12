const DAY = 86_400_000;

const grades = ["green", "green", "green", "green", "yellow", "green", "green", "green", "red"];

function isoDaysAgo(days) {
  return new Date(Date.UTC(2026, 6, 12) - days * DAY).toISOString().slice(0, 10);
}

function makeHistory(student, days, rate) {
  const records = [];
  let page = student.startPage;
  for (let ago = days; ago >= 0; ago -= 1) {
    const date = new Date(Date.UTC(2026, 6, 12) - ago * DAY);
    if (date.getUTCDay() === 5 || date.getUTCDay() === 6) continue;
    const index = records.length;
    const miss = index % (student.id === "layina" ? 19 : 11) === 7;
    const dailyPages = miss ? 0 : Math.max(0.15, rate * Math.min(1, 0.32 + index / 75));
    page += dailyPages;
    const sabaqGrade = miss ? "red" : grades[index % grades.length];
    records.push({
      id: `${student.id}-${date.toISOString().slice(0, 10)}`,
      date: date.toISOString().slice(0, 10),
      attendance: miss && index % 38 === 7 ? "Absent" : index % 17 === 4 ? "Late" : "Present",
      sabaq: {
        grade: sabaqGrade,
        ranges: index === 24 ? [
          { fromSurah: "Al-Baqarah", fromAyah: 284, toSurah: "Al-Baqarah", toAyah: 286 },
          { fromSurah: "Ali 'Imran", fromAyah: 1, toSurah: "Ali 'Imran", toAyah: 10 },
        ] : [{ fromSurah: student.currentSurah, fromAyah: 53 + (index % 20), toSurah: student.currentSurah, toAyah: 57 + (index % 20) }],
      },
      sabqi: { grade: grades[(index + 2) % grades.length], ranges: [{ fromSurah: student.sabqiSurah, fromAyah: 1 + (index % 12), toSurah: student.sabqiSurah, toAyah: 8 + (index % 12) }] },
      manzil: { grade: miss ? "yellow" : grades[(index + 4) % grades.length], preset: student.manzilPreset, juz: student.manzilJuz, ranges: [{ fromSurah: student.manzilSurah, fromAyah: 1, toSurah: student.manzilEndSurah, toAyah: student.manzilEndAyah }] },
      pagesMemorized: Number(page.toFixed(2)),
      dailyPages: Number(dailyPages.toFixed(2)),
      mistakes: miss ? [] : Array.from({ length: index % 4 === 0 ? 2 : 1 }, (_, m) => ({ type: m ? "Harakah" : "Letter", wordIndex: 3 + ((index + m * 4) % 11) })),
      note: miss ? "Sabaq needs to be repeated before moving forward." : index % 9 === 2 ? "Strong fluency; review the marked mutashabihat." : "",
    });
  }
  return records;
}

const baseStudents = [
  {
    id: "layina", name: "Layina Ahmed", initials: "LA", level: "A", attendance: 96,
    memorizedJuz: "1–12, 28–30", totalJuz: 15, currentSurah: "Yusuf", sabqiSurah: "Hud",
    manzilPreset: "1 juz", manzilJuz: 12, manzilSurah: "Hud", manzilEndSurah: "Yusuf", manzilEndAyah: 52,
    startPage: 185, current: "Yusuf 53–57", note: "One page daily · confident, consistent manzil",
  },
  {
    id: "rumsha", name: "Rumsha Khan", initials: "RK", level: "B", attendance: 91,
    memorizedJuz: "26–30", totalJuz: 5, currentSurah: "Al-Ahqaf", sabqiSurah: "Al-Jathiyah",
    manzilPreset: "1/2 juz", manzilJuz: 28, manzilSurah: "Al-Mujadilah", manzilEndSurah: "At-Tahrim", manzilEndAyah: 12,
    startPage: 515, current: "Al-Ahqaf 1–5", note: "Half-page daily · strengthen Sabqi consistency",
  },
];

function deriveLevel(history, attendanceRate) {
  const recent = history.slice(-60);
  const gradeValue = { green: 4, yellow: 2, red: 0 };
  const gradeTotal = recent.reduce(
    (sum, day) => sum + gradeValue[day.sabaq.grade] + gradeValue[day.sabqi.grade] + gradeValue[day.manzil.grade],
    0,
  );
  const gradeAverage = gradeTotal / (recent.length * 3 * 4);
  const score = gradeAverage * 0.8 + (attendanceRate / 100) * 0.2;

  if (score >= 0.84) return "A";
  if (score >= 0.75) return "B";
  if (score >= 0.65) return "C";
  if (score >= 0.5) return "D";
  return "F";
}

export const teacherStudents = baseStudents.map((student) => {
  const history = makeHistory(student, 210, student.id === "layina" ? 1 : 0.55);
  const latest = history.at(-1);
  const currentRange = latest.sabaq.ranges[0];
  return {
    ...student,
    history,
    latest,
    level: deriveLevel(history, student.attendance),
    current: `${currentRange.fromSurah} ${currentRange.fromAyah}–${currentRange.toAyah}`,
    nextClass: isoDaysAgo(-1),
  };
});

export function findTeacherStudent(id) {
  return teacherStudents.find((student) => student.id === id);
}
