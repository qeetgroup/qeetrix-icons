import { createElement, type ReactElement, type ReactNode } from "react";
import type {
  LogoData,
  LogoNode,
  LogoNodeProps,
  LogoPropValue,
  LogoProps,
  LogoVariantData,
} from "../types/logo.js";

/** Default rendered logo height in pixels; matches the default icon size. */
export const defaultLogoHeight = 24;

/**
 * Marks instance-scoped ids in logo data: `"\u0001" + local` is an id, and `url(#\u0001a)` or
 * `#\u0001a` a reference to it. U+0001 cannot occur in XML text, so it never collides with artwork.
 */
export const logoIdMarker = "\u0001";

const svgNamespace = "http://www.w3.org/2000/svg";

const hasText = (value: string | undefined) => value !== undefined && value.trim() !== "";

/**
 * The id prefix for one rendered instance, from a `useId()` value. Characters outside
 * `[A-Za-z0-9_]` are escaped as `-<hex>-`, so the result is safe in `url(#…)` and `href="#…"`
 * whatever React's id format or `identifierPrefix`, and distinct ids stay distinct. Local ids never
 * contain `-`, so the final `-` separates the prefix from them.
 */
export function logoIdPrefix(uid: string): string {
  return `${uid.replace(/[^A-Za-z0-9_]/gu, (char) => `-${char.codePointAt(0)?.toString(16)}-`)}-`;
}

/** Elements without scoped ids never change, so each is built once and shared by every render. */
const sharedElements = new WeakMap<LogoNode, ReactElement>();
/** Whether a node or any descendant carries a scoped id or reference. */
const scopedNodes = new WeakMap<LogoNode, boolean>();
/** Shared root children of drawings without ids. */
const sharedChildren = new WeakMap<LogoVariantData, readonly ReactNode[]>();
/** Parsed elements of drawings whose children are JSON text, parsed on first render. */
const parsedChildren = new WeakMap<LogoVariantData, readonly LogoNode[]>();

/** A drawing's elements, parsing (once) the JSON text generated modules carry. */
export function logoVariantNodes(variant: LogoVariantData): readonly LogoNode[] {
  if (typeof variant.children !== "string") return variant.children;
  let nodes = parsedChildren.get(variant);
  if (!nodes) {
    nodes = JSON.parse(variant.children) as LogoNode[];
    parsedChildren.set(variant, nodes);
  }
  return nodes;
}

function valueIsScoped(value: LogoPropValue): boolean {
  if (typeof value === "string") return value.includes(logoIdMarker);
  for (const key in value) if (value[key]?.includes(logoIdMarker)) return true;
  return false;
}

function nodeIsScoped(node: LogoNode): boolean {
  let scoped = scopedNodes.get(node);
  if (scoped === undefined) {
    scoped = false;
    const props = node[1];
    if (props) for (const key in props) if (valueIsScoped(props[key] as LogoPropValue)) scoped = true;
    for (let index = 2; !scoped && index < node.length; index += 1) {
      const child = node[index] as LogoNode | string;
      if (typeof child !== "string" && nodeIsScoped(child)) scoped = true;
    }
    scopedNodes.set(node, scoped);
  }
  return scoped;
}

function scopeProps(props: LogoNodeProps, prefix: string): Record<string, LogoPropValue> {
  const scoped: Record<string, LogoPropValue> = {};
  for (const key in props) {
    const value = props[key] as LogoPropValue;
    if (typeof value === "string") {
      scoped[key] = value.includes(logoIdMarker) ? value.replaceAll(logoIdMarker, prefix) : value;
    } else if (valueIsScoped(value)) {
      const style: Record<string, string> = {};
      for (const property in value) {
        style[property] = (value[property] as string).replaceAll(logoIdMarker, prefix);
      }
      scoped[key] = style;
    } else {
      scoped[key] = value;
    }
  }
  return scoped;
}

