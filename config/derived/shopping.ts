import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Shopping (`icons/<style>-<variant>/shopping/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    "badge-cent": {},
    "badge-dollar-sign": {},
    "badge-euro": {},
    "badge-indian-rupee": {},
    "badge-japanese-yen": {},
    "badge-pound-sterling": {},
    "badge-russian-ruble": {},
    "badge-turkish-lira": {},
    "circle-euro": {},
    handbag: {},
    shirt: {},
    "shopping-bag": {},
    // The frame (handle, side, and bottom bar) stays a line around the solid basket; filled, its
    // chord closed a wedge from the handle to the bar. The wheels stay solid and attached to the bar
    // (as front bodies, their clearances left a sliver of bar between them).
    "shopping-cart": { roles: { 0: "stroke" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
