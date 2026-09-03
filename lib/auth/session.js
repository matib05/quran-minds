import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import prisma from '@/lib/prisma';

const COOKIE = 'qm_session';
const MAX_AGE_DAYS = 30;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/** Issue a session and set the cookie. Returns the raw token. */
export async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + MAX_AGE_DAYS * 86400_000);

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(COOKIE);
}

/**
 * The signed-in user for this request, or null.
 * Wrapped in React `cache` so a page that checks auth in several places still
 * makes a single query.
 */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          studentProfile: true,
          school: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date() || !session.user?.active) return null;
  return session.user;
});

/** Delete expired sessions. Called opportunistically on sign-in. */
export async function pruneExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
