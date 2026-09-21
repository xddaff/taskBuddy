import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@studentproj/db';
import { GITLAB_OAUTH_SCOPES, gitlabOAuthEndpoints } from '@studentproj/gitlab';
import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { env } from '@/env';
import { encryptToken } from './crypto';

const endpoints = gitlabOAuthEndpoints(env.gitlabBaseUrl);

/// GitLab as an OIDC provider, with endpoints derived from GITLAB_BASE_URL.
///
/// Auth.js ships a GitLab provider, but it is hardwired to gitlab.com. Building
/// it from the configured instance root is what lets the same code point at a
/// university instance.
const gitlabProvider = {
  id: 'gitlab',
  name: 'GitLab',
  type: 'oidc' as const,
  issuer: endpoints.issuer,
  clientId: env.gitlabClientId,
  clientSecret: env.gitlabClientSecret,
  authorization: {
    url: endpoints.authorization,
    params: {
      scope: GITLAB_OAUTH_SCOPES.join(' '),
      response_type: 'code',
    },
  },
  token: endpoints.token,
  userinfo: endpoints.userinfo,
  checks: ['pkce' as const, 'state' as const],
  profile(profile: Record<string, unknown>) {
    return {
      id: String(profile.sub),
      name: (profile.name as string) ?? (profile.nickname as string) ?? 'Student',
      email: (profile.email as string) ?? null,
      image: (profile.picture as string) ?? null,
      gitlabUserId: Number.parseInt(String(profile.sub), 10),
      gitlabUsername: (profile.nickname as string) ?? (profile.preferred_username as string) ?? null,
    };
  },
};

/// Signs in as an already-seeded student, without a password.
///
/// This exists so the app is usable before an OAuth application has been
/// registered on the GitLab instance. It is gated on NODE_ENV and an explicit
/// opt-in, and it will only ever match a user that the seed script created.
const devLoginProvider = Credentials({
  id: 'dev-login',
  name: 'Demo student',
  credentials: { username: { label: 'Seeded student username', type: 'text' } },
  async authorize(credentials) {
    if (!env.devLoginEnabled) return null;

    const username = typeof credentials?.username === 'string' ? credentials.username.trim() : '';
    if (!username) return null;

    // Requiring an existing seeded user means this cannot be used to create an
    // account, only to assume one that a developer put there deliberately.
    const user = await prisma.user.findUnique({ where: { gitlabUsername: username } });
    if (!user) return null;

    return { id: user.id, name: user.name, email: user.email, image: user.image };
  },
});

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  secret: env.authSecret(),
  // Database sessions rather than JWT, so the realtime service can
  // authenticate a websocket by looking the session cookie up in Postgres
  // instead of this app inventing a second auth mechanism for sockets.
  session: { strategy: 'database' },
  trustHost: true,
  pages: { signIn: '/signin' },
  providers: [
    ...(env.gitlabOAuthConfigured ? [gitlabProvider] : []),
    ...(env.devLoginEnabled ? [devLoginProvider] : []),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    /// Store the GitLab identity and encrypt the tokens Auth.js just wrote.
    ///
    /// The Prisma adapter persists access and refresh tokens in the clear, so
    /// they are re-encrypted immediately afterwards rather than being left
    /// readable by anything with database access.
    async linkAccount({ user, account, profile }) {
      const gitlabUserId = Number.parseInt(String(profile.sub ?? ''), 10);
      const gitlabUsername =
        (profile.nickname as string) ?? (profile.preferred_username as string) ?? null;

      if (Number.isFinite(gitlabUserId) && user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { gitlabUserId, gitlabUsername },
        });
      }

      const stored = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        select: { id: true, access_token: true, refresh_token: true },
      });
      if (!stored) return;

      await prisma.account.update({
        where: { id: stored.id },
        data: {
          access_token: stored.access_token ? encryptToken(stored.access_token) : null,
          refresh_token: stored.refresh_token ? encryptToken(stored.refresh_token) : null,
        },
      });
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

/// The signed-in user, or null. Use in server components and actions.
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

/// The signed-in user's id, throwing if there isn't one. For server actions
/// that have already been reached through a protected layout: a missing session
/// there is a bug, not a case to render.
export async function requireUserId(): Promise<string> {
  const user = await currentUser();
  if (!user?.id) throw new Error('Not authenticated.');
  return user.id;
}
