"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SignOutIcon } from "@/components/Icons";
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
    <div className="flex items-center gap-2">
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        aria-label={pending ? "Signing out" : "Sign out"}
        className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-ink/80 transition hover:bg-white/70 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
      >
        <SignOutIcon />
        <span className="hidden lg:inline">{pending ? "Signing out…" : "Sign out"}</span>
      </button>
    </div>
  );
}
