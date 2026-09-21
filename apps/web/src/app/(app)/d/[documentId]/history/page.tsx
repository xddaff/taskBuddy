import { prisma } from '@studentproj/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VersionHistory, type VersionSummary } from '@/components/document/VersionHistory';
import { documentPlainText } from '@/lib/document-templates';
import { requireOnboardedUser } from '@/lib/data';

export default async function DocumentHistoryPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const { user } = await requireOnboardedUser();

  const document = await prisma.document.findFirst({
    where: { id: documentId, workspace: { members: { some: { userId: user.id } } } },
    select: {
      id: true,
      title: true,
      contentJson: true,
      updatedAt: true,
      versions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          label: true,
          createdAt: true,
          contentJson: true,
          author: { select: { id: true, name: true, image: true } },
        },
      },
    },
  });

  if (!document) notFound();

  const versions: VersionSummary[] = document.versions.map((version) => ({
    id: version.id,
    label: version.label,
    createdAt: version.createdAt.toISOString(),
    preview: documentPlainText(version.contentJson, 200),
    author: version.author,
  }));

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="mb-6">
          <Link
            href={`/d/${document.id}`}
            className="text-xs text-(--color-accent) hover:underline"
          >
            ← Back to {document.title}
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">Version history</h1>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            Snapshots of {document.title}, newest first.
          </p>
        </header>

        <VersionHistory
          documentId={document.id}
          versions={versions}
          current={{
            updatedAt: document.updatedAt.toISOString(),
            preview: documentPlainText(document.contentJson, 200),
          }}
        />
      </div>
    </main>
  );
}
