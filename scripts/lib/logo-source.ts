import { DOMParser, type Element, Node } from "@xmldom/xmldom";
import { logoIdMarker } from "../../src/runtime/render-logo.js";
import type { LogoNode, LogoNodeProps, LogoPropValue } from "../../src/types/logo.js";

/**
 * Converts one brand-logo SVG file into the compact element tree that `renderLogo` renders.
 *
 * The goal is fidelity: the rendered component must look exactly like the source file. So every
 * element and attribute that can affect rendering is kept with its exact value, and only what
 * cannot render is dropped:
 *
 * - comments, the XML declaration and DOCTYPE (internal entities are expanded first), `<title>`,
 *   `<desc>`, `<metadata>`, elements and attributes from other namespaces (Inkscape, Sodipodi,
 *   RDF, Illustrator), `data-*`, and attribute names that are not SVG (JSX-style `fillOpacity`
 *   in a file is ignored by every renderer, so it must not become React's `fillOpacity`);
 * - accessibility metadata (`role`, `aria-*`, `focusable`, `tabindex`): the component applies the
 *   package's accessibility contract and the caller names the logo;
 * - the root's `width`, `height`, `x`, `y` and layout CSS (`width`, `margin`, `display`, …), because
 *   the component owns the box; and the root's `overflow`, so artwork never paints outside it.
 *
 * `<style>` sheets are inlined: each element gets the declarations that win the cascade (importance,
 * origin, specificity, order) as its inline style, because CSS in inline SVG applies to the whole
 * page and would leak between logos. `class` is dropped afterwards. Media queries cannot be inlined
 * and are dropped (the default, light rendering is kept), as are `@font-face` and `@import`.
 *
 * Every referenced id is renamed to `logoIdMarker + <local>` and every reference (`url(#…)` in
 * attributes and styles, `href`/`xlink:href="#…"`) follows, so the runtime can make ids unique per
 * rendered instance. Unreferenced ids are dropped. `xlink:href` becomes `href`.
 *
 * A drawing with no colour at all (no paint other than `currentColor`/`none`, no gradients,
 * patterns, masks, filters or images) renders black; it gets `fill="currentColor"` on the root so
 * it follows the text colour. Artwork with colours is never recoloured.
 */

export class LogoSourceError extends Error {}

export type ConvertedLogoSvg = {
  readonly viewBox: readonly [number, number, number, number];
  /** Root `<svg>` props by React name, without `viewBox`, `xmlns`, `width` and `height`. */
  readonly props: LogoNodeProps | undefined;
  readonly children: readonly LogoNode[];
  /** Number of instance-scoped ids. */
  readonly ids: number;
  /** The drawing has no colour of its own, so it renders in `currentColor`. */
  readonly monochrome: boolean;
  /** Intrinsic `width / height` from the root's `width` and `height`, when both are lengths. */
  readonly intrinsicSize: readonly [number, number] | undefined;
  /** What the conversion dropped or changed that could be visible somewhere. */
  readonly notes: readonly string[];
  /** Attribute names dropped as non-rendering, for auditing. */
  readonly droppedAttributes: readonly string[];
};

const svgNamespace = "http://www.w3.org/2000/svg";
const xlinkNamespace = "http://www.w3.org/1999/xlink";
const xmlNamespace = "http://www.w3.org/XML/1998/namespace";

// ---------------------------------------------------------------------------------------------
// Elements and attributes

const filterPrimitives = [
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
];

/** SVG elements that render or are referenced by something that renders. */
const renderedElements = new Set([
  "svg",
  "g",
  "defs",
  "symbol",
  "use",
  "switch",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "textPath",
  "image",
  "linearGradient",
  "radialGradient",
  "stop",
  "pattern",
  "clipPath",
  "mask",
  "marker",
  "filter",
  ...filterPrimitives,
]);

/** SVG elements that never render; `<style>` is consumed by inlining. */
const droppedElements = new Set(["title", "desc", "metadata", "style", "script"]);

const textElements = new Set(["text", "tspan", "textPath"]);

/** Elements whose presence means the drawing has colour (or depends on it) beyond plain paint. */
const colourElements = new Set([
  "image",
  "linearGradient",
  "radialGradient",
  "pattern",
  "mask",
  "filter",
  ...filterPrimitives,
]);

