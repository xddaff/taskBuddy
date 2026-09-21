import { TAGS, type TagDefinition } from './taxonomy.js';

export type TagSource = 'LABEL' | 'LANGUAGE' | 'TITLE';

export interface ExtractedTag {
  slug: string;
  weight: number;
  source: TagSource;
}

/// Substitutions applied before punctuation is stripped, for names whose
/// meaning lives entirely in their symbols. Without these, "C++" and "C#"
/// both collapse to "c" and every issue mentioning either matches plain C.
const SYMBOL_FORMS: Array<[RegExp, string]> = [
  [/c\+\+/g, ' cpp '],
  [/\bc#/g, ' csharp '],
  [/\bf#/g, ' fsharp '],
  [/(^|[^a-z0-9])\.net\b/g, ' dotnet '],
  [/\bci\/cd\b/g, ' cicd '],
];

/// Longest alias first, so "react native" wins over "react" and
/// "machine learning" is never read as two unrelated tokens.
const ALIAS_INDEX: Map<string, string> = buildAliasIndex();
const MAX_NGRAM = 3;

function buildAliasIndex(): Map<string, string> {
  const index = new Map<string, string>();
  const add = (phrase: string, slug: string) => {
    const key = normalize(phrase);
    if (!key) return;
    // First writer wins: a tag's own slug and label are registered before its
    // aliases, so an alias shared by two tags cannot steal a canonical name.
    if (!index.has(key)) index.set(key, slug);
  };

  for (const tag of TAGS) {
    add(tag.slug.replace(/-/g, ' '), tag.slug);
    add(tag.label, tag.slug);
  }
  for (const tag of TAGS) {
    for (const alias of tag.aliases) add(alias, tag.slug);
  }
  return index;
}

/// Lowercases, resolves symbol-bearing names, joins dotted names
/// ("node.js" -> "nodejs") and reduces everything else to spaced tokens.
export function normalize(text: string): string {
  let out = text.toLowerCase();
  for (const [pattern, replacement] of SYMBOL_FORMS) {
    out = out.replace(pattern, replacement);
  }
  // Dots inside words are part of the name, not sentence punctuation.
  out = out.replace(/([a-z])\.([a-z])/g, '$1$2');
  out = out.replace(/[^a-z0-9+#]+/g, ' ');
  return out.trim().replace(/\s+/g, ' ');
}

function tokenize(text: string): string[] {
  const normalized = normalize(text);
  return normalized ? normalized.split(' ') : [];
}

/// Greedy longest-match scan. Once tokens are consumed by an n-gram they are
/// not reconsidered, so "react native navigation" yields react-native rather
/// than react-native plus react.
function matchSlugs(text: string): string[] {
  const tokens = tokenize(text);
  const found: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    for (let n = Math.min(MAX_NGRAM, tokens.length - i); n >= 1; n--) {
      const phrase = tokens.slice(i, i + n).join(' ');
      const slug = ALIAS_INDEX.get(phrase);
      if (slug) {
        found.push(slug);
        i += n;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1;
  }
  return found;
}

function mergeWeights(
  into: Map<string, ExtractedTag>,
  slugs: string[],
  weight: number,
  source: TagSource,
): void {
  for (const slug of slugs) {
    const existing = into.get(slug);
    // A tag confirmed by several signals should not be counted several times;
    // keep the strongest evidence instead of summing towards an arbitrary cap.
    if (!existing || weight > existing.weight) {
      into.set(slug, { slug, weight, source });
    }
  }
}

export interface IssueLikeInput {
  labels?: string[];
  title?: string;
  description?: string;
  /// Raw GitLab language percentages, e.g. { TypeScript: 72.1, CSS: 18.4 }.
  languages?: Record<string, number> | null;
}

/// Weighting reflects how much each signal is trusted. A maintainer applying
/// a label is deliberate; a word appearing in prose is circumstantial.
const WEIGHTS = {
  label: 1,
  title: 0.6,
  description: 0.35,
  /// Languages below this share of the repo say more about tooling than about
  /// the skills a task needs.
  minLanguageShare: 3,
} as const;

export function extractIssueTags(input: IssueLikeInput): ExtractedTag[] {
  const tags = new Map<string, ExtractedTag>();

  for (const label of input.labels ?? []) {
    mergeWeights(tags, matchSlugs(label), WEIGHTS.label, 'LABEL');
  }
  if (input.title) {
    mergeWeights(tags, matchSlugs(input.title), WEIGHTS.title, 'TITLE');
  }
  if (input.description) {
    // Only the opening of a description is considered. Long issue bodies
    // include stack traces and logs that mention half the taxonomy.
    mergeWeights(tags, matchSlugs(input.description.slice(0, 1200)), WEIGHTS.description, 'TITLE');
  }
  if (input.languages) {
    for (const [language, share] of Object.entries(input.languages)) {
      if (share < WEIGHTS.minLanguageShare) continue;
      mergeWeights(tags, matchSlugs(language), Math.min(1, share / 100), 'LANGUAGE');
    }
  }

  return [...tags.values()].sort((a, b) => b.weight - a.weight || a.slug.localeCompare(b.slug));
}

/// Tag extraction over chat messages. Deliberately the same extractor the
/// GitLab indexer uses, which is what lets one scoring implementation serve
/// both the task feed and the in-conversation suggestions.
export function extractTextTags(text: string): ExtractedTag[] {
  const tags = new Map<string, ExtractedTag>();
  mergeWeights(tags, matchSlugs(text), WEIGHTS.title, 'TITLE');
  return [...tags.values()].sort((a, b) => b.weight - a.weight || a.slug.localeCompare(b.slug));
}

/// Aggregates tags across a rolling window of messages. Recent messages count
/// for more, and a tag mentioned repeatedly outranks a passing reference.
export function extractConversationTags(
  messages: Array<{ body: string }>,
  options: { halfLifeMessages?: number } = {},
): ExtractedTag[] {
  const halfLife = options.halfLifeMessages ?? 10;
  const totals = new Map<string, number>();

  // messages arrive oldest-first; index from the end so recency is cheap.
  messages.forEach((message, index) => {
    const distanceFromNewest = messages.length - 1 - index;
    const recency = Math.pow(0.5, distanceFromNewest / halfLife);
    for (const tag of extractTextTags(message.body)) {
      totals.set(tag.slug, (totals.get(tag.slug) ?? 0) + tag.weight * recency);
    }
  });

  const max = Math.max(...totals.values(), 1);
  return [...totals.entries()]
    .map(([slug, total]) => ({ slug, weight: total / max, source: 'TITLE' as TagSource }))
    .sort((a, b) => b.weight - a.weight || a.slug.localeCompare(b.slug));
}

export function taxonomyForSeed(): TagDefinition[] {
  return TAGS;
}
