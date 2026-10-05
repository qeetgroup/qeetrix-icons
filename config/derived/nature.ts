import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Nature (`icons/<style>-<variant>/nature/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // The stem hangs from the leaf's base and stays attached; inference gapped it into the leaf.
    cannabis: { roles: { 0: "stroke" } },
    "flame-kindling": {},
    // The four short stubs where the petals meet are hidden under the petal strokes in the outline;
    // cut, they turned the centre into an eight-spoked gear. Only the ring and diagonals are cut.
    flower: { roles: { 2: "skip", 3: "skip", 4: "skip", 5: "skip" } },
    // The centre is knocked out (a cut left a stray diamond dot in the sharp drawing), and the stem
    // stays attached between head and leaves instead of gapping through both.
    "flower-2": { roles: { 1: "hole", 2: "stroke" } },
    // The stem stays a line attached to the leaf; inference filled its chord into a wedge.
    leaf: { roles: { 1: "stroke" } },
    mountain: {},
    "mountain-snow": {},
    shovel: {},
    // A solid bush on its trunk, like tree-deciduous: the trunk stays a line (inference filled its
    // chord into a foot), and the right branch is left out, since the left one is hidden in the fill.
    shrub: { roles: { 0: "stroke", 1: "skip" } },
    stone: {},
    "tree-deciduous": {},
    "tree-pine": {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
