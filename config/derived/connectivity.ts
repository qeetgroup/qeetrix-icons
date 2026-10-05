import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Connectivity (`icons/<style>-<variant>/connectivity/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // The terminals stand on the case's top edge (like a monitor's stand), so they stay attached
    // rather than gapped like calendar rings, which cross the edge.
    "car-battery": { roles: { 2: "stroke", 4: "stroke" } },
    "card-sim": {},
    "cassette-tape": {},
    "circle-power": {},
    "cloud-off": {},
    // The stand hangs from the screen rather than crossing it.
    monitor: { roles: { 2: "stroke" } },
    // The stand hangs from the screen rather than crossing it.
    "monitor-check": { roles: { 2: "stroke" } },
    // The stand hangs from the screen rather than crossing it.
    "monitor-cloud": { roles: { 1: "stroke" } },
    // The stand hangs from the screen rather than crossing it.
    "monitor-down": { roles: { 3: "stroke" } },
    // The stand hangs from the screen rather than crossing it.
    "monitor-pause": { roles: { 3: "stroke" } },
    // The stand hangs from the screen rather than crossing it.
    "monitor-play": { roles: { 1: "stroke" } },
    // The stand hangs from the screen rather than crossing it.
    "monitor-stop": { roles: { 0: "stroke" } },
    // The stand hangs from the screen rather than crossing it.
    "monitor-up": { roles: { 3: "stroke" } },
    // The stand hangs from the screen rather than crossing it.
    "monitor-x": { roles: { 3: "stroke" } },
    // Sound waves stay lines (as in volume-2); filled, their chords made a solid wedge.
    "phone-call": { roles: { 0: "stroke", 1: "stroke" } },
    "phone-missed": {},
    smartphone: {},
    "smartphone-charging": {},
    "square-power": {},
    // The tape line joins the reels' bottoms, so it stays attached instead of gapped from them.
    voicemail: { roles: { 2: "stroke" } },
    volume: {},
    // The sound wave stays a line, as in volume-2.
    "volume-1": { roles: { 1: "stroke" } },
    // Sound waves stay lines.
    "volume-2": { roles: { 1: "stroke", 2: "stroke" } },
    "volume-x": {},
    // The stand hangs from the camera rather than crossing it, as in the monitor family.
    webcam: { roles: { 3: "stroke" } },
    zap: {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    "monitor-speaker": [4], // The speaker's woofer cone, round like the woofer in `speaker`.
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
