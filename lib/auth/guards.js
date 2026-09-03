import 'server-only';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getCurrentUser } from './session';

/** Home route for each role, used after sign-in and by the guards below. */
export function homeFor(role) {
  switch (role) {
    case 'TEACHER':
    case 'ADMIN':
      return '/teacher';
    case 'STUDENT':
      return '/student';
    case 'PARENT':
      return '/parent';
    default:
      return '/';
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Require one of `roles`; anyone else is sent to their own home. */
export async function requireRole(...roles) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export async function requireStudent() {
  const user = await requireRole('STUDENT');
  if (!user.studentProfile) redirect('/login');
  return { user, student: user.studentProfile };
}

/**
 * True when `user` is allowed to see this student's data:
 * the student themselves, a teacher of one of their classes, a linked parent,
 * or an admin of the same school.
 */
export async function canAccessStudent(user, studentId) {
  if (!user || !studentId) return false;
  if (user.role === 'STUDENT') return user.studentProfile?.id === studentId;
  if (user.role === 'PARENT') {
    const link = await prisma.parentLink.findFirst({ where: { parentId: user.id, studentId } });
    return Boolean(link);
  }
  if (user.role === 'ADMIN') {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: { user: { select: { schoolId: true } } },
    });
    return Boolean(profile) && profile.user.schoolId === user.schoolId;
  }
  if (user.role === 'TEACHER') {
    const shared = await prisma.enrollment.findFirst({
      where: {
        studentId,
        active: true,
        class: { teachers: { some: { teacherId: user.id } } },
      },
      select: { id: true },
    });
    return Boolean(shared);
  }
  return false;
}

/** Throws (rather than redirects) - for use inside server actions. */
export async function assertCanAccessStudent(user, studentId) {
  if (!(await canAccessStudent(user, studentId))) {
    throw new Error('You do not have access to this student');
  }
}

/** Every student this teacher/admin/parent may see, with their user record. */
export async function visibleStudents(user) {
  if (user.role === 'TEACHER') {
    return prisma.studentProfile.findMany({
      where: { enrollments: { some: { active: true, class: { teachers: { some: { teacherId: user.id } } } } } },
      include: { user: true, enrollments: { include: { class: true } } },
      orderBy: { user: { name: 'asc' } },
    });
  }
  if (user.role === 'ADMIN') {
    return prisma.studentProfile.findMany({
      where: { user: { schoolId: user.schoolId } },
      include: { user: true, enrollments: { include: { class: true } } },
      orderBy: { user: { name: 'asc' } },
    });
  }
  if (user.role === 'PARENT') {
    return prisma.studentProfile.findMany({
      where: { parentLinks: { some: { parentId: user.id } } },
      include: { user: true, enrollments: { include: { class: true } } },
      orderBy: { user: { name: 'asc' } },
    });
  }
  return [];
}
