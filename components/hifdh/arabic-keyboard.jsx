'use client';

import { cn } from '@/lib/utils';

/**
 * An on-screen Arabic keyboard for typing exercises.
 *
 * Most students on a Chromebook or a school tablet do not have an Arabic
 * layout installed, and asking them to add one is a reason not to practise.
 * Letters only - harakat are not required for grading, so putting them on the
 * keyboard would only imply that they are.
 */
const ROWS = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
  ['ئ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ'],
  ['أ', 'إ', 'آ', 'ذ'],
];

export default function ArabicKeyboard({ onInsert, onBackspace, onSpace, className }) {
  return (
    <div className={cn('select-none rounded-lg border bg-muted/40 p-2', className)} dir="rtl">
      {ROWS.map((row, i) => (
        <div key={i} className="mb-1 flex flex-wrap justify-center gap-1">
          {row.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => onInsert(letter)}
              className="quran min-w-[2.1rem] rounded-md border bg-background px-2 py-1.5 text-xl leading-none hover:bg-accent/15 active:scale-95"
            >
              {letter}
            </button>
          ))}
        </div>
      ))}
      <div className="flex justify-center gap-1">
        <button
          type="button"
          onClick={onSpace}
          className="flex-1 rounded-md border bg-background px-4 py-2 text-sm hover:bg-muted"
        >
          Space
        </button>
        <button
          type="button"
          onClick={onBackspace}
          className="rounded-md border bg-background px-4 py-2 text-sm hover:bg-muted"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