/** Presentation attributes: SVG 1.1, SVG 2, CSS Masking and Compositing. */
const presentationAttributes = [
  "alignment-baseline",
  "baseline-shift",
  "clip",
  "clip-path",
  "clip-rule",
  "color",
  "color-interpolation",
  "color-interpolation-filters",
  "color-profile",
  "color-rendering",
  "cursor",
  "direction",
  "display",
  "dominant-baseline",
  "enable-background",
  "fill",
  "fill-opacity",
  "fill-rule",
  "filter",
  "flood-color",
  "flood-opacity",
  "font",
  "font-family",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "glyph-orientation-horizontal",
  "glyph-orientation-vertical",
  "image-rendering",
  "isolation",
  "kerning",
  "letter-spacing",
  "lighting-color",
  "marker",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "mask-type",
  "mix-blend-mode",
  "opacity",
  "overflow",
  "paint-order",
  "pointer-events",
  "shape-rendering",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "text-anchor",
  "text-decoration",
  "text-rendering",
  "transform",
  "transform-origin",
  "unicode-bidi",
  "vector-effect",
  "visibility",
  "white-space",
  "word-spacing",
  "writing-mode",
];

/** Geometry and element attributes, with their exact (case-sensitive) SVG names. */
const elementAttributes = [
  "x",
  "y",
  "width",
  "height",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "fr",
  "fx",
  "fy",
  "x1",
  "y1",
  "x2",
  "y2",
  "d",
  "points",
  "pathLength",
  "viewBox",
  "preserveAspectRatio",
  "gradientUnits",
  "gradientTransform",
  "spreadMethod",
  "offset",
  "href",
  "patternUnits",
  "patternContentUnits",
  "patternTransform",
  "clipPathUnits",
  "maskUnits",
  "maskContentUnits",
  "markerUnits",
  "markerWidth",
  "markerHeight",
  "refX",
  "refY",
  "orient",
  "filterUnits",
  "primitiveUnits",
  "in",
  "in2",
  "result",
  "stdDeviation",
  "edgeMode",
  "type",
  "values",
  "mode",
  "operator",
  "k1",
  "k2",
  "k3",
  "k4",
  "dx",
  "dy",
  "tableValues",
  "slope",
  "intercept",
  "amplitude",
  "exponent",
  "order",
  "kernelMatrix",
  "divisor",
  "bias",
  "targetX",
  "targetY",
  "kernelUnitLength",
  "preserveAlpha",
  "surfaceScale",
  "diffuseConstant",
  "specularConstant",
  "specularExponent",
  "limitingConeAngle",
  "azimuth",
  "elevation",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "z",
  "baseFrequency",
  "numOctaves",
  "seed",
  "stitchTiles",
  "scale",
  "xChannelSelector",
  "yChannelSelector",
  "radius",
  "crossorigin",
  "rotate",
  "textLength",
  "lengthAdjust",
  "startOffset",
  "method",
  "spacing",
  "side",
  "path",
  "systemLanguage",
  "requiredExtensions",
  "requiredFeatures",
  "lang",
  "xml:space",
  "xml:lang",
];

const renderedAttributes = new Set([...presentationAttributes, ...elementAttributes]);

/**
 * React prop names for SVG attributes whose React spelling differs, from React DOM's alias table.
 * Every other kept attribute is passed to React under its own name, which React renders verbatim.
 */
