type BrandMarkProps = {
  size?: "sm" | "md";
};

export function BrandMark({ size = "md" }: BrandMarkProps) {
  const box = size === "sm" ? "h-8 w-8 text-sm" : "h-9 w-9 text-base";

  return (
    <span
      aria-hidden
      className={`${box} inline-flex items-center justify-center rounded-xl bg-ink font-semibold text-white`}
    >
      T
    </span>
  );
}
