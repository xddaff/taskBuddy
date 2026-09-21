import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BrandMark } from "@/components/BrandMark";
import { ChartIcon, SettingsIcon } from "@/components/Icons";
import { SignOutButton } from "@/components/SignOutButton";
import { SyncButton } from "@/components/SyncButton";
import { isMaintainer, type Student } from "@/lib/types";

type NavKey = "dashboard" | "profile" | "class";

type NavBarProps = {
  student: Student;
  active: NavKey;
  title: string;
};

export function NavBar({ student, active, title }: NavBarProps) {
  return (
    <header className="px-3 pt-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-2 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          >
            <BrandMark size="sm" />
            <span className="sr-only">TaskBuddy home</span>
          </Link>
          <h1 className="truncate text-[17px] font-medium tracking-tight text-ink sm:text-lg">
            {title}
          </h1>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <SyncButton />
          {isMaintainer(student) ? (
            <Link
              href="/class"
              aria-current={active === "class" ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                active === "class" ? "bg-white text-ink shadow-chip" : "text-ink/80 hover:bg-white/70"
              }`}
            >
              <ChartIcon />
              <span className="hidden sm:inline">Analytics</span>
            </Link>
          ) : null}
          <Link
            href="/profile"
            aria-current={active === "profile" ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              active === "profile" ? "bg-white text-ink shadow-chip" : "text-ink/80 hover:bg-white/70"
            }`}
          >
            <SettingsIcon />
            <span className="hidden sm:inline">Skills</span>
          </Link>
          <SignOutButton />
          <div className="pl-1">
            <Avatar student={student} size="sm" />
          </div>
        </div>
      </div>
    </header>
  );
}