const reactAttributeNames = new Map([
  ["alignment-baseline", "alignmentBaseline"],
  ["baseline-shift", "baselineShift"],
  ["clip-path", "clipPath"],
  ["clip-rule", "clipRule"],
  ["color-interpolation", "colorInterpolation"],
  ["color-interpolation-filters", "colorInterpolationFilters"],
  ["color-profile", "colorProfile"],
  ["color-rendering", "colorRendering"],
  ["crossorigin", "crossOrigin"],
  ["dominant-baseline", "dominantBaseline"],
  ["enable-background", "enableBackground"],
  ["fill-opacity", "fillOpacity"],
  ["fill-rule", "fillRule"],
  ["flood-color", "floodColor"],
  ["flood-opacity", "floodOpacity"],
  ["font-family", "fontFamily"],
  ["font-size", "fontSize"],
  ["font-size-adjust", "fontSizeAdjust"],
  ["font-stretch", "fontStretch"],
  ["font-style", "fontStyle"],
  ["font-variant", "fontVariant"],
  ["font-weight", "fontWeight"],
  ["glyph-orientation-horizontal", "glyphOrientationHorizontal"],
  ["glyph-orientation-vertical", "glyphOrientationVertical"],
  ["image-rendering", "imageRendering"],
  ["letter-spacing", "letterSpacing"],
  ["lighting-color", "lightingColor"],
  ["marker-end", "markerEnd"],
  ["marker-mid", "markerMid"],
  ["marker-start", "markerStart"],
  ["mask-type", "maskType"],
  ["paint-order", "paintOrder"],
  ["pointer-events", "pointerEvents"],
  ["shape-rendering", "shapeRendering"],
  ["stop-color", "stopColor"],
  ["stop-opacity", "stopOpacity"],
  ["stroke-dasharray", "strokeDasharray"],
  ["stroke-dashoffset", "strokeDashoffset"],
  ["stroke-linecap", "strokeLinecap"],
  ["stroke-linejoin", "strokeLinejoin"],
  ["stroke-miterlimit", "strokeMiterlimit"],
  ["stroke-opacity", "strokeOpacity"],
  ["stroke-width", "strokeWidth"],
  ["text-anchor", "textAnchor"],
  ["text-decoration", "textDecoration"],
  ["text-rendering", "textRendering"],
  ["transform-origin", "transformOrigin"],
  ["unicode-bidi", "unicodeBidi"],
  ["vector-effect", "vectorEffect"],
  ["word-spacing", "wordSpacing"],
  ["writing-mode", "writingMode"],
  ["xml:lang", "xmlLang"],
  ["xml:space", "xmlSpace"],
]);

/** Attributes whose value is a list of numbers or commands, where whitespace runs are separators. */
const numericListAttributes = new Set([
  "d",
  "points",
  "transform",
  "gradientTransform",
  "patternTransform",
  "values",
  "kernelMatrix",
  "tableValues",
]);

/** Root attributes the component owns or that do nothing on an outermost `<svg>`. */
const rootOwnedAttributes = new Set(["width", "height", "x", "y", "viewBox", "overflow"]);

/**
 * Root CSS properties that size or place the box in a page rather than draw the artwork. The
 * component owns the box, and `overflow` is dropped so artwork never paints outside it.
 */
const rootLayoutProperties =
  /^(?:width|height|(?:min|max)-(?:width|height)|margin(?:-.+)?|padding(?:-.+)?|flex(?:-.+)?|display|position|top|right|bottom|left|inset(?:-.+)?|float|z-index|vertical-align|line-height|box-sizing|cursor|transition(?:-.+)?|animation(?:-.+)?|pointer-events|user-select|overflow(?:-[xy])?|enable-background|transform|transform-origin|transform-box)$/;

/** Paint properties: when every value is one of `neutralPaint`, the drawing has no colour. */
const paintProperties = new Set([
  "fill",
  "stroke",
  "stop-color",
  "flood-color",
  "lighting-color",
  "color",
  "solid-color",
  "background",
  "background-color",
]);
const neutralPaint = new Set([
  "none",
  "currentcolor",
  "inherit",
  "transparent",
  "initial",
  "unset",
]);

// ---------------------------------------------------------------------------------------------
// DOCTYPE and entities

const predefinedEntities = new Set(["amp", "lt", "gt", "quot", "apos"]);

/**
 * Removes the DOCTYPE, expanding the general entities its internal subset declares (Illustrator
 * declares namespace URIs as `&ns_svg;` and friends). External entities are not resolved.
 */
export function expandDoctype(source: string): string {
  const text = source.replace(/^﻿/, "");
  const doctype = /<!DOCTYPE\b[^[>]*(?:\[([\s\S]*?)\]\s*)?>/i.exec(text);
  if (!doctype) return text;
  const entities = new Map<string, string>();
  for (const [, name, double, single] of (doctype[1] ?? "").matchAll(
    /<!ENTITY\s+([A-Za-z_:][\w.:-]*)\s+(?:"([^"]*)"|'([^']*)')\s*>/g,
  )) {
    if (name && !predefinedEntities.has(name) && !entities.has(name)) {
      entities.set(name, double ?? single ?? "");
    }
  }
  let body = text.slice(0, doctype.index) + text.slice(doctype.index + doctype[0].length);
  if (entities.size > 0) {
    const expand = (value: string, depth: number): string =>
      value.replace(/&([A-Za-z_:][\w.:-]*);/g, (reference, name: string) => {
        const replacement = entities.get(name);
        if (replacement === undefined) return reference;
        if (depth > 8) throw new LogoSourceError(`Entity &${name}; nests too deeply.`);
        return expand(replacement, depth + 1);
      });
    body = expand(body, 0);
  }
  return body;
}

