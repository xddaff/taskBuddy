import { prisma } from '@studentproj/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { DeleteDocumentButton } from '@/components/document/DeleteDocumentButton';
import { DocumentEditor } from '@/components/document/DocumentEditor';
import { DocumentTitle } from '@/components/document/DocumentTitle';
import { asProseMirrorDoc, sectionLabel } from '@/lib/document-templates';
import { requireOnboardedUser } from '@/lib/data';

const TYPE_LABEL: Record<string, string> = {
  REPORT: 'Report',
  PLAN: 'Project plan',
  FREEFORM: 'Document',
};

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const { user } = await requireOnboardedUser();

  // Membership is the access rule, not the document id: the id is a cuid that
  // travels through group chats and bookmarks.
  const document = await prisma.document.findFirst({
    where: { id: documentId, workspace: { members: { some: { userId: user.id } } } },
    select: {
      id: true,
      title: true,
      type: true,
      contentJson: true,
      updatedAt: true,
      workspace: { select: { name: true, slug: true } },
      locks: {
        where: { expiresAt: { gt: new Date() } },
        orderBy: { acquiredAt: 'asc' },
        select: {
          sectionId: true,
          userId: true,
          user: { select: { name: true, image: true } },
        },
      },
      _count: { select: { versions: true } },
    },
  });

  if (!document) notFound();

  const editors = document.locks.filter((lock) => lock.userId !== user.id);

  return (
    <main className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-(--color-border-subtle) px-6 pt-5 pb-3">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DocumentTitle documentId={document.id} title={document.title} />
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-(--color-ink-faint)">
                <span>{TYPE_LABEL[document.type] ?? 'Document'}</span>
                <span aria-hidden="true">·</span>
                <Link
                  href={`/w/${document.workspace.slug}`}
                  className="hover:text-(--color-ink-muted) hover:underline"
                >
                  {document.workspace.name}
                </Link>
                <span aria-hidden="true">·</span>
                <Link
                  href={`/d/${document.id}/history`}
                  className="text-(--color-accent) hover:underline"
                >
                  Version history
                  {document._count.versions > 0 ? ` (${document._count.versions})` : ''}
                </Link>
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <DeleteDocumentButton documentId={document.id} title={document.title} />
              {editors.length > 0 && (
                <ul className="flex flex-wrap items-center justify-end gap-2">
                  {editors.map((lock) => (
                    <li
                      key={`${lock.userId}:${lock.sectionId}`}
                      className="flex items-center gap-1.5 text-xs text-(--color-ink-muted)"
                    >
                      <Avatar name={lock.user.name} image={lock.user.image} size="sm" />
                      <span>
                        {lock.user.name ?? 'Someone'} in{' '}
                        {sectionLabel(document.contentJson, lock.sectionId)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <DocumentEditor
          documentId={document.id}
          initialContent={asProseMirrorDoc(document.contentJson)}
          initialUpdatedAt={document.updatedAt.toISOString()}
          currentUserId={user.id}
        />
      </div>
    </main>
  );
}
