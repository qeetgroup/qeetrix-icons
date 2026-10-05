import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Layout (`icons/<style>-<variant>/layout/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    "align-end-horizontal": {},
    "align-end-vertical": {},
    // The guide lines (2, 3) lie on the bodies' edges, so they merge with them like Material's
    // filled align icons; a gap would shave 3 units off each body. Same for all six.
    "align-horizontal-distribute-end": { roles: { 2: "stroke", 3: "stroke" } },
    "align-horizontal-distribute-start": { roles: { 2: "stroke", 3: "stroke" } },
    "align-horizontal-justify-center": {},
    "align-horizontal-justify-end": {},
    "align-horizontal-justify-start": {},
    "align-horizontal-space-between": { roles: { 2: "stroke", 3: "stroke" } },
    "align-start-horizontal": {},
    "align-start-vertical": {},
    "align-vertical-distribute-end": { roles: { 2: "stroke", 3: "stroke" } },
    "align-vertical-distribute-start": { roles: { 2: "stroke", 3: "stroke" } },
    "align-vertical-justify-center": {},
    "align-vertical-justify-end": {},
    "align-vertical-justify-start": {},
    "align-vertical-space-between": { roles: { 2: "stroke", 3: "stroke" } },
    "app-window": {},
    "app-window-mac": {},
    // Element 1, the chevron beside the bodies, stays a chevron line; inference would close it
    // into a solid triangle with a new edge along its open side (and a wider mitered base in sharp).
    "between-horizontal-end": { roles: { 1: "stroke" } },
    // Element 1, the chevron beside the bodies, stays a chevron line; inference would close it
    // into a solid triangle with a new edge along its open side (and a wider mitered base in sharp).
    "between-horizontal-start": { roles: { 1: "stroke" } },
    // Element 1, the chevron beside the bodies, stays a chevron line; inference would close it
    // into a solid triangle with a new edge along its open side (and a wider mitered base in sharp).
    "between-vertical-end": { roles: { 1: "stroke" } },
    // Element 1, the chevron beside the bodies, stays a chevron line; inference would close it
    // into a solid triangle with a new edge along its open side (and a wider mitered base in sharp).
    "between-vertical-start": { roles: { 1: "stroke" } },
    "circle-ellipsis": {},
    "columns-2": {},
    "columns-3": {},
    dock: {},
    // Elements 0-3, the corner brackets, stay lines around the solid screen; inference would close
    // each open corner into a solid triangular wedge.
    fullscreen: { roles: { 0: "stroke", 1: "stroke", 2: "stroke", 3: "stroke" } },
    funnel: {},
    // funnel-plus and funnel-x are outline-only: their funnel is clipped open to make room for the
    // badge, and filling it leaves a sliced-off shoulder (and, for the plus, a bite around its arm).
    "gallery-horizontal": {},
    "gallery-horizontal-end": {},
    "gallery-thumbnails": {},
    "gallery-vertical": {},
    "gallery-vertical-end": {},
    "layout-panel-top": {},
    "layout-template": {},
    "panel-bottom": {},
    "panel-bottom-close": {},
    "panel-bottom-dashed": {},
    "panel-bottom-open": {},
    "panel-left": {},
    "panel-left-close": {},
    "panel-left-dashed": {},
    "panel-left-open": {},
    "panel-left-right-dashed": {},
    "panel-right": {},
    "panel-right-close": {},
    "panel-right-dashed": {},
    "panel-right-open": {},
    "panel-top": {},
    "panel-top-bottom-dashed": {},
    "panel-top-close": {},
    "panel-top-dashed": {},
    "panel-top-open": {},
    "panels-left-bottom": {},
    "panels-right-bottom": {},
    "panels-top-left": {},
    "rows-2": {},
    "rows-3": {},
    "square-menu": {},
    "square-square": {},
    "stretch-horizontal": {},
    "stretch-vertical": {},
    "toggle-left": {},
    "toggle-right": {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
