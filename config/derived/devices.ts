import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Devices (`icons/<style>-<variant>/devices/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // The legs stay attached to the clock face; inference would gap them where they meet it.
    "alarm-clock": { roles: { 4: "stroke", 5: "stroke" } },
    "alarm-clock-check": { roles: { 3: "stroke", 4: "stroke" } },
    "alarm-clock-minus": { roles: { 3: "stroke", 4: "stroke" } },
    "alarm-clock-plus": { roles: { 3: "stroke", 4: "stroke" } },
    // The three buttons stay attached to the top of the body, not gapped from it.
    "boom-box": { roles: { 1: "stroke", 2: "stroke", 3: "stroke" } },
    // The base sits in front of the monitor, with a gap where they share an edge. The round filled
    // drawing is an override only to flatten the monitor's bottom corners, which the base's round
    // clearance flared by 0.13 units.
    computer: { roles: { 3: "front" } },
    // The top disc sits in front of the drum; the middle seam is cut. Both filled drawings are one
    // override: derived, the seam's caps curled up the sides (round) or stepped (sharp), and the
    // lid's 1-unit gap was half the seam's. The override stacks discs instead: every edge is the
    // outline's rx 10, ry 4 lower half, so each 2-unit gap is a crescent across the full width.
    database: { roles: { 0: "front" } },
    disc: {},
    "disc-2": {},
    "disc-album": {},
    eject: {},
    gpu: {},
    hd: {},
    "hdmi-port": {},
    laptop: {},
    "laptop-minimal": {},
    "laptop-minimal-check": {},
    // The pins stay attached below the board; inference would gap them where they meet it.
    "memory-stick": { roles: { 1: "stroke", 3: "stroke", 5: "stroke", 7: "stroke", 9: "stroke" } },
    // The cup and stand stay lines around a solid capsule.
    mic: { roles: { 0: "stroke", 1: "stroke" } },
    // A solid head in front of a solid handle; the cable stays a line rather than filling its chord.
    "mic-vocal": { roles: { 0: "fill", 1: "stroke", 2: "front" } },
    mouse: {},
    "pc-case": {},
    // The prongs and the cord stay attached to the body, not gapped from it.
    plug: { roles: { 0: "stroke", 1: "stroke", 3: "stroke" } },
    // The plate is the body's top edge carried past it, so it merges with the body like the prongs
    // and the cord; inference would gap all four from the body.
    "plug-2": { roles: { 0: "stroke", 1: "stroke", 2: "stroke", 3: "stroke" } },
    // The sheet of paper sits in front of the body, with a gap around it.
    printer: { roles: { 2: "front" } },
    // printer-check and printer-x are outline-only: their paper and body are clipped open around
    // the badge, and filling those open paths leaves diagonal chords (like file-*-corner).
    // The feet stay attached under the body, not gapped from it.
    "radio-receiver": { roles: { 0: "stroke", 1: "stroke" } },
    "rectangle-goggles": {},
    tablet: {},
    touchpad: {},
    // The antenna stays a V on the screen; inference would fill it into a triangle.
    tv: { roles: { 0: "stroke" } },
    "tv-minimal": {},
    "tv-minimal-play": {},
    "usb-c-port": {},
    // The zigzags stay lines; inference would fill each one to its chord.
    vibrate: { roles: { 0: "stroke", 1: "stroke" } },
    // The lens is a solid part of the camera, not a handle: fill it to its chord on the body.
    video: { roles: { 0: "fill" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    hd: [2], // The D's bowl: squared, "HD" reads as "H0".
    usb: [0, 1], // The USB symbol's round terminals, distinct from its square one.
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
  // Outline elements whose corners keep their point at the padding, by element index. Cut flat,
  // an arrowhead's tip, a bolt's, a triangle's, a laptop's base, a plug's corners, and a zigzag's
  // points read as clipped; they move in instead.
  keepPoint: {
    // The arrowhead, the bolt, and the eject triangle.
    "database-arrow-down": [0],
    "database-zap": [3],
    eject: [0],
    "plug-zap": [0],
    // The laptop's base.
    laptop: [0],
    // The lamp's head.
    spotlight: [3],
    // The plugs.
    unplug: [2, 5],
    // The zigzags.
    vibrate: [0, 1],
    "vibrate-off": [0, 1],
  },
};
