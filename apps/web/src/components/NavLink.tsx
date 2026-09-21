'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

interface Props {
  href: string;
  children: ReactNode;
  /// When true, /search?q=docker still highlights Search. Default is exact so
  /// /tasks does not stay lit on /tasks/saved.
  prefix?: boolean;
  className?: string;
}

const INACTIVE =
  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-(--color-ink-muted) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink)';
const ACTIVE =
  'flex items-center gap-2 rounded-md bg-(--color-accent-soft) px-2 py-1.5 text-sm text-(--color-ink)';

export function NavLink({ href, children, prefix = false, className }: Props) {
  const pathname = usePathname();
  const active = prefix ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`${active ? ACTIVE : INACTIVE} ${className ?? ''}`}
    >
      {children}
    </Link>
  );
}