// ---------------------------------------------------------------------------------------------
// CSS

type Declaration = { readonly property: string; readonly value: string; readonly important: boolean };

type AttributeTest = {
  readonly name: string;
  readonly operator: string | undefined;
  readonly value: string | undefined;
};

type Compound = {
  readonly tag: string | undefined;
  readonly ids: readonly string[];
  readonly classes: readonly string[];
  readonly attributes: readonly AttributeTest[];
};

type SelectorPart = { readonly combinator: string; readonly compound: Compound };

type Selector = {
  /** Right-most compound last; `combinator` joins a part to the one before it. */
  readonly parts: readonly SelectorPart[];
  readonly specificity: number;
};

type Rule = {
  readonly selectors: readonly Selector[];
  readonly declarations: readonly Declaration[];
  readonly order: number;
};

/** Splits on `separator` outside strings, parentheses and brackets. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(" || char === "[") depth += 1;
    else if ((char === ")" || char === "]") && depth > 0) depth -= 1;
    else if (char === separator && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/** Parses a declaration block or `style` attribute. Invalid declarations are skipped, as in CSS. */
export function parseDeclarations(text: string): Declaration[] {
  const declarations: Declaration[] = [];
  for (const part of splitTopLevel(text, ";")) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    const property = part.slice(0, colon).trim().toLowerCase();
    let value = part.slice(colon + 1).trim();
    if (!/^-?-?[a-z_][a-z0-9_-]*$/.test(property)) continue;
    const important = /!\s*important\s*$/i.test(value);
    if (important) value = value.replace(/!\s*important\s*$/i, "").trim();
    if (value === "") continue;
    declarations.push({ property, value, important });
  }
  return declarations;
}

class UnsupportedSelector extends Error {}

const identifier = "-?(?:[_a-zA-Z\\u00A0-\\uFFFF]|--)[\\w\\u00A0-\\uFFFF-]*";
const selectorToken = new RegExp(
  [
    "\\s*([>+~])\\s*", // 1 combinator
    "(\\s+)", // 2 descendant
    `(\\*|${identifier})`, // 3 type
    `\\.(${identifier})`, // 4 class
    "#([\\w\\u00A0-\\uFFFF-]+)", // 5 id
    `\\[\\s*(${identifier}(?:\\|${identifier})?)\\s*(?:([~|^$*]?=)\\s*("[^"]*"|'[^']*'|${identifier}|[^\\]\\s]+)\\s*)?\\]`, // 6-8 attribute
    "(::?[\\w-]+(?:\\([^)]*\\))?)", // 9 pseudo
  ].join("|"),
  "y",
);

/**
 * Parses one selector. Returns `undefined` for invalid syntax, which drops the rule as browsers do;
 * throws for valid selectors this converter cannot match (pseudo-classes, escapes).
 */
