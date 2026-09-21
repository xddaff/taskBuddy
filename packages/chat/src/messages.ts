import { prisma, type MessageKind, type Prisma } from '@studentproj/db';
import { parseMentions } from './mentions';

export const MAX_MESSAGE_LENGTH = 4000;
export const MESSAGE_PAGE_SIZE = 50;

/// Everything the UI needs to render one message.
const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  body: true,
  kind: true,
  metadata: true,
  replyToId: true,
  editedAt: true,
  deletedAt: true,
  createdAt: true,
  authorId: true,
  author: { select: { id: true, name: true, image: true, gitlabUsername: true } },
  reactions: { select: { emoji: true, userId: true } },
  attachments: {
    select: {
      id: true,
      filename: true,
      mimeType: true,
      byteSize: true,
      width: true,
      height: true,
      storageKey: true,
      thumbnailKey: true,
    },
  },
  mentions: { select: { userId: true } },
  replyTo: {
    select: {
      id: true,
      body: true,
      deletedAt: true,
      author: { select: { name: true } },
    },
  },
} satisfies Prisma.MessageSelect;

export type ChatMessage = Prisma.MessageGetPayload<{ select: typeof MESSAGE_SELECT }>;

export class ChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatError';
  }
}

/// Confirms the user is a member of the conversation.
///
/// Every mutation and every read goes through this. Membership is the only
/// access rule in chat, so centralising it is what keeps a private DM from
/// leaking through a guessed conversation id.
export async function assertMembership(conversationId: string, userId: string): Promise<void> {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  if (!membership) throw new ChatError('You are not a member of this conversation.');
}

export interface SendMessageInput {
  conversationId: string;
  authorId: string;
  body: string;
  replyToId?: string | null;
  attachmentIds?: string[];
  kind?: MessageKind;
  /// Structured payload for non-text messages, currently the shared issue
  /// snapshot on a TASK_CARD. Declared as a plain object rather than Prisma's
  /// InputJsonValue so callers that build it from parsed JSON do not have to
  /// satisfy Prisma's recursive JSON type.
  metadata?: Record<string, unknown>;
}

export async function sendMessage(input: SendMessageInput): Promise<ChatMessage> {
  await assertMembership(input.conversationId, input.authorId);

  const body = input.body.trim();
  const hasAttachments = (input.attachmentIds ?? []).length > 0;
  if (!body && !hasAttachments) {
    throw new ChatError('A message needs text or an attachment.');
  }
  if (body.length > MAX_MESSAGE_LENGTH) {
    throw new ChatError(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`);
  }

  // A reply must point at a message in the same conversation, or a crafted
  // replyToId could pull a quoted preview out of a conversation the author
  // cannot see.
  if (input.replyToId) {
    const parent = await prisma.message.findFirst({
      where: { id: input.replyToId, conversationId: input.conversationId },
      select: { id: true },
    });
    if (!parent) throw new ChatError('That message is not in this conversation.');
  }

  const message = await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      authorId: input.authorId,
      body,
      kind: input.kind ?? 'TEXT',
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      replyToId: input.replyToId ?? null,
    },
    select: { id: true },
  });

  if (hasAttachments) {
    // Scoped to the uploader so one student cannot attach another's upload to
    // their own message.
    await prisma.attachment.updateMany({
      where: {
        id: { in: input.attachmentIds ?? [] },
        uploaderId: input.authorId,
        messageId: null,
      },
      data: { messageId: message.id },
    });
  }

  await writeMentions(message.id, input.conversationId, body, input.authorId);

  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: new Date() },
  });

  // The author has by definition read their own message; without this their
  // own send would come back as an unread.
  await prisma.conversationMember.update({
    where: {
      conversationId_userId: { conversationId: input.conversationId, userId: input.authorId },
    },
    data: { lastReadAt: new Date(), lastReadMessageId: message.id },
  });

  return getMessage(message.id);
}

/// Resolves @mentions against conversation membership and records them.
///
/// Only members can be mentioned. Otherwise @mention becomes a way to ping
/// anyone on the instance from a conversation they are not part of.
async function writeMentions(
  messageId: string,
  conversationId: string,
  body: string,
  authorId: string,
): Promise<void> {
  const { usernames, mentionsEveryone } = parseMentions(body);
  if (usernames.length === 0 && !mentionsEveryone) return;

  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true, user: { select: { gitlabUsername: true } } },
  });

  const targets = new Set<string>();
  if (mentionsEveryone) {
    for (const member of members) targets.add(member.userId);
  }
  for (const member of members) {
    const username = member.user.gitlabUsername?.toLowerCase();
    if (username && usernames.includes(username)) targets.add(member.userId);
  }

  // Mentioning yourself should not produce a notification badge.
  targets.delete(authorId);
  if (targets.size === 0) return;

  await prisma.mention.createMany({
    data: [...targets].map((userId) => ({ messageId, userId })),
    skipDuplicates: true,
  });
}

export async function getMessage(messageId: string): Promise<ChatMessage> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: MESSAGE_SELECT,
  });
  if (!message) throw new ChatError('Message not found.');
  return message;
}

/// One page of history, newest-last so the caller can render it directly.
export async function listMessages(input: {
  conversationId: string;
  userId: string;
  /// Cursor for older pages: the id of the oldest message already shown.
  before?: string;
  limit?: number;
}): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  await assertMembership(input.conversationId, input.userId);

  const limit = Math.min(input.limit ?? MESSAGE_PAGE_SIZE, 100);

  const cursor = input.before
    ? await prisma.message.findUnique({
        where: { id: input.before },
        select: { createdAt: true },
      })
    : null;

  const rows = await prisma.message.findMany({
    where: {
      conversationId: input.conversationId,
      ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    // One extra row tells us whether another page exists without a count query.
    take: limit + 1,
    select: MESSAGE_SELECT,
  });

  const hasMore = rows.length > limit;
  return { messages: rows.slice(0, limit).reverse(), hasMore };
}

export async function editMessage(input: {
  messageId: string;
  userId: string;
  body: string;
}): Promise<ChatMessage> {
  const message = await prisma.message.findUnique({
    where: { id: input.messageId },
    select: { id: true, authorId: true, conversationId: true, deletedAt: true },
  });
  if (!message) throw new ChatError('Message not found.');
  if (message.authorId !== input.userId) throw new ChatError('You can only edit your own messages.');
  if (message.deletedAt) throw new ChatError('That message was deleted.');

  const body = input.body.trim();
  if (!body) throw new ChatError('An edited message cannot be empty.');
  if (body.length > MAX_MESSAGE_LENGTH) {
    throw new ChatError(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`);
  }

  await prisma.message.update({
    where: { id: message.id },
    data: { body, editedAt: new Date() },
  });

  // Mentions are rewritten from the new body: editing someone out of a message
  // should not leave their mention badge behind.
  await prisma.mention.deleteMany({ where: { messageId: message.id } });
  await writeMentions(message.id, message.conversationId, body, message.authorId);

  return getMessage(message.id);
}

