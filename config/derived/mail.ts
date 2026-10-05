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
};
