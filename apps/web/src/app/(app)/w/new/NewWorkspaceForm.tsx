'use client';

import { useActionState } from 'react';
import { createWorkspaceAction, type NewWorkspaceState } from './actions';

export interface ProjectOption {
  gitlabId: number;
  name: string;
  pathWithNamespace: string;
  openIssueCount: number;
}

export function NewWorkspaceForm({ projects }: { projects: ProjectOption[] }) {
  const [state, formAction, pending] = useActionState<NewWorkspaceState, FormData>(
    createWorkspaceAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-8">
      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={60}
          autoComplete="off"
          placeholder="Campus Events Team"
          className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2 text-sm placeholder:text-(--color-ink-faint) focus:border-(--color-accent) focus:outline-none"
        />
        <p className="text-xs text-(--color-ink-faint)">
          The URL is generated from this, so pick something your team will recognise in the
          sidebar.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium">
          What is this team working on? <span className="text-(--color-ink-faint)">Optional</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={280}
          placeholder="Second year group project: the events board for the CS department."
          className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2 text-sm placeholder:text-(--color-ink-faint) focus:border-(--color-accent) focus:outline-none"
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">
          Linked GitLab projects <span className="text-(--color-ink-faint)">Optional</span>
        </legend>
        <p className="text-xs text-(--color-ink-muted)">
          Task suggestions in this workspace&rsquo;s chat are drawn from the projects you pick
          here. Leave it empty to suggest from everything indexed.
        </p>

        {projects.length === 0 ? (
          <p className="rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2 text-xs text-(--color-ink-faint)">
            Nothing is indexed yet, so there is nothing to link. You can add projects later.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {projects.map((project) => (
              <li key={project.gitlabId}>
                <label className="flex h-full cursor-pointer gap-3 rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) p-3 transition has-checked:border-(--color-accent) has-checked:bg-(--color-accent-soft) hover:border-(--color-ink-faint)">
                  <input
                    type="checkbox"
                    name="gitlabProjectIds"
                    value={project.gitlabId}
                    className="mt-0.5 size-4 shrink-0 accent-(--color-accent)"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{project.name}</span>
                    <span className="block truncate text-xs text-(--color-ink-faint)">
                      {project.pathWithNamespace} &middot; {project.openIssueCount} open
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-(--color-danger) bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-(--color-accent) px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Creating workspace...' : 'Create workspace'}
        </button>
        <p aria-live="polite" className="text-xs text-(--color-ink-faint)">
          {pending ? 'Setting up #general.' : 'You will be the owner, with a #general channel.'}
        </p>
      </div>
    </form>
  );
}
