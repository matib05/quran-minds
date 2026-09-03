'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAssignment, updateStudentSettings, setSabqiWindow } from '@/app/actions/assignments';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { key: 'SABAQ', label: 'Sabaq', arabic: 'سَبَق', hint: 'Today’s new memorization', defaultScope: 'PAGE_RANGE' },
  { key: 'SABQI', label: 'Sabqi', arabic: 'سَبْقِي', hint: 'Recently memorized', defaultScope: 'PAGE_RANGE' },
  { key: 'MANZIL', label: 'Manzil', arabic: 'مَنْزِل', hint: 'Long-term revision', defaultScope: 'JUZ' },
];

const SCOPES = [
  { value: 'PAGE_RANGE', label: 'Mushaf pages' },
  { value: 'JUZ', label: 'Juz' },
  { value: 'HIZB', label: 'Hizb' },
  { value: 'SURAH', label: 'Surah' },
  { value: 'AYAH_RANGE', label: 'Ayah range' },
];

export default function AssignmentEditor({ studentId, current, suggestion, surahs, settings }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {CATEGORIES.map((c) => (
          <CategoryForm
            key={c.key}
            studentId={studentId}
            category={c}
            existing={current[c.key]}
            suggestion={c.key === 'SABQI' ? suggestion : null}
            surahs={surahs}
          />
        ))}
      </div>
      <SettingsForm studentId={studentId} settings={settings} />
    </div>
  );
}

