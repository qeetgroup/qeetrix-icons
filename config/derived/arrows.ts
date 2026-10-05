import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Arrows (`icons/<style>-<variant>/arrows/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    "arrow-big-down": {},
    "arrow-big-down-dash": {},
    "arrow-big-left": {},
    "arrow-big-left-dash": {},
    "arrow-big-right": {},
    "arrow-big-right-dash": {},
    "arrow-big-up": {},
    "arrow-big-up-dash": {},
    "circle-arrow-down": {},
    "circle-arrow-left": {},
    "circle-arrow-right": {},
    "circle-arrow-up": {},
    "circle-chevron-down": {},
    "circle-chevron-left": {},
    "circle-chevron-right": {},
    "circle-chevron-up": {},
    // Elements 0 and 1, the post above and below the sign, hang from it; inference would gap them
    // into the sign and notch its edges.
    milestone: { roles: { 0: "stroke", 1: "stroke" } },
    // Element 0, the tail, is attached at the notch; inference would gap it and carve a channel
    // into the head.
    "mouse-pointer": { roles: { 0: "stroke" } },
    "mouse-pointer-2": {},
    // Elements 0 and 1, the arrow, stay lines; inference would fill the head's corner into a
    // triangle and cut the shaft out of it.
    "phone-incoming": { roles: { 0: "stroke", 1: "stroke" } },
    // Elements 0 and 1, the arrow, stay lines; inference would fill the head's corner into a
    // triangle and cut the shaft out of it.
    "phone-outgoing": { roles: { 0: "stroke", 1: "stroke" } },
    play: {},
    rewind: {},
    // Elements 0 and 1, the post above and below the sign, hang from it; inference would gap them
    // into the sign and notch its edges.
    signpost: { roles: { 0: "stroke", 1: "stroke" } },
    "square-arrow-down": {},
    "square-arrow-down-left": {},
    "square-arrow-down-right": {},
    "square-arrow-left": {},
    "square-arrow-right": {},
    "square-arrow-up": {},
    "square-arrow-up-left": {},
    "square-arrow-up-right": {},
    "square-chevron-down": {},
    "square-chevron-left": {},
    "square-chevron-right": {},
    "square-chevron-up": {},
    "square-play": {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
