import Link from 'next/link';
import { signOut } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

/**
 * The frame every signed-in page sits in. Navigation collapses to a scrollable
 * row on phones rather than hiding behind a menu - students practise on
 * phones, and a hidden nav is a nav nobody uses.
 */
export default function AppShell({ user, nav = [], current, children, wide = false }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="quran text-xl leading-none text-primary">ٱقْرَأْ</span>
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">Quran Minds</span>
          </Link>

          <nav className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors',
                  current === item.key
                    ? 'bg-secondary font-medium text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">{user.name}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className={cn('mx-auto w-full flex-1 px-4 py-6', wide ? 'max-w-7xl' : 'max-w-5xl')}>
        {children}
      </main>

      <footer className="border-t py-4">
        <p className="mx-auto max-w-7xl px-4 text-xs text-muted-foreground">
          Qur’an text and structural metadata from{' '}
          <a href="https://tanzil.net" className="underline" target="_blank" rel="noreferrer noopener">
            Tanzil.net
          </a>{' '}
          (Uthmani minimal edition; metadata CC BY 3.0). Recitation audio served by{' '}
          <a href="https://everyayah.com" className="underline" target="_blank" rel="noreferrer noopener">
            EveryAyah.com
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
