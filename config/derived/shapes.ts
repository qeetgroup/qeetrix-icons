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
    // The sharp filled drawing is an override: with the apex moved in (`keepPoint`), the edge
    // ends lower, and its derived cut stopped short of the apex, leaving a cap above it.
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
  // Outline elements whose corners keep their point at the padding, by element index. Cut flat,
  // these polygons and solids read as clipped; each corner moves in until its miter fits instead.
  keepPoint: {
    // A solid's outline; the edges that end in its corners are trimmed to hide in them.
    box: [0],
    boxes: [0, 4, 8],
    cone: [0],
    cuboid: [2],
    diamond: [0],
    hexagon: [0],
    pentagon: [0],
    pyramid: [0],
    // The triangle.
    shapes: [0],
    // The blade's tip.
    spade: [1],
    triangle: [0],
    "triangle-right": [0],
  },
};
