import { listMessages, markRead } from '@studentproj/chat';
import type { Metadata } from 'next';
import { Avatar } from '@/components/Avatar';
import { ChatView } from '@/components/chat/ChatView';
import { env } from '@/env';
import { toWireMessage } from '@/lib/chat-serialise';
import { conversationTitle, requireConversationAccess, requireOnboardedUser } from '@/lib/data';
import { toggleMute } from '../actions';

interface Props {
  params: Promise<{ conversationId: string }>;
}

const VISIBLE_AVATARS = 5;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { conversationId } = await params;
  const { user } = await requireOnboardedUser();
  const conversation = await requireConversationAccess(conversationId, user.id);

  return { title: `${headerTitle(conversation, user.id)} · TaskBuddy` };
}

export default async function ConversationPage({ params }: Props) {
  const { conversationId } = await params;
  const { user } = await requireOnboardedUser();
  const conversation = await requireConversationAccess(conversationId, user.id);

  const history = await listMessages({ conversationId, userId: user.id });

  // Opening a conversation is what clears its unread badge, so this runs on the
  // server render rather than waiting for the socket to connect.
  const newest = history.messages[history.messages.length - 1];
  await markRead({ conversationId, userId: user.id, messageId: newest?.id });

  const membership = conversation.members.find((member) => member.userId === user.id);
  const others = conversation.members.filter((member) => member.userId !== user.id);
  const members = conversation.members.map((member) => member.user);
  const title = headerTitle(conversation, user.id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b border-(--color-border-subtle) px-6 py-3">
        <div className="min-w-0">
          <h1 className="flex items-baseline gap-1.5 text-base font-semibold tracking-tight">
            {conversation.type === 'CHANNEL' && (
              <span aria-hidden="true" className="text-(--color-ink-faint)">
                #
              </span>
            )}
            <span className="truncate">{title}</span>
          </h1>

          <p className="mt-0.5 truncate text-xs text-(--color-ink-muted)">
            {conversation.topic ??
              (conversation.type === 'CHANNEL'
                ? `${conversation.members.length} members · no topic set`
                : describeDirect(others.length))}
          </p>
        </div>

        <ul className="ml-auto flex shrink-0 items-center -space-x-1.5">
          {conversation.members.slice(0, VISIBLE_AVATARS).map((member) => (
            <li key={member.userId} title={member.user.name ?? 'Unknown'} className="rounded-full ring-2 ring-(--color-surface)">
              <Avatar name={member.user.name} image={member.user.image} size="sm" />
            </li>
          ))}
          {conversation.members.length > VISIBLE_AVATARS && (
            <li className="pl-3 text-xs text-(--color-ink-faint)">
              +{conversation.members.length - VISIBLE_AVATARS}
            </li>
          )}
        </ul>

        <p className="sr-only">
          {conversation.members.length} members:{' '}
          {conversation.members.map((member) => member.user.name ?? 'Unknown').join(', ')}
        </p>

        <form action={toggleMute} className="shrink-0">
          <input type="hidden" name="conversationId" value={conversation.id} />
          <input type="hidden" name="muted" value={membership?.muted ? 'false' : 'true'} />
          <button
            type="submit"
            aria-pressed={membership?.muted ?? false}
            className={`rounded-md border px-2.5 py-1.5 text-xs transition ${
              membership?.muted
                ? 'border-(--color-warning)/50 bg-(--color-warning)/10 text-(--color-warning)'
                : 'border-(--color-border-subtle) text-(--color-ink-muted) hover:bg-(--color-surface-hover) hover:text-(--color-ink)'
            }`}
          >
            {membership?.muted ? 'Muted' : 'Mute'}
            <span className="sr-only"> notifications for this conversation</span>
          </button>
        </form>
      </header>

      <ChatView
        conversationId={conversation.id}
        currentUserId={user.id}
        members={members}
        initialMessages={history.messages.map(toWireMessage)}
        initialHasMore={history.hasMore}
        realtimeUrl={env.realtimeUrl}
        conversationLabel={conversation.type === 'CHANNEL' ? `#${title}` : title}
      />
    </div>
  );
}

/// `conversationTitle` names a DM after the people in it, so the signed-in user
/// has to be taken out first or a DM reads as "Ilya Petrov, Maya Okafor".
function headerTitle(
  conversation: {
    type: string;
    name: string | null;
    members: Array<{ userId: string; user: { name: string | null } }>;
  },
  currentUserId: string,
): string {
  return conversationTitle({
    type: conversation.type,
    name: conversation.name,
    members: conversation.members.filter((member) => member.userId !== currentUserId),
  });
}

function describeDirect(otherCount: number): string {
  if (otherCount === 0) return 'Just you';
  if (otherCount === 1) return 'Direct message';
  return `Group chat · ${otherCount + 1} people`;
}
