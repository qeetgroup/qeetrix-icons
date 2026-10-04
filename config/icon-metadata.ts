import type { IconDirectionality } from "../src/types/icon.js";

export type IconMetadataOverride = {
  readonly directionality: IconDirectionality;
};

/**
 * Authored exceptions to derived icon metadata, keyed by canonical icon name.
 *
 * Name, variant, category, and component names all come from the source path. Directionality
 * defaults to `iconSystem.architecture.defaultDirectionality` ("preserve"); list a concept here
 * only when it must differ, for example `"arrow-back": { directionality: "mirror" }`. One entry
 * covers every variant of that name. An entry for a name with no source fails validation, so a
 * rename or removal cannot leave stale metadata behind. See docs/rtl.md before adding one.
 */
export const iconMetadata: Readonly<Record<string, IconMetadataOverride>> = {
  // Semantic concepts that follow reading direction (docs/rtl.md). Physical directions such as
  // arrow-left, chevron-right, and corner-* keep the default "preserve".
  undo: { directionality: "mirror" },
  redo: { directionality: "mirror" },
  "arrow-back": { directionality: "mirror" },
  "arrow-forward": { directionality: "mirror" },
  "sidebar-open": { directionality: "mirror" },
  "sidebar-close": { directionality: "mirror" },
  "log-in": { directionality: "mirror" },
  "log-out": { directionality: "mirror" },
  enter: { directionality: "mirror" },
  exit: { directionality: "mirror" },
  // A progress bar fills from the reading start.
  progress: { directionality: "mirror" },
  // "Act as" another user: the arrow enters the person like log-in.
  impersonate: { directionality: "mirror" },
  send: { directionality: "mirror" },
  reply: { directionality: "mirror" },
  "reply-all": { directionality: "mirror" },
  // Forwarding a message, not media fast-forward.
  forward: { directionality: "mirror" },
  // Moving into or out of a group at the reading start or end, like log-in and log-out.
  join: { directionality: "mirror" },
  leave: { directionality: "mirror" },
};
