import QuranMindsApp from "@/components/quran-minds-app";
import { getLearningSample } from "@/lib/quran-source";

export default function PracticePage() { return <QuranMindsApp mode="practice" verses={getLearningSample()} />; }
