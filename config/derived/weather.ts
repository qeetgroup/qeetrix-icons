import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Weather (`icons/<style>-<variant>/weather/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    bubbles: {},
    cloud: {},
    // The cloud-* family: the open cloud fills closed along its chord, and every rain, drizzle,
    // hail, snow, fog, or bolt mark that overlaps it is a `gap` line with 1 unit of clearance,
    // so all siblings treat their marks alike (pinned even where inference agrees, since it
    // varies by how far a mark's cap reaches past the chord). Inferred, the drizzle dashes,
    // snow dots, and hail stone nearest the cloud were cut as holes beside gapped neighbours.
    "cloud-drizzle": { roles: { 2: "gap", 4: "gap", 6: "gap" } },
    "cloud-fog": { roles: { 1: "gap" } },
    "cloud-hail": { roles: { 1: "gap", 2: "gap", 5: "gap" } },
    // Element 1, the bolt, is a gap line; inferred, its bend closed into a fill that vanished
    // into the cloud, leaving only the bolt's tail.
    "cloud-lightning": { roles: { 1: "gap" } },
    "cloud-rain": { roles: { 1: "gap", 2: "gap", 3: "gap" } },
    "cloud-rain-wind": { roles: { 1: "gap", 2: "gap", 3: "gap" } },
    "cloud-snow": { roles: { 1: "gap", 3: "gap", 5: "gap" } },
    droplet: {},
    // Element 1, the drop half hidden behind the small one, stays a line, like copy's back sheet
    // and users' second figure; inferred, its slanted chord fused it into the small drop.
    droplets: { roles: { 1: "stroke" } },
    flame: {},
    thermometer: {},
    // Element 0, the handle, stays a line; inferred, its hook closed into a solid wedge. Element
    // 1, the tip, stands on the canopy like an antenna, so it stays attached rather than gapped.
    umbrella: { roles: { 0: "stroke", 1: "stroke" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    cloudy: [1], // The back cloud's small lobe, an organic curve; squared, it collapsed into a bare bar.
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
