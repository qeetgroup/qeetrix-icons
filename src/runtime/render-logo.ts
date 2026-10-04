import { type CSSProperties, createElement, type ReactElement } from "react";
import type { LogoData, LogoProps, LogoVariantData } from "../types/logo.js";

/** Default rendered logo height in pixels; matches the default icon size. */
export const defaultLogoHeight = 24;

const hasText = (value: string | undefined) => value !== undefined && value.trim() !== "";

const lengthPattern = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i;
const pixelPattern = /^\s*(?:\d+\.?\d*|\.\d+)\s*$/;

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Scales a number of pixels or a CSS length such as `"2em"` by `factor`, keeping its unit.
 * Percentages and anything that is not a single length (such as `calc()`) cannot be scaled.
 */
export function scaleLogoLength(
  length: number | string,
  factor: number,
): number | string | undefined {
  if (typeof length === "number")
    return Number.isFinite(length) ? round(length * factor) : undefined;
  const match = lengthPattern.exec(length);
  if (!match || match[2] === "%") return undefined;
  return `${round(Number(match[1]) * factor)}${match[2]}`;
}

/** The file to render: the requested variant when the logo has it, otherwise the default. */
export function selectLogoVariant<V extends string>(
  data: LogoData<V>,
  variant: string | undefined,
): LogoVariantData {
  const name =
    variant !== undefined && Object.hasOwn(data.variants, variant)
      ? (variant as V)
      : data.defaultVariant;
  return data.variants[name];
}

/**
 * Renders a generated logo: the shared runtime behind every `…Logo` component.
 *
 * The published SVG file is rendered unmodified as an `<img>` whose `src` is the file's data URI.
 * An image is its own isolated document, so a logo's ids and `<style>` can never clash with the
 * page or with other logos, and no hooks are needed: it renders the same in Server Components,
 * `renderToStaticMarkup`, and the browser.
 *
 * - `variant` selects the file (default: the logo's default variant); an unknown name falls back
 *   to the default.
 * - `height` defaults to 24 and `width` follows from the file's aspect ratio, keeping the unit of
 *   a CSS length; given only `width`, `height` follows from it instead. Pixel numbers become the
 *   `width`/`height` attributes, CSS lengths go to `style` (a caller `style` wins). A length that
 *   cannot be scaled (a percentage, `calc()`, …) leaves the other dimension to CSS, which sizes it
 *   from the image's own aspect ratio.
 * - Decorative by default: `alt=""` and `aria-hidden="true"`. A non-empty `alt` or `aria-label`
 *   names the logo; `aria-label` then becomes the `alt` text, and `aria-hidden` is dropped, as it
 *   is for a non-empty `aria-labelledby`. An explicit `aria-hidden` always wins.
 */
export function renderLogo<V extends string>(data: LogoData<V>, props: LogoProps<V>): ReactElement {
  const {
    variant: requested,
    height: heightProp,
    width: widthProp,
    alt: altProp,
    style: styleProp,
    ...rest
  } = props;
  const variant = selectLogoVariant(data, requested);
  const ratio = variant.width / variant.height;
  let height = heightProp;
  let width = widthProp;
  if (height === undefined && width !== undefined) height = scaleLogoLength(width, 1 / ratio);
  else {
    height ??= defaultLogoHeight;
    width ??= scaleLogoLength(height, ratio);
  }

  // `<img width>` and `<img height>` take pixels only; any other CSS length is a style.
  const sizeAttributes: { width?: number | string; height?: number | string } = {};
  const sizeStyle: CSSProperties = {};
  for (const [name, value] of [
    ["width", width],
    ["height", height],
  ] as const) {
    if (value === undefined) continue;
    if (typeof value === "number" || pixelPattern.test(value)) sizeAttributes[name] = value;
    else sizeStyle[name] = value;
  }
  const hasSizeStyle = sizeStyle.width !== undefined || sizeStyle.height !== undefined;

  const label = rest["aria-label"];
  const labelBecomesAlt = altProp === undefined && hasText(label);
  const named = hasText(altProp) || hasText(label) || hasText(rest["aria-labelledby"]);
  const alt = altProp ?? (labelBecomesAlt ? label : named ? undefined : "");
  const hidden = rest["aria-hidden"] ?? (named ? undefined : true);
  const style = hasSizeStyle ? { ...sizeStyle, ...styleProp } : styleProp;

  // Only defined keys, so Server Component payloads carry no `$undefined` props.
  const imgProps: Record<string, unknown> = { ...rest };
  if (labelBecomesAlt) delete imgProps["aria-label"];
  if (alt !== undefined) imgProps.alt = alt;
  Object.assign(imgProps, sizeAttributes);
  if (style !== undefined) imgProps.style = style;
  if (hidden !== undefined) imgProps["aria-hidden"] = hidden;
  imgProps.src = variant.src;
  return createElement("img", imgProps);
}
