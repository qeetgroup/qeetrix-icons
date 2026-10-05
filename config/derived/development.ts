import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Coding & development (`icons/<style>-<variant>/development/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // blocks is outline-only: its dividers are part of the frame's path, and cut in, they leave the
    // top and right blocks joined by a pinched bridge at the inner corner.
    "circle-dot": {},
    "circle-slash": {},
    container: {},
    "flag-triangle-left": {},
    "flag-triangle-right": {},
    form: {},
    // The branch stays a line between the solid nodes; inference fills the arc into a wedge.
    "git-branch": { roles: { 0: "stroke" } },
    // The branch stays a line between the solid nodes; inference fills the arc into a wedge.
    "git-branch-minus": { roles: { 0: "stroke" } },
    // The two connectors stay lines; inference fills their corners into wedges.
    "git-compare": { roles: { 2: "stroke", 3: "stroke" } },
    // The fork and its stem stay lines between the solid nodes; inference fills the fork.
    "git-fork": { roles: { 3: "stroke", 4: "stroke" } },
    "hard-drive": {},
    // The arrow above the drive stays a line arrow; inference fills its head into a wedge.
    "hard-drive-download": { roles: { 0: "stroke", 1: "stroke" } },
    // The arrow above the drive stays a line arrow; inference fills its head into a wedge.
    "hard-drive-upload": { roles: { 0: "stroke", 1: "stroke" } },
    "message-circle-code": {},
    "message-square-code": {},
    "message-square-diff": {},
    // The links stay lines between the solid nodes; inference fills the bus into a slab.
    network: { roles: { 3: "stroke", 4: "stroke" } },
    puzzle: {},
    // The antenna and the signal arcs stay lines; inference fills the arcs into fans.
    router: { roles: { 3: "stroke", 4: "stroke", 5: "stroke" } },
    server: {},
    "square-dot": {},
    "square-function": {},
    "square-pi": {},
    "square-radical": {},
    "square-slash": {},
    "square-terminal": {},
    workflow: {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    puzzle: [0], // An organic outline: squared, the knob necks turn into slits and teardrops.
    "square-function": [1], // The italic f is a letterform; squared, its hooks turn into steps.
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
