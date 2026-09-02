/**
 * Word-level alignment between an expected Qur'anic passage and a student's
 * attempt. Produces per-word verdicts that drive both the review UI and the
 * mistake rows fed into the weakness engine.
 */
import { tokenize, keysMatch } from './normalize.js';

const MATCH = 2;
const MISMATCH = -1;
const GAP = -1;

/**
 * Needleman-Wunsch global alignment over normalized word keys.
 * Returns ops of {type, expected, actual}.
 */
function align(expected, actual) {
  const n = expected.length;
  const m = actual.length;
  const score = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 1; i <= n; i++) score[i][0] = i * GAP;
  for (let j = 1; j <= m; j++) score[0][j] = j * GAP;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = keysMatch(expected[i - 1].keys, actual[j - 1].keys);
      const diag = score[i - 1][j - 1] + (same ? MATCH : MISMATCH);
      const up = score[i - 1][j] + GAP; // expected word never produced
      const left = score[i][j - 1] + GAP; // student produced a word we did not expect
      score[i][j] = Math.max(diag, up, left);
    }
  }

  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = keysMatch(expected[i - 1].keys, actual[j - 1].keys);
      if (score[i][j] === score[i - 1][j - 1] + (same ? MATCH : MISMATCH)) {
        ops.push({ type: same ? 'match' : 'substitute', expected: expected[i - 1], actual: actual[j - 1] });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && score[i][j] === score[i - 1][j] + GAP) {
      ops.push({ type: 'missing', expected: expected[i - 1], actual: null });
      i--;
      continue;
    }
    ops.push({ type: 'extra', expected: null, actual: actual[j - 1] });
    j--;
  }
  return ops.reverse();
}

/**
 * A word marked `missing` whose key also turns up among the `extra` words was
 * recited, just in the wrong place - relabel it as a word-order problem so the
 * student is not told they forgot a word they actually said.
 */
function markOrderProblems(ops) {
  const unclaimedExtras = ops
    .map((op, idx) => ({ op, idx }))
    .filter((e) => e.op.type === 'extra');
  if (!unclaimedExtras.length) return ops;

  for (const op of ops) {
    if (op.type !== 'missing') continue;
    // Compare on the full variant sets: the canonical word and the typed word
    // may agree only on a secondary spelling (dagger alif, waw + dagger alif).
    const hit = unclaimedExtras.findIndex((e) => keysMatch(op.expected.keys, e.op.actual.keys));
    if (hit === -1) continue;
    const [claimed] = unclaimedExtras.splice(hit, 1);
    op.type = 'misordered';
    ops[claimed.idx].type = 'misordered-source';
  }
  return ops;
}

/**
 * @param {string} expectedText canonical Qur'anic text from the repository
 * @param {string} actualText   what the student produced
 * @param {{strict?: boolean}} options strict = harakat must match too
 */
export function compareRecitation(expectedText, actualText, { strict = false } = {}) {
  const expected = tokenize(expectedText, { strict });
  const actual = tokenize(actualText, { strict }).map((w, i) => ({ ...w, position: i + 1 }));

  const ops = markOrderProblems(align(expected, actual));
  const correct = ops.filter((o) => o.type === 'match').length;
  const total = expected.length || 1;

  // Per-expected-word verdicts, in canonical order, for highlighting.
  const wordResults = [];
  for (const op of ops) {
    if (op.type === 'extra' || op.type === 'misordered-source') continue;
    wordResults.push({
      position: op.expected.position,
      text: op.expected.text,
      status:
        op.type === 'match'
          ? 'correct'
          : op.type === 'substitute'
            ? 'incorrect'
            : op.type === 'misordered'
              ? 'misordered'
              : 'missing',
      typed: op.actual ? op.actual.text : null,
    });
  }

  const extras = ops
    .filter((o) => o.type === 'extra')
    .map((o) => ({ text: o.actual.text, atPosition: o.actual.position }));

  const mistakes = wordResults
    .filter((w) => w.status !== 'correct')
    .map((w) => ({
      wordPosition: w.position,
      mistakeType:
        w.status === 'missing'
          ? 'FORGOTTEN_WORD'
          : w.status === 'misordered'
            ? 'WORD_ORDER'
            : 'WRONG_WORD',
    }));
  for (const e of extras) mistakes.push({ wordPosition: null, mistakeType: 'ADDED_WORD', text: e.text });

  return {
    accuracy: Math.round((correct / total) * 100),
    correctCount: correct,
    expectedCount: expected.length,
    typedCount: actual.length,
    exact: correct === expected.length && extras.length === 0,
    wordResults,
    extras,
    mistakes,
  };
}

/**
 * Cheap check for the drill modes (next-word, complete-the-ayah) where a single
 * word or short phrase is expected. Falls back to full alignment on a miss so
 * the UI can still show which word was wrong.
 */
export function checkPhrase(expectedText, actualText, { strict = false } = {}) {
  const result = compareRecitation(expectedText, actualText, { strict });
  return { correct: result.exact, ...result };
}
