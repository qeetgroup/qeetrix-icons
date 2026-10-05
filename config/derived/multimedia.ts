import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Multimedia (`icons/<style>-<variant>/multimedia/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    ad: {},
    captions: {},
    "circle-pause": {},
    "circle-play": {},
    "circle-stop": {},
    // Both filled drawings are overrides of the derived ones: the left stripe runs through the
    // clapper's bottom edge to the board's top edge, where it meets the gap under the clapper
    // (derived, it ended in a round cap with cusps, or a square end that notched the board).
    clapperboard: {},
    "diamond-minus": {},
    "diamond-plus": {},
    "fast-forward": {},
    // The neck stays attached to the headstock; gapped, its clearance bit into the headstock and
    // cut the neck off it.
    guitar: { roles: { 0: "stroke" } },
    "keyboard-music": {},
    // The round filled drawing is an override of the derived one: the bar runs through the bottom
    // edge between the handle's arms, flush as in sharp filled (derived, it stopped in a round cap
    // tangent to the edge, leaving cusps).
    megaphone: {},
    "midi-port": {},
    // Stems and beam stay lines, as drawn; filled, the open path's chord made a solid block.
    music: { roles: { 0: "stroke" } },
    // Stem and flag stay lines, as drawn; filled, the open path's chord made a solid wedge.
    "music-2": { roles: { 1: "stroke" } },
    // The stem is attached to the note head; inference gapped it, notching the head.
    "music-3": { roles: { 1: "stroke" } },
    // Stems and both beams stay lines, as in music; filled, the chord made a solid block.
    "music-4": { roles: { 0: "stroke", 1: "stroke" } },
    // Both filled drawings are overrides: the page is solid, and the rolled flap behind it stays an
    // outline (as copy's back sheet does); derived, the flap merged into the page and was lost.
    newspaper: {},
    "octagon-pause": {},
    pause: {},
    piano: {},
    // The stand hangs from the screen (as monitor's does); filled, its chord made a solid triangle.
    presentation: { roles: { 2: "stroke" } },
    // The lens sits in front of the body with a gap around it; merged, it read as a bare bump.
    projector: { roles: { 3: "front" } },
    "skip-back": {},
    "skip-forward": {},
    speaker: {},
    "square-pause": {},
    "square-stop": {},
    "step-back": {},
    "step-forward": {},
    turntable: {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    ad: [2], // The D's bowl (as in hd): squared, "AD" reads as "A0".
    "audio-waveform": [0], // A continuous wave: squared, its end hooks turn into steps.
    // The masks' eyes: figurative dots, round in sharp (UI dots stay square).
    drama: [0, 1, 2, 3],
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
