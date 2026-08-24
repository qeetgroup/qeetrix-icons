import type { SVGProps } from "react";

/** The style variants an icon can be drawn in. */
export type IconVariant = "outline" | "solid";

/**
 * Props accepted by every Qeetrix icon component.
 *
 * A thin extension of `SVGProps<SVGSVGElement>`: anything valid on an `<svg>`
 * element is valid here — `className`, `style`, `width`, `height`, `color`,
 * every `aria-*` attribute and every event handler. Props spread onto the root
 * `<svg>` last, so they override the defaults baked into the component.
 *
 * ## Colour
 *
 * Icons are drawn in white by default, matching the source artwork, and all
 * visible geometry paints `currentColor`. The root carries `color="white"` as
 * the default, so a single knob retints the whole glyph:
 *
 * ```tsx
 * <Activity />                                    // white, as drawn
 * <Activity color="black" />                      // any CSS colour
 * <Activity className="text-red-500" />           // a utility class
 * <Activity className="text-black dark:text-white" />   // dark / light mode
 * <Activity color="currentColor" />               // inherit surrounding text
 * ```
 *
 * `color` is a presentation attribute, which CSS outranks — so a `className` or
 * stylesheet rule beats the white default without needing `!important`.
 *
 * Note that `fill` is *not* the knob to reach for: visible paths carry their own
 * `fill="currentColor"`, and an explicit fill on a child beats an inherited one
 * from the root, so setting `fill` on the icon has no effect on the artwork.
 *
 * Individual components narrow `variant` to the styles they actually ship, so a
 * solid-only icon rejects `variant="outline"` at the type level.
 */
export type QeetrixIconProps = SVGProps<SVGSVGElement> & {
  /** Which style to draw. Defaults to `"outline"` where an outline exists. */
  variant?: IconVariant;
};
