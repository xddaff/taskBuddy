'use server';

import { Prisma, prisma } from '@studentproj/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { LockHolder, LockResult, SaveResult } from '@/components/document/types';
import { requireUserId } from '@/lib/auth';
import { asProseMirrorDoc, isProseMirrorDoc } from '@/lib/document-templates';

/// How long a section lock survives without a heartbeat.
///
/// Two minutes is long enough that a slow reader keeps their section across a
/// tab switch, and short enough that a laptop lid closed mid-sentence frees
/// the section before anyone gives up and edits around it. The client
/// heartbeats every 30 seconds, so three missed beats release the lock.
const LOCK_TTL_MS = 2 * 60_000;

/// Minimum spacing between automatic version snapshots.
///
/// Autosave fires every ~1.5 seconds of idle typing; one version per autosave
/// would bury the useful restore points under hundreds of near-identical rows.
/// Snapshotting at most once per author per five minutes, and never when the
/// content is unchanged, keeps history to the granularity a student actually
/// wants to roll back to.
const SNAPSHOT_INTERVAL_MS = 5 * 60_000;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/// A document is readable by members of its workspace, never by document id
/// alone: the id is a cuid in a URL and URLs get pasted into group chats.
async function loadDocumentForUser(documentId: string, userId: string) {
  return prisma.document.findFirst({
    where: { id: documentId, workspace: { members: { some: { userId } } } },
    select: {
      id: true,
      title: true,
      type: true,
      contentJson: true,
      createdById: true,
      updatedAt: true,
      workspaceId: true,
      workspace: { select: { slug: true } },
    },
  });
}

/// A document that has never been written has `contentJson` null; a version
/// row cannot, so an empty document is what gets snapshotted.
function storedContent(value: Prisma.JsonValue | null): Prisma.InputJsonValue {
  return asProseMirrorDoc(value) as unknown as Prisma.InputJsonValue;
}

interface Baseline {
  authorId: string;
  content: Prisma.InputJsonValue;
}

async function snapshot(
  documentId: string,
  authorId: string,
  content: Prisma.InputJsonValue,
  label: string | null,
  force: boolean,
  /// What the document held before this write. Only used the very first time
  /// a document is snapshotted: without it, a document whose first edit
  /// deletes half the text would have no version of the text that was there.
  baseline?: Baseline,
): Promise<void> {
  let latest = await prisma.documentVersion.findFirst({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, authorId: true, createdAt: true, contentJson: true },
  });

  if (!latest && baseline) {
    latest = await prisma.documentVersion.create({
      data: {
        documentId,
        authorId: baseline.authorId,
        contentJson: baseline.content,
        label: 'Before the first edit',
      },
      select: { id: true, authorId: true, createdAt: true, contentJson: true },
    });
  }

  if (latest) {
    // Both sides are serialised by the same editor, so key order is stable and
    // a string compare is an adequate "did anything actually change" test.
    const unchanged = JSON.stringify(latest.contentJson) === JSON.stringify(content);
    if (unchanged) return;

    const withinWindow =
      latest.authorId === authorId &&
      Date.now() - latest.createdAt.getTime() < SNAPSHOT_INTERVAL_MS;
    if (!force && withinWindow) return;
  }

  await prisma.documentVersion.create({
    data: { documentId, authorId, contentJson: content, label },
  });
}

