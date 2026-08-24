import type { QeetrixIconProps } from "./types.js";

/** Canonical grid. Every source SVG is authored against `0 0 24 24`. */
export const ICON_VIEW_BOX = "0 0 24 24";

/** Default rendered size in px. */
export const ICON_DEFAULT_SIZE = 24;

/** Default stroke width. Matches the outline spec in docs/icon-guidelines.md. */
export const ICON_DEFAULT_STROKE_WIDTH = 2;

/**
 * The single `<svg>` shell every generated icon renders through.
 *
 * Centralising it means the grid, the stroke defaults and — most importantly —
 * the accessibility behaviour are defined exactly once rather than duplicated
 * into every generated component.
 *
 * Accessibility: an icon is decorative by default (`aria-hidden="true"`),
 * because that is overwhelmingly the common case — an icon beside a text label
 * adds nothing for a screen reader. Passing `aria-label` or `aria-labelledby`
 * flips it to a semantic graphic (`role="img"`, no `aria-hidden`). That
 * automatic flip is the point: it makes the silent failure mode — an element
 * that is both `aria-hidden` and labelled, so the label is never announced —
 * unrepresentable.
 *
 * `...rest` is spread last, so every default above remains overridable;
 * `aria-hidden={false}` opts out of the decorative default entirely.
 *
 * Server-safe: no hooks, no browser APIs, no `"use client"`.
 */
export type IconVariant = "outline" | "solid";

export function IconBase({
  size = ICON_DEFAULT_SIZE,
  strokeWidth = ICON_DEFAULT_STROKE_WIDTH,
  variant = "outline",
  children,
  ...rest
}: QeetrixIconProps & { variant?: IconVariant }) {
  const labelled = rest["aria-label"] != null || rest["aria-labelledby"] != null;
  const isSolid = variant === "solid";

  // On the suppression below: this component IS the library's accessibility
  // contract, and it satisfies noSvgWithoutTitle's intent dynamically rather
  // than statically. A decorative icon carries `aria-hidden` (which the rule
  // accepts in place of a title); a semantic one is named by the consumer's
  // `aria-label`/`aria-labelledby` and gets `role="img"`. A static `<title>`
  // here would give every icon in the library the same useless accessible name.
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: satisfied dynamically — see the comment above.
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={ICON_VIEW_BOX}
      width={size}
      height={size}
      fill={isSolid ? "currentColor" : "none"}
      stroke={isSolid ? "none" : "currentColor"}
      strokeWidth={isSolid ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      {...rest}
    >
      {children}
    </svg>
  );
}
