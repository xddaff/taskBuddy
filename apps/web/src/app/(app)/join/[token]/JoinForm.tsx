'use client';

import { useActionState } from 'react';
import { acceptInviteAction, type JoinState } from './actions';

export function JoinForm({ token, workspaceName }: { token: string; workspaceName: string }) {
  const [state, formAction, pending] = useActionState<JoinState, FormData>(acceptInviteAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-(--color-danger) bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-(--color-accent) px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Joining...' : `Join ${workspaceName}`}
      </button>
    </form>
  );
}