function parseSelector(text: string): Selector | undefined {
  const source = text.trim();
  if (source === "") return undefined;
  if (source.includes("\\")) throw new UnsupportedSelector(`escaped selector ${source}`);
  const parts: SelectorPart[] = [];
  let compound = { tag: undefined as string | undefined, ids: [] as string[], classes: [] as string[], attributes: [] as AttributeTest[] };
  let empty = true;
  let combinator = "";
  let specificity = 0;
  selectorToken.lastIndex = 0;
  const finish = () => {
    if (empty) return false;
    parts.push({ combinator, compound });
    compound = { tag: undefined, ids: [], classes: [], attributes: [] };
    empty = true;
    return true;
  };
  while (selectorToken.lastIndex < source.length) {
    const match = selectorToken.exec(source);
    if (!match) return undefined;
    const [, joiner, space, tag, className, id, attribute, operator, rawValue, pseudo] = match;
    if (joiner || space) {
      if (!finish()) return undefined;
      combinator = joiner ?? " ";
    } else if (tag) {
      if (!empty) return undefined;
      compound.tag = tag === "*" ? undefined : tag;
      if (tag !== "*") specificity += 1;
      empty = false;
    } else if (className) {
      compound.classes.push(className);
      specificity += 1_000;
      empty = false;
    } else if (id) {
      compound.ids.push(id);
      specificity += 1_000_000;
      empty = false;
    } else if (attribute) {
      const value = rawValue?.replace(/^(["'])(.*)\1$/, "$2");
      compound.attributes.push({ name: attribute, operator, value });
      specificity += 1_000;
      empty = false;
    } else if (pseudo) {
      throw new UnsupportedSelector(`pseudo-class ${pseudo} in ${source}`);
    }
  }
  if (!finish()) return undefined;
  return { parts, specificity };
}

/** Skips a balanced `{…}` block starting at `open`; returns the index after its `}`. */
function skipBlock(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return text.length;
}

/** Parses a `<style>` sheet into rules; `notes` records at-rules and selectors that were dropped. */
export function parseStylesheet(css: string, firstOrder: number, notes: string[]): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/<!--|-->/g, " ");
  const rules: Rule[] = [];
  let index = 0;
  let order = firstOrder;
  while (index < text.length) {
    while (index < text.length && /\s/.test(text[index] ?? "")) index += 1;
    if (index >= text.length) break;
    if (text[index] === "@") {
      const name = /^@[\w-]+/.exec(text.slice(index))?.[0] ?? "@";
      const brace = text.indexOf("{", index);
      const semicolon = text.indexOf(";", index);
      if (brace >= 0 && (semicolon < 0 || brace < semicolon)) {
        const end = skipBlock(text, brace);
        notes.push(`dropped CSS ${name} block: ${text.slice(index, brace).trim()}`);
        index = end;
      } else {
        if (!/^@(?:charset|namespace)$/i.test(name)) notes.push(`dropped CSS ${name} rule`);
        index = semicolon < 0 ? text.length : semicolon + 1;
      }
      continue;
    }
    const open = text.indexOf("{", index);
    if (open < 0) break;
    const end = skipBlock(text, open);
    const selectorText = text.slice(index, open);
    const body = text.slice(open + 1, end - 1);
    index = end;
    const selectors: Selector[] = [];
    let valid = true;
    for (const part of splitTopLevel(selectorText, ",")) {
      const selector = parseSelector(part);
      if (!selector) valid = false;
      else selectors.push(selector);
    }
    if (!valid) {
      notes.push(`dropped CSS rule with an invalid selector: ${selectorText.trim()}`);
      continue;
    }
    rules.push({ selectors, declarations: parseDeclarations(body), order: order++ });
  }
  return rules;
}

function elementChildren(element: Element): Element[] {
  const children: Element[] = [];
  for (let node = element.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === Node.ELEMENT_NODE) children.push(node as Element);
  }
  return children;
}

function previousElement(element: Element): Element | undefined {
  for (let node = element.previousSibling; node; node = node.previousSibling) {
    if (node.nodeType === Node.ELEMENT_NODE) return node as Element;
  }
  return undefined;
}

function parentElement(element: Element): Element | undefined {
  const parent = element.parentNode;
  return parent && parent.nodeType === Node.ELEMENT_NODE ? (parent as Element) : undefined;
}

function matchesCompound(element: Element, compound: Compound): boolean {
  if (compound.tag !== undefined && element.localName !== compound.tag) return false;
  for (const id of compound.ids) if (element.getAttribute("id") !== id) return false;
  if (compound.classes.length > 0) {
    const classes = new Set((element.getAttribute("class") ?? "").split(/\s+/));
    for (const name of compound.classes) if (!classes.has(name)) return false;
  }
  for (const { name, operator, value } of compound.attributes) {
    if (!element.hasAttribute(name)) return false;
    const actual = element.getAttribute(name) ?? "";
    if (operator === undefined || value === undefined) continue;
    const ok =
      operator === "="
        ? actual === value
        : operator === "~="
          ? actual.split(/\s+/).includes(value)
          : operator === "|="
            ? actual === value || actual.startsWith(`${value}-`)
            : operator === "^="
              ? value !== "" && actual.startsWith(value)
              : operator === "$="
                ? value !== "" && actual.endsWith(value)
                : value !== "" && actual.includes(value);
    if (!ok) return false;
  }
  return true;
}

function matchesFrom(element: Element, parts: readonly SelectorPart[], index: number): boolean {
  const part = parts[index];
  if (!part || !matchesCompound(element, part.compound)) return false;
  if (index === 0) return true;
  switch (part.combinator) {
    case ">": {
      const parent = parentElement(element);
      return parent !== undefined && matchesFrom(parent, parts, index - 1);
    }
    case "+": {
      const previous = previousElement(element);
      return previous !== undefined && matchesFrom(previous, parts, index - 1);
    }
    case "~": {
      for (let sibling = previousElement(element); sibling; sibling = previousElement(sibling)) {
        if (matchesFrom(sibling, parts, index - 1)) return true;
      }
      return false;
    }
    default: {
      for (let ancestor = parentElement(element); ancestor; ancestor = parentElement(ancestor)) {
        if (matchesFrom(ancestor, parts, index - 1)) return true;
      }
      return false;
    }
  }
}

