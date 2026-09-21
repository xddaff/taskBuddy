import { prisma } from '@studentproj/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { NewConversation, type StudentOption } from '@/components/chat/NewConversation';
import { requireOnboardedUser } from '@/lib/data';

export const metadata: Metadata = { title: 'New conversation · TaskBuddy' };

export default async function NewConversationPage() {
  const { user } = await requireOnboardedUser();

  const [students, existingDms] = await Promise.all([
    prisma.user.findMany({
      where: { id: { not: user.id }, profile: { onboardedAt: { not: null } } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        image: true,
        gitlabUsername: true,
        profile: {
          select: {
            skills: {
              orderBy: { proficiency: 'desc' },
              take: 3,
              select: { tag: { select: { label: true } } },
            },
          },
        },
      },
    }),

    prisma.conversation.findMany({
      where: { type: 'DM', members: { some: { userId: user.id } } },
      select: {
        id: true,
        members: { where: { userId: { not: user.id } }, select: { userId: true } },
      },
    }),
  ]);

  const dmByUserId = new Map<string, string>();
  for (const conversation of existingDms) {
    const other = conversation.members[0];
    if (other) dmByUserId.set(other.userId, conversation.id);
  }

  const options: StudentOption[] = students.map((student) => ({
    id: student.id,
    name: student.name,
    image: student.image,
    gitlabUsername: student.gitlabUsername,
    skills: (student.profile?.skills ?? []).map((skill) => skill.tag.label),
    existingConversationId: dmByUserId.get(student.id) ?? null,
  }));

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Start a conversation</h1>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            Pick one person for a direct message, or several for a group chat. Channels live in a{' '}
            <Link href="/tasks" className="text-(--color-accent) hover:underline">
              workspace
            </Link>{' '}
            instead, so the whole team can see them.
          </p>
        </header>

        {options.length === 0 ? (
          <p className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-6 text-sm text-(--color-ink-muted)">
            Nobody else has finished onboarding yet, so there is no one to message. Load the demo
            students with <code className="text-(--color-ink)">pnpm db:seed</code>.
          </p>
        ) : (
          <NewConversation students={options} />
        )}
      </div>
    </main>
  );
}
