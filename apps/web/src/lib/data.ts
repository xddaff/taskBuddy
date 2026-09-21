import { prisma } from '@studentproj/db';
import { redirect } from 'next/navigation';
import { currentUser } from './auth';

/// The signed-in user plus their profile, redirecting if either is missing.
///
/// Onboarding is enforced here rather than in middleware because the decision
/// needs the profile row, and middleware cannot reach Prisma.
export async function requireOnboardedUser() {
  const user = await currentUser();
  if (!user?.id) redirect('/signin');

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, onboardedAt: true, weeklyHours: true, commitment: true, experience: true },
  });

  if (!profile?.onboardedAt) redirect('/onboarding');

  return { user, profile };
}

export async function getTaxonomyByKind() {
  const tags = await prisma.tag.findMany({ orderBy: { label: 'asc' } });

  return {
    languages: tags.filter((tag) => tag.kind === 'LANGUAGE'),
    frameworks: tags.filter((tag) => tag.kind === 'FRAMEWORK'),
    tools: tags.filter((tag) => tag.kind === 'TOOL'),
    topics: tags.filter((tag) => tag.kind === 'TOPIC'),
    domains: tags.filter((tag) => tag.kind === 'DOMAIN'),
    all: tags,
  };
}

/// Workspaces the user belongs to, with their channels, for the sidebar.
export async function getSidebarData(userId: string) {
  const [workspaces, directConversations, unreadMentions] = await Promise.all([
    prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        conversations: {
          where: { type: 'CHANNEL', members: { some: { userId } } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        },
        documents: {
          orderBy: { title: 'asc' },
          select: { id: true, title: true, type: true },
        },
      },
    }),

    prisma.conversation.findMany({
      where: { type: { in: ['DM', 'GROUP'] }, members: { some: { userId } } },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        type: true,
        name: true,
        members: {
          where: { userId: { not: userId } },
          select: { user: { select: { id: true, name: true, image: true } } },
        },
      },
    }),

    prisma.mention.count({ where: { userId, readAt: null } }),
  ]);

  return { workspaces, directConversations, unreadMentions };
}

/// Per-conversation unread counts for the signed-in user.
///
/// Counted from the member's lastReadAt rather than stored as a running total,
/// so a missed socket event cannot leave a badge permanently wrong.
export async function getUnreadCounts(userId: string): Promise<Map<string, number>> {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });

  const counts = new Map<string, number>();
  await Promise.all(
    memberships.map(async (membership) => {
      const count = await prisma.message.count({
        where: {
          conversationId: membership.conversationId,
          deletedAt: null,
          authorId: { not: userId },
          ...(membership.lastReadAt ? { createdAt: { gt: membership.lastReadAt } } : {}),
        },
      });
      if (count > 0) counts.set(membership.conversationId, count);
    }),
  );

  return counts;
}

/// Asserts the user is a member of the conversation and returns it.
///
/// Every conversation read and write goes through this. Membership is the only
/// access rule in chat, and checking it in one place is what keeps a private
/// DM from leaking through a guessed id.
export async function requireConversationAccess(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, members: { some: { userId } } },
    include: {
      workspace: { select: { id: true, name: true, slug: true, gitlabProjectIds: true } },
      members: {
        select: {
          userId: true,
          muted: true,
          lastReadAt: true,
          user: { select: { id: true, name: true, image: true, gitlabUsername: true } },
        },
      },
    },
  });

  if (!conversation) redirect('/tasks');
  return conversation;
}

export async function requireWorkspaceAccess(slug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { slug, members: { some: { userId } } },
    include: {
      members: {
        select: {
          role: true,
          user: { select: { id: true, name: true, image: true, gitlabUsername: true } },
        },
      },
    },
  });

  if (!workspace) redirect('/tasks');
  return workspace;
}

/// Display label for a conversation, which depends on its type: channels have
/// a name, DMs are named after the other person.
export function conversationTitle(conversation: {
  type: string;
  name: string | null;
  members?: Array<{ user: { name: string | null } }>;
}): string {
  if (conversation.name) return conversation.name;
  const others = conversation.members ?? [];
  if (others.length === 0) return 'Just you';
  return others.map((member) => member.user.name ?? 'Unknown').join(', ');
}
