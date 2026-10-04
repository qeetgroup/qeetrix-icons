import type { ReactElement, SVGProps } from "react";

/**
 * Props accepted by brand logo components such as `GithubLogo`.
 *
 * Native `<svg>` props, including `ref`, plus `variant`. Children are excluded because a logo
 * renders its own artwork.
 *
 * - `variant` selects one of the logo's drawings and defaults to the logo's default variant.
 *   Every generated component narrows `V` to the variants that exist for that logo, so an
 *   unavailable variant is a type error.
 * - `height` is any number of pixels or CSS length and defaults to 24. `width` follows from the
 *   artwork's aspect ratio unless given; when only `width` is given, `height` follows from it.
 *
 * Logos keep their original colours. See docs for the accessibility contract, which is the same
 * as for icons: decorative by default, `role="img"` once named.
 */
export type LogoProps<V extends string = string> = Omit<
  SVGProps<SVGSVGElement>,
  "children" | "dangerouslySetInnerHTML" | "height" | "width"
> & {
  variant?: V;
  height?: number | string;
  width?: number | string;
};

/** A brand logo component. `V` is the union of the variants it has. */
export type LogoComponent<V extends string = string> = (props: LogoProps<V>) => ReactElement;

/** Which background a variant is drawn for. `"any"` works on both. */
export type LogoBackground = "light" | "dark" | "any";

/**
 * One prop value of a logo element: an attribute string, or a style object whose keys are React
 * (camelCase) CSS property names.
 */
export type LogoPropValue = string | { readonly [property: string]: string };

/** Props of one logo element, keyed by React prop name. */
export type LogoNodeProps = { readonly [name: string]: LogoPropValue };

/**
 * One SVG element of a logo's artwork, as `[tag, props, ...children]`. Children are elements or
 * text. Instance-scoped ids and references to them contain `logoIdMarker` (U+0001).
 */
export type LogoNode = readonly [
  tag: string,
  props: LogoNodeProps | null,
  ...children: (LogoNode | string)[],
];

/** One drawing of a logo, ready to render. */
export interface LogoVariantData {
  /** `[minX, minY, width, height]` of the artwork; the aspect ratio is `width / height`. */
  readonly viewBox: readonly [number, number, number, number];
  /** Root `<svg>` props of the artwork, by React prop name; caller props win over these. */
  readonly props?: LogoNodeProps;
  /**
   * The artwork's elements, or the JSON text of that array. Generated modules use JSON text so
   * TypeScript checks one string instead of typing every element; it is parsed once, when the
   * drawing first renders.
   */
  readonly children: readonly LogoNode[] | string;
  /**
   * `true` when the drawing defines ids (gradients, clip paths, masks, filters, `<use>` targets).
   * Rendering replaces `logoIdMarker` (U+0001) in every string with an instance prefix.
   */
  readonly scoped?: boolean;
}

/** Everything a generated logo component renders. `V` is the union of its variant names. */
export interface LogoData<V extends string = string> {
  readonly defaultVariant: V;
  readonly variants: { readonly [K in V]: LogoVariantData };
}

/** One drawing of a logo, as listed in the manifest. */
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
  /** Primary brand colour as six uppercase hex digits without `#`, when upstream records one. */
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
