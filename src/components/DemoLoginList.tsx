"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { FolderIcon } from "@/components/Icons";
import { errorMessage, postJson } from "@/components/post-json";
import { isMaintainer, type Student } from "@/lib/types";

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
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {students.map((student) => (
          <li key={student.gitlabUserId}>
            <button
              type="button"
              onClick={() => signIn(student.username)}
              disabled={pendingUsername !== null}
              className="flex h-full w-full flex-col rounded-[1.35rem] bg-lavender/70 p-4 text-left transition hover:bg-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-start justify-between">
                <FolderIcon />
                <Avatar student={student} size="sm" />
              </span>
              <span className="mt-6 block truncate text-[15px] font-medium">{student.name}</span>
              <span className="mt-1 block truncate text-xs text-muted">
                {pendingUsername === student.username
                  ? "Opening notebook…"
                  : isMaintainer(student)
                    ? "Instructor notebook"
                    : student.skills.length > 0
                      ? `${student.skills.length} ${student.skills.length === 1 ? "source" : "sources"} · ${student.skills.join(", ")}`
                      : `@${student.username} · 0 sources`}
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