/** The declarations that win the cascade for one element, lowest priority first. */
function cascade(element: Element, rules: readonly Rule[]): Map<string, string> {
  type Entry = Declaration & { readonly key: readonly number[] };
  const entries: Entry[] = [];
  let sequence = 0;
  for (const rule of rules) {
    let specificity = -1;
    for (const selector of rule.selectors) {
      if (selector.specificity > specificity && matchesFrom(element, selector.parts, selector.parts.length - 1)) {
        specificity = selector.specificity;
      }
    }
    if (specificity < 0) continue;
    for (const declaration of rule.declarations) {
      entries.push({ ...declaration, key: [declaration.important ? 1 : 0, 0, specificity, rule.order, sequence++] });
    }
  }
  const inline = element.getAttribute("style");
  if (inline) {
    for (const declaration of parseDeclarations(inline)) {
      entries.push({ ...declaration, key: [declaration.important ? 1 : 0, 1, 0, 0, sequence++] });
    }
  }
  entries.sort((left, right) => {
    for (let index = 0; index < left.key.length; index += 1) {
      const difference = (left.key[index] ?? 0) - (right.key[index] ?? 0);
      if (difference !== 0) return difference;
    }
    return 0;
  });
  const style = new Map<string, string>();
  for (const { property, value } of entries) {
    style.delete(property);
    style.set(property, value);
  }
  return style;
}

// ---------------------------------------------------------------------------------------------
// Draft tree

type Draft = {
  readonly tag: string;
  readonly attributes: Map<string, string>;
  readonly style: Map<string, string>;
  id: string | undefined;
  readonly children: (Draft | string)[];
};

function isSvgElement(element: Element, rootNamespace: string | null): boolean {
  return element.namespaceURI === svgNamespace || (rootNamespace === null && element.namespaceURI === null);
}

/** The attribute's SVG name, or `undefined` when it cannot affect rendering. */
function svgAttributeName(namespace: string | null, name: string, localName: string): string | undefined {
  if (namespace === xlinkNamespace) return localName === "href" ? "xlink:href" : undefined;
  if (namespace === xmlNamespace) return localName === "space" || localName === "lang" ? `xml:${localName}` : undefined;
  if (namespace !== null || name.includes(":")) return undefined;
  return renderedAttributes.has(name) ? name : undefined;
}

type Conversion = {
  readonly rules: readonly Rule[];
  readonly rootNamespace: string | null;
  readonly idOwners: ReadonlyMap<string, Element>;
  readonly keptIds: Map<string, Draft>;
  readonly dropped: Set<string>;
  readonly notes: string[];
};

function convertElement(element: Element, context: Conversion): Draft {
  const attributes = new Map<string, string>();
  let xlinkHref: string | undefined;
  for (const attribute of Array.from(element.attributes)) {
    const { namespaceURI, name, localName, value } = attribute;
    if (namespaceURI === null && (name === "id" || name === "class" || name === "style")) continue;
    const svgName = svgAttributeName(namespaceURI, name, localName ?? name);
    if (svgName === undefined) {
      if (!name.startsWith("xmlns")) context.dropped.add(name);
      continue;
    }
    if (svgName === "xlink:href") xlinkHref = value;
    else attributes.set(svgName, value);
  }
  if (xlinkHref !== undefined && !attributes.has("href")) attributes.set("href", xlinkHref);

  const id = element.getAttribute("id") ?? undefined;
  const draft: Draft = {
    tag: element.localName ?? element.tagName,
    attributes,
    style: cascade(element, context.rules),
    id: undefined,
    children: [],
  };
  if (id !== undefined && context.idOwners.get(id) === element) {
    draft.id = id;
    context.keptIds.set(id, draft);
  }

  const inText = textElements.has(draft.tag);
  for (let node = element.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as Element;
      if (!isSvgElement(child, context.rootNamespace)) continue;
      const tag = child.localName ?? child.tagName;
      if (droppedElements.has(tag)) continue;
      if (!renderedElements.has(tag)) throw new LogoSourceError(`Unsupported element <${tag}>.`);
      draft.children.push(convertElement(child, context));
    } else if (
      inText &&
      (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE)
    ) {
      const text = node.nodeValue ?? "";
      const last = draft.children.at(-1);
      if (typeof last === "string") draft.children[draft.children.length - 1] = last + text;
      else if (text !== "") draft.children.push(text);
    }
  }
  return draft;
}

