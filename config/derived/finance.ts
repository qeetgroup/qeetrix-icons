import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Finance (`icons/<style>-<variant>/finance/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    banknote: {},
    "circle-dollar-sign": {},
    "circle-pound-sterling": {},
    landmark: {},
    // The tail (element 2) is a curl attached to the body, not a body filling the corner it bends round.
    "piggy-bank": { roles: { 2: "stroke" } },
    receipt: {},
    "receipt-cent": {},
    "receipt-euro": {},
    "receipt-indian-rupee": {},
    "receipt-japanese-yen": {},
    "receipt-pound-sterling": {},
    "receipt-russian-ruble": {},
    "receipt-text": {},
    "receipt-turkish-lira": {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    // The palm's turn into the thumb, round like the fingers' curves (element 1), which sharpening
    // already keeps; squared, it leaves a jog. Same hand as social's `hand-heart`, kept round there too.
    "hand-coins": [0],
    // The pig's tail is an organic curl like the body's curves; squared, it turns into a pipe elbow.
    "piggy-bank": [2],
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
