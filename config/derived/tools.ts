import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Tools (`icons/<style>-<variant>/tools/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // The handle is a solid bar like pickaxe's, filled to the head; inferred as an attached curve,
    // it stayed a hollow loop beside a solid head.
    axe: { roles: { 0: "fill" } },
    bolt: {},
    // The handle is a solid bar, as axe's and pickaxe's. The striking face (element 1) closes the
    // head and stays attached to it; inferred as a crossing line, it was cut free into a loose bar.
    hammer: { roles: { 0: "fill", 1: "stroke" } },
    // Override (round and sharp filled): the dome is two arcs meeting the ridge, so no role fills
    // it (inferred, the dome stayed hollow; filled, the arcs' chords leave a hole). The override
    // fills the dome whole, with the ridge a solid front part in a gap, like a clipboard's clip.
    "hard-hat": {},
    "inspection-panel": {},
    // The blades are solid like the head and handle, filled to their chords on the head; inferred
    // as attached curves, they stayed hollow crescents.
    pickaxe: { roles: { 1: "fill", 2: "fill" } },
    ruler: {},
    "ruler-dimension-line": {},
    toolbox: {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    // The rag spilling from the case is an organic outline of round lobes; squared, it turns into
    // a jagged polygon.
    "tool-case": [1],
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
