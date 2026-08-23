/**
 * Deterministic icon search and ranking.
 *
 * This module is the single implementation of the ranking algorithm. The explorer
 * inlines its source into the generated HTML (see scripts/explorer.mjs), and the
 * tests import it directly — so the ordering a developer sees in the explorer is
 * the ordering the test suite locks down. There is no second copy to drift.
 *
 * Written as plain function declarations with no imports, because the generator
 * strips the `export ` keywords and drops the rest straight into a `<script>`.
 *
 * Ranking is a fixed tier list, not a relevance heuristic. A developer typing
 * `user` wants `user` first, every time — a scoring model that reorders itself as
 * the catalogue grows would make the explorer feel broken.
 */

/**
 * The shape this module needs from an icon.
 *
 * Structurally compatible with the published `IconMetadata`, plus the two
 * authoring-only fields the explorer also filters on. Declared here rather than
 * imported so the module stays dependency-free and inlinable.
 *
 * @typedef {object} SearchableIcon
 * @property {string} name
 * @property {string} component
 * @property {string} category
 * @property {string[]} [tags]
 * @property {string[]} [aliases]
 * @property {boolean} [mirror]
 * @property {string} [priority]
 * @property {{since: string, replacement: string|null, reason: string}} [deprecated]
 */

/**
 * Match tiers, highest first. The numbers are spaced so a lower tier can never
 * outrank a higher one no matter how many terms match.
 */
export const RANK = {
  NAME_EXACT: 1000,
  NAME_PREFIX: 900,
  ALIAS_EXACT: 800,
  COMPONENT_PREFIX: 700,
  NAME_SUBSTRING: 600,
  ALIAS_SUBSTRING: 500,
  TAG_EXACT: 400,
  TAG_SUBSTRING: 300,
  CATEGORY_EXACT: 200,
  CATEGORY_SUBSTRING: 100,
};

/** Normalise a query or field for comparison. */
export function normalise(value) {
  return String(value).trim().toLowerCase();
}

/**
 * Score one icon against one already-normalised term.
 *
 * Returns 0 when the term does not match at all, which callers treat as
 * "exclude this icon" so a multi-word query behaves as AND.
 *
 * @param {SearchableIcon} icon
 * @param {string} term
 * @returns {number}
 */
export function scoreTerm(icon, term) {
  if (term === "") return 0;

  const name = normalise(icon.name);
  const component = normalise(icon.component);
  const category = normalise(icon.category);
  const aliases = (icon.aliases ?? []).map(normalise);
  const tags = (icon.tags ?? []).map(normalise);

  if (name === term) return RANK.NAME_EXACT;
  if (name.startsWith(term)) return RANK.NAME_PREFIX;
  if (aliases.includes(term)) return RANK.ALIAS_EXACT;
  if (component.startsWith(term)) return RANK.COMPONENT_PREFIX;
  if (name.includes(term)) return RANK.NAME_SUBSTRING;
  if (aliases.some((a) => a.includes(term))) return RANK.ALIAS_SUBSTRING;
  if (tags.includes(term)) return RANK.TAG_EXACT;
  if (tags.some((t) => t.includes(term))) return RANK.TAG_SUBSTRING;
  if (category === term) return RANK.CATEGORY_EXACT;
  if (category.includes(term)) return RANK.CATEGORY_SUBSTRING;
  return 0;
}

/**
 * Rank a set of icons against a query.
 *
 * Multi-word queries are AND: every term must match something, and the total is
 * the sum of each term's best tier. `shield check` therefore ranks
 * `shield-check` above `shield` (which does not match `check` at all and is
 * excluded) without needing a phrase parser.
 *
 * Ties break by name length then alphabetically, so the order is total and
 * stable — two icons can never swap places between runs.
 *
 * @param {SearchableIcon[]} icons
 * @param {string} query
 * @returns {SearchableIcon[]} matching icons, best first
 */
export function rankIcons(icons, query) {
  const terms = normalise(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return [...icons].sort((a, b) => compareNames(a.name, b.name));
  }

  const scored = [];
  for (const icon of icons) {
    let total = 0;
    let matchedEvery = true;
    for (const term of terms) {
      const score = scoreTerm(icon, term);
      if (score === 0) {
        matchedEvery = false;
        break;
      }
      total += score;
    }
    if (matchedEvery) scored.push({ icon, total });
  }

  scored.sort(
    (a, b) =>
      b.total - a.total ||
      a.icon.name.length - b.icon.name.length ||
      compareNames(a.icon.name, b.icon.name),
  );
  return scored.map((entry) => entry.icon);
}

/**
 * Codepoint name comparison.
 *
 * Not `localeCompare`: the explorer's ordering must not depend on the browser's
 * locale, or two developers comparing screens would see different lists.
 */
export function compareNames(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Apply the non-text filters, then rank.
 *
 * @param {object} options
 * @param {SearchableIcon[]} options.icons
 * @param {string} [options.query]
 * @param {string} [options.category] Empty string means "any".
 * @param {string} [options.priority] Empty string means "any".
 * @param {boolean} [options.mirrorOnly]
 * @param {boolean} [options.includeDeprecated] Defaults to true.
 * @returns {SearchableIcon[]}
 */
export function filterIcons({
  icons,
  query = "",
  category = "",
  priority = "",
  mirrorOnly = false,
  includeDeprecated = true,
}) {
  const pool = icons.filter((icon) => {
    if (category && icon.category !== category) return false;
    if (priority && icon.priority !== priority) return false;
    if (mirrorOnly && !icon.mirror) return false;
    if (!includeDeprecated && icon.deprecated) return false;
    return true;
  });
  return rankIcons(pool, query);
}
