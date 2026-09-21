import { redirect } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { SkillsEditor } from "@/components/SkillsEditor";
import { CATEGORY_SLUGS } from "@/lib/ai/taxonomy";
import { ensureSeeded, listIssues } from "@/lib/repo";
import { getCurrentStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const student = await getCurrentStudent();
  if (!student) redirect("/");

  await ensureSeeded();
  const issues = await listIssues();
  const projectLabels = [...new Set(issues.flatMap((issue) => issue.labels))].sort();
  // Categories first: they are what the recommender matches on for every task,
  // including the ones GitLab left unlabelled.
  const suggestions = [...new Set([...CATEGORY_SLUGS, ...projectLabels])];

  return (
    <>
      <NavBar student={student} active="profile" />

      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Skills</h1>
          <p className="mt-1 text-sm text-muted">
            TaskBuddy categorizes every task for you, then ranks the ones whose categories and
            GitLab labels match what you list here.
          </p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <SkillsEditor initialSkills={student.skills} suggestions={suggestions} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-muted">Currently saved</h2>
          {student.skills.length > 0 ? (
            <p className="mt-2 text-sm">{student.skills.join(", ")}</p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Nothing saved yet. Without skills you still get recommendations, but they are picked
              only to close your participation gap.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
