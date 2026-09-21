type BrandMarkProps = {
  size?: "sm" | "md";
};

export function BrandMark({ size = "md" }: BrandMarkProps) {
  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";

  return (
    <span
      aria-hidden
      className={`${box} relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#c4b5fd] via-[#93c5fd] to-[#86efac] shadow-chip`}
    >
      <svg viewBox="0 0 32 32" className="h-[70%] w-[70%] text-white" fill="none">
        <rect x="7" y="6" width="16" height="20" rx="2.5" fill="white" />
        <rect x="9.5" y="6" width="2.2" height="20" rx="1" fill="#7c6af7" />
        <path d="M14 12h6.5M14 16h6.5M14 20h4.5" stroke="#1f1f1f" strokeWidth="1.4" strokeLinecap="round" />
        <path
          d="M23.2 8.2l.55 1.35 1.35.55-1.35.55-.55 1.35-.55-1.35-1.35-.55 1.35-.55z"
          fill="#1f1f1f"
        />
      </svg>
    </span>
  );
}
