import Link from 'next/link';
import { signOut } from '@/lib/auth';
import { conversationTitle, getSidebarData, getUnreadCounts } from '@/lib/data';
import { Avatar } from './Avatar';

interface Props {
  userId: string;
  userName: string | null;
  userImage: string | null | undefined;
}

const DOC_ICON: Record<string, string> = {
  REPORT: 'R',
  PLAN: 'P',
  FREEFORM: 'D',
};

export async function Sidebar({ userId, userName, userImage }: Props) {
  const [{ workspaces, directConversations, unreadMentions }, unread] = await Promise.all([
    getSidebarData(userId),
    getUnreadCounts(userId),
  ]);

  return (
    <nav
      aria-label="Main"
      className="flex h-screen w-64 shrink-0 flex-col border-r border-(--color-border-subtle) bg-(--color-surface-raised)"
    >
      <div className="px-4 py-4">
        <Link href="/tasks" className="text-sm font-semibold tracking-tight">
          TaskBuddy
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <ul className="space-y-0.5">
          <SidebarLink href="/tasks" label="My tasks" />
          <SidebarLink href="/tasks/saved" label="Saved and claimed" />
          <SidebarLink
            href="/mentions"
            label="Mentions"
            badge={unreadMentions > 0 ? unreadMentions : undefined}
          />
          <SidebarLink href="/search" label="Search messages" />
        </ul>

        <Section
          heading="Direct messages"
          action={
            <Link
              href="/c/new"
              aria-label="Start a new conversation"
              className="rounded px-1 text-sm text-(--color-ink-faint) transition hover:text-(--color-ink)"
            >
              +
            </Link>
          }
        >
          {directConversations.length === 0 ? (
            <EmptyHint>No conversations yet.</EmptyHint>
          ) : (
            <ul className="space-y-0.5">
              {directConversations.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    href={`/c/${conversation.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-(--color-ink-muted) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink)"
                  >
                    {conversation.type === 'DM' && conversation.members[0] ? (
                      <Avatar
                        name={conversation.members[0].user.name}
                        image={conversation.members[0].user.image}
                        size="sm"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--color-surface-hover) text-[10px]"
                      >
                        {conversation.members.length + 1}
                      </span>
                    )}
                    <span className="flex-1 truncate">{conversationTitle(conversation)}</span>
                    <UnreadBadge count={unread.get(conversation.id)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {workspaces.map((workspace) => (
          <Section
            key={workspace.id}
            heading={workspace.name}
            headingHref={`/w/${workspace.slug}`}
          >
            <ul className="space-y-0.5">
              {workspace.conversations.map((channel) => (
                <li key={channel.id}>
                  <Link
                    href={`/c/${channel.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-(--color-ink-muted) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink)"
                  >
                    <span aria-hidden="true" className="text-(--color-ink-faint)">
                      #
                    </span>
                    <span className="flex-1 truncate">{channel.name}</span>
                    <UnreadBadge count={unread.get(channel.id)} />
                  </Link>
                </li>
              ))}

              {workspace.documents.map((document) => (
                <li key={document.id}>
                  <Link
                    href={`/d/${document.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-(--color-ink-muted) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink)"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-(--color-surface-hover) text-[9px] text-(--color-ink-faint)"
                    >
                      {DOC_ICON[document.type] ?? 'D'}
                    </span>
                    <span className="flex-1 truncate">{document.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ))}

        <Section heading="Workspaces">
          <Link
            href="/w/new"
            className="block rounded-md px-2 py-1.5 text-sm text-(--color-ink-muted) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink)"
          >
            + New workspace
          </Link>
        </Section>
      </div>

      <div className="border-t border-(--color-border-subtle) p-3">
        <div className="flex items-center gap-2">
          <Avatar name={userName} image={userImage} />
          <div className="min-w-0 flex-1">
            <Link href="/onboarding" className="block truncate text-sm hover:underline">
              {userName ?? 'Student'}
            </Link>
            <span className="text-xs text-(--color-ink-faint)">Edit profile</span>
          </div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/signin' });
            }}
          >
            <button
              type="submit"
              className="rounded px-2 py-1 text-xs text-(--color-ink-faint) transition hover:text-(--color-ink)"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}

function SidebarLink({
  href,
  label,
  badge,
}: {
  href: string;
  label: string;
  badge?: number;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-(--color-ink-muted) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink)"
      >
        <span className="flex-1">{label}</span>
        <UnreadBadge count={badge} />
      </Link>
    </li>
  );
}

function Section({
  heading,
  headingHref,
  action,
  children,
}: {
  heading: string;
  headingHref?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between px-2 pb-1">
        {headingHref ? (
          <Link
            href={headingHref}
            className="truncate text-xs font-medium uppercase tracking-wider text-(--color-ink-faint) hover:text-(--color-ink-muted)"
          >
            {heading}
          </Link>
        ) : (
          <h2 className="truncate text-xs font-medium uppercase tracking-wider text-(--color-ink-faint)">
            {heading}
          </h2>
        )}
        {action}
      </div>
      {children}
    </div>
  );
}

function UnreadBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="rounded-full bg-(--color-accent) px-1.5 py-0.5 text-[10px] font-medium text-white">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> unread</span>
    </span>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-1 text-xs text-(--color-ink-faint)">{children}</p>;
}