export async function saveDocument(input: {
  documentId: string;
  contentJson: unknown;
  expectedUpdatedAt: string;
  /// Set only when the user has seen the conflict warning and chosen to keep
  /// their own text anyway.
  force?: boolean;
}): Promise<SaveResult> {
  const userId = await requireUserId();
  const document = await loadDocumentForUser(input.documentId, userId);
  if (!document) return { status: 'error', message: 'Document not found.' };

  if (!isProseMirrorDoc(input.contentJson)) {
    return { status: 'error', message: 'Editor content was not a document.' };
  }
  const content = input.contentJson as unknown as Prisma.InputJsonValue;

  const expected = new Date(input.expectedUpdatedAt);
  if (!input.force && Number.isNaN(expected.getTime())) {
    return { status: 'error', message: 'Missing the version this edit was based on.' };
  }

  // Optimistic concurrency in place of a CRDT: the write only lands if the
  // stored updatedAt is still the one the client last read. Last-writer-wins
  // would be simpler, but two students typing into the same document would
  // then lose whole paragraphs with no sign anything happened. Refusing the
  // write and telling the user is the honest trade while merging is manual.
  const written = input.force
    ? await prisma.document.updateMany({
        where: { id: document.id },
        data: { contentJson: content },
      })
    : await prisma.document.updateMany({
        where: { id: document.id, updatedAt: expected },
        data: { contentJson: content },
      });

  if (written.count === 0) {
    const current = await prisma.document.findUnique({
      where: { id: document.id },
      select: { contentJson: true, updatedAt: true },
    });
    if (!current) return { status: 'error', message: 'Document not found.' };

    const lastAuthor = await prisma.documentVersion.findFirst({
      where: { documentId: document.id, authorId: { not: userId } },
      orderBy: { createdAt: 'desc' },
      select: { author: { select: { name: true } } },
    });

    return {
      status: 'conflict',
      updatedAt: current.updatedAt.toISOString(),
      content: current.contentJson,
      changedBy: lastAuthor?.author.name ?? null,
    };
  }

  const saved = await prisma.document.findUnique({
    where: { id: document.id },
    select: { updatedAt: true },
  });

  await snapshot(document.id, userId, content, null, false);

  return { status: 'saved', updatedAt: (saved?.updatedAt ?? new Date()).toISOString() };
}

/// Explicit checkpoint of whatever is currently stored, bypassing the
/// five-minute spacing because the user asked for it by name.
export async function createVersionSnapshot(input: {
  documentId: string;
  label?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const userId = await requireUserId();
  const document = await loadDocumentForUser(input.documentId, userId);
  if (!document) return { ok: false, message: 'Document not found.' };

  const label = input.label?.trim().slice(0, 120) || null;
  await snapshot(document.id, userId, storedContent(document.contentJson), label, true);

  revalidatePath(`/d/${document.id}/history`);
  return { ok: true };
}

export async function restoreVersion(input: {
  documentId: string;
  versionId: string;
}): Promise<{ ok: boolean; message?: string; updatedAt?: string }> {
  const userId = await requireUserId();
  const document = await loadDocumentForUser(input.documentId, userId);
  if (!document) return { ok: false, message: 'Document not found.' };

  const version = await prisma.documentVersion.findFirst({
    where: { id: input.versionId, documentId: document.id },
    select: { id: true, contentJson: true, createdAt: true },
  });
  if (!version) return { ok: false, message: 'That version no longer exists.' };

  // Snapshot the live content before overwriting it, so a restore is itself
  // undoable: someone restoring the wrong version should not be the reason
  // the last hour of work is gone.
  await snapshot(document.id, userId, storedContent(document.contentJson), 'Before restore', true);

  const restored = await prisma.document.update({
    where: { id: document.id },
    data: { contentJson: version.contentJson as Prisma.InputJsonValue },
    select: { updatedAt: true },
  });

  revalidatePath(`/d/${document.id}`);
  revalidatePath(`/d/${document.id}/history`);
  return { ok: true, updatedAt: restored.updatedAt.toISOString() };
}

export async function renameDocument(input: {
  documentId: string;
  title: string;
}): Promise<{ ok: boolean; message?: string; title?: string }> {
  const userId = await requireUserId();
  const document = await loadDocumentForUser(input.documentId, userId);
  if (!document) return { ok: false, message: 'Document not found.' };

  const title = input.title.trim().replace(/\s+/g, ' ').slice(0, 160);
  if (!title) return { ok: false, message: 'A document needs a title.' };
  if (title === document.title) return { ok: true, title };

  await prisma.document.update({ where: { id: document.id }, data: { title } });

  revalidatePath(`/d/${document.id}`);
  revalidatePath(`/w/${document.workspace.slug}`);
  return { ok: true, title };
}

export async function deleteDocument(input: {
  documentId: string;
}): Promise<{ ok: false; message: string } | void> {
  const userId = await requireUserId();
  const document = await loadDocumentForUser(input.documentId, userId);
  if (!document) return { ok: false, message: 'Document not found.' };

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: document.workspaceId, userId } },
    select: { role: true },
  });

  // Deleting takes the whole team's work with it, so it is limited to the
  // people who run the workspace plus whoever created the document.
  const allowed =
    document.createdById === userId ||
    membership?.role === 'OWNER' ||
    membership?.role === 'ADMIN';
  if (!allowed) {
    return { ok: false, message: 'Only workspace owners, admins or the creator can delete this.' };
  }

  await prisma.document.delete({ where: { id: document.id } });

  revalidatePath(`/w/${document.workspace.slug}`);
  redirect(`/w/${document.workspace.slug}`);
}

