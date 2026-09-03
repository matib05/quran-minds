import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { homeFor } from '@/lib/auth/guards';
import LoginForm from './login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <span className="quran-md block text-primary" dir="rtl">
              ٱقْرَأْ
            </span>
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Quran Minds</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to continue your Hifdh</p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>

        <DemoAccounts />
      </div>
    </main>
  );
}

/**
 * Shown only outside production so the demo dataset is actually usable.
 */
function DemoAccounts() {
  if (process.env.NODE_ENV === 'production' && process.env.SHOW_DEMO_ACCOUNTS !== 'true') return null;
  const accounts = [
    ['Teacher', 'yusuf@quranminds.app'],
    ['Student', 'ahmad@quranminds.app'],
    ['Parent', 'parent@quranminds.app'],
    ['Admin', 'admin@quranminds.app'],
  ];
  return (
    <div className="mt-6 rounded-lg border border-dashed bg-muted/40 p-4 text-xs text-muted-foreground">
      <p className="mb-2 font-medium text-foreground">Demo accounts</p>
      <ul className="space-y-1">
        {accounts.map(([role, email]) => (
          <li key={email} className="flex justify-between gap-2">
            <span>{role}</span>
            <span className="font-mono">{email}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2">
        Password for all: <span className="font-mono">Password123</span>
      </p>
    </div>
  );
}
