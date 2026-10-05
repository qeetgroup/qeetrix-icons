import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Time & calendar (`icons/<style>-<variant>/time/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    calendar: {},
    "calendar-1": {},
    "calendar-check": {},
    "calendar-days": {},
    "calendar-fold": {},
    "calendar-minus-2": {},
    "calendar-plus-2": {},
    "calendar-range": {},
    "calendar-x": {},
    clock: {},
    "clock-1": {},
    "clock-10": {},
    "clock-11": {},
    "clock-12": {},
    "clock-2": {},
    "clock-3": {},
    "clock-4": {},
    "clock-5": {},
    "clock-6": {},
    "clock-7": {},
    "clock-8": {},
    "clock-9": {},
    hourglass: {},
    timer: {},
    // Elements 1 and 2, the straps, are solid bands like the face; inferred as attached lines
    // (handles), they stayed hollow outlines beside a solid face.
    watch: { roles: { 1: "fill", 2: "fill" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
