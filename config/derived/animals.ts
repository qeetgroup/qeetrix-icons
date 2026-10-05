import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Animals (`icons/<style>-<variant>/animals/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    bird: {},
    bone: {},
    cat: {},
    // Override (round and sharp filled): the head is two open bodies, the ears with the brow and
    // the lower face, whose closing chords left a white bar across the forehead. The override fills
    // the face whole and cuts the ear flaps' inner edges, running out where each flap meets the
    // cheek.
    dog: {},
    panda: {},
    "paw-print": {},
    squirrel: {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    // The bone's knobs meet in small round notches, an organic outline; squared, they leave square
    // inner corners.
    bone: [0],
    // The snout and the neck's curve, organic like the rest of the rabbit; squared, the head turns
    // into a box.
    rabbit: [2],
    // The snout's round tip, organic as rabbit's and squirrel's; squared, it facets into a
    // chamfered point.
    rat: [3],
    // The snout and the paw's curve, as rabbit's; squared, the head turns into a box.
    squirrel: [1],
    // The worm's body is one organic curve; squared, its inner turns kink into corners.
    worm: [2],
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
