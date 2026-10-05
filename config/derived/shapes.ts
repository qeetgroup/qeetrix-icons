import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Shapes (`icons/<style>-<variant>/shapes/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    astroid: {},
    box: {},
    circle: {},
    "circle-slash-2": {},
    "circle-small": {},
    // The stem hangs from the leaves rather than crossing them.
    club: { roles: { 1: "stroke" } },
    // The base disc sits in front of the cone, like the top disc of `cylinder` and `database`.
    cone: { roles: { 1: "front" } },
    cross: {},
    cuboid: {},
    // The top disc sits in front of the drum, as in `database`.
    cylinder: { roles: { 0: "front" } },
    diamond: {},
    ellipse: {},
    hexagon: {},
    octagon: {},
    pentagon: {},
    pyramid: {},
    "rectangle-horizontal": {},
    "rectangle-vertical": {},
    shapes: {},
    // The stem hangs from the blade rather than crossing it.
    spade: { roles: { 0: "stroke" } },
    sparkle: {},
    square: {},
    squircle: {},
    // The ring's hole is knocked out whole; cut as a ring it leaves a speck in the middle.
    torus: { roles: { 0: "hole" } },
    triangle: {},
    "triangle-right": {},
    ungroup: {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
