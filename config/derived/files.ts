import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * File icons (`icons/<style>-<variant>/files/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // The lid sits in front of the box with a gap below it, like a database's top disc; merged,
    // the lid and box read as one block and the outline's lid seam was lost.
    archive: { roles: { 0: "front" } },
    "archive-x": { roles: { 0: "front" } },
    file: {},
    "file-braces": {},
    "file-chart-column": {},
    "file-chart-column-increasing": {},
    "file-chart-line": {},
    "file-check": {},
    "file-code": {},
    "file-diff": {},
    "file-down": {},
    "file-exclamation-point": {},
    "file-minus": {},
    "file-play": {},
    "file-plus": {},
    "file-question-mark": {},
    "file-search": {},
    "file-signal": {},
    "file-sliders": {},
    "file-spreadsheet": {},
    // file-symlink is left out: its outline is open where the arrow leaves the page, so filling it
    // drew a wedge-shaped notch from that chord into the page. folder-symlink is outline-only too.
    "file-terminal": {},
    "file-text": {},
    "file-type": {},
    "file-up": {},
    "file-x": {},
    folder: {},
    "folder-bookmark": {},
    "folder-check": {},
    "folder-closed": {},
    "folder-code": {},
    "folder-dot": {},
    "folder-down": {},
    "folder-git": {},
    "folder-minus": {},
    "folder-plus": {},
    "folder-root": {},
    "folder-search-2": {},
    "folder-up": {},
    "folder-x": {},
    package: {},
    "package-2": {},
    trash: {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
