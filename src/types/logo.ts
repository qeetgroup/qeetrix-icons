import type { ComponentPropsWithRef, ReactElement } from "react";

/**
 * Props accepted by logo components such as `QeetLogo`.
 *
 * A logo renders its published SVG file, unmodified, as an `<img>`. Native `<img>` props pass
 * through (`className`, `style`, `loading`, `decoding`, `draggable`, `title`, `ref`, …) except
 * `src`, `srcSet` and `sizes`, which the logo owns.
 *
 * - `variant` selects one of the logo's files and defaults to the logo's default variant. Every
 *   generated component narrows `V` to the variants that exist for that logo, so an unavailable
 *   variant is a type error.
 * - `height` is any number of pixels or CSS length and defaults to 24. `width` follows from the
 *   file's own aspect ratio unless given; when only `width` is given, `height` follows from it.
 *   Pixel numbers become the `width`/`height` attributes; CSS lengths such as `"2em"` go to
 *   `style`, which a caller `style` overrides.
 * - Decorative by default: `alt=""` and `aria-hidden="true"`. A non-empty `alt` or `aria-label`
 *   names the logo: it becomes the `alt` text and `aria-hidden` is dropped. A non-empty
 *   `aria-labelledby` also drops `aria-hidden`. An explicit `aria-hidden` always wins.
 */
export type LogoProps<V extends string = string> = Omit<
  ComponentPropsWithRef<"img">,
  "children" | "dangerouslySetInnerHTML" | "src" | "srcSet" | "sizes" | "height" | "width"
> & {
  variant?: V;
  height?: number | string;
  width?: number | string;
};

/** A logo component. `V` is the union of the variants it has. */
export type LogoComponent<V extends string = string> = (props: LogoProps<V>) => ReactElement;

/** Which background a variant is drawn for. `"any"` works on both. */
export type LogoBackground = "light" | "dark" | "any";

/** One published file of a logo. */
export interface LogoVariantData {
  /**
   * The file as a `data:image/svg+xml,` URI. Percent-decoding it yields the published file byte
   * for byte; only bytes a URI cannot carry verbatim are escaped.
   */
  readonly src: string;
  /**
   * The file's intrinsic size, read from it without modification: its root `width` and `height`
   * when both are absolute lengths, otherwise its `viewBox` size. Only the ratio is used.
   */
  readonly width: number;
  readonly height: number;
}

/** Everything a generated logo component renders. `V` is the union of its variant names. */
export interface LogoData<V extends string = string> {
  readonly defaultVariant: V;
  readonly variants: { readonly [K in V]: LogoVariantData };
}

/** One file of a logo, as listed in the manifest. */
export type LogoManifestVariant = {
  readonly name: string;
  readonly background: LogoBackground;
};

/** Catalogue metadata for one logo. */
export type LogoManifestEntry = {
  /** The logo's slug, such as `"github"`. */
  readonly id: string;
  readonly componentName: string;
  readonly title: string;
  readonly collection: string;
  readonly variants: readonly LogoManifestVariant[];
  readonly defaultVariant: string;
  /** Primary brand colour as six hex digits without `#`, when upstream records one. */
  readonly hex: string | null;
  readonly categories: readonly string[];
  readonly aliases: readonly string[];
  /** SPDX identifier where one applies, otherwise the upstream licence text. */
  readonly license: string;
  readonly website: string | null;
  readonly guidelines: string | null;
  /** Upstream page for the logo. */
  readonly source: string | null;
};

/** The generated logo catalogue. */
export type LogoManifest = {
  readonly schemaVersion: 1;
  readonly logos: readonly LogoManifestEntry[];
};
