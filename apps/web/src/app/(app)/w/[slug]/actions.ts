'use server';

import { ChatError, createChannel } from '@studentproj/chat';
import { prisma, type DocumentType, type Prisma, type WorkspaceRole } from '@studentproj/db';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserId } from '@/lib/auth';
import { inviteExpiry } from './invites';

export interface WorkspaceActionState {
  error?: string;
}

const DOCUMENT_TYPES = new Set<DocumentType>(['REPORT', 'PLAN', 'FREEFORM']);
const ASSIGNABLE_ROLES = new Set<WorkspaceRole>(['OWNER', 'ADMIN', 'MEMBER']);

/// A failure the student is allowed to see: a permission they do not have, or
/// input that cannot be accepted. Anything else is a bug and keeps throwing.
class WorkspaceError extends Error {}

/// Runs an action body, turning expected failures into form state.
///
/// Actions that navigate return the path instead of calling redirect inside
/// the try, because redirect signals itself by throwing and would otherwise be
/// swallowed as an error.
async function run(work: () => Promise<string | void>): Promise<WorkspaceActionState> {
  let destination: string | void;
  try {
    destination = await work();
  } catch (error) {
    if (error instanceof WorkspaceError || error instanceof ChatError) {
      return { error: error.message };
    }
    throw error;
  }

  if (destination) redirect(destination);
  return {};
}

interface Context {
  userId: string;
  workspaceId: string;
  slug: string;
  role: WorkspaceRole;
}

/// Resolves the caller's own membership of the workspace named in the form.
///
/// The slug arrives from the client, but nothing about the caller does: the
/// role is read from the database for the session user, so a tampered form can
/// at most name a different workspace, which then fails this check.
async function requireMember(formData: FormData): Promise<Context> {
  const userId = await requireUserId();
  const slug = String(formData.get('slug') ?? '');

  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  });
  // Non-members are told the same thing as people using a made-up slug, so the
  // form cannot be used to probe which workspaces exist.
  if (!workspace) throw new WorkspaceError('That workspace does not exist, or you are not in it.');

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
    select: { role: true },
  });
  if (!membership) {
    throw new WorkspaceError('That workspace does not exist, or you are not in it.');
  }

  return { userId, workspaceId: workspace.id, slug: workspace.slug, role: membership.role };
}

async function requireManager(formData: FormData): Promise<Context> {
  const context = await requireMember(formData);
  if (context.role === 'MEMBER') {
    throw new WorkspaceError('Only owners and admins can do that.');
  }
  return context;
}

function refresh(slug: string): void {
  revalidatePath(`/w/${slug}`);
  // The sidebar lists channels and documents for every workspace, so it is
  // rendered stale by most of these actions.
  revalidatePath('/', 'layout');
}

export async function createChannelAction(
  _previous: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  return run(async () => {
    const { userId, workspaceId, slug } = await requireManager(formData);

    await createChannel({
      workspaceId,
      createdById: userId,
      name: String(formData.get('name') ?? ''),
      topic: String(formData.get('topic') ?? '').slice(0, 140),
    });

    refresh(slug);
  });
}

/// Opening paragraphs for a new document.
///
/// A blank page is the main reason a shared report never gets written, so each
/// type starts with the sections the team is going to need anyway.
function starterContent(type: DocumentType, title: string): Prisma.InputJsonValue {
  const lines: Record<DocumentType, string[]> = {
    REPORT: [
      title,
      'Summary: what this covers, in two or three sentences.',
      'What we built.',
      'What we found.',
      'What is still open.',
    ],
    PLAN: [
      title,
      'Goal: what done looks like.',
      'Milestones, with who is on each.',
      'Risks and what we would do about them.',
    ],
    FREEFORM: [title, 'Start writing.'],
  };

  return {
    type: 'doc',
    content: (lines[type] ?? lines.FREEFORM).map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })),
  };
}

export async function createDocumentAction(
  _previous: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  return run(async () => {
    const { userId, workspaceId, slug } = await requireMember(formData);

    const title = String(formData.get('title') ?? '').trim().slice(0, 120);
    if (title.length < 2) throw new WorkspaceError('Give the document a title.');

    const requestedType = String(formData.get('type') ?? 'FREEFORM') as DocumentType;
    const type = DOCUMENT_TYPES.has(requestedType) ? requestedType : 'FREEFORM';

    const document = await prisma.document.create({
      data: {
        workspaceId,
        type,
        title,
        createdById: userId,
        contentJson: starterContent(type, title),
      },
      select: { id: true },
    });

    refresh(slug);
    return `/d/${document.id}`;
  });
}

