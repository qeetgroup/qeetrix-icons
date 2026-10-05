import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Home (`icons/<style>-<variant>/home/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // Elements 2 and 3, the legs, stay attached to the seat; inference would gap them, cutting a
    // notch into the seat above each leg. The back (element 0) stays a frame, as inferred.
    armchair: { roles: { 2: "stroke", 3: "stroke" } },
    // Both filled drawings are overrides: filling the open frame closes it at the legs' feet, so
    // the space under the bed came out solid below the frame line. The overrides fill the
    // mattress down to the frame line only, keep the headboard and its divider as lines (like
    // armchair's back), and leave the legs attached.
    "bed-double": {},
    // Overrides, as for bed-double.
    "bed-single": {},
    "door-closed": {},
    fan: {},
    "house-heart": {},
    "house-wifi": {},
    lamp: {},
    // Element 0, the cord, stays attached to the shade; inference would gap it, cutting a slot
    // into the shade around its end.
    "lamp-ceiling": { roles: { 0: "stroke" } },
    // Element 0, the pole, stays attached to the shade; inference would gap it, cutting a slot
    // into the shade around its end.
    "lamp-floor": { roles: { 0: "stroke" } },
    // Element 2, the arm, stays a line; inference would fill its bend into a solid wedge.
    "lamp-wall-down": { roles: { 2: "stroke" } },
    // Element 2, the arm, stays a line; inference would fill its bend into a solid wedge.
    "lamp-wall-up": { roles: { 2: "stroke" } },
    // Both filled drawings are overrides: element 0 draws both leaves and the stem as one open
    // path, so filling it closed the stem against its chord into a wedge. The overrides fill the
    // leaves, keep the stem a line attached to the rim, and gap the rim from the pot like trash's
    // lid.
    "plant-pot": {},
    // Element 3, the bottle half hidden behind the droplet, stays a line, like users' second
    // figure; inference would close it with a slanted chord into a skewed wedge. Elements 0 and 1,
    // the pump stem and nozzle, stay attached lines; inference would gap the stem and fill the
    // nozzle's bend.
    "soap-dispenser-droplet": { roles: { 0: "stroke", 1: "stroke", 3: "stroke" } },
    "washing-machine": {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
