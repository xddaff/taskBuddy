'use server';

import { prisma } from '@studentproj/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserId } from '@/lib/auth';

export interface JoinState {
  error?: string;
}

export async function acceptInviteAction(
  _previous: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const userId = await requireUserId();
  const token = String(formData.get('token') ?? '');

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    select: {
      id: true,
      expiresAt: true,
      usedAt: true,
      workspace: { select: { id: true, slug: true } },
    },
  });

  if (!invite) return { error: 'That invite link is not valid.' };
  if (invite.usedAt) return { error: 'That invite link has already been used.' };
  if (invite.expiresAt.getTime() <= Date.now()) return { error: 'That invite link has expired.' };

  const workspaceId = invite.workspace.id;

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true },
  });
  // Already a member: send them in without spending the invite, so the link
  // still works for the person it was meant for.
  if (existing) redirect(`/w/${invite.workspace.slug}`);

  // Claiming the invite is a conditional update rather than a read followed by
  // a write, so two people opening the same link at once cannot both consume
  // it.
  const claimed = await prisma.workspaceInvite.updateMany({
    where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date(), usedById: userId },
  });
  if (claimed.count === 0) return { error: 'That invite link has already been used.' };

  const channels = await prisma.conversation.findMany({
    where: { workspaceId, type: 'CHANNEL' },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.workspaceMember.create({ data: { workspaceId, userId, role: 'MEMBER' } }),
    // Channels are workspace-wide, so joining the workspace means joining the
    // conversations that already exist in it.
    prisma.conversationMember.createMany({
      data: channels.map((channel) => ({ conversationId: channel.id, userId })),
      skipDuplicates: true,
    }),
  ]);

  revalidatePath('/', 'layout');
  redirect(`/w/${invite.workspace.slug}`);
}
