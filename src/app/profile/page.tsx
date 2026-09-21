import { redirect } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { Pane } from "@/components/Pane";
import { SkillsEditor } from "@/components/SkillsEditor";
import { ensureSeeded, listIssues } from "@/lib/repo";
import { getCurrentStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const student = await getCurrentStudent();
  if (!student) redirect("/");

  await ensureSeeded();
  const issues = await listIssues();
  const projectLabels = [...new Set(issues.flatMap((issue) => issue.labels))].sort();

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar student={student} active="profile" />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 p-3 lg:flex-row lg:items-start">
        <Pane title="Currently saved" className="w-full lg:max-w-sm">
          <p className="text-sm leading-relaxed text-muted">
            TaskBuddy ranks open issues higher when their GitLab labels match what you list here.
          </p>
          {student.skills.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {student.skills.map((skill) => (
                <li key={skill} className="rounded-full bg-lavender px-3 py-1 text-sm font-medium">
                  {skill}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Nothing saved yet. Without skills you still get recommendations, but they are picked
              only to close your participation gap.
            </p>
          )}
        </Pane>

        <Pane title="Skills" className="w-full flex-1">
          <SkillsEditor initialSkills={student.skills} suggestions={projectLabels} />
        </Pane>
      </main>
    </div>
  );
}
