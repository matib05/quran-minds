import Link from 'next/link';
import { requireStudent } from '@/lib/auth/guards';
import { buildDailyPlan } from '@/lib/hifdh/practice-plan';
import { startPracticeSession } from '@/app/actions/practice';
import PracticeRunner from './practice-runner';

export const metadata = { title: 'Practice' };
export const dynamic = 'force-dynamic';

export default async function PracticePage() {
  const { student } = await requireStudent();
  const plan = await buildDailyPlan(student.id);

  if (!plan || plan.stages.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">Nothing assigned yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your teacher has not set today’s Sabaq, Sabqi or Manzil. Ask them to assign your portions
          and this page will fill in.
        </p>
        <Link
          href="/student"
          className="mt-4 inline-block rounded-md border px-4 py-2 text-sm hover:bg-muted"
        >
          Back to today
        </Link>
      </div>
    );
  }

  // Opening the page opens the session: the timer only ever counts interaction,
  // so there is nothing to game by loading this early.
  const { sessionId } = await startPracticeSession();

  return <PracticeRunner plan={plan} sessionId={sessionId} />;
}
