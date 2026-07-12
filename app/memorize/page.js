import QuranMindsApp from "@/components/quran-minds-app";
import { getLearningSample } from "@/lib/quran-source";

export default function MemorizePage() { return <QuranMindsApp mode="memorize" verses={getLearningSample()} />; }
