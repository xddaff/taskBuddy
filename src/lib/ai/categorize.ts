import { CATEGORIES, type CategorySlug } from "@/lib/ai/taxonomy";
import { mentionsWholeWord } from "@/lib/text-match";

export type CategorizerInput = {
  title: string;
  description: string;
  labels: string[];
};

export type CategorySuggestion = {
  slug: CategorySlug;
  /** Share of the total signal this category won, 0-1, rounded to two decimals. */
  confidence: number;
  /** The signals that produced the category, so the UI can explain itself. */
  evidence: string[];
};

/**
 * Batched and asynchronous so a model-backed implementation can replace the
 * bundled keyword one without any caller changing.
 */
export interface TaskCategorizer {
  readonly name: string;
  categorize(inputs: CategorizerInput[]): Promise<CategorySuggestion[][]>;
}

const LABEL_POINTS = 3;
const TITLE_POINTS = 2;
const DESCRIPTION_POINTS = 1;

const MIN_SCORE = 2;
const MIN_CONFIDENCE = 0.15;
const MAX_CATEGORIES = 3;

type Scored = {
  slug: CategorySlug;
  score: number;
  evidence: string[];
};

function scoreCategories(input: CategorizerInput): Scored[] {
  const labels = new Set(input.labels.map((label) => label.trim().toLowerCase()));

  return CATEGORIES.map((category) => {
    let score = 0;
    const evidence: string[] = [];

    for (const alias of category.labelAliases) {
      if (!labels.has(alias)) continue;
      score += LABEL_POINTS;
      evidence.push(`label: ${alias}`);
    }

    for (const keyword of category.keywords) {
      if (mentionsWholeWord(input.title, keyword)) {
        score += TITLE_POINTS;
        evidence.push(`title: ${keyword}`);
      } else if (mentionsWholeWord(input.description, keyword)) {
        score += DESCRIPTION_POINTS;
        evidence.push(`text: ${keyword}`);
      }
    }

    return { slug: category.slug, score, evidence };
  });
}

/** Pure, deterministic classification of a single task. */
export function classifyTask(input: CategorizerInput): CategorySuggestion[] {
  const scored = scoreCategories(input);
  const total = scored.reduce((sum, entry) => sum + entry.score, 0);
  if (total === 0) return [];

  return scored
    .map((entry) => ({
      slug: entry.slug,
      confidence: Math.round((entry.score / total) * 100) / 100,
      evidence: entry.evidence,
      score: entry.score,
    }))
    .filter((entry) => entry.score >= MIN_SCORE && entry.confidence >= MIN_CONFIDENCE)
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, MAX_CATEGORIES)
    .map(({ slug, confidence, evidence }) => ({ slug, confidence, evidence }));
}

export const keywordCategorizer: TaskCategorizer = {
  name: "keyword",
  async categorize(inputs: CategorizerInput[]): Promise<CategorySuggestion[][]> {
    return inputs.map(classifyTask);
  },
};
