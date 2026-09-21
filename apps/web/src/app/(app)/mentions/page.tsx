import { prisma } from '@studentproj/db';
import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { conversationTitle, requireOnboardedUser } from '@/lib/data';
import { absoluteTime, relativeTime } from '@/lib/format';
import { markAllMentionsRead } from './actions';

/// How far back a mention that has already been read is still worth showing.
///
/// Unread mentions are the point of the page, but dropping read ones the
/// instant they are read would make it impossible to find the thing you
/// glanced at yesterday.
const READ_HISTORY_DAYS = 14;

const PREVIEW_LENGTH = 280;

export default async function MentionsPage() {
  const { user } = await requireOnboardedUser();

  const since = new Date(Date.now() - READ_HISTORY_DAYS * 86_400_000);

  const mentions = await prisma.mention.findMany({
    where: {
      userId: user.id,
      message: { deletedAt: null },
      OR: [{ readAt: null }, { readAt: { gte: since } }],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      readAt: true,
      createdAt: true,
      message: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true, image: true } },
          conversation: {
            select: {
              id: true,
              type: true,
              name: true,
              workspace: { select: { name: true, slug: true } },
              members: {
                where: { userId: { not: user.id } },
                select: { user: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  const unreadCount = mentions.filter((mention) => mention.readAt === null).length;
  const now = new Date();

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Mentions</h1>
            <p className="mt-1 text-sm text-(--color-ink-muted)">
              Where someone has asked for you by name. Read ones stay here for{' '}
              {READ_HISTORY_DAYS} days.
            </p>
          </div>

          {unreadCount > 0 && (
            <form
              action={async () => {
                'use server';
                await markAllMentionsRead();
              }}
            >
              <button
                type="submit"
                className="shrink-0 rounded-md border border-(--color-border-subtle) px-3 py-1.5 text-xs text-(--color-ink-muted) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink)"
              >
                Mark all read
              </button>
            </form>
          )}
        </header>

        <p aria-live="polite" className="sr-only">
          {unreadCount} unread {unreadCount === 1 ? 'mention' : 'mentions'}.
        </p>

        {mentions.length === 0 ? (
          <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-6">
            <h2 className="font-medium">Nothing waiting on you</h2>
            <p className="mt-2 text-sm leading-relaxed text-(--color-ink-muted)">
              When a teammate writes{' '}
              <code className="text-(--color-ink)">
                @{user.name?.split(' ')[0]?.toLowerCase() ?? 'you'}
              </code>{' '}
              in a conversation you are in, it turns up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {mentions.map((mention) => {
              const conversation = mention.message.conversation;
              const label =
                conversation.type === 'CHANNEL'
                  ? `#${conversation.name ?? 'channel'}`
                  : conversationTitle(conversation);
              const unread = mention.readAt === null;
              const body = mention.message.body.trim();

              return (
                <li key={mention.id}>
                  <Link
                    href={`/c/${conversation.id}#message-${mention.message.id}`}
                    className={`flex gap-3 rounded-xl border bg-(--color-surface-raised) p-4 transition hover:border-(--color-ink-faint) ${
                      unread ? 'border-(--color-accent)/40' : 'border-(--color-border-subtle)'
                    }`}
                  >
                    <Avatar
                      name={mention.message.author.name}
                      image={mention.message.author.image}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-sm">
                          <span className="font-medium">
                            {mention.message.author.name ?? 'Someone'}
                          </span>
                          <span className="text-(--color-ink-faint)"> in </span>
                          <span className="text-(--color-ink-muted)">
                            {label}
                            {conversation.workspace ? ` · ${conversation.workspace.name}` : ''}
                          </span>
                        </p>
                        <time
                          dateTime={mention.message.createdAt.toISOString()}
                          title={absoluteTime(mention.message.createdAt)}
                          className="shrink-0 text-xs text-(--color-ink-faint)"
                        >
                          {relativeTime(mention.message.createdAt, now)}
                        </time>
                      </div>

                      <p className="mt-1.5 text-sm leading-relaxed text-(--color-ink-muted)">
                        {body.length > PREVIEW_LENGTH
                          ? `${body.slice(0, PREVIEW_LENGTH).trimEnd()}...`
                          : body}
                      </p>
                    </div>

                    {unread && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-(--color-accent)">
                        <span className="sr-only">Unread</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
