import { requireStudent } from '@/lib/auth/guards';
import AppShell from '@/components/shell/app-shell';

const NAV = [
  { key: 'today', href: '/student', label: 'Today' },
  { key: 'memorize', href: '/student/memorize', label: 'Memorize' },
  { key: 'weak', href: '/student/weak-spots', label: 'Weak spots' },
  { key: 'progress', href: '/student/progress', label: 'Progress' },
];

export default async function StudentLayout({ children }) {
  const { user } = await requireStudent();
  return (
    <AppShell user={user} nav={NAV}>
      {children}
    </AppShell>
  );
}
