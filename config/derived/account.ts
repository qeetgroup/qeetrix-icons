import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Accounts & access (`icons/<style>-<variant>/account/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  // Left outline-only on review: icons whose body Lucide clips to make room for a badge (bell-dot,
  // credit-card-check, credit-card-minus, credit-card-x, star-check, star-minus, star-plus,
  // user-lock), like their unlisted siblings credit-card-plus, star-x, and user-round-check: filled,
  // the clipped body closes with a diagonal edge. book-user, like book, loses its page edge, and
  // wallet-minimal, like wallet, fills its open flap into a wedge.
  filled: {
    award: {},
    badge: {},
    "badge-alert": {},
    "badge-info": {},
    ban: {},
    bell: {},
    bookmark: {},
    "bookmark-check": {},
    "bookmark-minus": {},
    "bookmark-off": {},
    "bookmark-plus": {},
    "bookmark-x": {},
    building: {},
    "circle-user": {},
    "circle-user-round": {},
    contact: {},
    "contact-round": {},
    cookie: {},
    "credit-card": {},
    "file-user": {},
    flag: {},
    inbox: {},
    "message-circle-x": {},
    "notebook-tabs": {},
    settings: {},
    "share-2": {},
    shield: {},
    "shield-alert": {},
    "shield-ban": {},
    "shield-check": {},
    "shield-cog": {},
    "shield-ellipsis": {},
    "shield-keyhole": {},
    "shield-minus": {},
    "shield-off": {},
    "shield-plus": {},
    "shield-question-mark": {},
    "shield-user": {},
    "shield-x": {},
    "square-user": {},
    "square-user-round": {},
    star: {},
    tag: {},
    "thumbs-down": {},
    "thumbs-up": {},
    ticket: {},
    user: {},
    // Element 0, the check beside the figure, stays a line like user-x's cross; inference would
    // fill its corner into a wedge.
    "user-check": { roles: { 0: "stroke" } },
    "user-minus": {},
    "user-plus": {},
    "user-round": {},
    "user-x": {},
    // Elements 1 and 2, the second figure half hidden behind the first, stay lines; inference would
    // fill the head arc into a half disc and the shoulder arc into a sliver.
    users: { roles: { 1: "stroke", 2: "stroke" } },
    // Element 2, the second figure half hidden behind the first, stays a line; inference would fill
    // its head and shoulder curve into a blade.
    "users-round": { roles: { 2: "stroke" } },
    "venetian-mask": {},
    "wallet-cards": {},
    wrench: {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    // The figure's shoulders, round like `user`'s; squared, the torso turns into a box.
    contact: [1],
    // Element 0's turn is a fingerprint ridge like the others; squared, it turns into a bracket.
    "fingerprint-pattern": [0],
    // The upper hand's curves (the thumb's crotch, the wrist); squared, the hand turns into a bracket.
    handshake: [1],
    // The figure's shoulders, round like `user`'s; squared, the torso turns into a box.
    "square-user": [2],
    // The figures' shoulders, round like `user`'s; squared, they turn into brackets.
    "user-group": [0, 1, 2],
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
