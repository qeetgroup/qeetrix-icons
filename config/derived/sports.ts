import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Sports (`icons/<style>-<variant>/sports/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    "circle-star": {},
    // The numeral 1 is an open hook: as a fill it closes into a wedge. The middle block is solid in
    // front, with a 1-unit gap to the side blocks; that gap also clears the chord that closing the
    // open side-block outline would otherwise draw across it. The round filled drawing is an
    // override of this derivation with the blocks' bottom corners at the gaps square, as in sharp
    // (derived, the middle block's closing edge rounded them and the gaps curved around them).
    podium: { roles: { 0: "stroke", 2: "front" } },
    "rugby-ball": {},
    "square-star": {},
    // The two stem lines hang off the cup to the base line; as fills they close into wedges.
    trophy: { roles: { 0: "stroke", 1: "stroke" } },
    whistle: {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
