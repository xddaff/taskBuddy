interface Props {
  name: string | null;
  image?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
} as const;

/// Derives a stable colour from the name so the same person is always the same
/// colour, without needing to store one.
function hue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}

export function Avatar({ name, image, size = 'md' }: Props) {
  const label = name ?? 'Unknown';
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars come from
      // arbitrary GitLab instances, which cannot be pre-registered with the
      // Next image optimiser.
      <img
        src={image}
        alt=""
        className={`${SIZES[size]} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-full font-medium text-white`}
      style={{ background: `hsl(${hue(label)} 45% 42%)` }}
    >
      {initials || '?'}
    </span>
  );
}
