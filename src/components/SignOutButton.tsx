"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, postJson } from "@/components/post-json";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setError(null);
    setPending(true);
    try {
      await postJson("/api/auth/logout");
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-slate-100 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
