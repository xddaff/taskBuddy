import { keywordCategorizer, type TaskCategorizer } from "@/lib/ai/categorize";

/**
 * The single place that decides which categorizer runs. Adding a model-backed
 * one means implementing `TaskCategorizer` and branching here.
 */
export function getCategorizer(): TaskCategorizer {
  return keywordCategorizer;
}

export type {
  CategorizerInput,
  CategorySuggestion,
  TaskCategorizer,
} from "@/lib/ai/categorize";
