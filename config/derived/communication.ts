import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Communication (`icons/<style>-<variant>/communication/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    "ethernet-port": {},
    // The arm hangs off the desk and the base line carries the post; inference closed the arm into a
    // wedge and gapped the base off the post. The filled drawings are overrides of this derivation
    // with a 1-unit gap around the post's top inside the desk, where the post stands in front of it
    // (the front role would also have gapped the post off its base).
    lectern: { roles: { 2: "stroke", 3: "stroke" } },
    // The NFC waves beside the phone stay lines; inference closed each arc into a solid wedge.
    "smartphone-nfc": { roles: { 1: "stroke", 2: "stroke", 3: "stroke" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {},
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
