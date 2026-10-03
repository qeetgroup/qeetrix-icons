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
export const iconMetadata: Readonly<Record<string, IconMetadataOverride>> = {};
