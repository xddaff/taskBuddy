import { Chip } from "@/components/Chip";
import { categoryBySlug } from "@/lib/ai/taxonomy";
import type { IssueCategory } from "@/lib/types";

type CategoryChipsProps = {
  categories: IssueCategory[];
};

function explain(category: IssueCategory, label: string): string {
  const confidence = `${Math.round(category.confidence * 100)}% confidence`;
  if (category.evidence.length === 0) return `${label} · ${confidence}`;
  return `${label} · ${confidence} · from ${category.evidence.join(", ")}`;
}

export function CategoryChips({ categories }: CategoryChipsProps) {
  if (categories.length === 0) {
    return (
      <Chip title="Nothing in the title, description, or labels pointed at a category">
        Uncategorized
      </Chip>
    );
  }

  return (
    <>
      {categories.map((category) => {
        const definition = categoryBySlug(category.slug);
        const label = definition?.label ?? category.slug;
        return (
          <Chip
            key={category.slug}
            tone={definition?.tone ?? "slate"}
            title={explain(category, label)}
          >
            {label}
          </Chip>
        );
      })}
    </>
  );
}
