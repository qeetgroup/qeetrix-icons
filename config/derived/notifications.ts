import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Notification (`icons/<style>-<variant>/notifications/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    "bell-off": {},
    // The ringing arcs (elements 1 and 3) stay lines; inferred as bodies, they filled to their
    // chords and bulged inward.
    "bell-ring": { roles: { 1: "stroke", 3: "stroke" } },
    "circle-alert": {},
    "circle-check": {},
    "octagon-alert": {},
    "square-check": {},
    "square-exclamation-point": {},
    "triangle-alert": {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
  // Outline elements whose corners keep their point at the padding, by element index. Cut flat,
  // a bell's flare and a warning triangle's corners read as clipped; they move in instead.
  keepPoint: {
    // The bell's flare, like account's bell.
    "bell-minus": [2],
    "bell-off": [1],
    "bell-plus": [3],
    "bell-ring": [2],
    // The triangle, like shapes' triangle.
    "triangle-alert": [0],
  },
};
