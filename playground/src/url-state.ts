import { categories } from "../../config/categories.js";
import { iconSystem } from "../../config/icon-system.js";
import type { IconDirectionality, IconShape, IconVariant } from "../../src/types/icon.js";
import type { VariantFilter } from "./catalogue.js";
import {
  type BackgroundMode,
  backgroundModes,
  type LicenseClass,
  licenseClassIds,
  type VariantKind,
  variantKindIds,
} from "./logo-catalogue.js";

/**
 * The whole playground view in the query string, so a link or a reload reopens exactly what a
 * reviewer saw: the page, its search and filters, the inspected icon or logo, and the theme. Only
 * the current page's parameters are written; the other page keeps its state in memory. Every
 * value is validated, and anything invalid falls back to its default instead of failing.
 *
 *   ?q=arrow&category=arrows&shape=sharp&icon=arrow-right&variant=filled&theme=dark
 *   ?page=logos&collection=brands&license=permissive,public-domain&bg=dark&logo=github
 */

export type Page = "icons" | "logos";
export type Theme = "system" | "light" | "dark";
export type Direction = "ltr" | "rtl";

/** Grid preview sizes. */
export const previewSizes = [16, 20, 24, 32, 48] as const;
/** Custom inspection range in the inspector. It does not change recommended sizes. */
export const sizeRange = { min: 12, max: 64 } as const;
/** The `strokeWidth` preview range, in quarter units. */
export const strokeRange = { min: 0.5, max: 3, step: 0.25 } as const;
/** Named preview colours; any six-digit hex is accepted too. */
export const colorTokens = [
  "foreground",
  "muted",
  "accent",
  "blue",
  "green",
  "amber",
  "red",
] as const;
export type ColorToken = (typeof colorTokens)[number];

export type IconsState = {
  readonly q: string;
  /** A configured category id, or "" for all. */
  readonly category: string;
  readonly variants: VariantFilter;
  readonly directionality: "all" | IconDirectionality;
  /** The `shape` every rendered icon gets, in the grid and the inspector. */
  readonly shape: IconShape;
  readonly preview: number;
  readonly stroke: number;
  /** A colour token or six lower-case hex digits. */
  readonly color: string;
  /** Requested icon id. Whether it exists is checked against the catalogue, not here. */
  readonly icon?: string;
  readonly variant?: IconVariant;
  readonly size: number;
  readonly dir: Direction;
};

export type LogosState = {
  readonly q: string;
  /** A collection id, or "" for all. Unknown ids are ignored by the page, not here. */
  readonly collection: string;
  readonly licenses: readonly LicenseClass[];
  readonly kinds: readonly VariantKind[];
  readonly bg: BackgroundMode;
  readonly logo?: string;
};

export type AppState = {
  readonly page: Page;
  readonly theme: Theme;
  readonly icons: IconsState;
  readonly logos: LogosState;
};

export const defaultIconsState: IconsState = {
  q: "",
  category: "",
  variants: "all",
  directionality: "all",
  shape: iconSystem.architecture.defaultStyle,
  preview: iconSystem.design.defaultSize,
  stroke: iconSystem.design.strokeWidth,
  color: "foreground",
  size: iconSystem.design.defaultSize,
  dir: "ltr",
};

export const defaultLogosState: LogosState = {
  q: "",
  collection: "",
  licenses: [],
  kinds: [],
  bg: "light",
};

export const defaultAppState: AppState = {
  page: "icons",
  theme: "system",
  icons: defaultIconsState,
  logos: defaultLogosState,
};

const slugPattern = /^[a-z0-9][a-z0-9-]*$/;
const categoryIds: readonly string[] = categories.map(({ id }) => id);
const shapes: readonly string[] = iconSystem.architecture.styles;
const variants: readonly string[] = iconSystem.architecture.variants;
const variantFilters: readonly string[] = [
  "all",
  "default-only",
  ...variants.filter((variant) => variant !== iconSystem.architecture.defaultVariant),
];

function oneOf<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

/** A comma list of known values, deduplicated, in canonical order. */
function listOf<T extends string>(value: string | null, options: readonly T[]): T[] {
  const requested = new Set((value ?? "").split(","));
  return options.filter((option) => requested.has(option));
}

function integerIn(value: string | null, min: number, max: number, fallback: number): number {
  const number = Number(value ?? Number.NaN);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

/** Free text, trimmed of control characters and capped, so a pasted URL cannot bloat state. */
function query(value: string | null): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point.
  return (value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 120);
}

