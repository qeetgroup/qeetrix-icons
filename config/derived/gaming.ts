import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Gaming (`icons/<style>-<variant>/gaming/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // Element 3, the finial bar, stays joined to the mitre's tip as in the outline; inference would
    // gap it, cutting the head flat under a floating bar.
    "chess-bishop": { roles: { 3: "stroke" } },
    // Element 3, the cross's stem, stays joined to the crown; inference would gap it, sinking the
    // cross into a slot cut in the crown's top.
    "chess-king": { roles: { 3: "stroke" } },
    // Element 2, the collar, stays joined to the head; inference would gap it, cutting the head to a
    // dome. The drawings are overrides (config/overrides/*-filled/gaming/chess-pawn.svg) that also
    // fill the body between the two leg lines, solid like the other chess pieces.
    "chess-pawn": { roles: { 2: "stroke" } },
    crown: {},
    "dice-1": {},
    "dice-2": {},
    "dice-3": {},
    "dice-4": {},
    "dice-5": {},
    "dice-6": {},
    // Element 0, the front die, is solid in front of the back die with a gap, like copy's front
    // sheet; inferred, the two dice fuse into one blob.
    dices: { roles: { 0: "front" } },
    gamepad: {},
    "gamepad-2": {},
    "gamepad-directional": {},
    // The drawings are overrides (config/overrides/*-filled/gaming/gem.svg): the two lower facet
    // cuts meet at a vertex on the outline, which the run-through rule (for line ends) misses, so
    // derived, the lower facets pinch together at the tip (round) or join by a hairline (sharp).
    // The overrides run the cut out through the tip as a 2-unit slot, like the girdle at the sides.
    gem: {},
    ghost: {},
    gift: {},
    // Element 1, the button, stays joined to the base; inference would gap it into a slot.
    joystick: { roles: { 1: "stroke" } },
    "playing-card": {},
    "playing-cards": {},
    // Elements 0 and 3, the fins, are solid like the body and flame; inferred, they stay outlined
    // like a handle.
    rocket: { roles: { 0: "fill", 3: "fill" } },
    skull: {},
    // Elements 1 and 2, the studs, are solid like the brick; inferred, they stay outlined like a
    // handle.
    "toy-brick": { roles: { 1: "fill", 2: "fill" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    skull: [2, 3], // The skull's eyes.
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
