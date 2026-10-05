import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Social (`icons/<style>-<variant>/social/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    "badge-check": {},
    "badge-minus": {},
    "badge-percent": {},
    "badge-plus": {},
    "badge-x": {},
    "circle-percent": {},
    "diamond-percent": {},
    "hat-glasses": {},
    "message-circle": {},
    "message-circle-check": {},
    "message-circle-heart": {},
    "message-circle-more": {},
    "message-circle-plus": {},
    "message-circle-question-mark": {},
    "message-circle-reply": {},
    "message-circle-warning": {},
    "message-square": {},
    "message-square-check": {},
    "message-square-heart": {},
    "message-square-more": {},
    "message-square-plus": {},
    "message-square-quote": {},
    "message-square-reply": {},
    "message-square-text": {},
    "message-square-warning": {},
    "message-square-x": {},
    "square-percent": {},
    sticker: {},
    vote: {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    // The fist's thumb and knuckles: squared, the curled thumb reads as a digit 4.
    "hand-fist": [0],
    // The hand's thumb, round like its palm (element 3), which sharpening already keeps.
    "hand-heart": [0],
    // The quote marks' tails: squared, they read as closing brackets `]]`.
    "message-square-quote": [0, 2],
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
