import { redirect } from 'next/navigation';
import { env } from '@/env';
import { currentUser, signIn } from '@/lib/auth';
import { devSignIn } from '@/lib/dev-login';
import { prisma } from '@studentproj/db';

export default async function SignInPage() {
  if (await currentUser()) redirect('/tasks');

  const demoStudents = env.devLoginEnabled
    ? await prisma.user.findMany({
        where: { gitlabUsername: { not: null }, profile: { isNot: null } },
        select: { name: true, gitlabUsername: true, profile: { select: { bio: true } } },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">TaskBuddy</h1>
        <p className="text-sm leading-relaxed text-(--color-ink-muted)">
          Tell us your stack and how much time you have. We will find GitLab tasks that fit, and
          give your project team somewhere to work together.
        </p>
      </header>

      {env.gitlabOAuthConfigured ? (
        <form
          action={async () => {
            'use server';
            await signIn('gitlab', { redirectTo: '/tasks' });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-(--color-accent) px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            Continue with GitLab
          </button>
          <p className="mt-2 text-center text-xs text-(--color-ink-faint)">
            {new URL(env.gitlabBaseUrl).host}
          </p>
        </form>
      ) : (
        <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) p-4 text-sm text-(--color-ink-muted)">
          <p className="font-medium text-(--color-ink)">GitLab sign-in is not configured yet.</p>
          <p className="mt-2 leading-relaxed">
            Register an OAuth application on your instance, then set{' '}
            <code className="text-(--color-ink)">GITLAB_CLIENT_ID</code> and{' '}
            <code className="text-(--color-ink)">GITLAB_CLIENT_SECRET</code> in{' '}
            <code className="text-(--color-ink)">.env</code>. The redirect URI must be exactly{' '}
            <code className="break-all text-(--color-ink)">
              http://localhost:3000/api/auth/callback/gitlab
            </code>
            .
          </p>
        </div>
      )}

      {demoStudents.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-(--color-border-subtle)" />
            <span className="text-xs uppercase tracking-wider text-(--color-ink-faint)">
              or sign in as a demo student
            </span>
            <span className="h-px flex-1 bg-(--color-border-subtle)" />
          </div>

          <ul className="space-y-2">
            {demoStudents.map((student) => (
              <li key={student.gitlabUsername}>
                <form
                  action={async () => {
                    'use server';
                    await devSignIn(student.gitlabUsername!);
                  }}
                >
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-4 py-3 text-left transition hover:bg-(--color-surface-hover)"
                  >
                    <span className="block text-sm font-medium">{student.name}</span>
                    <span className="mt-0.5 block text-xs text-(--color-ink-muted)">
                      {student.profile?.bio}
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>

          <p className="text-xs leading-relaxed text-(--color-ink-faint)">
            Demo sign-in has no password and is only available in development with{' '}
            <code>ALLOW_DEV_LOGIN=true</code>.
          </p>
        </section>
      )}
    </main>
  );
}
