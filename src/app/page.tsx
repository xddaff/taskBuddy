import { redirect } from "next/navigation";
import { DemoLoginList } from "@/components/DemoLoginList";
import { isDemoMode } from "@/lib/env";
import { ensureSeeded, listStudents } from "@/lib/repo";
import { getCurrentStudent } from "@/lib/session";
import { isMaintainer, type Student } from "@/lib/types";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await getCurrentStudent();
  if (current) redirect("/dashboard");

  const error = firstParam((await searchParams).error);
  const demo = isDemoMode();

  let classMembers: Student[] = [];
  let instructors: Student[] = [];
  if (demo) {
    await ensureSeeded();
    const students = await listStudents();
    classMembers = students.filter((student) => !isMaintainer(student));
    instructors = students.filter(isMaintainer);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">TaskBuddy</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Find the course issues that fit you
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted">
          TaskBuddy reads your course GitLab project, matches open issues to the skills you list,
          and recommends the work that gets every student to the participation minimum.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {demo ? (
          <>
            <h2 className="text-lg font-semibold">Demo mode: pick a student</h2>
            <p className="mt-1 text-sm text-muted">
              No GitLab credentials are configured, so sign in as any member of the sample class.
            </p>
            <div className="mt-6">
              <DemoLoginList students={classMembers} />
            </div>

            {instructors.length > 0 ? (
              <div className="mt-8 border-t border-slate-200 pt-6">
                <h3 className="text-sm font-semibold">Instructor account</h3>
                <p className="mt-1 text-sm text-muted">
                  Sign in here to set the participation minimum and see the whole class.
                </p>
                <div className="mt-4">
                  <DemoLoginList students={instructors} />
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-center">
            <h2 className="text-lg font-semibold">Sign in to continue</h2>
            <p className="mt-1 text-sm text-muted">
              TaskBuddy uses your GitLab account to find your issues in the course project.
            </p>
            <a
              href="/api/auth/gitlab"
              className="mt-6 inline-flex items-center rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Sign in with GitLab
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
