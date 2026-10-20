import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Photography (`icons/<style>-<variant>/photography/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    camera: {},
    film: {},
    flashlight: {},
    image: {},
    lightbulb: {},
    // Elements 0-3, the scan corners, stay lines around the solid eye (as in scan-heart and
    // fullscreen); inferred, each open corner fills to its chord as a solid wedge.
    "scan-eye": { roles: { 0: "stroke", 1: "stroke", 2: "stroke", 3: "stroke" } },
    // Elements 0-3, the scan corners, stay lines around the solid square, as in scan-eye.
    "scan-square": { roles: { 0: "stroke", 1: "stroke", 2: "stroke", 3: "stroke" } },
    "square-bookmark": {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    images: [2], // The picture's sun, round in `image` too.
    "scan-eye": [4], // The eye's pupil.
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
  // Outline elements whose corners keep their point at the padding, by element index. Cut flat,
  // an arrowhead's tip and a play triangle read as clipped; they move in instead. (square-sparkles
  // stays unlisted, like sparkle: its tips are too acute to come to a point.)
  keepPoint: {
    "image-down": [2],
    "image-play": [0],
  },
};
