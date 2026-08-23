import type * as React from "react";

/**
 * Props accepted by every Qeetrix icon component.
 *
 * Deliberately a thin extension of `React.SVGProps<SVGSVGElement>` — anything
 * valid on an `<svg>` element is valid here, including every `aria-*`
 * attribute, `className`, `style`, `strokeWidth` and event handlers. The only
 * addition is `size`, which sets `width` and `height` together.
 *
 * Named `QeetrixIconProps` rather than `IconProps` because `@qeetrix/ui`
 * already exports an `IconProps` (the props of its `<Icon icon={…}>` wrapper).
 * Distinct names let a consumer re-export both packages from one barrel.
 */
export type QeetrixIconProps = React.SVGProps<SVGSVGElement> & {
  /** Rendered width and height. Defaults to `24`. */
  size?: number | string;
};

/**
 * Search and discovery metadata for a single icon.
 *
 * Generated into `@qeetrix/icons/metadata` from the `icons/` tree plus the
 * hand-authored `icon-metadata.json`. Importable without pulling in any icon
 * component, so an icon picker or docs search can read the catalogue cheaply.
 *
 * `tags`, `aliases` and `mirror` are required rather than optional: generated
 * output with no conditionally-omitted keys produces far cleaner diffs, and an
 * absent tag list and an empty one mean the same thing here.
 */
export interface IconMetadata {
  /** Canonical kebab-case name, matching the source filename. */
  name: string;
  /** PascalCase name of the exported React component. */
  component: string;
  /** Category, always derived from the `icons/` subdirectory. */
  category: string;
  /** Free-form search keywords. */
  tags: string[];
  /** Alternative names that should resolve to this icon in a search. */
  aliases: string[];
  /** Whether the glyph must be mirrored horizontally under `dir="rtl"`. */
  mirror: boolean;
  /**
   * Present only on icons scheduled for removal.
   *
   * An icon component is public API, so it is never deleted in a minor release.
   * Marking it deprecated keeps it working and exporting while telling pickers,
   * docs and codemods to stop offering it. Absent on every supported icon, so a
   * consumer can treat `deprecated` as the whole signal.
   */
  deprecated?: IconDeprecation;
}

/** Why an icon is deprecated and what to use instead. */
export interface IconDeprecation {
  /** Version in which the icon was deprecated, e.g. `"0.2.0"`. */
  since: string;
  /** Canonical name of the icon to use instead, or `null` if there is none. */
  replacement: string | null;
  /** One sentence a developer can act on. */
  reason: string;
}