function walkDrafts(draft: Draft, visit: (draft: Draft) => void): void {
  visit(draft);
  for (const child of draft.children) if (typeof child !== "string") walkDrafts(child, visit);
}

// ---------------------------------------------------------------------------------------------
// Ids and references

const urlReference = /url\(\s*(?:"#([^"]*)"|'#([^']*)'|#([^)\s'"]*))\s*\)/g;

function referencedIds(value: string, found: (id: string) => void): void {
  for (const match of value.matchAll(urlReference)) found(match[1] ?? match[2] ?? match[3] ?? "");
}

function rewriteReferences(value: string, local: (id: string) => string): string {
  return value.replace(urlReference, (_reference, double, single, bare) => `url(#${local(double ?? single ?? bare ?? "")})`);
}

// ---------------------------------------------------------------------------------------------
// Root and viewBox

const lengthUnits: Readonly<Record<string, number>> = {
  "": 1,
  px: 1,
  pt: 4 / 3,
  pc: 16,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96,
  em: 16,
  ex: 8,
};

/** A length attribute in user units (pixels); `undefined` for percentages, `auto` and junk. */
function parseLength(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(value);
  const factor = match ? lengthUnits[(match[2] ?? "").toLowerCase()] : undefined;
  if (!match || factor === undefined) return undefined;
  const length = Number(match[1]) * factor;
  return Number.isFinite(length) && length > 0 ? length : undefined;
}

function parseViewBox(value: string | null | undefined): [number, number, number, number] | undefined {
  if (!value) return undefined;
  const numbers = value.trim().split(/[\s,]+/).map(Number);
  if (numbers.length !== 4 || !numbers.every(Number.isFinite)) return undefined;
  const [minX = 0, minY = 0, width = 0, height = 0] = numbers;
  return width > 0 && height > 0 ? [minX, minY, width, height] : undefined;
}

// ---------------------------------------------------------------------------------------------
// Emission

