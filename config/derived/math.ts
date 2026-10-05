import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Mathematics (`icons/<style>-<variant>/math/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    calculator: {},
    "circle-divide": {},
    "circle-equal": {},
    "circle-minus": {},
    "circle-plus": {},
    "circle-x": {},
    "octagon-x": {},
    "square-divide": {},
    "square-equal": {},
    "square-minus": {},
    "square-plus": {},
    "square-x": {},
    // The hanging ring stays a line joined to the body, like lock's shackle; filled, it became a
    // solid ball and the weight read as a bell.
    weight: { roles: { 0: "stroke" } },
    // The hanging ring stays a line joined to the body, as in weight.
    "weight-tilde": { roles: { 2: "stroke" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
