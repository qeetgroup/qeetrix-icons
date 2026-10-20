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
  // Outline elements whose corners keep their point at the padding, by element index. Cut flat,
  // a speech bubble's tail, a heart's tip, a star's tips, a diamond's corners, a ribbon's ends,
  // and an arrowhead read as clipped; they move in instead. (message-square-heart's sharp outline
  // is an override for its heart's tip; its bubble follows message-square.)
  keepPoint: {
    // The bubble's tail.
    "message-circle": [0],
    "message-circle-check": [0],
    "message-circle-dashed": [7],
    "message-circle-dashed-check": [7],
    "message-circle-heart": [0],
    "message-circle-more": [0],
    "message-circle-off": [1],
    "message-circle-plus": [0],
    "message-circle-question-mark": [0],
    "message-circle-reply": [0],
    "message-circle-warning": [0],
    "message-square": [0],
    "message-square-check": [0],
    "message-square-dashed": [3],
    "message-square-dot": [0],
    "message-square-lock": [0],
    "message-square-more": [0],
    "message-square-off": [0],
    "message-square-plus": [0],
    "message-square-quote": [1],
    "message-square-reply": [0],
    "message-square-share": [0],
    "message-square-text": [0],
    "message-square-warning": [0],
    "message-square-x": [0],
    "messages-circle": [0, 1],
    "messages-square": [1],
    // The diamond, the hat's crown, the heart, the ribbon's ends, the star, and the arrowhead.
    "diamond-percent": [0],
    "hat-glasses": [1],
    "heart-off": [1],
    ribbon: [4],
    "star-half": [0],
    "zodiac-scorpio": [1],
  },
};