function CategoryForm({ studentId, category, existing, suggestion, surahs }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState(existing?.scope ?? category.defaultScope);
  const [values, setValues] = useState(() => ({
    pageStart: existing?.pageStart ?? '',
    pageEnd: existing?.pageEnd ?? '',
    lineStart: existing?.lineStart ?? '',
    lineEnd: existing?.lineEnd ?? '',
    juzNumber: existing?.juzNumber ?? '',
    hizbNumber: existing?.hizbNumber ?? '',
    surahNumber: existing?.surahNumber ?? '',
    fromVerseKey: existing?.fromVerseKey ?? '',
    toVerseKey: existing?.toVerseKey ?? '',
    notes: existing?.notes ?? '',
  }));

  const set = (patch) => setValues((v) => ({ ...v, ...patch }));

  const applySuggestion = () => {
    if (!suggestion) return;
    setScope('PAGE_RANGE');
    set({ pageStart: suggestion.pageStart, pageEnd: suggestion.pageEnd });
  };

  const save = () => {
    startTransition(async () => {
      try {
        const result = await setAssignment({
          studentId,
          category: category.key,
          scope,
          ...emptyToNull(values),
        });
        toast({
          title: `${category.label} set`,
          description: `${result.resolved.label} · ${result.resolved.ayahCount} ayat`,
        });
        router.refresh();
      } catch (error) {
        toast({ variant: 'destructive', title: 'Could not save', description: error?.message });
      }
    });
  };

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="quran mr-2 text-lg text-primary">{category.arabic}</span>
          <span className="font-semibold">{category.label}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{category.hint}</p>

      {existing ? (
        <p className="mt-2 rounded-md bg-muted/60 p-2 text-sm">
          <span className="font-medium">{existing.title}</span>
          <span className="block text-xs text-muted-foreground">
            {existing.subtitle} · {existing.ayahCount} ayat
          </span>
        </p>
      ) : null}

      {suggestion ? (
        <button
          type="button"
          onClick={applySuggestion}
          className="mt-2 w-full rounded-md border border-dashed px-2 py-1.5 text-xs hover:bg-muted"
        >
          Suggested: {suggestion.label} (the {suggestion.pageEnd - suggestion.pageStart + 1} pages behind Sabaq)
        </button>
      ) : null}

      <label className="mt-3 block text-xs font-medium text-muted-foreground">Assign by</label>
      <select
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      >
        {SCOPES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <div className="mt-2 space-y-2">
        {scope === 'PAGE_RANGE' ? (
          <>
            <Pair>
              <Field label="From page" value={values.pageStart} onChange={(v) => set({ pageStart: v })} type="number" min={1} max={604} />
              <Field label="To page" value={values.pageEnd} onChange={(v) => set({ pageEnd: v })} type="number" min={1} max={604} />
            </Pair>
            <Pair>
              <Field label="From line" value={values.lineStart} onChange={(v) => set({ lineStart: v })} type="number" min={1} max={15} />
              <Field label="To line" value={values.lineEnd} onChange={(v) => set({ lineEnd: v })} type="number" min={1} max={15} />
            </Pair>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Lines are recorded as a note for you and the student — the portion the app practises is
              the whole page range above. Line-level mushaf layout data is not part of this dataset.
            </p>
          </>
        ) : null}

        {scope === 'JUZ' ? (
          <Field label="Juz" value={values.juzNumber} onChange={(v) => set({ juzNumber: v })} type="number" min={1} max={30} />
        ) : null}

        {scope === 'HIZB' ? (
          <Field label="Hizb" value={values.hizbNumber} onChange={(v) => set({ hizbNumber: v })} type="number" min={1} max={60} />
        ) : null}

        {scope === 'SURAH' ? (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Surah</span>
            <select
              value={values.surahNumber}
              onChange={(e) => set({ surahNumber: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Choose…</option>
              {surahs.map((s) => (
                <option key={s.number} value={s.number}>
                  {s.number}. {s.name} ({s.ayahCount})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {scope === 'AYAH_RANGE' ? (
          <Pair>
            <Field label="From (e.g. 2:255)" value={values.fromVerseKey} onChange={(v) => set({ fromVerseKey: v })} placeholder="2:255" />
            <Field label="To" value={values.toVerseKey} onChange={(v) => set({ toVerseKey: v })} placeholder="2:257" />
          </Pair>
        ) : null}

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Note (optional)</span>
          <input
            value={values.notes}
            onChange={(e) => set({ notes: e.target.value })}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="mt-3 h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Saving…' : existing ? `Replace ${category.label}` : `Set ${category.label}`}
      </button>
    </section>
  );
}

function SettingsForm({ studentId, settings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(settings);

  const save = () => {
    startTransition(async () => {
      try {
        await setSabqiWindow(studentId, values.sabqiWindowPages);
        await updateStudentSettings(studentId, {
          repetitionTarget: values.repetitionTarget,
          dailyGoalMinutes: values.dailyGoalMinutes,
          strictTashkeel: values.strictTashkeel,
          gamificationOn: values.gamificationOn,
        });
        toast({ title: 'Settings saved' });
        router.refresh();
      } catch (error) {
        toast({ variant: 'destructive', title: 'Could not save', description: error?.message });
      }
    });
  };

  const set = (patch) => setValues((v) => ({ ...v, ...patch }));

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Teaching settings</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          label="Sabqi window (pages)"
          value={values.sabqiWindowPages}
          onChange={(v) => set({ sabqiWindowPages: v })}
          type="number"
          min={1}
          max={60}
        />
        <Field
          label="Repetitions (the 5 in 5-5-5)"
          value={values.repetitionTarget}
          onChange={(v) => set({ repetitionTarget: v })}
          type="number"
          min={1}
          max={20}
        />
        <Field
          label="Daily practice goal (minutes)"
          value={values.dailyGoalMinutes}
          onChange={(v) => set({ dailyGoalMinutes: v })}
          type="number"
          min={5}
          max={240}
        />
        <div className="space-y-2 pt-5">
          <Toggle
            checked={values.strictTashkeel}
            onChange={(v) => set({ strictTashkeel: v })}
            label="Require harakat when typing"
          />
          <Toggle
            checked={values.gamificationOn}
            onChange={(v) => set({ gamificationOn: v })}
            label="Show points and streaks"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="mt-3 rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save settings'}
      </button>
    </section>
  );
}

function Pair({ children }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function Field({ label, value, onChange, type = 'text', ...rest }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...rest}
      />
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        className={cn('h-4 w-4 rounded border-input accent-[hsl(var(--primary))]')}
      />
      {label}
    </label>
  );
}

/** Empty strings from the form become nulls so zod's optional fields pass. */
function emptyToNull(values) {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === '' ? null : v]));
}
