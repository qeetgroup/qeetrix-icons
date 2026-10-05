import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Medical (`icons/<style>-<variant>/medical/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // Wheels sit in front of the body; the axle between them stays a line. Both filled drawings are
    // overrides: filled to its chord, the open cab path leaves a wedge between cab and box.
    ambulance: { roles: { 4: "stroke", 5: "front", 6: "front" } },
    bandage: {},
    "briefcase-medical": {},
    heart: {},
    // The arrowhead and its shaft stay attached lines; inferred, the arrowhead fills as a triangle
    // and the shaft becomes a gap line that splits it.
    mars: { roles: { 0: "stroke", 1: "stroke" } },
    // Both filled drawings are overrides: the lip line runs through both corners without the
    // outline's closing hook, which otherwise bites a notch out of the upper lip.
    mouth: {},
    pill: {},
    "pill-bottle": {},
    // The four scan corners stay lines; inferred, each fills to its chord as a solid wedge.
    "scan-heart": { roles: { 0: "stroke", 1: "stroke", 2: "stroke", 3: "stroke" } },
    siren: {},
    "square-activity": {},
    // The cap is a solid part like the tube, not an attached handle with an empty middle. The sharp
    // filled drawing is an override: cut from the trimmed sharp wave, the run-on leaves slivers.
    "tube-lotion": { roles: { 0: "fill" } },
    // The stem stays attached to the disc; inferred, it becomes a gap line notching the disc.
    venus: { roles: { 0: "stroke" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    // The spots: figurative dots, round in sharp (UI dots stay square).
    virus: [0, 18],
    // The spots: figurative dots, round in sharp (UI dots stay square).
    "virus-off": [0, 1, 19],
    // The spots: figurative dots, round in sharp (UI dots stay square).
    germ: [1, 8],
    // The spots: figurative dots, round in sharp (UI dots stay square).
    "germ-off": [1, 11],
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
