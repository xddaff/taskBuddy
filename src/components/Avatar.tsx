import type { Student } from "@/lib/types";

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

type AvatarProps = {
  student: Pick<Student, "name" | "username" | "avatarUrl">;
  size?: keyof typeof SIZES;
};

function initialsOf(name: string, username: string): string {
  const source = name.trim() || username.trim();
  const parts = source.split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return letters || "?";
}

export function Avatar({ student, size = "md" }: AvatarProps) {
  const base = `${SIZES[size]} shrink-0 rounded-full object-cover ring-1 ring-slate-200`;

  if (student.avatarUrl) {
    // Remote GitLab avatar hosts are not declared in next.config, so next/image is unusable here.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={student.avatarUrl} alt="" className={base} />;
  }

  return (
    <span
      aria-hidden
      className={`${base} flex items-center justify-center bg-slate-100 font-semibold text-muted`}
    >
      {initialsOf(student.name, student.username)}
    </span>
  );
}
