import type { SVGProps } from "react";

/**
 * Props accepted by every generated icon component.
 *
 * Native `<svg>` props, including `ref`, plus `size`. Children are excluded because an icon renders
 * its own artwork. `size` is any CSS length or number of pixels; recommended design sizes are
 * guidance, not a restriction. Not a root package export yet: the public API is a later phase.
 */
export type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "dangerouslySetInnerHTML"> & {
  size?: number | string;
};
