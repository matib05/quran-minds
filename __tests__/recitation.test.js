import { describe, expect, test } from 'vitest';
import {
  evaluateTranscript,
  getRecitationEvaluator,
  UnavailableRecitationEvaluator,
  MIN_REPORTABLE_CONFIDENCE,
} from '@/lib/recitation/evaluator';
import { getQuranRepository } from '@/lib/quran/local-repository';

const repo = getQuranRepository();
const ayah = repo.getAyah('1:2').text;

describe('recitation evaluation', () => {
  test('a confident, correct transcript scores 100', () => {
    const r = evaluateTranscript(ayah, 'الحمد لله رب العالمين', { confidence: 0.95 });
    expect(r.accuracy).toBe(100);
    expect(r.reliable).toBe(true);
    expect(r.mistakes).toHaveLength(0);
  });

  test('a confident transcript with a slip reports the word', () => {
    const r = evaluateTranscript(ayah, 'الحمد لله ملك العالمين', { confidence: 0.9 });
    expect(r.mistakes).toEqual([{ wordPosition: 3, mistakeType: 'WRONG_WORD' }]);
  });

  test('a low-confidence transcript records no mistakes at all', () => {
    const r = evaluateTranscript(ayah, 'الحمد لله ملك العالمين', { confidence: 0.3 });
    expect(r.reliable).toBe(false);
    expect(r.mistakes).toEqual([]);
    expect(r.message).toMatch(/experimental/i);
  });

  test('the confidence floor is meaningfully high', () => {
    expect(MIN_REPORTABLE_CONFIDENCE).toBeGreaterThanOrEqual(0.7);
  });

  test('the default provider is off and says so', () => {
    const evaluator = getRecitationEvaluator();
    expect(evaluator).toBeInstanceOf(UnavailableRecitationEvaluator);
    expect(evaluator.isAvailable()).toBe(false);
    expect(evaluator.experimental).toBe(true);
  });

  test('opting in without browser support still degrades to unavailable', () => {
    // jsdom exposes no SpeechRecognition, which is the common real-world case.
    const evaluator = getRecitationEvaluator({ enabled: true });
    expect(evaluator.isAvailable()).toBe(false);
  });

  test('starting an unavailable evaluator refuses rather than pretending', async () => {
    const evaluator = getRecitationEvaluator();
    await expect(evaluator.start({ expectedText: ayah })).rejects.toThrow(/not available/i);
  });

  test('no provider exposes a tajwid verdict', () => {
    const evaluator = getRecitationEvaluator({ enabled: true });
    const surface = [
      ...Object.getOwnPropertyNames(Object.getPrototypeOf(evaluator)),
      ...Object.keys(evaluateTranscript(ayah, ayah, { confidence: 1 })),
    ].join(' ');
    expect(surface.toLowerCase()).not.toMatch(/tajwid|pronunciation|makhraj/);
  });
});
