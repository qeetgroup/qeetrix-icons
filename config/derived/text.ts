import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Text formatting (`icons/<style>-<variant>/text/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    "book-open": {},
    "book-open-text": {},
    brush: {},
    // The clip sits in front of the board.
    clipboard: { roles: { 0: "front" } },
    // The clip sits in front of the board.
    "clipboard-check": { roles: { 0: "front" } },
    // The clip sits in front of the board.
    "clipboard-list": { roles: { 0: "front" } },
    // The clip sits in front of the board.
    "clipboard-minus": { roles: { 0: "front" } },
    // The clip sits in front of the board.
    "clipboard-plus": { roles: { 0: "front" } },
    // The clip sits in front of the board.
    "clipboard-type": { roles: { 0: "front" } },
    // The clip sits in front of the board.
    "clipboard-x": { roles: { 0: "front" } },
    // The front sheet sits on an outlined back sheet.
    copy: { roles: { 0: "front", 1: "stroke" } },
    // The front sheet sits on an outlined back sheet.
    "copy-check": { roles: { 1: "front", 2: "stroke" } },
    // The front sheet sits on an outlined back sheet.
    "copy-minus": { roles: { 1: "front", 2: "stroke" } },
    // The front sheet sits on an outlined back sheet.
    "copy-plus": { roles: { 2: "front", 3: "stroke" } },
    // The front sheet sits on an outlined back sheet.
    "copy-slash": { roles: { 1: "front", 2: "stroke" } },
    copyleft: {},
    copyright: {},
    "creative-commons": {},
    delete: {},
    eraser: {},
    "grid-2x2": {},
    "grid-3x2": {},
    keyboard: {},
    "library-big": {},
    mail: {},
    map: {},
    notebook: {},
    "notebook-text": {},
    "notepad-text": {},
    // The bent handle is a line from the roller to the grip, not a body enclosing the area beside it.
    "paint-roller": { roles: { 1: "stroke" } },
    // The ferrule and handle are solid like the bristles; left an outline, the drawing was half filled.
    "paintbrush-vertical": { roles: { 3: "fill" } },
    palette: {},
    pen: {},
    "pen-line": {},
    // The grip sits in front of the nib, with a gap, instead of merging into one blob.
    "pen-tool": { roles: { 0: "front" } },
    "pencil-line": {},
    phone: {},
    quote: {},
    "rectangle-ellipsis": {},
    save: {},
    // The handle stays attached to the lens.
    search: { roles: { 0: "stroke" } },
    // The handle stays attached to the lens.
    "search-alert": { roles: { 1: "stroke" } },
    // The handle stays attached to the lens.
    "search-check": { roles: { 2: "stroke" } },
    // The handle stays attached to the lens.
    "search-code": { roles: { 1: "stroke" } },
    // The handle stays attached to the lens.
    "search-slash": { roles: { 2: "stroke" } },
    // The handle stays attached to the lens.
    "search-x": { roles: { 3: "stroke" } },
    "square-asterisk": {},
    "square-code": {},
    "square-library": {},
    "square-pilcrow": {},
    // The finger rings are knocked out whole; cut as rings, their tiny centres were specks.
    "square-scissors": { roles: { 3: "hole", 4: "hole" } },
    "square-sigma": {},
    "square-text": {},
    "sticky-note": {},
    table: {},
    "table-2": {},
    "table-cells-merge": {},
    "table-cells-split": {},
    "table-properties": {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    // The palette is an organic outline (its thumb hole would zigzag) and its paint dabs are
    // figurative, not UI dots: square wells read as a different object.
    palette: [0, 1, 2, 3, 4],
    // A handwritten signature is an organic stroke: its loops would square into steps and a spike.
    signature: [0],
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
