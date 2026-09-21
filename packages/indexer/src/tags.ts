import { prisma, type Prisma } from '@studentproj/db';
import { TAGS } from '@studentproj/scoring';

/// Pushes the code-defined taxonomy into the database.
///
/// The taxonomy lives in `packages/scoring` because extraction needs it
/// without a database round trip; the rows exist so profiles and issues can
/// hold foreign keys to a tag. This keeps the two in step and is safe to run
/// on every deploy.
export async function syncTaxonomy(client: Prisma.TransactionClient = prisma): Promise<number> {
  for (const tag of TAGS) {
    await client.tag.upsert({
      where: { slug: tag.slug },
      create: { slug: tag.slug, label: tag.label, kind: tag.kind, aliases: tag.aliases },
      update: { label: tag.label, kind: tag.kind, aliases: tag.aliases },
    });
  }
  return TAGS.length;
}

/// slug -> tag id, for turning extraction output into foreign keys.
export async function tagIdsBySlug(
  client: Prisma.TransactionClient = prisma,
): Promise<Map<string, string>> {
  const tags = await client.tag.findMany({ select: { id: true, slug: true } });
  return new Map(tags.map((tag) => [tag.slug, tag.id]));
}
