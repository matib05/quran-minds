'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const PRACTICE_FILTERS = [
  { value: 'all', label: 'Everyone' },
  { value: 'practiced', label: 'Practised today' },
  { value: 'not-practiced', label: 'Not practised' },
];

const WEAKNESS_FILTERS = [
  { value: 'all', label: 'Any' },
  { value: 'HIGH', label: 'High weakness' },
  { value: 'MEDIUM', label: 'Medium or worse' },
];

export default function RosterTable({ snapshots, classes }) {
  const [query, setQuery] = useState('');
  const [classId, setClassId] = useState('all');
  const [practice, setPractice] = useState('all');
  const [weakness, setWeakness] = useState('all');
  const [juz, setJuz] = useState('all');

  const juzOptions = useMemo(
    () => [...new Set(snapshots.map((s) => s.juz).filter(Boolean))].sort((a, b) => a - b),
    [snapshots],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snapshots.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false;
      if (classId !== 'all' && !s.classes.some((c) => c.id === classId)) return false;
      if (practice === 'practiced' && !s.practicedToday) return false;
      if (practice === 'not-practiced' && s.practicedToday) return false;
      if (juz !== 'all' && String(s.juz) !== juz) return false;
      if (weakness === 'HIGH' && s.topWeakness?.band !== 'HIGH') return false;
      if (weakness === 'MEDIUM' && !['HIGH', 'MEDIUM'].includes(s.topWeakness?.band)) return false;
      return true;
    });
  }, [snapshots, query, classId, practice, weakness, juz]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students…"
          aria-label="Search students"
          className="h-9 min-w-[10rem] flex-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Select value={classId} onChange={setClassId} label="Class"
          options={[{ value: 'all', label: 'All classes' }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} />
        <Select value={practice} onChange={setPractice} label="Practice" options={PRACTICE_FILTERS} />
        <Select value={weakness} onChange={setWeakness} label="Weakness" options={WEAKNESS_FILTERS} />
        <Select value={juz} onChange={setJuz} label="Juz"
          options={[{ value: 'all', label: 'Any juz' }, ...juzOptions.map((j) => ({ value: String(j), label: `Juz ${j}` }))]} />
      </div>

      {/* Cards on phones, a table from md up - the same data, read differently. */}
      <div className="grid gap-3 md:hidden">
        {rows.map((s) => (
          <StudentCard key={s.id} s={s} />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[64rem] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Student</th>
              <th className="px-3 py-2 font-medium">Sabaq</th>
              <th className="px-3 py-2 font-medium">Sabqi</th>
              <th className="px-3 py-2 font-medium">Manzil</th>
              <th className="px-3 py-2 font-medium">Practice</th>
              <th className="px-3 py-2 font-medium">Progress</th>
              <th className="px-3 py-2 font-medium">Weak spot</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((s) => (
              <tr key={s.id} className="align-top hover:bg-muted/30">
                <td className="px-3 py-3">
                  <Link href={`/teacher/students/${s.id}`} className="font-medium underline-offset-2 hover:underline">
                    {s.name}
                  </Link>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {s.classes.map((c) => c.name).join(', ')}
                  </div>
                  <Flags flags={s.flags} />
                </td>
                <AssignmentCell a={s.sabaq} accuracy={s.sabaqAccuracy} />
                <AssignmentCell a={s.sabqi} accuracy={s.sabqiAccuracy} />
                <AssignmentCell a={s.manzil} accuracy={s.manzilAccuracy} />
                <td className="px-3 py-3">
                  <div className={s.practicedToday ? 'text-success' : 'text-muted-foreground'}>
                    {s.practicedToday ? `✓ ${s.minutesToday} min today` : 'Not yet today'}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {s.daysThisWeek}/7 days · {s.streak} day streak
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div>{s.pagesMemorized} pages</div>
                  <div className="text-xs text-muted-foreground">{s.juzMemorized} juz complete</div>
                </td>
                <td className="px-3 py-3">
                  {s.topWeakness ? (
                    <>
                      <WeaknessBadge band={s.topWeakness.band} />
                      <div className="mt-1 text-xs">{s.topWeakness.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.topWeakness.count}× · {s.openMistakes} open
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">None recorded</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  <Link
                    href={`/teacher/students/${s.id}/lesson`}
                    className="inline-block whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    Record lesson
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No students match these filters.
        </p>
      ) : null}
    </section>
  );
}

function AssignmentCell({ a, accuracy }) {
  return (
    <td className="px-3 py-3">
      {a ? (
        <>
          <div className="font-medium">{a.title}</div>
          <div className="text-xs text-muted-foreground">{a.subtitle}</div>
          {accuracy != null ? <div className="mt-0.5 text-xs">{accuracy}% avg</div> : null}
        </>
      ) : (
        <span className="text-xs text-muted-foreground">Not assigned</span>
      )}
    </td>
  );
}

function StudentCard({ s }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/teacher/students/${s.id}`} className="font-medium">
            {s.name}
          </Link>
          <div className="text-xs text-muted-foreground">{s.classes.map((c) => c.name).join(', ')}</div>
        </div>
        <span className={cn('text-xs', s.practicedToday ? 'text-success' : 'text-muted-foreground')}>
          {s.practicedToday ? `✓ ${s.minutesToday} min` : 'No practice'}
        </span>
      </div>
      <Flags flags={s.flags} />
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Mini label="Sabaq" value={s.sabaq?.title} />
        <Mini label="Sabqi" value={s.sabqi?.title} />
        <Mini label="Manzil" value={s.manzil?.title} />
      </dl>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {s.pagesMemorized} pages · {s.daysThisWeek}/7 days
        </span>
        <Link
          href={`/teacher/students/${s.id}/lesson`}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Record lesson
        </Link>
      </div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || '—'}</dd>
    </div>
  );
}

function Flags({ flags }) {
  if (!flags?.length) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1">
      {flags.slice(0, 3).map((f) => (
        <li
          key={f.code}
          className={cn(
            'rounded px-1.5 py-0.5 text-[11px]',
            f.level === 'high' && 'bg-destructive/10 text-destructive',
            f.level === 'medium' && 'bg-warning/15 text-warning',
            f.level === 'low' && 'bg-muted text-muted-foreground',
            f.level === 'good' && 'bg-success/10 text-success',
          )}
        >
          {f.label}
        </li>
      ))}
    </ul>
  );
}

function WeaknessBadge({ band }) {
  return (
    <span
      className={cn(
        'inline-block rounded px-1.5 py-0.5 text-[11px] font-medium',
        band === 'HIGH' && 'bg-destructive/10 text-destructive',
        band === 'MEDIUM' && 'bg-warning/15 text-warning',
        band === 'LOW' && 'bg-muted text-muted-foreground',
      )}
    >
      {band.toLowerCase()}
    </span>
  );
}

function Select({ value, onChange, options, label }) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
