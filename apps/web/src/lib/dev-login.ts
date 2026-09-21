'use server';

import { prisma } from '@studentproj/db';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/env';

/// Auth.js session cookie name for a non-HTTPS origin. On HTTPS it is prefixed
/// with `__Secure-`, but dev sign-in only ever runs over http on localhost.
const SESSION_COOKIE = 'authjs.session-token';
const SESSION_DAYS = 30;

/// Signs in as an already-seeded student, with no password.
///
/// Auth.js cannot pair a Credentials provider with database sessions, and
/// database sessions are load-bearing here: the realtime service authenticates
/// websockets by looking the session cookie up in Postgres. So this writes the
/// Session row and sets the cookie directly, producing a session
/// indistinguishable from one created by the OAuth flow.
///
/// Guarded three ways: it refuses unless NODE_ENV is not production and
/// ALLOW_DEV_LOGIN is explicitly true, and it will only assume a user that
/// already exists with a GitLab username, which in practice means one the seed
/// script created. It cannot be used to create an account.
export async function devSignIn(username: string): Promise<void> {
  if (!env.devLoginEnabled) {
    throw new Error('Dev sign-in is disabled.');
  }

  const user = await prisma.user.findUnique({
    where: { gitlabUsername: username.trim() },
    select: { id: true },
  });
  if (!user) {
    throw new Error(`No seeded student with username "${username}". Run pnpm db:seed.`);
  }

  const sessionToken = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });

  (await cookies()).set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires,
  });

  redirect('/tasks');
}
