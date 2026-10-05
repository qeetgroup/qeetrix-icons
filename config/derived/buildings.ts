import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Buildings (`icons/<style>-<variant>/buildings/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // Element 4, the nave, is solid in front of the side wings with a gap, like copy's front sheet;
    // inferred, it is an attached outline, so the roof stays hollow and the cross is half cut, half
    // gapped.
    church: { roles: { 4: "front" } },
    factory: {},
    "graduation-cap": {},
    hotel: {},
    house: {},
    // The drawings are overrides (config/overrides/*-filled/buildings/house-plug.svg): the house
    // outline doubles as the plug's cord, so derived, the body closes from the cord's end to the
    // bottom edge's and a wedge is notched out of the bottom. The overrides fill the whole house
    // and cut the cord as a straight line out through the bottom edge, like house's door.
    "house-plug": {},
    // Element 1, the awning, is solid in front of the shop with a scalloped gap below it; inferred,
    // the two fuse and the scallops disappear.
    store: { roles: { 1: "front" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
