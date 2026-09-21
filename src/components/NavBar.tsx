import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BrandMark } from "@/components/BrandMark";
import { SignOutButton } from "@/components/SignOutButton";
import { SyncButton } from "@/components/SyncButton";
import { isMaintainer, type Student } from "@/lib/types";

type NavKey = "dashboard" | "profile" | "class";

type NavBarProps = {
  student: Student;
  active: NavKey;
};

const LINKS: Array<{ key: NavKey; href: string; label: string; maintainerOnly?: boolean }> = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard" },
  { key: "profile", href: "/profile", label: "Skills" },
  { key: "class", href: "/class", label: "Class", maintainerOnly: true },
];

export function NavBar({ student, active }: NavBarProps) {
  const links = LINKS.filter((link) => !link.maintainerOnly || isMaintainer(student));

  return (
    <header className="px-3 pt-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-2 py-1">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        >
          <BrandMark size="sm" />
          <span className="text-[17px] font-medium tracking-tight">TaskBuddy</span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              aria-current={link.key === active ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                link.key === active
                  ? "bg-white text-ink shadow-chip"
                  : "text-ink/70 hover:bg-white/70 hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <SyncButton />
          <div className="flex items-center gap-2 pl-1">
            <Avatar student={student} size="sm" />
            <span className="hidden text-sm font-medium sm:inline">{student.name}</span>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
