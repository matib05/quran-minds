import TeacherProgressApp from "@/components/teacher-progress-app";
import { getJuzBounds } from "@/lib/quran-source";

export default function TeacherPage() { return <TeacherProgressApp view="class" juzBounds={getJuzBounds()} />; }
