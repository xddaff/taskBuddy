import type { ReactNode } from "react";

const TONES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
} as const;

export type ChipTone = keyof typeof TONES;

type ChipProps = {
  children: ReactNode;
  tone?: ChipTone;
};

export function Chip({ children, tone = "slate" }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
