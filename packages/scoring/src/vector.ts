export type TagVector = Map<string, number>;

export interface WeightedTag {
  slug: string;
  weight: number;
}

export function toVector(tags: WeightedTag[]): TagVector {
  const vector: TagVector = new Map();
  for (const { slug, weight } of tags) {
    if (weight <= 0) continue;
    vector.set(slug, Math.max(vector.get(slug) ?? 0, weight));
  }
  return vector;
}

function magnitude(vector: TagVector): number {
  let sum = 0;
  for (const value of vector.values()) sum += value * value;
  return Math.sqrt(sum);
}

/// Cosine similarity in tag space, in 0..1 because all weights are positive.
/// Cosine rather than raw overlap so a student who listed twenty skills is not
/// automatically a better match for everything than one who listed three.
export function cosineSimilarity(a: TagVector, b: TagVector): number {
  if (a.size === 0 || b.size === 0) return 0;

  let dot = 0;
  // Iterate the smaller vector; the result is symmetric either way.
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [slug, value] of smaller) {
    const other = larger.get(slug);
    if (other !== undefined) dot += value * other;
  }
  if (dot === 0) return 0;

  return clamp01(dot / (magnitude(a) * magnitude(b)));
}

/// Tags present in both vectors, ordered by how much they contributed to the
/// similarity. This is what turns a score into an explanation.
export function overlappingTags(a: TagVector, b: TagVector): WeightedTag[] {
  const shared: WeightedTag[] = [];
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [slug, value] of smaller) {
    const other = larger.get(slug);
    if (other !== undefined) shared.push({ slug, weight: value * other });
  }
  return shared.sort((x, y) => y.weight - x.weight || x.slug.localeCompare(y.slug));
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
