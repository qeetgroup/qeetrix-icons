import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Travel (`icons/<style>-<variant>/travel/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // The base plate is solid in front of the dome, with a gap between them.
    "concierge-bell": { roles: { 0: "front" } },
    // Wheels sit in front of the body; the axle between them stays a line (inference cut it). The
    // filled drawings are overrides of this derivation with the body between the wheels ending flat
    // at their tops (y 17): the wheels sit so close that their gaps met in a spike there.
    luggage: { roles: { 2: "stroke", 3: "front", 4: "front" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
  // Outline elements whose corners keep their point at the padding, by element index. Cut flat,
  // a tap's spout, a tent's corners, and a pine's tip read as clipped; they move in instead.
  keepPoint: {
    bath: [4],
    "tent-tree": [1, 4],
  },
};
