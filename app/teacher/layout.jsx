import { requireRole } from '@/lib/auth/guards';
import AppShell from '@/components/shell/app-shell';

const NAV = [
  { key: 'dashboard', href: '/teacher', label: 'Students' },
  { key: 'mushaf', href: '/teacher/mushaf', label: 'Mushaf' },
];

export default async function TeacherLayout({ children }) {
  const user = await requireRole('TEACHER', 'ADMIN');
  return (
    <AppShell user={user} nav={NAV} wide>
      {children}
    </AppShell>
  );
}
