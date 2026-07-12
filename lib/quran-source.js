import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

let cachedAyat;

function loadAyat() {
  if (cachedAyat) return cachedAyat;

  const source = readFileSync(join(process.cwd(), "resources", "quran-text.txt"), "utf8");
  cachedAyat = source.trim().split(/\r?\n/).map((line) => {
    const [juz, surahName, surah, ayah, ...text] = line.split("|");
    return {
      juz: Number(juz),
      surahName,
      surah: Number(surah),
      ayah: Number(ayah),
      text: text.join("|"),
      ref: `${surah}:${ayah}`,
    };
  });
  return cachedAyat;
}

export function getLearningSample() {
  const wanted = new Set(["1:1", "1:2", "1:3", "1:4", "1:5", "1:6", "1:7", "2:1", "2:2", "2:3", "2:4", "2:5"]);
  return loadAyat().filter((ayah) => wanted.has(ayah.ref));
}

export function getQuranIntegrity() {
  const ayat = loadAyat();
  return { ayahCount: ayat.length, source: "Tanzil Uthmani", version: "1.1" };
}

export function getJuzBounds() {
  const ayat = loadAyat().filter((ayah) => ayah.juz >= 1 && ayah.juz <= 30);
  return Array.from({ length: 30 }, (_, index) => {
    const juz = index + 1;
    const rows = ayat.filter((ayah) => ayah.juz === juz);
    const first = rows[0];
    const last = rows.at(-1);
    return {
      juz,
      from: { surah: first.surah, surahName: first.surahName, ayah: first.ayah },
      to: { surah: last.surah, surahName: last.surahName, ayah: last.ayah },
    };
  });
}
