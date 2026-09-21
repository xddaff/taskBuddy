import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { SignOutButton } from "@/components/SignOutButton";
import { SyncButton } from "@/components/SyncButton";
import { isMaintainer, type Student } from "@/lib/types";

type NavKey = "dashboard" | "profile" | "chat" | "bureaucracy" | "class";

type NavBarProps = {
  student: Student;
  active: NavKey;
};

const LINKS: Array<{ key: NavKey; href: string; label: string; maintainerOnly?: boolean }> = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard" },
  { key: "profile", href: "/profile", label: "Skills" },
  { key: "chat", href: "/chat", label: "Chat" },
  { key: "bureaucracy", href: "/bureaucracy", label: "Bureaucracy" },
  { key: "class", href: "/class", label: "Class", maintainerOnly: true },
];

export function NavBar({ student, active }: NavBarProps) {
  const links = LINKS.filter((link) => !link.maintainerOnly || isMaintainer(student));

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="text-base font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        >
          TaskBuddy
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              aria-current={link.key === active ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                link.key === active
                  ? "bg-slate-100 text-ink"
                  : "text-muted hover:bg-slate-50 hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <SyncButton />
          <div className="flex items-center gap-2">
            <Avatar student={student} size="sm" />
            <span className="text-sm font-medium">{student.name}</span>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
