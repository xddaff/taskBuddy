'use server';

import { createChannel } from '@studentproj/chat';
import { prisma } from '@studentproj/db';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserId } from '@/lib/auth';

export interface NewWorkspaceState {
  error?: string;
}

const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 280;

/// Workspace slugs share a URL namespace with the routes under /w, so a
/// workspace called "New" must not be able to shadow the creation page.
const RESERVED_SLUGS = new Set(['new']);

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function isSlugCollision(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/// First free slug of the form `base`, `base-2`, `base-3`.
///
/// Advisory only: two people naming a workspace the same thing at the same
/// moment can still both land on the same candidate, which is why the caller
/// also handles the unique-constraint failure.
async function availableSlug(base: string): Promise<string> {
  const existing = await prisma.workspace.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });

  const taken = new Set([...existing.map((workspace) => workspace.slug), ...RESERVED_SLUGS]);
  if (!taken.has(base)) return base;

  for (let suffix = 2; suffix <= 99; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${base}-${randomBytes(3).toString('hex')}`;
}

export async function createWorkspaceAction(
  _previous: NewWorkspaceState,
  formData: FormData,
): Promise<NewWorkspaceState> {
  const userId = await requireUserId();

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '')
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH);

  if (name.length < 2) return { error: 'Give the workspace a name of at least two characters.' };
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Workspace names are limited to ${MAX_NAME_LENGTH} characters.` };
  }

  const requestedProjectIds = formData
    .getAll('gitlabProjectIds')
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => Number.isInteger(value));

  // Only ids that are actually in the index are stored: task suggestions are
  // scoped by this list, and an id pointing at nothing would silently narrow
  // them to nothing.
  const knownProjects = requestedProjectIds.length
    ? await prisma.gitlabProject.findMany({
        where: { gitlabId: { in: requestedProjectIds } },
        select: { gitlabId: true },
      })
    : [];
  const gitlabProjectIds = knownProjects.map((project) => project.gitlabId);

  const base = slugify(name) || 'workspace';

  let created: { id: string; slug: string } | null = null;
  for (let attempt = 0; attempt < 4 && !created; attempt++) {
    const slug =
      attempt === 0 ? await availableSlug(base) : `${base}-${randomBytes(3).toString('hex')}`;

    try {
      created = await prisma.workspace.create({
        data: {
          name,
          slug,
          description: description || null,
          createdById: userId,
          gitlabProjectIds,
          members: { create: { userId, role: 'OWNER' } },
        },
        select: { id: true, slug: true },
      });
    } catch (error) {
      if (!isSlugCollision(error)) throw error;
    }
  }

  if (!created) {
    return { error: 'That name is taken too many times over. Try a more specific one.' };
  }

  // A workspace with no channel has nowhere to talk, so the first one comes
  // with the workspace rather than as a second step.
  await createChannel({ workspaceId: created.id, createdById: userId, name: 'general' });

  revalidatePath('/', 'layout');
  redirect(`/w/${created.slug}`);
}
