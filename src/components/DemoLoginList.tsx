"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { errorMessage, postJson } from "@/components/post-json";
import type { Student } from "@/lib/types";

type DemoLoginListProps = {
  students: Student[];
};

export function DemoLoginList({ students }: DemoLoginListProps) {
  const router = useRouter();
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(username: string) {
    setError(null);
    setPendingUsername(username);
    try {
      await postJson("/api/auth/demo", { username });
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
      setPendingUsername(null);
    }
  }

  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {students.map((student) => (
          <li key={student.gitlabUserId}>
            <button
              type="button"
              onClick={() => signIn(student.username)}
              disabled={pendingUsername !== null}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Avatar student={student} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{student.name}</span>
                <span className="block truncate text-xs text-muted">
                  {pendingUsername === student.username
                    ? "Signing in…"
                    : student.skills.length > 0
                      ? student.skills.join(", ")
                      : `@${student.username}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
