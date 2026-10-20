import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Mail (`icons/<style>-<variant>/mail/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  // mail-check, mail-minus, and mail-warning are outline-only: their envelope is clipped open around
  // the badge, and filling it closed a diagonal chord across the corner (as printer-check and the
  // other clipped badge icons, which are not listed either).
  filled: {
    "mail-open": {},
    send: {},
    "send-horizontal": {},
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
  // Outline elements whose corners keep their point at the padding, by element index. Cut flat,
  // a ribbon's tails, an open envelope's flap, a pen's nib, a flag's corner, a chevron's tip, and
  // a paper plane's tips read as clipped; they move in instead. (send-horizontal's sharp outline
  // is an override drawn the same way: its centre line ends inside the moved tip, which the
  // attached-end rule, at most a cap's length, cannot reach. Its sharp filled drawing is an
  // override too, so the centre cut still runs out through the tip.)
  keepPoint: {
    "mail-badge": [2],
    "mail-open": [0],
    "mail-pen": [0],
    mailbox: [2],
    "reply-all": [2],
    send: [0],
  },
};
