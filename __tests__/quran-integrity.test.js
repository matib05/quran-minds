import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const EXPECTED_SHA256 = "903f2bd8122c8a5fde7bf7bf518e8958a2ee7df599986b9b54b982a385f74f61";

describe("Tanzil Quran source integrity", () => {
  const bytes = readFileSync(join(process.cwd(), "resources", "quran-text.txt"));
  const lines = bytes.toString("utf8").trim().split(/\r?\n/);

  test("contains the canonical 6,236 ayat", () => {
    expect(lines).toHaveLength(6236);
    expect(lines[0]).toMatch(/^0\|Al-Fatihah\|1\|1\|/);
    expect(lines.at(-1)).toMatch(/^30\|An-Nas\|114\|6\|/);
  });

  test("has not changed by a single byte", () => {
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(EXPECTED_SHA256);
  });
});
