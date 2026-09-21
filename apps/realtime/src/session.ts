import { prisma } from '@studentproj/db';

/// Auth.js session cookie names. The `__Secure-` variant is used on HTTPS
/// origins, so both are accepted and whichever is present wins.
const COOKIE_NAMES = ['__Secure-authjs.session-token', 'authjs.session-token'];

export interface SocketUser {
  id: string;
  name: string | null;
  image: string | null;
  gitlabUsername: string | null;
}

/// Reads a cookie value out of a raw Cookie header.
///
/// Cookies are not port-scoped, so a cookie set by the web app on
/// localhost:3000 is sent to this service on localhost:3001 unchanged. That is
/// what makes sharing the session possible without a second auth mechanism.
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

/// Resolves a websocket connection to a user by looking its session cookie up
/// in Postgres, the same row the web app's session was created in.
export async function authenticateSocket(cookieHeader: string | undefined): Promise<SocketUser | null> {
  for (const cookieName of COOKIE_NAMES) {
    const token = readCookie(cookieHeader, cookieName);
    if (!token) continue;

    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      select: {
        expires: true,
        user: { select: { id: true, name: true, image: true, gitlabUsername: true } },
      },
    });

    if (!session) continue;
    // An expired row is still present until something cleans it up, so the
    // expiry has to be checked here rather than assumed.
    if (session.expires.getTime() <= Date.now()) continue;

    return session.user;
  }

  return null;
}
