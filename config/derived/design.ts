import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Design (`icons/<style>-<variant>/design/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // The back squares' visible corners stay lines, like copy's back sheet; filled, their chords
    // drew diagonal wedges merged with the front square.
    "bring-to-front": { roles: { 1: "stroke", 2: "stroke" } },
    component: {},
    "file-axis-3d": {},
    // The lower layers' edges stay lines below the solid top layer; filled, their chords merged
    // every layer into one notched blob.
    layers: { roles: { 1: "stroke", 2: "stroke" } },
    // The lower layer's edge stays a line below the solid top layer, as in layers.
    "layers-2": { roles: { 1: "stroke" } },
    // The lower layers' edges stay lines below the solid top layer, as in layers.
    "layers-minus": { roles: { 2: "stroke", 3: "stroke", 4: "stroke" } },
    // The lower layers' edges stay lines below the solid top layer, as in layers.
    "layers-plus": { roles: { 3: "stroke", 4: "stroke" } },
    // The arrowhead stays a line like its shaft; filled, it became a solid triangle.
    "layout-arrow-down": { roles: { 3: "stroke" } },
    // The arrowhead stays a line like its shaft; filled, it became a solid triangle.
    "layout-arrow-right": { roles: { 3: "stroke" } },
    "layout-dashboard": {},
    "layout-freeform": {},
    "layout-grid": {},
    "layout-grid-circles": {},
    "layout-list": {},
    "layout-panel-left": {},
    pencil: {},
    "pencil-sparkles": {},
    // The back square's visible corners stay lines, as in bring-to-front; filled, they became
    // detached wedges.
    "send-to-back": { roles: { 2: "stroke", 3: "stroke" } },
    "square-dimensions": {},
    "squares-unite": {},
    // The handle is a solid knob, filled down to the pad; inferred as a line, it read as a hollow loop.
    stamp: { roles: { 0: "fill" } },
    // The back swatch stays a line, like the middle one; filled, its chord merged all three swatches.
    "swatch-book": { roles: { 1: "stroke" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    view: [2], // The eye's pupil.
    // The spray: figurative dots, round in sharp (UI dots stay square).
    "spray-can": [0, 1, 2, 3, 4, 5],
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
