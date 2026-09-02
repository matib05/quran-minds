'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, destroySession, pruneExpiredSessions } from '@/lib/auth/session';
import { homeFor } from '@/lib/auth/guards';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

/**
 * Sign in. Returns `{ error }` on failure so the form can render it; on
 * success it redirects, which throws, so nothing is returned.
 */
export async function signIn(_prevState, formData) {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Same message either way - never reveal which accounts exist.
  const ok = user && user.active && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!ok) {
    return { error: 'Email or password is incorrect' };
  }

  await pruneExpiredSessions();
  await createSession(user.id);
  redirect(homeFor(user.role));
}

export async function signOut() {
  await destroySession();
  redirect('/login');
}
