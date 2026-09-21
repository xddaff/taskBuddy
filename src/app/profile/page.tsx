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
      <NavBar student={student} active="profile" title="Skills and sources" />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 p-3 lg:flex-row lg:items-start">
        <Pane title="Sources" className="w-full lg:max-w-sm">
          <p className="text-sm leading-relaxed text-muted">
            These skills are treated like notebook sources. TaskBuddy ranks open issues higher when
            their GitLab labels match what you list here.
          </p>
          {student.skills.length > 0 ? (
            <ul className="mt-4 space-y-1">
              {student.skills.map((skill) => (
                <li
                  key={skill}
                  className="rounded-xl bg-[#f8f6fc] px-3 py-2 text-sm font-medium"
                >
                  {skill}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 rounded-2xl bg-[#f8f6fc] px-4 py-6 text-center text-sm text-muted">
              Nothing saved yet. Without skills you still get recommendations, but they are picked
              only to close your participation gap.
            </p>
          )}
        </Pane>

        <Pane title="Chat" className="w-full flex-1">
          <div className="px-1 py-2">
            <h2 className="text-[1.65rem] font-medium tracking-tight">Customize this notebook</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Add the languages, tools, and topics you want recommendations grounded in.
            </p>
            <div className="mt-6">
              <SkillsEditor initialSkills={student.skills} suggestions={projectLabels} />
            </div>
          </div>
        </Pane>
      </main>
    </div>
  );
}
