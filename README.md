# Quran Minds

A Hifdh management platform for students, teachers, parents and Islamic schools.
Sabaq, Sabqi and Manzil are first-class throughout: assigned by a teacher,
practised by the student, heard and marked at word level, and fed back into what
gets revised tomorrow.

The Qur'anic text is a verified local dataset. Normal memorization practice
works with no third-party API, no quota, and no connection.

---

## Running it

```bash
npm install
```

### A database

The quickest path is the bundled Postgres container:

```bash
docker compose up -d
```

Then `cp .env.example .env` — it already points at that container. If you would
rather use a hosted database (Neon, Supabase, Vercel Postgres), put its URLs in
`.env` instead; `.env.example` has an annotated template.

Two things matter whichever you choose:

- **Both URLs need the same `schema=` parameter.** Prisma qualifies its own
  queries, but the handful of raw SQL statements read the schema name from this
  URL at runtime (`lib/prisma.js`). Any name works; `public` is fine.
- **On a hosted/serverless Postgres, bound the pool.** Add
  `connection_limit=5&pool_timeout=20` to the pooled URL. Prisma otherwise opens
  `cpus * 2 + 1` connections per instance, which a serverless Postgres will
  refuse — surfacing as `Timed out fetching a new connection from the connection
  pool` on whatever request happens to arrive next.

```bash
npm run quran:build   # generate the local Qur'an dataset (verifies as it builds)
npm run db:migrate    # create the schema
npm run db:seed       # demo school, 6 students, 3 weeks of history
npm run dev
```

Open <http://localhost:3000>.

### Demo accounts

All use the password `Password123`.

| Role | Email | What to look at |
|---|---|---|
| Teacher | `yusuf@quranminds.app` | Roster, attention flags, lesson recorder |
| Teacher | `amina@quranminds.app` | The same students under a second teacher |
| Student | `ahmad@quranminds.app` | Today's Hifdh, guided practice |
| Parent | `parent@quranminds.app` | Simplified view of two children |
| Admin | `admin@quranminds.app` | Whole school |

The seeded students each demonstrate something the dashboard has to surface:
Ahmad is consistent with one stubborn word, Bilal stopped practising four days
ago, Zaynab's Manzil accuracy is sliding, Maryam keeps missing the same ayah
ending, Ibrahim is on a 15-day streak, and Fatimah is new.

### Scripts

| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Regenerate Qur'an data, generate Prisma client, build |
| `npm test` | Vitest — 81 tests over the Qur'an data, grading, and Hifdh engines |
| `npm run quran:build` | Rebuild `lib/quran/data/` from `resources/` |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma |
| `docker compose up -d` / `down` | Local Postgres |

### If the database is unreachable

Every page needs the database, so a connection failure shows up as a Prisma
error on whatever you touch first — often the login form. Check the database
before suspecting the app:

```bash
docker compose ps
```

A hosted database that has gone quiet usually means the compute suspended or a
free-tier limit was hit; the container above is unaffected by either.

---

## Deploying

Vercel, or anything that runs Next.js 14 on Node.

1. Set `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING` (with the same
   `schema=`) in the host's environment.
2. `npm run build` is the build command — it regenerates the Qur'an dataset and
   the Prisma client before building.
3. Run `npx prisma migrate deploy` against production once per release.
4. Seed only if you want the demo data. **Do not seed a real school** — the seed
   deletes everything first.
5. Demo credentials are hidden on the login page in production unless
   `SHOW_DEMO_ACCOUNTS=true`.

Sessions are httpOnly cookies, `secure` in production; nothing else needs
configuring.

---

## What is built

### Teacher

- **Roster** with today's Sabaq / Sabqi / Manzil, practice, accuracy, pages and
  juz memorized, and the top weak spot per student. Filter by class, practice
  status, weakness band and juz.
- **Attention flags** that name something actionable — "No practice yesterday or
  today", "Missed Al-Mulk 3 four times", "Manzil accuracy falling (97% → 91%)" —
  not a generic low score.
- **Lesson recorder.** Three verdicts, the assigned mushaf page rendered
  word-by-word, and a tap on any word records a mistake against that exact
  canonical position. Around 30 seconds for a full lesson. Existing weak words
  are shaded so the teacher sees history while listening.
- **Student detail** — memorization map, weakest ayat and words, pages needing
  revision, lesson history, recent mistakes, and one suggested next step.
- **Assignments** by page range, juz, hizb, surah or ayah range, with a
  suggested Sabqi window and per-student teaching settings.
- **Mushaf browser** across all 604 pages.

### Student

- **Today's Hifdh** — the three portions, practice time, streak, accuracy, weak
  ayat and the teacher's latest feedback.
- **Guided daily practice**: learn Sabaq → recall test → Sabqi → weak spots →
  Manzil → summary. The whole plan is built server-side and sent before the
  first screen, so a dropped connection does not end the session.
- **Memorization assistant** — 5-5-5, phrase by phrase, vanishing words, typing
  from memory, on any surah or page.
- **Typing from memory** graded on the server with word-level highlighting:
  correct green, wrong struck through, omitted outlined. Harakat not required.
  On-screen Arabic keyboard for devices without an Arabic layout.
- **Weak spots** and a **progress map** over all 30 juz.

### Parent

Assignment, whether practice happened, for how long, memorization growth,
streak, and the teacher's note. Word-level mistake data is deliberately left
out — it produces pressure at home and it is the teacher's material to use.

---

## Things this app will not do

- **Invent Qur'anic text.** Every Arabic character displayed comes from the
  verified Tanzil dataset. Normalization produces comparison keys only; a test
  asserts the canonical string is never altered.
- **Grade in the browser.** Typed answers are graded on the server against text
  re-read from the repository.
- **Reward time.** There is no points award for minutes spent, and the timer
  only counts seconds with real interaction. Leaving the app open earns nothing.
- **Judge tajwid.** Automatic recitation checking is off by default, clearly
  marked experimental, weighted lowest of any evidence source, and reports
  "could not check" rather than a mistake when it is not confident. No API here
  returns a tajwid verdict.
- **Watch students through a camera.** The Face ID concept was dropped. Focus is
  supported by short sessions, one task at a time and visible progress.

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — audit of the prototype, what
  was kept, the Qur'an data layer, the database, and how the engines work.
- [docs/RESEARCH.md](docs/RESEARCH.md) — every dependency evaluated, with
  licence, maturity and recommendation, including the Quran Foundation API and
  the state of Qur'anic speech recognition.

---

## Attribution

Qur'anic text: the [Tanzil Project](https://tanzil.net) Uthmani (minimal)
edition, redistributed verbatim. Structural metadata: Tanzil Quran Metadata
v1.0, CC BY 3.0. Recitation audio: [EveryAyah.com](https://everyayah.com).
