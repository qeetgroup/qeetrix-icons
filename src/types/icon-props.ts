import type { SVGProps } from "react";
import type { IconVariant } from "./icon.js";

/**
 * Props accepted by icon components.
 *
 * Native `<svg>` props, including `ref`, plus `size` and `variant`. Children are excluded because
 * an icon renders its own artwork. `size` is any number of pixels or CSS length; recommended design
 * sizes are guidance, not a restriction. `variant` selects a drawing and defaults to `"outline"`.
 *
 * Every generated component narrows `V` to the drawings that exist for it, so `SearchIcon` takes
 * `IconProps<"outline">` and `StarIcon` takes `IconProps<"outline" | "filled">`, and an
 * unavailable variant is a type error. The default `V` describes the whole system.
 */
export type IconProps<V extends IconVariant = IconVariant> = Omit<
  SVGProps<SVGSVGElement>,
  "children" | "dangerouslySetInnerHTML"
> & {
  size?: number | string;
  variant?: V;
};
