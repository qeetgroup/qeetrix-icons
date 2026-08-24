import type { SVGProps } from "react";

/** The style variants an icon can be drawn in. */
export type IconVariant = "outline" | "solid";

/**
 * Props accepted by every Qeetrix icon component.
 *
 * A thin extension of `SVGProps<SVGSVGElement>`: anything valid on an `<svg>`
 * element is valid here — `className`, `style`, `width`, `height`, `fill`,
 * every `aria-*` attribute and every event handler. Props spread onto the root
 * `<svg>` last, so they override the values baked into the source SVG.
 *
 * Named `QeetrixIconProps` rather than `IconProps` because `@qeetrix/ui`
 * already exports an `IconProps`. Distinct names let a consumer re-export both
 * packages from one barrel.
 *
 * Individual components narrow `variant` to the styles they actually ship, so a
 * solid-only icon rejects `variant="outline"` at the type level.
 */
export type QeetrixIconProps = SVGProps<SVGSVGElement> & {
  /** Which style to draw. Defaults to `"outline"` where an outline exists. */
  variant?: IconVariant;
};
