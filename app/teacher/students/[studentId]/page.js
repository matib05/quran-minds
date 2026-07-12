import { notFound } from "next/navigation";
import TeacherProgressApp from "@/components/teacher-progress-app";
import { getJuzBounds } from "@/lib/quran-source";
import { findTeacherStudent } from "@/lib/teacher-seed";

export default async function StudentProgressPage({ params }) {
  const { studentId } = await params;
  const student = findTeacherStudent(studentId);
  if (!student) notFound();
  return <TeacherProgressApp view="student" studentId={studentId} juzBounds={getJuzBounds()} />;
}
