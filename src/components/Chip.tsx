import type { ReactNode } from "react";

const TONES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
} as const;

export type ChipTone = keyof typeof TONES;

type ChipProps = {
  children: ReactNode;
  tone?: ChipTone;
  title?: string;
};

export function Chip({ children, tone = "slate", title }: ChipProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
