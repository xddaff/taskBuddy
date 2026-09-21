import { prisma } from '@studentproj/db';
import Link from 'next/link';
import { NewWorkspaceForm } from './NewWorkspaceForm';

export default async function NewWorkspacePage() {
  const projects = await prisma.gitlabProject.findMany({
    orderBy: [{ lastActivityAt: 'desc' }, { name: 'asc' }],
    take: 30,
    select: { gitlabId: true, name: true, pathWithNamespace: true, openIssueCount: true },
  });

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-(--color-ink-faint)">
          <Link href="/tasks" className="hover:text-(--color-ink)">
            Home
          </Link>
          <span aria-hidden="true" className="px-1.5">
            /
          </span>
          <span className="text-(--color-ink-muted)">New workspace</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight">Start a workspace</h1>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            A workspace is one team: shared channels, shared documents, and task suggestions
            scoped to the repositories you are actually working in.
          </p>
        </header>

        <NewWorkspaceForm projects={projects} />
      </div>
    </main>
  );
}