/** React style property name for a CSS property. */
export function reactStyleName(property: string): string {
  if (property.startsWith("--")) return property;
  const name = property.startsWith("-ms-") ? property.slice(1) : property;
  return name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function emitProps(draft: Draft): LogoNodeProps | null {
  const props: Record<string, LogoPropValue> = {};
  const entries: [string, LogoPropValue][] = [];
  for (const [name, raw] of draft.attributes) {
    const value = numericListAttributes.has(name) ? raw.replace(/\s+/g, " ").trim() : raw;
    entries.push([reactAttributeNames.get(name) ?? name, value]);
  }
  if (draft.id !== undefined) entries.push(["id", draft.id]);
  if (draft.style.size > 0) {
    const style: Record<string, string> = {};
    for (const [property, value] of draft.style) style[reactStyleName(property)] = value;
    entries.push(["style", style]);
  }
  if (entries.length === 0) return null;
  entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  for (const [name, value] of entries) props[name] = value;
  return props;
}

function emitNode(draft: Draft): LogoNode {
  const children = draft.children.map((child) => (typeof child === "string" ? child : emitNode(child)));
  return [draft.tag, emitProps(draft), ...children];
}

// ---------------------------------------------------------------------------------------------

function parseDocument(text: string): Element {
  const errors: string[] = [];
  let root: Element | null = null;
  try {
    root = new DOMParser({
      onError: (level, message) => {
        if (level !== "warning") errors.push(message);
      },
    }).parseFromString(text, "image/svg+xml").documentElement;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (errors.length > 0) throw new LogoSourceError(`Invalid XML: ${errors.join("; ")}`);
  if (!root || root.localName !== "svg") throw new LogoSourceError("The root element is not <svg>.");
  if (root.namespaceURI !== svgNamespace && root.namespaceURI !== null) {
    throw new LogoSourceError(`The root <svg> is in namespace ${root.namespaceURI}.`);
  }
  return root;
}

/** Converts one SVG source. Throws {@link LogoSourceError} when it cannot be converted faithfully. */
export function convertLogoSvg(source: string): ConvertedLogoSvg {
  const root = parseDocument(expandDoctype(source));
  const rootNamespace = root.namespaceURI;
  const notes: string[] = [];

  // Style sheets and the first owner of each id, both over the whole document.
  const rules: Rule[] = [];
  const idOwners = new Map<string, Element>();
  const scan = (element: Element, inSvg: boolean) => {
    const svg = inSvg && isSvgElement(element, rootNamespace);
    const id = element.getAttribute("id");
    if (id !== null && !idOwners.has(id)) idOwners.set(id, element);
    if (svg && element.localName === "style") {
      try {
        rules.push(...parseStylesheet(element.textContent ?? "", rules.length, notes));
      } catch (error) {
        if (error instanceof UnsupportedSelector) {
          throw new LogoSourceError(`Unsupported CSS: ${error.message}.`);
        }
        throw error;
      }
    }
    for (const child of elementChildren(element)) scan(child, svg);
  };
  scan(root, true);

  const context: Conversion = {
    rules,
    rootNamespace,
    idOwners,
    keptIds: new Map(),
    dropped: new Set(),
    notes,
  };
  const draft = convertElement(root, context);

  // viewBox, derived from width and height when missing.
  const width = parseLength(root.getAttribute("width"));
  const height = parseLength(root.getAttribute("height"));
  let viewBox = parseViewBox(root.getAttribute("viewBox"));
  if (!viewBox) {
    if (width === undefined || height === undefined) {
      throw new LogoSourceError("The root has no valid viewBox and no width and height to derive one from.");
    }
    viewBox = [0, 0, width, height];
    notes.push(`derived viewBox 0 0 ${width} ${height} from width and height`);
  }
  for (const name of rootOwnedAttributes) {
    if (name === "overflow" && draft.attributes.has(name)) notes.push(`dropped root overflow="${draft.attributes.get(name)}"`);
    draft.attributes.delete(name);
  }
  for (const property of [...draft.style.keys()]) {
    if (rootLayoutProperties.test(property)) {
      if (property !== "enable-background") notes.push(`dropped root style ${property}: ${draft.style.get(property)}`);
      draft.style.delete(property);
    }
  }

  // Ids: keep referenced ones, renamed in document order; references to missing ids stay dangling
  // but scoped, so they can never resolve to another logo's element.
  const references = new Set<string>();
  walkDrafts(draft, (node) => {
    for (const [name, value] of node.attributes) {
      if (name === "href") {
        if (value.startsWith("#")) references.add(value.slice(1));
        else if (!value.startsWith("data:")) notes.push(`external href ${value.slice(0, 80)}`);
      } else referencedIds(value, (id) => references.add(id));
    }
    for (const value of node.style.values()) referencedIds(value, (id) => references.add(id));
  });
  const locals = new Map<string, string>();
  const local = (id: string) => {
    let name = locals.get(id);
    if (name === undefined) {
      name = locals.size.toString(36);
      locals.set(id, name);
    }
    return `${logoIdMarker}${name}`;
  };
  walkDrafts(draft, (node) => {
    if (node.id === undefined) return;
    node.id = references.has(node.id) ? local(node.id) : undefined;
  });
  walkDrafts(draft, (node) => {
    for (const [name, value] of node.attributes) {
      if (name === "href" && value.startsWith("#")) node.attributes.set(name, `#${local(value.slice(1))}`);
      else if (value.includes("url(")) node.attributes.set(name, rewriteReferences(value, local));
    }
    for (const [property, value] of node.style) {
      if (value.includes("url(")) node.style.set(property, rewriteReferences(value, local));
    }
  });

  // No colour of its own: follow the text colour.
  let monochrome = true;
  walkDrafts(draft, (node) => {
    if (colourElements.has(node.tag)) monochrome = false;
    for (const [name, value] of node.attributes) {
      if (paintProperties.has(name) && !neutralPaint.has(value.trim().toLowerCase())) monochrome = false;
    }
    for (const [property, value] of node.style) {
      if (paintProperties.has(property) && !neutralPaint.has(value.trim().toLowerCase())) monochrome = false;
    }
  });
  if (monochrome && !draft.attributes.has("fill") && !draft.style.has("fill")) {
    draft.attributes.set("fill", "currentColor");
  }

  const node = emitNode(draft);
  const [, props, ...children] = node;
  return {
    viewBox,
    props: props ?? undefined,
    children: children.filter((child): child is LogoNode => typeof child !== "string"),
    ids: locals.size,
    monochrome,
    intrinsicSize: width !== undefined && height !== undefined ? [width, height] : undefined,
    notes,
    droppedAttributes: [...context.dropped].sort(),
  };
}
