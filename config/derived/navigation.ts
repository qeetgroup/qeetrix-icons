import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Navigation & Places (`icons/<style>-<variant>/navigation/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    binoculars: {
      roles: {
        // The bridge joins the barrels; inference gaps it like a line crossing a body.
        0: "stroke",
        // The eyepieces are solid tubes; as handles they would leave a speck of a hole.
        1: "fill",
        5: "fill",
        // The lens rim is a seam across each barrel, not a bar in front of them.
        3: "cut",
      },
    },
    compass: {},
    footprints: {},
    "map-pin": {},
    "map-pin-check-inside": {},
    "map-pin-minus-inside": {},
    "map-pin-plus-inside": {},
    "map-pin-x-inside": {},
    navigation: {},
    "navigation-2": {},
    // The needle hangs from the head rather than crossing it.
    pin: { roles: { 0: "stroke" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    earth: [0, 1, 2], // Continents' coastlines.
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
