# Quran Minds — architecture

## 1. What the prototype was

The starting point was a small Next.js 14 App Router app (JavaScript, no TypeScript)
implementing one exercise: a multiple-choice "guess the surah" quiz.

| Area | State found |
|---|---|
| Framework | Next.js 14.2.5, App Router, JS + `jsconfig` path alias `@/*` |
| Styling | Tailwind + shadcn/ui primitives (button, card, form, label, select, toast) |
| Routes | `/`, `/review/input`, `/review/input/juz`, `/review/input/surah`, `/review/quiz` |
| State | One React context (`app/Context/store.js`) holding the whole quiz |
| Server logic | Two `zsa` server actions in `app/actions.js` |
| Database | Prisma + Vercel Postgres (Neon). Three models: `User` (empty), `Ayah` (6236 rows), `Page` (empty) |
| Auth | **None.** No sessions, no roles, no ownership on any row |
| Qur'an text | `resources/quran-text.txt` — 6236 lines, `juz\|surahName\|surah\|ayah\|text` |
| Qur'an metadata | `resources/quran-data.js` — Tanzil Quran Metadata v1.0, **not imported anywhere** |
| Tests | One test asserting a heading that did not exist |

### What was worth keeping

- **The Qur'anic text.** Verified during this work: 114 surahs, 6236 ayat, every
  surah's ayah count correct, and every ayah at exactly the offset Tanzil's
  metadata predicts. It is the Tanzil **Uthmani (minimal)** edition — no waqf
  marks, no ayah-end glyphs. Ayat al-Kursi is 50 words, as it should be.
- **`resources/quran-data.js`.** The most valuable file in the repository and
  entirely unused: Tanzil metadata with sura offsets, 30 juz starts, 240 hizb
  quarters, 7 manzils, 556 rukus, **604 Madani mushaf page starts**, and 15
  sajdas. This is what makes "page 76, lines 1-8" possible without any API.
- Next.js 14 + App Router + Tailwind + shadcn + Prisma + Postgres. All fine.
- The self-hosted `public/uthmanicscript.otf` Uthmani font.

### What was wrong

- **The `juz` column of `quran-text.txt` is unreliable.** Al-Faatiha is labelled
  juz **0**, and juz 4 and 7 boundaries disagree with Tanzil metadata (3:92 vs
  3:93; 5:83 vs 5:82). The build now derives *all* structure from the metadata
  file and ignores that column. A regression test asserts `1:1` is in juz 1.
- **`resources/seed.js` could not run** — it used `SurahData` without importing it.
- **`SurahData` existed twice**, byte-different but content-identical, in
  `resources/` and `utils/`.
- **The Qur'an lived in Postgres.** Every quiz question was a database query for
  text that never changes. A typing drill does hundreds of lookups.
- No authentication, so no concept of *whose* data anything was.
- Answers were hashed with SHA3 *in the browser* — obfuscation, not security.

### What was replaced

Everything above the data layer. The quiz was a single exercise with no notion
of a student, a portion, a mistake, or a teacher; the Hifdh workflow the product
needs is not a bigger version of it.

---

## 2. The Qur'an data layer

**Decision: the canonical Qur'an is a local, verified, build-time dataset. No
network request, no database row, ever, for Qur'anic text.**

```
resources/quran-text.txt   ─┐
                            ├─► scripts/build-quran-data.mjs ─► lib/quran/data/*.js
resources/quran-data.js    ─┘        (verifies as it builds)
```

The build script cross-checks the two sources against each other and **throws**
if they disagree: every ayah must sit at the index Tanzil's sura offsets
predict, and every boundary table must have the expected length (30 juz, 240
rub, 604 pages, 556 rukus, 7 manzils). A corrupted text file fails the build
rather than shipping.

`LocalQuranRepository` (`lib/quran/local-repository.js`) implements the
`QuranRepository` interface the brief asked for:

```
indexOf/keyAt          listSurahs/getSurah/getSurahAyat
getAyah/getAyahWords   getWord/getNextAyah/getPreviousAyah
getRange/countRange    getPage/pageOfKey/pagesForRange
getJuz/getHizb         juzOf/hizbQuarterOf/getJuzPages
getAudioUrl            getWordTimestamps
```

Nothing in the application imports Qur'an data directly — everything goes
through the repository, so a different provider can be dropped in later.

### Why not the Quran Foundation API

Evaluated and deliberately not used for canonical text. Their developer terms
prohibit caching content beyond one week, and the app performs hundreds of
lookups in a single practice session. Basic Hifdh must not depend on a third
party being up or on a quota. See [RESEARCH.md](RESEARCH.md) for the full
evaluation and where their API *would* be a good fit (word timestamps,
translations, additional reciters).

### The one honest gap: mushaf line numbers

Tanzil metadata gives page *starts*, not line layout. So:

- **Page-level assignment is real** — page 76 resolves to Aal-i-Imraan 195-200.
- **Line numbers are a teacher-entered annotation**, displayed next to the page
  and stored on the assignment, while the portion the app actually practises is
  the resolved verse range. The assignment UI says this in plain words rather
  than implying a precision the data does not have.

Adding true line-level rendering means integrating QPC mushaf layout data — a
documented future step, not a pretended present capability.

---

## 3. Application architecture

