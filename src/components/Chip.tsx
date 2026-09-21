import type { ReactNode } from "react";

const TONES = {
  slate: "bg-[#f1f3f4] text-ink",
  emerald: "bg-mist/80 text-[#0d652d]",
  amber: "bg-sand text-[#8a5a00]",
  lavender: "bg-lavender text-[#4a3c7a]",
  sky: "bg-sky/80 text-[#0842a0]",
  peach: "bg-peach text-[#8c1d18]",
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
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
