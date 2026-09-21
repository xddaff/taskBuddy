'use client';

import type { WorkspaceRole } from '@studentproj/db';
import { useActionState, useState } from 'react';
import {
  changeRoleAction,
  createChannelAction,
  createDocumentAction,
  createInviteAction,
  removeMemberAction,
  revokeInviteAction,
  type WorkspaceActionState,
} from './actions';

const INPUT_CLASS =
  'w-full rounded-md border border-(--color-border-subtle) bg-(--color-surface) px-2.5 py-1.5 text-sm placeholder:text-(--color-ink-faint) focus:border-(--color-accent) focus:outline-none';

const PRIMARY_BUTTON_CLASS =
  'rounded-md bg-(--color-accent) px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50';

const QUIET_BUTTON_CLASS =
  'rounded-md border border-(--color-border-subtle) px-2.5 py-1.5 text-xs text-(--color-ink-muted) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink) disabled:opacity-50';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-(--color-danger)">
      {message}
    </p>
  );
}

export function NewChannelForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState<WorkspaceActionState, FormData>(
    createChannelAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <label htmlFor="channel-name" className="mb-1 block text-xs text-(--color-ink-muted)">
            Channel name
          </label>
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true" className="text-(--color-ink-faint)">
              #
            </span>
            <input
              id="channel-name"
              name="name"
              required
              maxLength={40}
              autoComplete="off"
              placeholder="design-review"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="min-w-40 flex-1">
          <label htmlFor="channel-topic" className="mb-1 block text-xs text-(--color-ink-muted)">
            Topic <span className="text-(--color-ink-faint)">optional</span>
          </label>
          <input
            id="channel-topic"
            name="topic"
            maxLength={140}
            autoComplete="off"
            placeholder="What belongs in here"
            className={INPUT_CLASS}
          />
        </div>

        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? 'Creating...' : 'Create channel'}
        </button>
      </div>
      <FieldError message={state.error} />
    </form>
  );
}

export function NewDocumentForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState<WorkspaceActionState, FormData>(
    createDocumentAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <label htmlFor="document-title" className="mb-1 block text-xs text-(--color-ink-muted)">
            Document title
          </label>
          <input
            id="document-title"
            name="title"
            required
            maxLength={120}
            autoComplete="off"
            placeholder="Sprint 2 report"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="document-type" className="mb-1 block text-xs text-(--color-ink-muted)">
            Type
          </label>
          <select id="document-type" name="type" defaultValue="REPORT" className={INPUT_CLASS}>
            <option value="REPORT">Report</option>
            <option value="PLAN">Plan</option>
            <option value="FREEFORM">Freeform</option>
          </select>
        </div>

        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? 'Creating...' : 'Create document'}
        </button>
      </div>
      <FieldError message={state.error} />
    </form>
  );
}

export function CreateInviteForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState<WorkspaceActionState, FormData>(
    createInviteAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="slug" value={slug} />
      <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
        {pending ? 'Generating...' : 'Generate invite link'}
      </button>
      <FieldError message={state.error} />
    </form>
  );
}

export function RevokeInviteButton({ slug, inviteId }: { slug: string; inviteId: string }) {
  const [state, formAction, pending] = useActionState<WorkspaceActionState, FormData>(
    revokeInviteAction,
    {},
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="inviteId" value={inviteId} />
      <button type="submit" disabled={pending} className={QUIET_BUTTON_CLASS}>
        Revoke
        <span className="sr-only"> this invite link</span>
      </button>
      <FieldError message={state.error} />
    </form>
  );
}

export function CopyLinkButton({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={QUIET_BUTTON_CLASS}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
            setCopied(true);
          } catch {
            // Clipboard access can be refused; the link stays selectable next
            // to the button either way.
            setCopied(false);
          }
        }}
      >
        Copy link
        <span className="sr-only"> for {label}</span>
      </button>
      <span aria-live="polite" className="text-xs text-(--color-positive)">
        {copied ? 'Copied' : ''}
      </span>
    </div>
  );
}

interface MemberActionsProps {
  slug: string;
  memberUserId: string;
  memberName: string;
  role: WorkspaceRole;
  canManage: boolean;
  isSelf: boolean;
}

export function MemberActions({
  slug,
  memberUserId,
  memberName,
  role,
  canManage,
  isSelf,
}: MemberActionsProps) {
  const [roleState, roleAction, rolePending] = useActionState<WorkspaceActionState, FormData>(
    changeRoleAction,
    {},
  );
  const [removeState, removeAction, removePending] = useActionState<WorkspaceActionState, FormData>(
    removeMemberAction,
    {},
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {canManage && (
          <form action={roleAction} className="flex items-center gap-1.5">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="memberUserId" value={memberUserId} />
            <label htmlFor={`role-${memberUserId}`} className="sr-only">
              Role for {memberName}
            </label>
            <select
              id={`role-${memberUserId}`}
              name="role"
              defaultValue={role}
              className="rounded-md border border-(--color-border-subtle) bg-(--color-surface) px-2 py-1 text-xs focus:border-(--color-accent) focus:outline-none"
            >
              <option value="OWNER">Owner</option>
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
            </select>
            <button type="submit" disabled={rolePending} className={QUIET_BUTTON_CLASS}>
              Save
              <span className="sr-only"> role for {memberName}</span>
            </button>
          </form>
        )}

        {(canManage || isSelf) && (
          <form action={removeAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="memberUserId" value={memberUserId} />
            <button
              type="submit"
              disabled={removePending}
              className={`rounded-md px-2.5 py-1.5 text-xs transition disabled:opacity-50 ${
                isSelf
                  ? 'border border-(--color-border-subtle) text-(--color-ink-muted) hover:bg-(--color-surface-hover) hover:text-(--color-ink)'
                  : 'text-(--color-danger) hover:bg-(--color-danger)/10'
              }`}
            >
              {isSelf ? 'Leave workspace' : 'Remove'}
              {!isSelf && <span className="sr-only"> {memberName} from this workspace</span>}
            </button>
          </form>
        )}
      </div>

      <FieldError message={roleState.error ?? removeState.error} />
    </div>
  );
}
