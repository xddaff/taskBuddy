import { prisma, type WorkspaceRole } from '@studentproj/db';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/Avatar';
import { requireOnboardedUser, requireWorkspaceAccess } from '@/lib/data';
import { absoluteTime, relativeTime } from '@/lib/format';
import { INVITE_LIFETIME_DAYS } from './invites';
import {
  CopyLinkButton,
  CreateInviteForm,
  MemberActions,
  NewChannelForm,
  NewDocumentForm,
  RevokeInviteButton,
} from './forms';

const ROLE_ORDER: Record<WorkspaceRole, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
};

const DOCUMENT_LABEL: Record<string, string> = {
  REPORT: 'Report',
  PLAN: 'Plan',
  FREEFORM: 'Freeform',
};

export default async function WorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user } = await requireOnboardedUser();
  const workspace = await requireWorkspaceAccess(slug, user.id);

  const myRole = workspace.members.find((member) => member.user.id === user.id)?.role ?? 'MEMBER';
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  const [channels, documents, invites, projects] = await Promise.all([
    prisma.conversation.findMany({
      where: { workspaceId: workspace.id, type: 'CHANNEL' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        topic: true,
        lastMessageAt: true,
        _count: { select: { members: true } },
        members: { where: { userId: user.id }, select: { id: true } },
      },
    }),
    prisma.document.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, type: true, updatedAt: true },
    }),
    canManage
      ? prisma.workspaceInvite.findMany({
          where: { workspaceId: workspace.id },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            token: true,
            expiresAt: true,
            usedAt: true,
            usedById: true,
            createdAt: true,
          },
        })
      : [],
    workspace.gitlabProjectIds.length > 0
      ? prisma.gitlabProject.findMany({
          where: { gitlabId: { in: workspace.gitlabProjectIds } },
          orderBy: { name: 'asc' },
          select: {
            gitlabId: true,
            name: true,
            pathWithNamespace: true,
            webUrl: true,
            openIssueCount: true,
          },
        })
      : [],
  ]);

  const joinerIds = invites.map((invite) => invite.usedById).filter((id): id is string => !!id);
  const joiners = joinerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: joinerIds } },
        select: { id: true, name: true },
      })
    : [];
  const joinerNames = new Map(joiners.map((joiner) => [joiner.id, joiner.name ?? 'Someone']));

  const members = [...workspace.members].sort(
    (a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      (a.user.name ?? '').localeCompare(b.user.name ?? ''),
  );

  const now = new Date();

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{workspace.name}</h1>
            <RolePill role={myRole} />
          </div>
          {workspace.description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-(--color-ink-muted)">
              {workspace.description}
            </p>
          )}
          <p className="mt-2 text-xs text-(--color-ink-faint)">
            /w/{workspace.slug} &middot; {members.length}{' '}
            {members.length === 1 ? 'member' : 'members'} &middot; {channels.length}{' '}
            {channels.length === 1 ? 'channel' : 'channels'}
          </p>
        </header>

        <div className="space-y-6">
          <Section
            title="Channels"
            description={
              canManage
                ? 'Everyone in the workspace is added to every channel.'
                : 'Ask an owner or admin if you need another channel.'
            }
          >
            {channels.length === 0 ? (
              <Empty>No channels yet.</Empty>
            ) : (
              <ul className="divide-y divide-(--color-border-subtle)">
                {channels.map((channel) => {
                  const joined = channel.members.length > 0;
                  return (
                    <li key={channel.id} className="flex items-center gap-3 py-2.5">
                      <span aria-hidden="true" className="text-(--color-ink-faint)">
                        #
                      </span>
                      <span className="min-w-0 flex-1">
                        {joined ? (
                          <Link
                            href={`/c/${channel.id}`}
                            className="block truncate text-sm hover:text-(--color-accent) hover:underline"
                          >
                            {channel.name}
                          </Link>
                        ) : (
                          <span className="block truncate text-sm text-(--color-ink-muted)">
                            {channel.name}
                          </span>
                        )}
                        {channel.topic && (
                          <span className="block truncate text-xs text-(--color-ink-faint)">
                            {channel.topic}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-(--color-ink-faint)">
                        {joined
                          ? channel.lastMessageAt
                            ? `active ${relativeTime(channel.lastMessageAt, now)}`
                            : 'no messages yet'
                          : 'you are not in this channel'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {canManage && (
              <div className="mt-4 border-t border-(--color-border-subtle) pt-4">
                <NewChannelForm slug={workspace.slug} />
              </div>
            )}
          </Section>

          <Section
            title="Documents"
            description="Shared reports and plans for this team, editable by every member."
          >
            {documents.length === 0 ? (
              <Empty>No documents yet. The first one starts with a set of headings.</Empty>
            ) : (
              <ul className="divide-y divide-(--color-border-subtle)">
                {documents.map((document) => (
                  <li key={document.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <Link
                        href={`/d/${document.id}`}
                        className="block truncate text-sm hover:text-(--color-accent) hover:underline"
                      >
                        {document.title}
                      </Link>
                      <span className="block text-xs text-(--color-ink-faint)">
                        {DOCUMENT_LABEL[document.type] ?? 'Document'} &middot; edited{' '}
                        {relativeTime(document.updatedAt, now)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 border-t border-(--color-border-subtle) pt-4">
              <NewDocumentForm slug={workspace.slug} />
            </div>
          </Section>

          <Section
            title="Members"
            description={
              canManage
                ? 'Owners and admins can change roles and remove people. A workspace always keeps at least one owner.'
                : 'You can leave at any time.'
            }
          >
            <ul className="divide-y divide-(--color-border-subtle)">
              {members.map((member) => {
                const isSelf = member.user.id === user.id;
                return (
                  <li key={member.user.id} className="flex items-center gap-3 py-3">
                    <Avatar name={member.user.name} image={member.user.image} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {member.user.name ?? 'Unknown student'}
                        {isSelf && <span className="text-(--color-ink-faint)"> (you)</span>}
                      </p>
                      <p className="truncate text-xs text-(--color-ink-faint)">
                        {member.user.gitlabUsername
                          ? `@${member.user.gitlabUsername}`
                          : 'No GitLab account linked'}
                      </p>
                    </div>
                    <RolePill role={member.role} />
                    <MemberActions
                      slug={workspace.slug}
                      memberUserId={member.user.id}
                      memberName={member.user.name ?? 'this member'}
                      role={member.role}
                      canManage={canManage}
                      isSelf={isSelf}
                    />
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section
            title="Linked GitLab projects"
            description="Task suggestions in this workspace are drawn from these repositories."
          >
            {projects.length === 0 ? (
              <Empty>
                Nothing linked, so suggestions come from everything indexed. Link projects when
                the team settles on a repository.
              </Empty>
            ) : (
              <ul className="divide-y divide-(--color-border-subtle)">
                {projects.map((project) => (
                  <li key={project.gitlabId} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <a
                        href={project.webUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm hover:text-(--color-accent) hover:underline"
                      >
                        {project.name}
                      </a>
                      <span className="block truncate text-xs text-(--color-ink-faint)">
                        {project.pathWithNamespace}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-(--color-ink-faint)">
                      {project.openIssueCount} open
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {canManage && (
            <Section
              title="Invites"
              description={`Anyone with a link can join as a member. Links expire after ${INVITE_LIFETIME_DAYS} days and work once.`}
            >
              {invites.length === 0 ? (
                <Empty>No invite links yet.</Empty>
              ) : (
                <ul className="divide-y divide-(--color-border-subtle)">
                  {invites.map((invite) => {
                    const path = `/join/${invite.token}`;
                    const used = invite.usedAt !== null;
                    const expired = !used && invite.expiresAt.getTime() <= now.getTime();
                    const active = !used && !expired;

                    return (
                      <li
                        key={invite.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate font-mono text-xs ${
                              active ? 'text-(--color-ink-muted)' : 'text-(--color-ink-faint)'
                            }`}
                          >
                            {path}
                          </p>
                          <p className="mt-0.5 text-xs text-(--color-ink-faint)">
                            {used
                              ? `Used by ${joinerNames.get(invite.usedById ?? '') ?? 'someone'} ${relativeTime(
                                  invite.usedAt ?? invite.createdAt,
                                  now,
                                )}`
                              : expired
                                ? `Expired ${relativeTime(invite.expiresAt, now)}`
                                : `Created ${relativeTime(invite.createdAt, now)}, expires ${absoluteTime(invite.expiresAt)}`}
                          </p>
                        </div>

                        <StatusPill
                          tone={active ? 'positive' : 'muted'}
                          label={used ? 'Used' : expired ? 'Expired' : 'Active'}
                        />

                        {active && (
                          <>
                            <CopyLinkButton path={path} label="this invite" />
                            <RevokeInviteButton slug={workspace.slug} inviteId={invite.id} />
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-4 border-t border-(--color-border-subtle) pt-4">
                <CreateInviteForm slug={workspace.slug} />
              </div>
            </Section>
          )}
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      {description && <p className="mt-1 text-xs text-(--color-ink-muted)">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function RolePill({ role }: { role: WorkspaceRole }) {
  const tone =
    role === 'OWNER'
      ? 'border-(--color-accent) text-(--color-accent)'
      : role === 'ADMIN'
        ? 'border-(--color-border-subtle) text-(--color-ink-muted)'
        : 'border-(--color-border-subtle) text-(--color-ink-faint)';

  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${tone}`}>
      {ROLE_LABEL[role]}
    </span>
  );
}

function StatusPill({ tone, label }: { tone: 'positive' | 'muted'; label: string }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${
        tone === 'positive'
          ? 'border-(--color-positive) text-(--color-positive)'
          : 'border-(--color-border-subtle) text-(--color-ink-faint)'
      }`}
    >
      {label}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-(--color-ink-faint)">{children}</p>;
}