export async function createInviteAction(
  _previous: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  return run(async () => {
    const { userId, workspaceId, slug } = await requireManager(formData);

    await prisma.workspaceInvite.create({
      data: {
        workspaceId,
        createdById: userId,
        // 32 bytes from the CSPRNG: the link is the only credential needed to
        // join, so it has to be unguessable rather than merely unique.
        token: randomBytes(32).toString('base64url'),
        expiresAt: inviteExpiry(),
      },
    });

    refresh(slug);
  });
}

export async function revokeInviteAction(
  _previous: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  return run(async () => {
    const { workspaceId, slug } = await requireManager(formData);
    const inviteId = String(formData.get('inviteId') ?? '');

    // Scoped to this workspace, so an id from somewhere else cannot be revoked
    // by an admin here. Used invites are left alone: they are the record of
    // how someone joined.
    const removed = await prisma.workspaceInvite.deleteMany({
      where: { id: inviteId, workspaceId, usedAt: null },
    });
    if (removed.count === 0) throw new WorkspaceError('That invite has already gone.');

    refresh(slug);
  });
}

/// Loads the target membership and rejects the changes that would leave the
/// workspace unowned or let an admin act on an owner.
async function targetMember(context: Context, formData: FormData) {
  const targetUserId = String(formData.get('memberUserId') ?? '');

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: context.workspaceId, userId: targetUserId } },
    select: { userId: true, role: true },
  });
  if (!membership) throw new WorkspaceError('That person is not in this workspace.');

  const isSelf = membership.userId === context.userId;
  if (membership.role === 'OWNER' && !isSelf && context.role !== 'OWNER') {
    throw new WorkspaceError('Only an owner can act on another owner.');
  }

  return { ...membership, isSelf };
}

async function assertNotLastOwner(workspaceId: string, role: WorkspaceRole): Promise<void> {
  if (role !== 'OWNER') return;

  const owners = await prisma.workspaceMember.count({ where: { workspaceId, role: 'OWNER' } });
  if (owners <= 1) {
    throw new WorkspaceError(
      'This is the last owner. Make someone else an owner first, then try again.',
    );
  }
}

export async function removeMemberAction(
  _previous: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  return run(async () => {
    // Leaving is a member's own decision, so only removing someone else needs
    // owner or admin rights.
    const context = await requireMember(formData);
    const target = await targetMember(context, formData);

    if (!target.isSelf && context.role === 'MEMBER') {
      throw new WorkspaceError('Only owners and admins can remove people.');
    }

    await assertNotLastOwner(context.workspaceId, target.role);

    // Channel membership goes with workspace membership. Left behind, it would
    // keep the conversation in their sidebar and its messages in their search
    // results after they have been removed.
    await prisma.$transaction([
      prisma.conversationMember.deleteMany({
        where: { userId: target.userId, conversation: { workspaceId: context.workspaceId } },
      }),
      prisma.workspaceMember.delete({
        where: {
          workspaceId_userId: { workspaceId: context.workspaceId, userId: target.userId },
        },
      }),
    ]);

    refresh(context.slug);
    if (target.isSelf) return '/tasks';
  });
}

export async function changeRoleAction(
  _previous: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  return run(async () => {
    const context = await requireManager(formData);
    const target = await targetMember(context, formData);

    const role = String(formData.get('role') ?? '') as WorkspaceRole;
    if (!ASSIGNABLE_ROLES.has(role)) throw new WorkspaceError('That is not a role.');
    if (role === target.role) return;

    // Admins can shuffle members and other admins, but making an owner is an
    // owner's decision.
    if (role === 'OWNER' && context.role !== 'OWNER') {
      throw new WorkspaceError('Only an owner can make someone else an owner.');
    }
    if (target.role === 'OWNER') {
      await assertNotLastOwner(context.workspaceId, target.role);
    }

    await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: context.workspaceId, userId: target.userId } },
      data: { role },
    });

    refresh(context.slug);
  });
}
