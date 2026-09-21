type IconProps = {
  className?: string;
};

export function SignOutIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 4.5H5.5A1.5 1.5 0 0 0 4 6v8a1.5 1.5 0 0 0 1.5 1.5H8M11 13.5 14.5 10 11 6.5M14.5 10H8" />
    </svg>
  );
}
