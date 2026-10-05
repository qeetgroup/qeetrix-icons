import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Transportation (`icons/<style>-<variant>/transportation/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // The rider stays a line; inference filled the body polygon into a wedge.
    bike: { roles: { 3: "stroke" } },
    briefcase: {},
    "briefcase-business": {},
    // Wheels sit in front of the body; the axle between them stays a line.
    car: { roles: { 1: "front", 2: "stroke", 3: "front" } },
    // The cabin and mirrors stay lines (filling them closed the mirrors into a shelf); the wheels stay
    // attached below the body instead of being gapped into it.
    "car-front": { roles: { 0: "stroke", 4: "stroke", 5: "stroke" } },
    // As car-front: cabin and mirrors stay lines, wheels stay attached.
    "car-taxi-front": { roles: { 1: "stroke", 5: "stroke", 6: "stroke" } },
    "circle-parking": {},
    // The hose stays a line (filling it closed a blob against the pump); the base stays joined to the pump.
    "ev-charger": { roles: { 0: "stroke", 2: "stroke" } },
    // The hose stays a line (filling it closed a blob against the pump); the base stays joined to the pump.
    fuel: { roles: { 0: "stroke", 2: "stroke" } },
    gauge: {},
    "octagon-minus": {},
    // The post stays attached under the head instead of being gapped into it.
    "parking-meter": { roles: { 2: "stroke" } },
    plane: {},
    "plane-landing": {},
    "plane-takeoff": {},
    road: {},
    // Filled drawings are overrides: the mast keeps its gap through the sail but stands on the hull
    // (the gap role alone notched the hull around the mast's foot).
    sailboat: {},
    // The waves stay a line with a gap under the hull instead of merging into it. The filled drawings
    // are overrides of this derivation with the speck of hull left under the waves removed.
    ship: { roles: { 4: "gap" } },
    "square-m": {},
    "square-parking": {},
    "ticket-check": {},
    "ticket-minus": {},
    "ticket-percent": {},
    "ticket-plus": {},
    "ticket-slash": {},
    "ticket-x": {},
    // The cone stands in front of its base plate, with a gap around its foot.
    "traffic-cone": { roles: { 2: "front" } },
    // The wheel sits in front of the body; the hitch stays a line (filling it closed a wedge to its tip).
    trailer: { roles: { 3: "stroke", 5: "front" } },
    // The legs stay attached under the body instead of being gapped into it.
    "tram-front": { roles: { 3: "stroke", 4: "stroke" } },
    // Wheels sit in front of the body; the axle between them stays a line. The filled drawings are
    // overrides with the cab closed against the box (its open path left a wedge between them).
    truck: { roles: { 1: "stroke", 3: "front", 4: "front" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    bike: [2], // The rider's head.
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
