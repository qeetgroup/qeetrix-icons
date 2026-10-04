import type { SVGProps } from "react";
import type { IconProps } from "../types/icon-props.js";

/**
 * Default rendered size. Mirrors `design.defaultSize` in the internal icon-system config,
 * which published code cannot import; tests keep the two equal.
 */
export const defaultIconSize = 24;

const hasText = (value: string | undefined) => value !== undefined && value.trim() !== "";

/**
 * Root `<svg>` props shared by every generated icon: size and accessibility defaults, with any
 * prop the caller passes taking precedence. See docs/accessibility.md for the contract.
 *
 * - `size`, `shape`, and `variant` are consumed here and never reach the DOM; the component has
 *   already used `shape` (default `"round"`) and `variant` (default `"outline"`) to choose which
 *   drawing to render.
 * - Unnamed icons are decorative: `aria-hidden="true"`, `focusable="false"`, and no role.
 * - A non-empty `aria-label` or `aria-labelledby` exposes the icon as `role="img"` instead.
 * - Explicit `width`, `height`, `focusable`, `aria-hidden`, or `role` always wins.
 */
export function resolveIconProps({
  size = defaultIconSize,
  shape: _shape,
  variant: _variant,
  ...props
}: IconProps): SVGProps<SVGSVGElement> {
  const named = hasText(props["aria-label"]) || hasText(props["aria-labelledby"]);
  return {
    ...props,
    width: props.width ?? size,
    height: props.height ?? size,
    focusable: props.focusable ?? false,
    "aria-hidden": props["aria-hidden"] ?? (named ? undefined : true),
    role: props.role ?? (named ? "img" : undefined),
  };
}
