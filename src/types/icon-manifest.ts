import type { IconDirectionality, IconShape, IconVariant } from "./icon.js";

/**
 * The generated icon catalogue, published as `@qeetrix/icons/manifest`. Metadata for tooling,
 * documentation, and search; icons never need it to render.
 *
 * `schemaVersion` is independent of the package version. It changes only when an existing field
 * changes meaning or is removed; adding an optional field does not change it.
 */
export type IconManifest = {
  readonly schemaVersion: 1;
  /** One entry per concept, ordered by configured category, then name. */
  readonly icons: readonly IconManifestEntry[];
};

/** One semantic icon concept: one component, with every drawing that exists for it. */
export type IconManifestEntry = {
  /** Unique public id, and the direct-import subpath `@qeetrix/icons/icons/<id>`: `star`. */
  readonly id: string;
  /** Canonical concept name: `star`. */
  readonly name: string;
  /** The one public export for the concept: `StarIcon`. */
  readonly componentName: string;
  /** Primary category id: the source folder. Never part of an export name or import path. */
  readonly category: string;
  /** Every category the concept belongs to, primary first. Filter by these, not `category`. */
  readonly categories: readonly string[];
  /** Drawings available through the `variant` prop, in configured order; always starts with `outline`. */
  readonly variants: readonly IconVariant[];
  /**
   * Drawing styles available through the `shape` prop, default first: `["round", "sharp"]`. Every
   * shape has exactly the drawings listed in `variants`.
   */
  readonly shapes: readonly IconShape[];
  /** Whether the concept follows reading direction in RTL. See docs/rtl.md. */
  readonly directionality: IconDirectionality;
  /** Search keywords: `["delete", "remove", …]` for `trash`. */
  readonly tags: readonly string[];
  /** Earlier upstream names, for search and migration: `["trash-2"]` for `trash`. Never exported. */
  readonly aliases: readonly string[];
};
