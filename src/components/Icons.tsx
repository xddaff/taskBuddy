type IconProps = {
  className?: string;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PlusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...stroke}>
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  );
}

export function SettingsIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...stroke}>
      <circle cx="10" cy="10" r="2.2" />
      <path d="M10 3.4v1.4M10 15.2v1.4M3.4 10h1.4M15.2 10h1.4M5.3 5.3l1 1M13.7 13.7l1 1M14.7 5.3l-1 1M6.3 13.7l-1 1" />
    </svg>
  );
}

export function ChartIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...stroke}>
      <path d="M4 15.5V9.5M10 15.5V4.5M16 15.5v-4" />
    </svg>
  );
}

export function CollapseIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...stroke}>
      <rect x="3.5" y="4.5" width="13" height="11" rx="2" />
      <path d="M8 4.5v11" />
    </svg>
  );
}

export function FolderIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M3.5 8.5A2 2 0 0 1 5.5 6.5h4.2l1.6 2H18.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"
        fill="#f6c453"
        stroke="#e0a93a"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function HeadphonesIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} strokeWidth={1.6}>
      <path d="M5 13.5v2.2A2.2 2.2 0 0 0 7.2 18H8v-4.5H7.2A2.2 2.2 0 0 0 5 15.7V13.5a7 7 0 0 1 14 0v2.2a2.2 2.2 0 0 1-2.2 2.2H16V13.5h.8A2.2 2.2 0 0 1 19 15.7" />
    </svg>
  );
}

export function UploadIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} strokeWidth={1.6}>
      <path d="M12 16V7M8.5 10.5 12 7l3.5 3.5M6 18h12" />
    </svg>
  );
}

export function PeopleIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} strokeWidth={1.6}>
      <circle cx="9" cy="8.5" r="2.4" />
      <circle cx="16" cy="9.2" r="2" />
      <path d="M4.5 18c.4-2.6 2.4-4 4.5-4s4.1 1.4 4.5 4M13.5 18c.2-1.8 1.4-3 3-3.2 1.6.1 2.8 1.3 3 3.2" />
    </svg>
  );
}

export function SendIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor">
      <path d="M4.2 10.3 15.4 5.2c.6-.3 1.2.3.9.9l-5.1 11.2c-.3.6-1.1.5-1.3-.1l-1.4-4.6-4.6-1.4c-.6-.2-.7-1-.1-1.3z" />
    </svg>
  );
}

export function DocIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...stroke}>
      <path d="M6 3.8h5.2L14.8 7.4V16.2H6z" />
      <path d="M11.1 3.8V7.4h3.7" />
    </svg>
  );
}

export function CheckIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} {...stroke} strokeWidth={1.8}>
      <path d="M3.5 8.2 6.6 11.2 12.5 4.8" />
    </svg>
  );
}

export function NoteIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none">
      <rect x="4" y="3.5" width="12" height="13" rx="2" fill="#f6c453" />
      <path d="M7 8h6M7 11h4" stroke="#1f1f1f" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function AppsIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor">
      <rect x="3.5" y="3.5" width="4" height="4" rx="1" />
      <rect x="8" y="3.5" width="4" height="4" rx="1" />
      <rect x="12.5" y="3.5" width="4" height="4" rx="1" />
      <rect x="3.5" y="8" width="4" height="4" rx="1" />
      <rect x="8" y="8" width="4" height="4" rx="1" />
      <rect x="12.5" y="8" width="4" height="4" rx="1" />
      <rect x="3.5" y="12.5" width="4" height="4" rx="1" />
      <rect x="8" y="12.5" width="4" height="4" rx="1" />
      <rect x="12.5" y="12.5" width="4" height="4" rx="1" />
    </svg>
  );
}

export function SignOutIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...stroke}>
      <path d="M8 4.5H5.5A1.5 1.5 0 0 0 4 6v8a1.5 1.5 0 0 0 1.5 1.5H8M11 13.5 14.5 10 11 6.5M14.5 10H8" />
    </svg>
  );
}
