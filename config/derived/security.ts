import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Security (`icons/<style>-<variant>/security/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // Element 1, the fuse cap, is solid like the ball; inferred, it stays an outline like a handle.
    bomb: { roles: { 1: "fill" } },
    "id-card": {},
    // The drawings are overrides (config/overrides/*-filled/security/id-card-lanyard.svg): the card
    // outline starts with the right strap, so derived, the body closes from the strap's tip and a
    // wedge sticks out of the top. The overrides draw the card whole, keep the right strap a line on
    // it, and gap the left strap and clip bar through the card like a calendar's tabs.
    "id-card-lanyard": {},
    "key-round": {},
    // The shaft and bit are solid like key-round's; inferred, the attached outline stays hollow.
    "key-square": { roles: { 2: "fill" } },
    lock: {},
    "lock-keyhole": {},
    // The open shackle stays a line.
    "lock-keyhole-open": { roles: { 2: "stroke" } },
    // The open shackle stays a line.
    "lock-open": { roles: { 1: "stroke" } },
    vault: {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    "earth-lock": [0, 1, 2], // Continents' coastlines.
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
  // Outline elements whose corners keep their point at the padding, by element index. Cut flat,
  // a camera's corners, a shield's, a key's bit, and a fuse cap read as clipped; they move in
  // instead.
  keepPoint: {
    bomb: [1],
    "brick-wall-shield": [3],
    cctv: [0, 1],
    "cctv-off": [0, 1],
    key: [1],
    "key-square": [0],
    "shield-lock": [0],
  },
};
