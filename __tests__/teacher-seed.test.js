import { describe, expect, test } from "vitest";
import { teacherStudents } from "../lib/teacher-seed";

describe("teacher seed data", () => {
  test("models Layina and Rumsha with realistic longitudinal history", () => {
    expect(teacherStudents.map((student) => student.name)).toEqual(["Layina Ahmed", "Rumsha Khan"]);
    expect(teacherStudents[0].totalJuz).toBe(15);
    expect(teacherStudents[1].totalJuz).toBe(5);
    expect(teacherStudents.every((student) => student.history.length > 100)).toBe(true);
  });

  test("includes multi-surah portions and marked mistakes", () => {
    expect(teacherStudents[0].history.some((record) => record.sabaq.ranges.length > 1)).toBe(true);
    expect(teacherStudents[0].history.some((record) => record.mistakes.length === 2)).toBe(true);
  });
});
