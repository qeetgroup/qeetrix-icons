import { iconSystem } from "../../config/icon-system.js";
import type { IconShape, IconVariant } from "../../src/types/icon.js";

/**
 * Shareable inspection state in the query string, so `?icon=star&shape=sharp&variant=filled` opens
 * the same view for a reviewer. Only inspection state lives here, not every UI preference. Every
 * value is validated; anything invalid falls back to its default rather than failing.
 */

export type Theme = "system" | "light" | "dark";
export type Direction = "ltr" | "rtl";

export type UrlState = {
  /** Requested icon id. Whether it exists is checked against the catalogue, not here. */
  readonly icon?: string;
  /** The `shape` every rendered icon gets, in the grid and the inspector. */
  readonly shape: IconShape;
  readonly variant?: IconVariant;
  readonly size: number;
  readonly theme: Theme;
  readonly dir: Direction;
};

/** Custom inspection range. Inspection only; it does not change recommended sizes. */
export const sizeRange = { min: 12, max: 64 } as const;

export const defaultUrlState: UrlState = {
  shape: iconSystem.architecture.defaultStyle,
  size: iconSystem.design.defaultSize,
  theme: "system",
  dir: "ltr",
};

const themes: readonly string[] = ["system", "light", "dark"];
const directions: readonly string[] = ["ltr", "rtl"];
/** The source styles are the `shape` prop's values. */
const shapes: readonly string[] = iconSystem.architecture.styles;
const variants: readonly string[] = iconSystem.architecture.variants;

export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const icon = params.get("icon") ?? "";
  const shape = params.get("shape") ?? "";
  const variant = params.get("variant") ?? "";
  const size = Number(params.get("size") ?? Number.NaN);
  const theme = params.get("theme") ?? "";
  const dir = params.get("dir") ?? "";
  return {
    icon: /^[a-z][a-z0-9-]*$/.test(icon) ? icon : undefined,
    shape: shapes.includes(shape) ? (shape as IconShape) : defaultUrlState.shape,
    variant: variants.includes(variant) ? (variant as IconVariant) : undefined,
    size:
      Number.isInteger(size) && size >= sizeRange.min && size <= sizeRange.max
        ? size
        : defaultUrlState.size,
    theme: themes.includes(theme) ? (theme as Theme) : defaultUrlState.theme,
    dir: directions.includes(dir) ? (dir as Direction) : defaultUrlState.dir,
  };
}

/** A query string with defaults omitted, in a stable parameter order. */
export function serializeUrlState(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.icon) params.set("icon", state.icon);
  if (state.shape !== defaultUrlState.shape) params.set("shape", state.shape);
  if (state.variant && state.variant !== iconSystem.architecture.defaultVariant) {
    params.set("variant", state.variant);
  }
  if (state.size !== defaultUrlState.size) params.set("size", String(state.size));
  if (state.theme !== defaultUrlState.theme) params.set("theme", state.theme);
  if (state.dir !== defaultUrlState.dir) params.set("dir", state.dir);
  const query = params.toString();
  return query ? `?${query}` : "";
}
