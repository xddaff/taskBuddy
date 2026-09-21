import { prisma, type Conversation } from '@studentproj/db';
import { ChatError } from './messages';

/// Canonical key for a one-to-one DM: both ids, sorted, joined.
///
/// Sorting is what makes the pair order-independent, so A opening a DM with B
/// and B opening one with A resolve to the same row rather than two.
export function dmKeyFor(userA: string, userB: string): string {
  return [userA, userB].sort().join(':');
}

/// Finds or creates the DM between two users.
export async function openDirectMessage(
  userId: string,
  otherUserId: string,
): Promise<Conversation> {
  if (userId === otherUserId) throw new ChatError('You cannot open a DM with yourself.');

  const other = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: { id: true },
  });
  if (!other) throw new ChatError('That student does not exist.');

  const dmKey = dmKeyFor(userId, otherUserId);

  const existing = await prisma.conversation.findUnique({ where: { dmKey } });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      type: 'DM',
      dmKey,
      createdById: userId,
      members: { create: [{ userId }, { userId: otherUserId, role: 'MEMBER' }] },
    },
  });
}

/// Creates an ad-hoc group chat.
///
/// Groups have no dmKey: unlike a one-to-one DM, the same set of people may
/// legitimately want several separate group chats.
export async function createGroupConversation(input: {
  createdById: string;
  memberIds: string[];
  name?: string | null;
}): Promise<Conversation> {
  const memberIds = [...new Set([input.createdById, ...input.memberIds])];
  if (memberIds.length < 3) {
    throw new ChatError('A group chat needs at least three people. Use a DM for two.');
  }

  const found = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true },
  });
  if (found.length !== memberIds.length) {
    throw new ChatError('Some of those students do not exist.');
  }

  return prisma.conversation.create({
    data: {
      type: 'GROUP',
      name: input.name?.trim() || null,
      createdById: input.createdById,
      members: {
        create: memberIds.map((userId) => ({
          userId,
          role: userId === input.createdById ? ('OWNER' as const) : ('MEMBER' as const),
        })),
      },
    },
  });
}

/// Creates a channel inside a workspace and subscribes every workspace member.
///
/// Channels are workspace-wide by design: a project channel that some teammates
/// cannot see defeats the point of having a shared workspace.
export async function createChannel(input: {
  workspaceId: string;
  createdById: string;
  name: string;
  topic?: string | null;
}): Promise<Conversation> {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.createdById } },
    select: { id: true },
  });
  if (!membership) throw new ChatError('You are not a member of that workspace.');

  const name = normaliseChannelName(input.name);
  if (!name) throw new ChatError('Give the channel a name.');

  const clash = await prisma.conversation.findFirst({
    where: { workspaceId: input.workspaceId, type: 'CHANNEL', name },
    select: { id: true },
  });
  if (clash) throw new ChatError(`#${name} already exists.`);

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: input.workspaceId },
    select: { userId: true },
  });

  return prisma.conversation.create({
    data: {
      type: 'CHANNEL',
      workspaceId: input.workspaceId,
      name,
      topic: input.topic?.trim() || null,
      createdById: input.createdById,
      members: {
        create: members.map((member) => ({
          userId: member.userId,
          role: member.userId === input.createdById ? ('OWNER' as const) : ('MEMBER' as const),
        })),
      },
    },
  });
}

/// Channel names are shown after a '#', so they are lowercased and hyphenated
/// to keep '#Build Issues' and '#build-issues' from coexisting confusingly.
export function normaliseChannelName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
