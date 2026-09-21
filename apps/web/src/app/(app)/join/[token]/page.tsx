import { prisma } from '@studentproj/db';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireOnboardedUser } from '@/lib/data';
import { absoluteTime, relativeTime } from '@/lib/format';
import { JoinForm } from './JoinForm';

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { user } = await requireOnboardedUser();

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      usedAt: true,
      createdById: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          _count: { select: { members: true, conversations: true } },
        },
      },
    },
  });

  // Every rejection reads the same from outside: whether a token is unknown,
  // spent or expired is only shown here, never as a crash or a redirect that
  // leaves the student guessing.
  if (!invite) {
    return (
      <Outcome title="That invite link is not valid">
        The link may have been mistyped, or the invite was revoked. Ask whoever sent it for a
        fresh one.
      </Outcome>
    );
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: invite.workspace.id, userId: user.id } },
    select: { role: true },
  });

  if (membership) {
    return (
      <Outcome
        title={`You are already in ${invite.workspace.name}`}
        action={{ href: `/w/${invite.workspace.slug}`, label: 'Open the workspace' }}
      >
        Nothing to accept. The invite is still there for whoever else needs it.
      </Outcome>
    );
  }

  if (invite.usedAt) {
    return (
      <Outcome title="That invite link has already been used">
        Invite links work once, and this one was claimed {relativeTime(invite.usedAt)}. Ask an
        owner or admin of {invite.workspace.name} for a new link.
      </Outcome>
    );
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    return (
      <Outcome title="That invite link has expired">
        It lapsed {relativeTime(invite.expiresAt)}. Ask an owner or admin of{' '}
        {invite.workspace.name} for a new link.
      </Outcome>
    );
  }

  const inviter = await prisma.user.findUnique({
    where: { id: invite.createdById },
    select: { name: true },
  });

  return (
    <Shell>
      <p className="text-xs uppercase tracking-wider text-(--color-ink-faint)">
        Workspace invite
      </p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">{invite.workspace.name}</h1>

      {invite.workspace.description && (
        <p className="mt-2 text-sm leading-relaxed text-(--color-ink-muted)">
          {invite.workspace.description}
        </p>
      )}

      <p className="mt-3 text-xs text-(--color-ink-faint)">
        {inviter?.name ? `Invited by ${inviter.name}. ` : ''}
        {invite.workspace._count.members}{' '}
        {invite.workspace._count.members === 1 ? 'member' : 'members'} &middot;{' '}
        {invite.workspace._count.conversations}{' '}
        {invite.workspace._count.conversations === 1 ? 'channel' : 'channels'} &middot; link valid
        until {absoluteTime(invite.expiresAt)}
      </p>

      <p className="mt-4 text-sm text-(--color-ink-muted)">
        Joining adds you as a member and subscribes you to the channels that already exist.
      </p>

      <div className="mt-5 space-y-3">
        <JoinForm token={token} workspaceName={invite.workspace.name} />
        <Link
          href="/tasks"
          className="block text-center text-xs text-(--color-ink-faint) hover:text-(--color-ink)"
        >
          Not now
        </Link>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-md px-6 py-16">
        <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-6">
          {children}
        </div>
      </div>
    </main>
  );
}

function Outcome({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <Shell>
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-(--color-ink-muted)">{children}</p>
      <div className="mt-5 flex items-center gap-3">
        {action && (
          <Link
            href={action.href}
            className="rounded-lg bg-(--color-accent) px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            {action.label}
          </Link>
        )}
        <Link
          href="/tasks"
          className="text-sm text-(--color-ink-muted) transition hover:text-(--color-ink)"
        >
          Back to your tasks
        </Link>
      </div>
    </Shell>
  );
}
