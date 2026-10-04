import type { SVGProps } from "react";
import type { IconShape, IconVariant } from "./icon.js";

/**
 * Props accepted by icon components.
 *
 * Native `<svg>` props, including `ref`, plus `size`, `shape`, and `variant`. Children are excluded
 * because an icon renders its own artwork. `size` is any number of pixels or CSS length;
 * recommended design sizes are guidance, not a restriction. `shape` selects the drawing style and
 * defaults to `"round"`; `variant` selects a drawing within it and defaults to `"outline"`.
 *
 * Every icon has both shapes, so `shape` is never narrowed. Every generated component narrows `V`
 * to the drawings that exist for it, the same in both shapes, so `SearchIcon` takes
 * `IconProps<"outline">` and `StarIcon` takes `IconProps<"outline" | "filled">`, and an
 * unavailable variant is a type error. The default `V` describes the whole system.
 */
export type IconProps<V extends IconVariant = IconVariant> = Omit<
  SVGProps<SVGSVGElement>,
  "children" | "dangerouslySetInnerHTML"
> & {
  size?: number | string;
  shape?: IconShape;
  variant?: V;
};
