import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Accessibility (`icons/<style>-<variant>/accessibility/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    baby: {},
    "badge-question-mark": {},
    "circle-question-mark": {},
    "closed-caption": {},
    eye: {},
    "eye-off": {},
    // The temples are open arms hanging off the lenses; filled, each closes into a solid wedge.
    glasses: { roles: { 3: "stroke", 4: "stroke" } },
    info: {},
    // The ring's hole is knocked out whole, like torus; cut as a ring it leaves a solid disc
    // in the middle and the buoy reads as a target.
    "life-buoy": { roles: { 5: "hole" } },
    moon: {},
    "moon-star": {},
    // The sound waves are open arcs; filled, each closes into a solid half disc.
    speech: { roles: { 1: "stroke", 2: "stroke" } },
    sun: {},
    "sun-dim": {},
    "sun-medium": {},
    // The sun's visible arc stays a line; filled, it closes into a solid segment.
    "sun-moon": { roles: { 2: "stroke" } },
    "zoom-in": {},
    "zoom-out": {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    accessibility: [0], // The figure's head.
    "person-standing": [0], // The figure's head.
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
