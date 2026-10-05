/**
 * Relevance scoring shared by the icon grid, the logo grid, and the command palette. Pure and
 * browser-free. Text is compared in a normalized form (lower case, runs of spaces and underscores
 * as one hyphen), so "arrow right" finds `arrow-right` and "api gateway" finds "Amazon API
 * Gateway".
 */

export function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

/** Fields of one record, strongest first: names, then earlier names, then keywords. */
export type SearchFields = {
  readonly primary: readonly string[];
  readonly secondary?: readonly string[];
  readonly keywords?: readonly string[];
};

/** Exact, prefix, word-start, then anywhere. */
function matchScore(value: string, query: string): number {
  const text = normalize(value);
  if (text === query) return 100;
  if (text.startsWith(query)) return 80;
  if (text.includes(`-${query}`)) return 60;
  return text.includes(query) ? 40 : 0;
}

/**
 * How well a record matches an already-normalized query: 0 for no match. Primary fields count in
 * full, secondary ones (aliases) slightly less, keywords (tags, categories) clearly less, so a
 * name match always outranks a tag match of the same kind.
 */
export function scoreFields(fields: SearchFields, query: string): number {
  if (!query) return 1;
  let best = 0;
  for (const value of fields.primary) best = Math.max(best, matchScore(value, query));
  for (const value of fields.secondary ?? []) best = Math.max(best, matchScore(value, query) * 0.9);
  for (const value of fields.keywords ?? []) best = Math.max(best, matchScore(value, query) * 0.55);
  return best;
}

/**
 * The records matching `query`, best first. Ties keep their original order, so an empty or
 * uniformly matching query returns the catalogue order unchanged.
 */
export function rankBy<T>(
  items: readonly T[],
  query: string,
  fields: (item: T) => SearchFields,
  limit = Number.POSITIVE_INFINITY,
): T[] {
  const normalized = normalize(query);
  if (!normalized) return items.slice(0, limit);
  const scored: { item: T; score: number; order: number }[] = [];
  items.forEach((item, order) => {
    const score = scoreFields(fields(item), normalized);
    if (score > 0) scored.push({ item, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, limit).map(({ item }) => item);
}
