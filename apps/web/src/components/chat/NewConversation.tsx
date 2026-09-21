'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { startDm, startGroup, type ConversationActionState } from '@/app/(app)/c/actions';

const EMPTY_STATE: ConversationActionState = { error: null };

export interface StudentOption {
  id: string;
  name: string | null;
  image: string | null;
  gitlabUsername: string | null;
  skills: string[];
  /// Set when a DM with this student already exists, so the list can link
  /// straight to it rather than implying something new gets created.
  existingConversationId: string | null;
}

interface Props {
  students: StudentOption[];
}

export function NewConversation({ students }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState('');

  const [state, submit, pending] = useActionState(
    async (previous: ConversationActionState, formData: FormData) => {
      // One person is a DM and several are a group; the same selection drives
      // both so nobody has to decide which kind of conversation they want
      // before picking who is in it.
      const count = formData.getAll('userId').length;
      if (count === 0) return { error: 'Pick at least one person.' };
      return count === 1 ? startDm(previous, formData) : startGroup(previous, formData);
    },
    EMPTY_STATE,
  );

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return students;
    return students.filter(
      (student) =>
        (student.name ?? '').toLowerCase().includes(needle) ||
        (student.gitlabUsername ?? '').toLowerCase().includes(needle) ||
        student.skills.some((skill) => skill.toLowerCase().includes(needle)),
    );
  }, [students, filter]);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const isGroup = selected.length > 1;

  return (
    <form action={submit} className="space-y-4">
      <div>
        <label htmlFor="student-filter" className="sr-only">
          Filter students
        </label>
        <input
          id="student-filter"
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by name, username or skill"
          className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2 text-sm outline-none placeholder:text-(--color-ink-faint) focus:border-(--color-accent)"
        />
      </div>

      <fieldset>
        <legend className="pb-2 text-xs font-medium uppercase tracking-wider text-(--color-ink-faint)">
          Students
        </legend>

        {visible.length === 0 ? (
          <p className="rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) p-4 text-sm text-(--color-ink-muted)">
            Nobody matches “{filter.trim()}”.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {visible.map((student) => {
              const checked = selected.includes(student.id);

              return (
                <li key={student.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                      checked
                        ? 'border-(--color-accent) bg-(--color-accent-soft)'
                        : 'border-(--color-border-subtle) bg-(--color-surface-raised) hover:bg-(--color-surface-hover)'
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="userId"
                      value={student.id}
                      checked={checked}
                      onChange={() => toggle(student.id)}
                      className="h-4 w-4 shrink-0 accent-(--color-accent)"
                    />
                    <Avatar name={student.name} image={student.image} />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {student.name ?? 'Unknown'}
                        {student.gitlabUsername && (
                          <span className="ml-2 text-xs font-normal text-(--color-ink-faint)">
                            @{student.gitlabUsername}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-(--color-ink-faint)">
                        {student.skills.length > 0 ? student.skills.join(' · ') : 'No skills listed'}
                      </span>
                    </span>

                    {student.existingConversationId && (
                      <Link
                        href={`/c/${student.existingConversationId}`}
                        className="shrink-0 rounded-md border border-(--color-border-subtle) px-2 py-1 text-xs text-(--color-ink-muted) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink)"
                      >
                        Open
                        <span className="sr-only"> existing conversation with {student.name}</span>
                      </Link>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {isGroup && (
        <div>
          <label htmlFor="group-name" className="block pb-1.5 text-sm">
            Group name <span className="text-(--color-ink-faint)">(optional)</span>
          </label>
          <input
            id="group-name"
            name="name"
            type="text"
            maxLength={60}
            placeholder="e.g. Compose debugging"
            className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2 text-sm outline-none placeholder:text-(--color-ink-faint) focus:border-(--color-accent)"
          />
          <p className="mt-1.5 text-xs text-(--color-ink-faint)">
            Without a name the group is listed by who is in it.
          </p>
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-(--color-danger)">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 border-t border-(--color-border-subtle) pt-4">
        <button
          type="submit"
          disabled={selected.length === 0 || pending}
          className="rounded-md bg-(--color-accent) px-3.5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending
            ? 'Opening…'
            : isGroup
              ? `Create group chat with ${selected.length} people`
              : 'Open direct message'}
        </button>

        <p aria-live="polite" className="text-xs text-(--color-ink-faint)">
          {selected.length === 0
            ? 'Pick one person for a direct message, or two or more for a group.'
            : isGroup
              ? `${selected.length + 1} people including you.`
              : 'One person selected.'}
        </p>
      </div>
    </form>
  );
}