export function parseIconsState(params: URLSearchParams): IconsState {
  const icon = params.get("icon") ?? "";
  const category = params.get("category") ?? "";
  const stroke = Number(params.get("stroke") ?? Number.NaN);
  const color = (params.get("color") ?? "").toLowerCase();
  return {
    q: query(params.get("q")),
    category: categoryIds.includes(category) ? category : "",
    variants: oneOf(params.get("variants"), variantFilters, "all") as VariantFilter,
    directionality: oneOf(params.get("direction"), ["all", "mirror", "preserve"], "all"),
    shape: oneOf(params.get("shape"), shapes, defaultIconsState.shape) as IconShape,
    preview: Number(
      oneOf(params.get("preview"), previewSizes.map(String), String(defaultIconsState.preview)),
    ),
    stroke:
      stroke >= strokeRange.min &&
      stroke <= strokeRange.max &&
      Number.isInteger(stroke / strokeRange.step)
        ? stroke
        : defaultIconsState.stroke,
    color:
      colorTokens.includes(color as ColorToken) || /^[0-9a-f]{6}$/.test(color)
        ? color
        : defaultIconsState.color,
    icon: slugPattern.test(icon) ? icon : undefined,
    variant: variants.includes(params.get("variant") ?? "")
      ? (params.get("variant") as IconVariant)
      : undefined,
    size: integerIn(params.get("size"), sizeRange.min, sizeRange.max, defaultIconsState.size),
    dir: oneOf(params.get("dir"), ["ltr", "rtl"], defaultIconsState.dir),
  };
}

export function parseLogosState(params: URLSearchParams): LogosState {
  const logo = params.get("logo") ?? "";
  const collection = params.get("collection") ?? "";
  return {
    q: query(params.get("q")),
    collection: slugPattern.test(collection) ? collection : "",
    licenses: listOf(params.get("license"), licenseClassIds),
    kinds: listOf(params.get("kind"), variantKindIds),
    bg: oneOf(
      params.get("bg"),
      backgroundModes.map(({ value }) => value),
      defaultLogosState.bg,
    ),
    logo: slugPattern.test(logo) ? logo : undefined,
  };
}

/**
 * The full state for a query string. The page that is not in the URL gets its defaults; callers
 * that already hold state for it (back and forward navigation) keep their own.
 */
export function parseAppState(search: string): AppState {
  const params = new URLSearchParams(search);
  const page = oneOf<Page>(params.get("page"), ["icons", "logos"], "icons");
  return {
    page,
    theme: oneOf<Theme>(params.get("theme"), ["system", "light", "dark"], "system"),
    icons: page === "icons" ? parseIconsState(params) : defaultIconsState,
    logos: page === "logos" ? parseLogosState(params) : defaultLogosState,
  };
}

/** A query string for the current page, defaults omitted, in a stable parameter order. */
export function serializeAppState(state: AppState): string {
  const params = new URLSearchParams();
  const set = (name: string, value: string | number | undefined, fallback?: string | number) => {
    if (value !== undefined && value !== "" && value !== fallback) params.set(name, String(value));
  };
  if (state.page === "logos") {
    const { logos } = state;
    params.set("page", "logos");
    set("q", logos.q.trim());
    set("collection", logos.collection);
    set("license", listOf(logos.licenses.join(","), licenseClassIds).join(","));
    set("kind", listOf(logos.kinds.join(","), variantKindIds).join(","));
    set("bg", logos.bg, defaultLogosState.bg);
    set("logo", logos.logo);
  } else {
    const { icons } = state;
    const defaults = defaultIconsState;
    set("q", icons.q.trim());
    set("category", icons.category);
    set("variants", icons.variants, defaults.variants);
    set("direction", icons.directionality, defaults.directionality);
    set("shape", icons.shape, defaults.shape);
    set("preview", icons.preview, defaults.preview);
    set("stroke", icons.stroke, defaults.stroke);
    set("color", icons.color, defaults.color);
    set("icon", icons.icon);
    set(
      "variant",
      icons.variant === iconSystem.architecture.defaultVariant ? undefined : icons.variant,
    );
    set("size", icons.size, defaults.size);
    set("dir", icons.dir, defaults.dir);
  }
  set("theme", state.theme, defaultAppState.theme);
  const search = params.toString().replace(/%2C/g, ",");
  return search ? `?${search}` : "";
}

/**
 * State after back or forward navigation: the URL's page and theme, and that page's parameters;
 * the other page keeps what it had in memory.
 */
export function mergeNavigation(current: AppState, next: AppState): AppState {
  return {
    page: next.page,
    theme: next.theme,
    icons: next.page === "icons" ? next.icons : current.icons,
    logos: next.page === "logos" ? next.logos : current.logos,
  };
}
