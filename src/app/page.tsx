import { redirect } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { DemoLoginList } from "@/components/DemoLoginList";
import { AppsIcon, HeadphonesIcon, PeopleIcon, PlusIcon, SettingsIcon, UploadIcon } from "@/components/Icons";
import { isDemoMode } from "@/lib/env";
import { ensureSeeded, listStudents } from "@/lib/repo";
import { getCurrentStudent } from "@/lib/session";
import { isMaintainer, type Student } from "@/lib/types";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const FEATURES = [
  {
    title: "Gain new understandings about any issue",
    body: "Match GitLab work to the skills you already have, then see why each recommendation was picked for you.",
    icon: HeadphonesIcon,
  },
  {
    title: "A notebook grounded in your course",
    body: "Upload is automatic: TaskBuddy reads the course project and keeps open issues ready to claim.",
    icon: UploadIcon,
  },
  {
    title: "Share the load fairly",
    body: "Recommendations fill every student’s participation gap so the whole class can reach the minimum.",
    icon: PeopleIcon,
  },
];

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
    <div className="welcome-shell min-h-screen">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[17px] font-medium tracking-tight">TaskBuddy</span>
        </div>
        <div aria-hidden className="flex items-center gap-1 text-muted">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full">
            <SettingsIcon className="h-[18px] w-[18px]" />
          </span>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full">
            <AppsIcon className="h-[18px] w-[18px]" />
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-10 sm:px-8 sm:pt-16">
        <div className="text-center">
          <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">Welcome to TaskBuddy</h1>
          <h2 className="mt-10 text-2xl font-medium tracking-tight sm:text-3xl">
            Create your first course notebook
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">
            TaskBuddy is an issue recommender that works best with the GitLab project you already
            use. It matches open work to your skills and helps every student reach the participation
            minimum.
          </p>
        </div>

        <ul className="mx-auto mt-14 grid max-w-4xl gap-10 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lavender text-[#4a3c7a]">
                <feature.icon className="h-7 w-7" />
              </span>
              <h3 className="mt-5 text-base font-medium tracking-tight">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
            </li>
          ))}
        </ul>

        {error ? (
          <p
            role="alert"
            className="mx-auto mt-10 max-w-xl rounded-2xl border border-peach bg-peach/70 px-4 py-3 text-sm text-[#8c1d18]"
          >
            {error}
          </p>
        ) : null}

        {demo ? (
          <section className="mt-16">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-medium tracking-tight">Recent notebooks</h2>
                <p className="mt-1 text-sm text-muted">
                  Demo mode is on. Open any class member’s notebook to try the full flow.
                </p>
              </div>
            </div>
            <div className="mt-6">
              <DemoLoginList students={classMembers} />
            </div>

            {instructors.length > 0 ? (
              <div className="mt-10">
                <h3 className="text-xl font-medium tracking-tight">Instructor notebook</h3>
                <p className="mt-1 text-sm text-muted">
                  Sign in here to set the participation minimum and see the whole class.
                </p>
                <div className="mt-6">
                  <DemoLoginList students={instructors} />
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-sm text-muted">Try your course project</p>
            <a
              href="/api/auth/gitlab"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Sign in with GitLab
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
