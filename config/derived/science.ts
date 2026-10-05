import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Science (`icons/<style>-<variant>/science/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    beaker: {},
    "flask-conical": {},
    "flask-round": {},
    "lens-concave": {},
    "lens-convex": {},
    "mirror-rectangular": {},
    // Element 1, the stand's stem, stays attached to the mirror; inference would gap it, cutting a
    // notch into the mirror around its top end.
    "mirror-round": { roles: { 1: "stroke" } },
    radiation: {},
    "test-tube": {},
    "test-tube-diagonal": {},
    "test-tubes": {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    atom: [0], // The nucleus, a ball inside round orbits.
    // The lower lobes and the little bridge between them are one organic curve: squared, the
    // bridge turns into a peak whose miter spikes up into the brain.
    "brain-cog": [9],
    // The round core (4), and the stars (1, 2): figurative dots, round in sharp.
    galaxy: [1, 2, 4],
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