async function holderOf(documentId: string, sectionId: string): Promise<LockHolder | null> {
  const lock = await prisma.documentSectionLock.findUnique({
    where: { documentId_sectionId: { documentId, sectionId } },
    select: {
      sectionId: true,
      userId: true,
      acquiredAt: true,
      expiresAt: true,
      user: { select: { name: true, image: true } },
    },
  });
  if (!lock) return null;

  return {
    sectionId: lock.sectionId,
    userId: lock.userId,
    name: lock.user.name,
    image: lock.user.image,
    acquiredAt: lock.acquiredAt.toISOString(),
    expiresAt: lock.expiresAt.toISOString(),
  };
}

export async function acquireSectionLock(input: {
  documentId: string;
  sectionId: string;
}): Promise<LockResult> {
  const userId = await requireUserId();
  const document = await loadDocumentForUser(input.documentId, userId);
  if (!document) return { status: 'error', message: 'Document not found.' };

  const { documentId, sectionId } = input;

  // Two passes, because a lock that expires between the "is it taken" read and
  // the write should be winnable rather than reported as held.
  for (let attempt = 0; attempt < 2; attempt++) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

    // Already ours: extend it, leaving acquiredAt alone so "editing since" is
    // the start of the session rather than the last heartbeat.
    const refreshed = await prisma.documentSectionLock.updateMany({
      where: { documentId, sectionId, userId },
      data: { expiresAt },
    });
    if (refreshed.count > 0) {
      return { status: 'acquired', sectionId, expiresAt: expiresAt.toISOString() };
    }

    // Held by someone who stopped heartbeating: the lock is expired, so it is
    // free to take. This is the case that keeps a closed laptop from freezing
    // a section forever.
    const takenOver = await prisma.documentSectionLock.updateMany({
      where: { documentId, sectionId, expiresAt: { lte: now } },
      data: { userId, acquiredAt: now, expiresAt },
    });
    if (takenOver.count > 0) {
      return { status: 'acquired', sectionId, expiresAt: expiresAt.toISOString() };
    }

    try {
      await prisma.documentSectionLock.create({
        data: { documentId, sectionId, userId, acquiredAt: now, expiresAt },
      });
      return { status: 'acquired', sectionId, expiresAt: expiresAt.toISOString() };
    } catch (error) {
      // Someone inserted the same (documentId, sectionId) first; the unique
      // constraint is what makes this safe under concurrency.
      if (!isUniqueViolation(error)) throw error;
    }

    const holder = await holderOf(documentId, sectionId);
    if (holder && new Date(holder.expiresAt).getTime() > Date.now()) {
      return { status: 'held', sectionId, by: holder };
    }
  }

  return { status: 'error', message: 'Could not take the section lock.' };
}

/// Extends a lock the caller already holds. Deliberately does not take a lock
/// the caller has lost: a stale heartbeat must not evict whoever replaced them.
export async function heartbeatSectionLock(input: {
  documentId: string;
  sectionId: string;
}): Promise<LockResult> {
  const userId = await requireUserId();
  const document = await loadDocumentForUser(input.documentId, userId);
  if (!document) return { status: 'error', message: 'Document not found.' };

  const expiresAt = new Date(Date.now() + LOCK_TTL_MS);
  const refreshed = await prisma.documentSectionLock.updateMany({
    where: { documentId: input.documentId, sectionId: input.sectionId, userId },
    data: { expiresAt },
  });

  if (refreshed.count > 0) {
    return { status: 'acquired', sectionId: input.sectionId, expiresAt: expiresAt.toISOString() };
  }

  const holder = await holderOf(input.documentId, input.sectionId);
  if (holder && new Date(holder.expiresAt).getTime() > Date.now()) {
    return { status: 'held', sectionId: input.sectionId, by: holder };
  }
  return { status: 'error', message: 'The lock was released.' };
}

export async function releaseSectionLock(input: {
  documentId: string;
  sectionId: string;
}): Promise<{ ok: boolean }> {
  const userId = await requireUserId();

  // Scoped by userId so releasing is always releasing your own lock.
  const deleted = await prisma.documentSectionLock.deleteMany({
    where: { documentId: input.documentId, sectionId: input.sectionId, userId },
  });

  return { ok: deleted.count > 0 };
}
