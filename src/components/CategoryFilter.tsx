import Link from "next/link";
import type { CategoryCount } from "@/lib/category-stats";

type CategoryFilterProps = {
  basePath: string;
  active: string | null;
  counts: CategoryCount[];
  total: number;
};

const BASE =
  "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const IDLE = "bg-white text-muted ring-slate-200 hover:text-ink hover:ring-slate-300";
const ACTIVE = "bg-ink text-white ring-ink";

export function CategoryFilter({ basePath, active, counts, total }: CategoryFilterProps) {
  if (counts.length === 0) return null;

  return (
    <nav aria-label="Filter issues by category" className="flex flex-wrap items-center gap-2">
      <Link href={basePath} className={`${BASE} ${active === null ? ACTIVE : IDLE}`}>
        All {total}
      </Link>
      {counts.map((count) => (
        <Link
          key={count.slug}
          href={`${basePath}?category=${count.slug}`}
          aria-current={active === count.slug ? "page" : undefined}
          className={`${BASE} ${active === count.slug ? ACTIVE : IDLE}`}
        >
          {count.label} {count.total}
        </Link>
      ))}
    </nav>
  );
}
