# Dependency and data-source evaluation

Researched during the build (September 2026). Every recommendation below is
reflected in what the code actually does.

---

## 1. Qur'anic text

### Tanzil Uthmani (minimal) — **chosen, in the MVP**

| | |
|---|---|
| Project | [Tanzil Project](https://tanzil.net) |
| Purpose | Canonical Qur'anic text |
| License | Verbatim redistribution permitted; **modification prohibited**; source must be indicated with a link to tanzil.net |
| Maturity | Published since 2007, the de-facto text behind most Qur'an software |
| Recommendation | **Use as the single source of canonical text** |

Already present in the repository as `resources/quran-text.txt`. Verified during
this work: 114 surahs, 6236 ayat, canonical per-surah counts, Ayat al-Kursi at
50 words, and every ayah at the exact index Tanzil's own metadata predicts.

**Licence compliance in this build:**
- The text is redistributed byte-for-byte; the build script fails if the file
  does not match the metadata.
- `normalize()` produces *comparison keys only* and never rewrites stored or
  displayed text. There is a test asserting the canonical string is unchanged
  after normalization.
- Attribution and a live link to tanzil.net appear in the footer of every
  signed-in page.

### Tanzil Quran Metadata v1.0 — **chosen, in the MVP**

| | |
|---|---|
| License | Creative Commons Attribution 3.0 |
| Contents | Sura offsets, 30 juz, 240 hizb quarters, 7 manzils, 556 rukus, **604 Madani mushaf pages**, 15 sajdas |
| Recommendation | **Use for all structural addressing** |

Already in the repository as `resources/quran-data.js` and previously unused.
This is what makes page-based assignment work offline.

### Quran Foundation / Quran.com Content API — **evaluated, not used for canonical text**

| | |
|---|---|
| Project | [Quran Foundation Content APIs](https://api-docs.quran.foundation/) |
| Purpose | Verses, translations, tafsir, recitations, word-level data |
| Auth | OAuth2 (`x-auth-token` + `x-client-id` per request) |
| Maturity | Actively maintained, official JS/TS SDK, powers quran.com |

**Why it is not the canonical source here:**

1. **Caching restriction.** The developer terms prohibit caching or storing QF
   content for longer than one week without express permission. A student's
   assigned Sabaq needs to be readable offline tomorrow, next week and next
   term. A local licensed copy satisfies that; a one-week cache does not.
2. **Request volume.** A single typing session performs hundreds of lookups.
   Those are free against a local dataset and are a quota problem against an API.
3. **Availability.** "Can Ahmad revise his Manzil tonight?" must not depend on a
   third party being up.

**Where it is the right tool** (a good MVP-2/3 addition, behind
`QuranFoundationRepository`):

- Word-level audio timestamps for follow-along highlighting — the local dataset
  has none, and `getWordTimestamps()` returns `null` rather than guessing.
- Translations and tafsir.
- Additional reciters and higher-quality audio.
- Their ML-usage restriction is also worth noting: QF content may not be used to
  train models without written consent.

### everyayah.com — **chosen for audio, in the MVP**

| | |
|---|---|
| Purpose | Per-ayah recitation MP3s |
| Access | Plain CDN URL pattern, no key, no quota: `/data/{reciter}/{sss}{aaa}.mp3` |
| Recommendation | **Use, with graceful degradation** |

Audio is the one genuinely network-dependent feature. `AudioButton` reports
"Audio unavailable" and the session continues text-only.

---

## 2. Arabic normalization

**Recommendation: write it, do not import it.** Implemented in
`lib/quran/normalize.js` — ~80 lines, fully tested, zero dependencies.

General-purpose Arabic normalizers get Uthmani orthography wrong in a way that
matters. Three real cases, all handled:

| Canonical (Uthmani) | Student types | Why they differ |
|---|---|---|
| `ٱلْعَـٰلَمِينَ` | `العالمين` | dagger alif = a written alif |
| `ٱلرَّحْمَـٰنِ` | `الرحمن` | dagger alif = no alif at all |
| `ٱلصَّلَوٰةَ` | `الصلاة` | waw + dagger alif = alif |

No single collapse handles all three, so each canonical word carries a small set
of accepted spellings and a match is a non-empty intersection. This is generous
about orthography and strict about memorization — the right trade, since we are
testing whether the student knows the words, not whether they can reproduce
mushaf spelling on a touchscreen.

**Default: harakat are not required.** Configurable per student
(`strictTashkeel`) for schools that want tashkeel-sensitive grading.

---

## 3. Answer comparison

**Recommendation: Needleman-Wunsch word alignment.** Implemented in
`lib/quran/compare.js`, no dependency.

A naive diff reports a swapped pair as two omissions and an inserted word as a
cascade of wrong words. Global alignment distinguishes:

- exact match
- wrong word (substitution)
- missing word (deletion)
- added word (insertion)
- **word-order problem** — a word marked missing whose spelling also appears
  among the extras was recited, just in the wrong place, and the student is told
  that rather than being told they forgot it

Each verdict maps to a `MistakeType`, so a typing drill and a teacher's tap feed
the same weakness engine.

---

## 4. Qur'anic speech recognition

**Recommendation: build the abstraction and the UI; ship the default off.**

The brief asked whether a viable free/open-source Qur'an-specific ASR exists
today. Honest answer: **credible work exists, but nothing that belongs in the
critical path of grading a child's Hifdh unsupervised.**

| Option | Assessment |
|---|---|
| [`tarteel-ai/whisper-base-ar-quran`](https://huggingface.co/tarteel-ai/whisper-base-ar-quran) | The strongest starting point: a Whisper fine-tune specifically on Qur'anic recitation. **Server-side inference only** — real hardware, real cost. |
| [`KheemP/whisper-base-quran-lora`](https://huggingface.co/KheemP/whisper-base-quran-lora) | LoRA on the above, diacritic-sensitive, reported test WER ≈ 6%. Same deployment constraints. |
| [`MaddoggProduction/whisper-l-v3-turbo-quran-lora-dataset-mix`](https://huggingface.co/MaddoggProduction/whisper-l-v3-turbo-quran-lora-dataset-mix) | large-v3-turbo fine-tune, reported WER ≈ 12.7%. Larger, slower, no better for our purpose. |
| [Real-Time Quran recitation tracker](https://github.com/yayaiu6/Real-Time-Quran-recitation-tracker-System) | Open-source system for word-level alignment and error detection. Research-grade; worth tracking. |
| [offline-tarteel research notes](https://github.com/yazinsai/offline-tarteel/blob/main/RESEARCH-audio-to-verse.md) | Useful survey of audio→verse matching approaches. |
| Generic Arabic STT (Web Speech, cloud vendors) | **Not sufficient.** Trained on Modern Standard/dialectal Arabic; mis-hears classical vocabulary, and typically ships audio to a vendor. |
| Browser/WebGPU inference | A Whisper fine-tune is not currently a reasonable in-browser dependency for a phone or a school Chromebook. |

Even at 6% WER, roughly one word in seventeen is misheard — which, in a drill
whose whole purpose is to tell a student they got a word wrong, is a false
accusation every couple of ayat.

### What is implemented

`lib/recitation/evaluator.js` defines `RecitationEvaluator` with:

- `UnavailableRecitationEvaluator` — **the default.** Reports unavailable.
- `WebSpeechRecitationEvaluator` — experimental, opt-in, uses the browser's
  built-in recognition.
- `evaluateTranscript()` — shared alignment so every provider reports the same
  shape, whatever the model.

Three deliberate constraints, each covered by a test:

1. **A confidence floor of 0.7.** Below it, the result is "could not check",
   and **no mistakes are recorded**. A student told they missed a word they
   recited correctly will stop trusting the feature — and may "correct" a
   correct recitation.
2. **Recitation-sourced mistakes weigh 0.4** in the weakness engine, the lowest
   of any source, against 1.0 for the teacher.
3. **No method anywhere returns a tajwid verdict.** There is a test asserting
   the API surface contains no such thing. Automatic tajwid assessment is not a
   solved problem and this app will not imply that it is.

### If a school wants this for real

Deploy `tarteel-ai/whisper-base-ar-quran` behind an inference endpoint and add a
`ServerRecitationEvaluator` implementing the same interface. Nothing else in the
application changes. Treat it as a practice aid that flags *possible* skips for
the teacher to confirm — never as assessment.

---

## 5. Typography

| | |
|---|---|
| Font | `public/uthmanicscript.otf`, already in the repository, self-hosted |
| Recommendation | **Keep.** Self-hosting means the canonical text never fails to render because a CDN is unreachable |

Rendering rules in `app/globals.css`: `direction: rtl`, `line-height: 2.15`
(Uthmani stacks marks above and below the baseline and is unreadable when
crowded), and fluid `clamp()` sizing so an ayah is legible on a phone and
beautiful on a tablet. UI Arabic and Qur'anic Arabic are separate concerns —
`.quran` is only ever applied to canonical text.

---

## 6. Learning styles

**Recommendation: do not build on them.** The brief was right to be sceptical.
The "match teaching to a learner's visual/auditory/kinesthetic style" hypothesis
is not supported by the evidence, and labelling a child permanently is the
opposite of useful.

What is implemented instead: several genuinely different practice modes —
listening, reading, phrase repetition, typing, recall, multiple choice — with
every attempt recording its `mode`. That data supports "typing drills are
working for this student" without ever assigning them a label.

---

## 7. Focus

**Recommendation: no face recognition. Removed from the concept.**

Camera-based attention detection is a serious privacy intrusion for a
marginal signal, and pointing a camera at a child in their home to check they
are looking at a screen is not a trade any school should make.

What is implemented instead:

- One task on screen at a time; the practice runner shows a single exercise.
- Honest active-time measurement rather than a timer that rewards an open tab.
- Visible stage progress, so the end is always in sight.
- Short sessions — the 5-5-5 stage is capped at 8 phrases per sitting.
- Streaks and daily goals, without casino mechanics.
