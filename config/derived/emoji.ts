import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Emoji (`icons/<style>-<variant>/emoji/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // The string (element 0) stays a line; inferred as a body, it filled wedges into its bends.
    balloon: { roles: { 0: "stroke" } },
    "face-angry": {},
    "face-expressionless": {},
    "face-grinning": {},
    "face-neutral": {},
    "face-slightly-frowning": {},
    "face-slightly-smiling": {},
    "heart-crack": {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    // The string's S-curve and the highlight's arc are organic curves; squared, the string turns
    // into a staircase and the highlight into a corner bracket.
    balloon: [0, 1],
    // The arm's figurative curves (the fist's curl, the elbow); squared, they facet into kinks.
    "biceps-flexed": [0],
    // The palm's turn into the thumb: the same hand as finance's `hand-coins` and social's
    // `hand-heart`, kept round there too.
    "hand-helping": [0],
    // The clasped hands' curves (the thumb's crotch, the knuckles), as account's `handshake`;
    // squared, the upper hand turns into a bracket.
    "heart-handshake": [0],
    "party-popper": [5, 6, 7], // Streamers' squiggles.
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