```
app/
  actions/         server actions - auth, lesson, practice, assignments
  login/           credential sign-in
  teacher/         dashboard, student detail, lesson recorder, assignments, mushaf
  student/         today, guided practice, memorization assistant, weak spots, progress
  parent/          simplified read-only view
lib/
  quran/           repository, normalization, comparison, phrases, drills
  hifdh/           weakness engine, scheduler, points, assignments, dashboard, practice plan
  auth/            password hashing, sessions, access guards
  recitation/      RecitationEvaluator abstraction (experimental providers)
components/
  quran/           AyahView (word-addressable), AudioButton
  hifdh/           progress map, Arabic keyboard, active-time hook
  shell/           app shell
```

### Where the rules live

Every decision that matters is a plain function with tests, not logic buried in
a component:

| Concern | Module | Shape |
|---|---|---|
| What counts as a match | `lib/quran/normalize.js` | Multi-variant spelling keys |
| Grading a typed answer | `lib/quran/compare.js` | Needleman-Wunsch word alignment |
| What is weak | `lib/hifdh/weakness.js` | Transparent weighted sum with decay |
| When to revise | `lib/hifdh/scheduler.js` | 1→3→7→14→30→60 day ladder |
| What earns points | `lib/hifdh/points.js` | Behaviour-based awards, no time award |
| Who needs attention | `lib/hifdh/dashboard.js` | Named, actionable flags |

### Authentication

Email + password, scrypt (`node:crypto`, no dependency), session rows keyed by a
SHA-256 hash of a random token in an httpOnly cookie. Every server action calls
`requireRole` / `assertCanAccessStudent` — a teacher can only reach students in
classes they teach, a parent only linked children, a student only themselves.

### Trust boundary

Typed answers are graded **on the server**, against text re-read from the
repository. The client sends what the student typed; it never asserts whether
that was correct, and it cannot supply the expected text.

### Practice time

`useActiveTime` counts a second only when the document is visible, the window
has focus, *and* the student interacted in the last 45 seconds. Heartbeats are
capped server-side. A tab left open overnight adds nothing — which is why there
is no points award for time.

---

## 4. Database

Postgres via Prisma, in its own schema (`?schema=quranminds` on the connection
string) so it never collides with the prototype's `public` tables.

**Rule: this database stores the student's relationship to the Qur'an, never a
copy of the Qur'an.** Every reference is a canonical address — `"2:255"`, word
7, page 42 — resolved through the repository.

```
School ─┬─ Program ── Class ─┬─ ClassTeacher ── User(TEACHER)
        │                    └─ Enrollment ── StudentProfile
        └─ User ─┬─ Session
                 ├─ StudentProfile ─┬─ Assignment  (SABAQ | SABQI | MANZIL)
                 │                  ├─ TeacherLesson ── LessonEntry
                 │                  ├─ Mistake        ← the important one
                 │                  ├─ PracticeSession ── PracticeAttempt
                 │                  ├─ AyahProgress   (state + schedule per ayah)
                 │                  ├─ WeaknessScore  (word/ayah/page/surah/juz)
                 │                  ├─ PointTransaction / Achievement
                 │                  └─ ParentLink
                 └─ ParentLink (as parent)
```

Notable choices:

- **`Assignment` stores both** the teacher's expression (`pageStart`, `juzNumber`,
  `lineStart`) and the resolved `fromVerseKey`/`toVerseKey`/`ayahCount`. The UI
  shows what the teacher wrote; practice uses the resolved range.
- **`Mistake` denormalises `page` and `juz`** so weakness rollups need no Qur'an
  lookup per row.
- **`AyahProgress` carries its own schedule** (`intervalDays`,
  `consecutiveSuccess`, `nextReviewAt`), so revision is per-ayah, not per-page.
- **`WeaknessScore` is derived**, recomputed after every lesson and session.
  It is a cache, never a source of truth.
- Indexes on every access path used by the dashboards:
  `(studentId, assignedFor)`, `(studentId, verseKey)`,
  `(studentId, resolved, createdAt)`, `(studentId, nextReviewAt)`,
  `(studentId, level, score)`.

---

## 5. The weakness engine

Each mistake contributes `typeWeight × sourceWeight × recency × openness`:

- **Type** — a forgotten word (1.0) says more than a tajwid note (0.4).
- **Source** — the teacher heard it (1.0) > a quiz (0.7) > typing (0.6) >
  the experimental recitation checker (0.4).
- **Recency** — halves every 14 days, so old mistakes fade instead of
  accumulating forever.
- **Openness** — a resolved mistake keeps 35% of its weight; it happened.

Contributions roll up to word, ayah, page, surah and juz simultaneously. Bands
are calibrated against the weights so they mean something concrete: one fresh
teacher-observed omission scores 1.0, so `HIGH ≥ 3` is "three or more recent
misses of the same thing".

Failed recall attempts add ayah-level evidence at 0.5 weight. A typed attempt
below 30% accuracy records **no** word-level mistakes — an abandoned attempt
says "I don't know this ayah", not "I missed these forty specific words", and
recording the latter would drown the student's Weak Spots screen in noise.

---

## 6. The revision engine

A spaced-repetition ladder — 1, 3, 7, 14, 30, 60 days — adapted in two ways
that matter for Qur'an:

1. **Teacher assignments always win.** The scheduler produces *suggestions*.
   What a student is shown is what their teacher assigned.
2. **Runs, not cards.** Due ayat are regrouped into contiguous passages in
   mushaf order (`groupIntoRuns`), because reciting 17:23, 4:11 and 67:9 in
   isolation is not revision.

A pass is ≥ 85%. One good recall is `LEARNING`, two is `MEMORIZED`, four is
`STRONG` — deliberately not calling a single success mastery.

When a teacher passes a whole portion, the non-flagged ayat advance in **one
SQL statement** rather than one round trip per ayah; a Manzil of juz 30 is 564
rows and a teacher should not wait for that.
