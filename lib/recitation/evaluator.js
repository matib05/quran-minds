/**
 * RecitationEvaluator - the seam for automatic recitation checking.
 *
 * ## What this is and is not
 *
 * Every provider here answers exactly one question: *did the student say the
 * words we were expecting, in order?* None of them answer "was the tajwid
 * correct" or "was the recitation acceptable", and the interface deliberately
 * has no method that could be read that way. Judging recitation is the
 * teacher's work; this is a practice aid that can tell a student they skipped
 * a word.
 *
 * ## Why the default provider does nothing
 *
 * As of this build there is no free, production-ready, browser-deliverable
 * Qur'an-specific ASR that we would trust to grade a student unsupervised.
 * The credible options (see docs/RESEARCH.md) are Whisper fine-tunes such as
 * `tarteel-ai/whisper-base-ar-quran` and its LoRA derivatives, which need
 * server-side inference and real hardware. So the architecture and the UI are
 * built, an experimental browser provider is included behind an explicit
 * opt-in, and the default is honest: unavailable.
 *
 * ## Adding a provider
 *
 * Implement `isAvailable()`, `start()`, `stop()`, and emit results through the
 * `onResult` callback. Alignment against the canonical text is shared - use
 * `evaluateTranscript` so every provider reports word verdicts the same way.
 */
import { compareRecitation } from '@/lib/quran/compare';

/**
 * Confidence below which we refuse to report a word as wrong.
 *
 * A student told they missed a word they actually recited correctly will stop
 * trusting the feature, and worse, may "correct" a correct recitation. When
 * the recogniser is unsure, we say we are unsure.
 */
export const MIN_REPORTABLE_CONFIDENCE = 0.7;

/**
 * Align a transcript against the expected canonical text.
 * Shared by every provider so their output is comparable.
 *
 * @param {string} expectedText canonical Uthmani text from the repository
 * @param {string} transcript what the recogniser heard
 * @param {{confidence?: number, strict?: boolean}} options
 */
export function evaluateTranscript(expectedText, transcript, { confidence = 0, strict = false } = {}) {
  const comparison = compareRecitation(expectedText, transcript, { strict });
  const reliable = confidence >= MIN_REPORTABLE_CONFIDENCE;

  return {
    transcript,
    confidence,
    /** Only true when the recogniser was confident enough to be worth showing. */
    reliable,
    accuracy: comparison.accuracy,
    wordResults: comparison.wordResults,
    extras: comparison.extras,
    /**
     * Mistakes are only emitted when the transcription was reliable. An
     * unreliable pass produces a suggestion to try again, not a mistake record.
     */
    mistakes: reliable ? comparison.mistakes : [],
    message: reliable
      ? null
      : 'The recording was not clear enough to check. This is an experimental feature — your teacher’s ear is the reference.',
  };
}

/** The interface every provider implements. */
export class RecitationEvaluator {
  get id() {
    return 'base';
  }

  /** Human-readable name for the settings UI. */
  get label() {
    return 'Recitation check';
  }

  /** Whether this provider can run right now, in this browser/session. */
  isAvailable() {
    return false;
  }

  /** True when the provider is experimental and must be labelled as such. */
  get experimental() {
    return true;
  }

  async start({ expectedText, onResult, onError }) {
    throw new Error('This recitation evaluator is not available');
  }

  stop() {}
}

/** The default: does nothing, and says so. */
export class UnavailableRecitationEvaluator extends RecitationEvaluator {
  get id() {
    return 'unavailable';
  }

  get label() {
    return 'Not available';
  }

  isAvailable() {
    return false;
  }
}

/**
 * Experimental provider using the browser's built-in SpeechRecognition.
 *
 * This is *general Arabic* recognition, not Qur'anic. It will mis-hear
 * classical vocabulary, it is unavailable in most browsers, and where it does
 * exist it usually sends audio to the vendor's servers. It is included so the
 * end-to-end shape can be exercised and so a school can trial it knowingly -
 * it is not on by default, and results below the confidence floor are reported
 * as "could not check" rather than as mistakes.
 */
export class WebSpeechRecitationEvaluator extends RecitationEvaluator {
  #recognition = null;

  get id() {
    return 'web-speech';
  }

  get label() {
    return 'Browser speech recognition (experimental)';
  }

  isAvailable() {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  async start({ expectedText, strict = false, onResult, onError }) {
    if (!this.isAvailable()) {
      onError?.(new Error('This browser has no speech recognition'));
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = 'ar-SA';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const result = event.results?.[0]?.[0];
      if (!result) return;
      onResult?.(
        evaluateTranscript(expectedText, result.transcript, {
          confidence: result.confidence ?? 0,
          strict,
        }),
      );
    };
    recognition.onerror = (event) => onError?.(new Error(event.error || 'Recognition failed'));

    this.#recognition = recognition;
    recognition.start();
  }

  stop() {
    this.#recognition?.stop();
    this.#recognition = null;
  }
}

/**
 * Pick a provider. Recitation checking stays off unless a school turns it on,
 * because an unreliable check is worse than no check.
 */
export function getRecitationEvaluator({ enabled = false } = {}) {
  if (!enabled) return new UnavailableRecitationEvaluator();
  const provider = new WebSpeechRecitationEvaluator();
  return provider.isAvailable() ? provider : new UnavailableRecitationEvaluator();
}
