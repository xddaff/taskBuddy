export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `\b` misses terms ending in punctuation (`c++`, `c#`, `n+1`), so boundaries are spelled out. */
export function mentionsWholeWord(text: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9_])${escapeRegExp(term)}([^a-z0-9_]|$)`, "i").test(text);
}