/// Soft delete, so replies pointing at this message keep their structure and
/// the thread does not develop holes.
export async function deleteMessage(input: {
  messageId: string;
  userId: string;
}): Promise<ChatMessage> {
  const message = await prisma.message.findUnique({
    where: { id: input.messageId },
    select: { id: true, authorId: true, conversationId: true },
  });
  if (!message) throw new ChatError('Message not found.');
  if (message.authorId !== input.userId) {
    throw new ChatError('You can only delete your own messages.');
  }

  await prisma.$transaction([
    prisma.message.update({
      where: { id: message.id },
      data: { deletedAt: new Date(), body: '' },
    }),
    // Withdraw the notification along with the message.
    prisma.mention.deleteMany({ where: { messageId: message.id } }),
  ]);

  return getMessage(message.id);
}

export async function toggleReaction(input: {
  messageId: string;
  userId: string;
  emoji: string;
}): Promise<ChatMessage> {
  const message = await prisma.message.findUnique({
    where: { id: input.messageId },
    select: { id: true, conversationId: true },
  });
  if (!message) throw new ChatError('Message not found.');
  await assertMembership(message.conversationId, input.userId);

  const emoji = input.emoji.trim();
  // Enough for any single emoji including skin-tone and ZWJ sequences, short
  // enough that the field cannot be used to store arbitrary text.
  if (!emoji || emoji.length > 16) throw new ChatError('That is not a usable reaction.');

  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: { messageId: message.id, userId: input.userId, emoji },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({
      data: { messageId: message.id, userId: input.userId, emoji },
    });
  }

  return getMessage(message.id);
}

export async function markRead(input: {
  conversationId: string;
  userId: string;
  messageId?: string;
}): Promise<void> {
  await assertMembership(input.conversationId, input.userId);

  await prisma.conversationMember.update({
    where: {
      conversationId_userId: { conversationId: input.conversationId, userId: input.userId },
    },
    data: { lastReadAt: new Date(), lastReadMessageId: input.messageId ?? null },
  });

  if (input.messageId) {
    await prisma.mention.updateMany({
      where: { userId: input.userId, messageId: input.messageId, readAt: null },
      data: { readAt: new Date() },
    });
  } else {
    // Opening a conversation clears its mention badges; leaving them would
    // make the badge permanently stale.
    await prisma.mention.updateMany({
      where: {
        userId: input.userId,
        readAt: null,
        message: { conversationId: input.conversationId },
      },
      data: { readAt: new Date() },
    });
  }
}

export async function setMuted(input: {
  conversationId: string;
  userId: string;
  muted: boolean;
}): Promise<void> {
  await assertMembership(input.conversationId, input.userId);
  await prisma.conversationMember.update({
    where: {
      conversationId_userId: { conversationId: input.conversationId, userId: input.userId },
    },
    data: { muted: input.muted },
  });
}

/// Conversation ids the user belongs to, for subscribing a socket to rooms.
export async function conversationIdsFor(userId: string): Promise<string[]> {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true },
  });
  return memberships.map((membership) => membership.conversationId);
}