/** Builds one element; `prefix` is set only for nodes that carry scoped ids. */
function buildNode(node: LogoNode, prefix: string | undefined): ReactElement {
  if (prefix === undefined || !nodeIsScoped(node)) {
    const shared = sharedElements.get(node);
    if (shared) return shared;
  }
  const scoped = prefix !== undefined && nodeIsScoped(node);
  const children: ReactNode[] = [];
  for (let index = 2; index < node.length; index += 1) {
    const child = node[index] as LogoNode | string;
    children.push(typeof child === "string" ? child : buildNode(child, scoped ? prefix : undefined));
  }
  const props = node[1];
  const element = createElement(
    node[0],
    props && scoped ? scopeProps(props, prefix) : props,
    ...children,
  );
  if (!scoped) sharedElements.set(node, element);
  return element;
}

function buildChildren(variant: LogoVariantData, prefix: string | undefined): readonly ReactNode[] {
  if (variant.scoped && prefix !== undefined) {
    return logoVariantNodes(variant).map((node) => buildNode(node, prefix));
  }
  let children = sharedChildren.get(variant);
  if (!children) {
    children = logoVariantNodes(variant).map((node) => buildNode(node, undefined));
    sharedChildren.set(variant, children);
  }
  return children;
}

const lengthPattern = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i;

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Scales a number of pixels or a CSS length such as `"2em"` by `factor`, keeping its unit.
 * Percentages and anything that is not a single length (such as `calc()`) cannot be scaled.
 */
export function scaleLogoLength(
  length: number | string,
  factor: number,
): number | string | undefined {
  if (typeof length === "number") return Number.isFinite(length) ? round(length * factor) : undefined;
  const match = lengthPattern.exec(length);
  if (!match || match[2] === "%") return undefined;
  return `${round(Number(match[1]) * factor)}${match[2]}`;
}

/** The drawing to render: the requested variant when the logo has it, otherwise the default. */
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
 * - `variant` selects the drawing (default: the logo's default variant); an unknown name falls back
 *   to the default.
 * - `height` defaults to 24 and `width` follows from the viewBox aspect ratio, keeping the unit of a
 *   CSS length. Given only `width`, `height` follows from it instead. A length that cannot be
 *   scaled (a percentage, `calc()`, …) leaves the other dimension unset, so CSS sizes it from the
 *   viewBox ratio.
 * - Unnamed logos are decorative: `aria-hidden="true"`, `focusable="false"`, no role. A non-empty
 *   `aria-label` or `aria-labelledby` exposes the logo as `role="img"` instead. Explicit props
 *   always win, and a caller `style` is merged over the artwork's root style.
 * - `uid` (from `useId()`) makes the ids of drawings with gradients, clip paths, masks, filters,
 *   or `<use>` targets unique per instance: every id becomes `<prefix><local>`, and every
 *   reference follows. Drawings without ids ignore it and share their elements across renders.
 */
export function renderLogo<V extends string>(
  data: LogoData<V>,
  props: LogoProps<V>,
  uid?: string,
): ReactElement {
  const { variant: requested, height: heightProp, width: widthProp, ...rest } = props;
  const variant = selectLogoVariant(data, requested);
  const [, , boxWidth, boxHeight] = variant.viewBox;
  const ratio = boxWidth / boxHeight;
  let height = heightProp;
  let width = widthProp;
  if (height === undefined && width !== undefined) height = scaleLogoLength(width, 1 / ratio);
  else {
    height ??= defaultLogoHeight;
    width ??= scaleLogoLength(height, ratio);
  }

  const prefix = variant.scoped ? logoIdPrefix(uid ?? "logo") : undefined;
  const artwork = variant.props && prefix ? scopeProps(variant.props, prefix) : variant.props;
  const named = hasText(rest["aria-label"]) || hasText(rest["aria-labelledby"]);
  const artworkStyle = artwork?.style;
  const style =
    typeof artworkStyle === "object" && rest.style ? { ...artworkStyle, ...rest.style } : undefined;

  return createElement(
    "svg",
    {
      xmlns: svgNamespace,
      viewBox: variant.viewBox.join(" "),
      ...artwork,
      ...rest,
      ...(style ? { style } : undefined),
      width,
      height,
      focusable: rest.focusable ?? false,
      "aria-hidden": rest["aria-hidden"] ?? (named ? undefined : true),
      role: rest.role ?? (named ? "img" : undefined),
    },
    ...buildChildren(variant, prefix),
  );
}
