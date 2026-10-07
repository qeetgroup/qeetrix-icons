import { DOMParser, type Document, Element, type Node, onWarningStopParsing } from "@xmldom/xmldom";
import { compareText } from "./diagnostics.js";

/**
 * Qeet Group's own logos.
 *
 * Every file is kept exactly as drawn, with its own colours, viewBox and proportions, at
 * `icons/brand-icons/<slug>/<variant>.svg`. `config/brands.json` records each logo's
 * metadata and licence, and, per file, the background it is drawn for. Third-party brand logos are
 * not shipped; an app that needs one uses theSVG (https://thesvg.org) directly.
 */

export const brandsRoot = "icons/brand-icons";
export const brandsDataPath = "config/brands.json";

/**
 * The background a file's artwork is drawn for: `light` is dark artwork for light backgrounds,
 * `dark` is light artwork for dark backgrounds, and `any` is colourful, mid-tone or mixed artwork.
 */
export type BrandBackground = "light" | "dark" | "any";

/** A rough licence family, from most to least permissive. `licenseRaw` stays authoritative. */
export type BrandLicenseClass =
  | "first-party"
  | "public-domain"
  | "permissive"
  | "attribution"
  | "share-alike"
  | "no-derivatives"
  | "non-commercial"
  | "copyleft"
  | "no-licence";

export const brandBackgrounds: readonly BrandBackground[] = ["light", "dark", "any"];
export const brandLicenseClasses: readonly BrandLicenseClass[] = [
  "first-party",
  "public-domain",
  "permissive",
  "attribution",
  "share-alike",
  "no-derivatives",
  "non-commercial",
  "copyleft",
  "no-licence",
];

/** The painted colours of one file and the background they suit. */
export type BrandPaint = {
  readonly background: BrandBackground;
  /** Distinct painted colours as lowercase `#rrggbb`, plus `currentColor` when used. Sorted. */
  readonly colors: readonly string[];
};

export type BrandVariantData = BrandPaint & {
  /** Repository-relative path: `icons/brand-icons/<slug>/<variant>.svg`. */
  readonly file: string;
};

export type BrandLogoData = {
  readonly title: string;
  readonly collection: string;
  readonly componentName: string;
  /** The variant a component renders when none is given. */
  readonly defaultVariant: string;
  readonly variants: Readonly<Record<string, BrandVariantData>>;
  /** Brand colour as uppercase `RRGGBB`, or null. */
  readonly hex: string | null;
  readonly categories: readonly string[];
  readonly aliases: readonly string[];
  /** SPDX identifier, or a `LicenseRef-` identifier for proprietary artwork. */
  readonly license: string;
  /** The licence text, verbatim; null when there is none. */
  readonly licenseRaw: string | null;
  readonly licenseClass: BrandLicenseClass;
  readonly website: string | null;
  readonly guidelines: string | null;
  /** Where the artwork comes from, as an https URL. */
  readonly source: string;
  /** Qeet's own artwork (licence class `first-party`). Every logo in the package is first-party. */
  readonly firstParty: true;
};

export type BrandCollection = {
  readonly id: string;
  readonly label: string;
  /** Number of logos. */
  readonly count: number;
};

/** `config/brands.json`. */
export type BrandsData = {
  readonly collections: readonly BrandCollection[];
  readonly logos: Readonly<Record<string, BrandLogoData>>;
};

// ---------------------------------------------------------------------------------------------
// Names

const kebabPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const identifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function isKebabCase(value: string): boolean {
  return kebabPattern.test(value);
}

/**
 * PascalCase of the slug's hyphen-separated parts plus `Logo`, prefixed with `Brand` when it would
 * start with a digit: `arch-linux` → `ArchLinuxLogo`, `archlinux` → `ArchlinuxLogo`,
 * `1001tracklists` → `Brand1001tracklistsLogo`.
 */
export function brandComponentName(slug: string): string {
  const pascal = slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  const name = `${pascal}Logo`;
  return /^[0-9]/.test(name) ? `Brand${name}` : name;
}

export function brandVariantFile(slug: string, variant: string): string {
  return `${brandsRoot}/${slug}/${variant}.svg`;
}

// ---------------------------------------------------------------------------------------------
// Colours

type Rgba = { readonly r: number; readonly g: number; readonly b: number; readonly a: number };

/** CSS named colours, as `name:rrggbb`. */
const namedColors = new Map(
  (
    "aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff beige:f5f5dc " +
    "bisque:ffe4c4 black:000000 blanchedalmond:ffebcd blue:0000ff blueviolet:8a2be2 brown:a52a2a " +
    "burlywood:deb887 cadetblue:5f9ea0 chartreuse:7fff00 chocolate:d2691e coral:ff7f50 " +
    "cornflowerblue:6495ed cornsilk:fff8dc crimson:dc143c cyan:00ffff darkblue:00008b " +
    "darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 darkgreen:006400 darkgrey:a9a9a9 " +
    "darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00 " +
    "darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f darkslateblue:483d8b " +
    "darkslategray:2f4f4f darkslategrey:2f4f4f darkturquoise:00ced1 darkviolet:9400d3 " +
    "deeppink:ff1493 deepskyblue:00bfff dimgray:696969 dimgrey:696969 dodgerblue:1e90ff " +
    "firebrick:b22222 floralwhite:fffaf0 forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc " +
    "ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520 gray:808080 green:008000 greenyellow:adff2f " +
    "grey:808080 honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c indigo:4b0082 ivory:fffff0 " +
    "khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5 lawngreen:7cfc00 lemonchiffon:fffacd " +
    "lightblue:add8e6 lightcoral:f08080 lightcyan:e0ffff lightgoldenrodyellow:fafad2 " +
    "lightgray:d3d3d3 lightgreen:90ee90 lightgrey:d3d3d3 lightpink:ffb6c1 lightsalmon:ffa07a " +
    "lightseagreen:20b2aa lightskyblue:87cefa lightslategray:778899 lightslategrey:778899 " +
    "lightsteelblue:b0c4de lightyellow:ffffe0 lime:00ff00 limegreen:32cd32 linen:faf0e6 " +
    "magenta:ff00ff maroon:800000 mediumaquamarine:66cdaa mediumblue:0000cd mediumorchid:ba55d3 " +
    "mediumpurple:9370db mediumseagreen:3cb371 mediumslateblue:7b68ee mediumspringgreen:00fa9a " +
    "mediumturquoise:48d1cc mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa " +
    "mistyrose:ffe4e1 moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000 " +
    "olivedrab:6b8e23 orange:ffa500 orangered:ff4500 orchid:da70d6 palegoldenrod:eee8aa " +
    "palegreen:98fb98 paleturquoise:afeeee palevioletred:db7093 papayawhip:ffefd5 " +
    "peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd powderblue:b0e0e6 purple:800080 " +
    "rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f royalblue:4169e1 saddlebrown:8b4513 " +
    "salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 " +
    "skyblue:87ceeb slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa " +
    "springgreen:00ff7f steelblue:4682b4 tan:d2b48c teal:008080 thistle:d8bfd8 tomato:ff6347 " +
    "turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff whitesmoke:f5f5f5 yellow:ffff00 " +
    "yellowgreen:9acd32"
  )
    .split(" ")
    .map((pair) => pair.split(":") as [string, string]),
);

function channel(token: string, scale: number): number | undefined {
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%?)$/i.exec(token);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Math.min(1, Math.max(0, match[2] ? value / 100 : value / scale));
}

function hueToRgb(p: number, q: number, t: number): number {
  const h = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
  if (h < 1 / 6) return p + (q - p) * 6 * h;
  if (h < 1 / 2) return q;
  if (h < 2 / 3) return p + (q - p) * (2 / 3 - h) * 6;
  return p;
}

/** Parses a CSS colour (hex, `rgb()`, `hsl()`, named, `transparent`) to 0–1 channels. */
export function parseCssColor(value: string): Rgba | undefined {
  const text = value.trim().toLowerCase();
  if (text === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const named = namedColors.get(text);
  const hexMatch = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(named ? `#${named}` : text);
  if (hexMatch?.[1]) {
    let digits = hexMatch[1];
    if (digits.length <= 4) digits = [...digits].map((digit) => digit + digit).join("");
    const byte = (index: number) => Number.parseInt(digits.slice(index, index + 2), 16) / 255;
    return { r: byte(0), g: byte(2), b: byte(4), a: digits.length === 8 ? byte(6) : 1 };
  }
  // `color(display-p3 r g b)` (as Figma exports) is read as sRGB: close enough for luminance.
  const predefined = /^color\(\s*(?:srgb|display-p3)\s+([^)]*)\)$/.exec(text);
  if (predefined?.[1] !== undefined) {
    const parts = predefined[1].trim().split(/\s*\/\s*|\s+/);
    const [r, g, b, a] = [0, 1, 2, 3].map((index) =>
      parts[index] === undefined ? (index === 3 ? 1 : undefined) : channel(parts[index] ?? "", 1),
    );
    if (parts.length < 3 || parts.length > 4) return undefined;
    if (r === undefined || g === undefined || b === undefined || a === undefined) return undefined;
    return { r, g, b, a };
  }
  const functional = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(text);
  if (!functional?.[1] || functional[2] === undefined) return undefined;
  const parts = functional[2].trim().split(/\s*[,/]\s*|\s+/);
  if (parts.length < 3 || parts.length > 4) return undefined;
  const alpha = parts[3] === undefined ? 1 : channel(parts[3], 1);
  if (alpha === undefined) return undefined;
  if (functional[1].startsWith("rgb")) {
    const [r, g, b] = parts.slice(0, 3).map((part) => channel(part, 255));
    if (r === undefined || g === undefined || b === undefined) return undefined;
    return { r, g, b, a: alpha };
  }
  const hue = Number((parts[0] ?? "").replace(/deg$/, ""));
  const saturation = channel(parts[1] ?? "", 100);
  const lightness = channel(parts[2] ?? "", 100);
  if (!Number.isFinite(hue) || saturation === undefined || lightness === undefined)
    return undefined;
  const h = (((hue % 360) + 360) % 360) / 360;
  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return {
    r: hueToRgb(p, q, h + 1 / 3),
    g: hueToRgb(p, q, h),
    b: hueToRgb(p, q, h - 1 / 3),
    a: alpha,
  };
}

function toHex({ r, g, b }: Rgba): string {
  return `#${[r, g, b]
    .map((value) =>
      Math.round(value * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** WCAG relative luminance of a `#rrggbb` colour; `currentColor` counts as black. */
export function relativeLuminance(color: string): number {
  const rgba = color === "currentColor" ? undefined : parseCssColor(color);
  if (!rgba) return 0;
  const linear = (value: number) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(rgba.r) + 0.7152 * linear(rgba.g) + 0.0722 * linear(rgba.b);
}

/** Below this luminance a colour has under 2.5:1 contrast against black: dark artwork. */
export const darkLuminance = 0.075;
/** Above this luminance a grey has under 1.6:1 contrast against white: light artwork. */
export const lightLuminance = 0.6;
/** Saturated colours stand out from white by hue too, so they count as light only above this. */
export const chromaticLightLuminance = 0.8;

export type BrandTone = "dark" | "mid" | "light";

/** A colour's tone: dark, light (near-white, or very bright when saturated), or mid. */
export function brandTone(color: string): BrandTone {
  const luminance = relativeLuminance(color);
  if (luminance < darkLuminance) return "dark";
  const rgba = color === "currentColor" ? undefined : parseCssColor(color);
  const chroma = rgba ? Math.max(rgba.r, rgba.g, rgba.b) - Math.min(rgba.r, rgba.g, rgba.b) : 0;
  return luminance > (chroma < 0.2 ? lightLuminance : chromaticLightLuminance) ? "light" : "mid";
}

/**
 * Classifies painted colours by tone (dark, mid, light):
 *
 * - only dark → `light` (dark artwork for light backgrounds); only light → `dark`; only mid-tone
 *   or colourful → `any`.
 * - Mixed artwork that carries its own contrast → `any`: drawn on a tile (`tile`: the first painted
 *   shape spans the artwork, as in badges and app icons), or with the extreme tone carried by the
 *   rest (`contained`: white details on a coloured mark; see `extremesContained`).
 * - Other mixed artwork suits the background its extreme tone needs: dark with mid-tones (black
 *   text beside a coloured mark) → `light`; light with mid-tones → `dark`; dark with light → `any`.
 * - Raster content cannot be measured, and no paint at all says nothing → `any`.
 */
export function brandBackground(
  colors: readonly string[],
  {
    raster = false,
    tile = false,
    contained = false,
  }: { readonly raster?: boolean; readonly tile?: boolean; readonly contained?: boolean } = {},
): BrandBackground {
  if (raster || colors.length === 0) return "any";
  const tones = new Set(colors.map(brandTone));
  const dark = tones.has("dark");
  const light = tones.has("light");
  const mid = tones.has("mid");
  if (dark && !light && !mid) return "light";
  if (light && !dark && !mid) return "dark";
  if (tile || contained || dark === light) return "any";
  return dark ? "light" : "dark";
}

// ---------------------------------------------------------------------------------------------
// Parsing: DOCTYPE, internal entities, XML

export type BrandDoctype = {
  readonly name: string;
  readonly publicId: string | undefined;
  readonly systemId: string | undefined;
  /** Internal general entities, which XML parsers expand and xmldom does not. */
  readonly entities: ReadonlyMap<string, string>;
  /** External entities, parameter entities, non-W3C external DTDs and malformed declarations. */
  readonly problems: readonly string[];
  /** Offset just past the DOCTYPE's closing `>`. */
  readonly end: number;
};

const predefinedEntities = new Set(["lt", "gt", "amp", "quot", "apos"]);
const w3cDtd = /^https?:\/\/www\.w3\.org\/\S+\.dtd$/;

/**
 * Reads the DOCTYPE, if any. Allowed: no external identifier, or a W3C SVG DTD (which renderers
 * never fetch), and an internal subset of comments, `<!ELEMENT>`, `<!ATTLIST>` and internal
 * general `<!ENTITY>` declarations. Anything else is reported in `problems`.
 */
export function readBrandDoctype(source: string): BrandDoctype | undefined {
  const start = source.search(/<!DOCTYPE[\s[>]/i);
  if (start < 0) return undefined;
  let position = start + 9;
  const problems: string[] = [];
  const entities = new Map<string, string>();
  const skipSpace = () => {
    while (position < source.length && /\s/.test(source.charAt(position))) position += 1;
  };
  const readQuoted = (): string | undefined => {
    const quote = source.charAt(position);
    if (quote !== '"' && quote !== "'") return undefined;
    const close = source.indexOf(quote, position + 1);
    if (close < 0) return undefined;
    const value = source.slice(position + 1, close);
    position = close + 1;
    return value;
  };
  /** Skips to just past the next `>` outside quotes; always advances. */
  const skipDeclaration = () => {
    position += 1;
    let quote = "";
    while (position < source.length) {
      const character = source.charAt(position);
      position += 1;
      if (quote) {
        if (character === quote) quote = "";
      } else if (character === '"' || character === "'") quote = character;
      else if (character === ">") return;
    }
  };
  const nameAt = () => /^[A-Za-z_:][\w.:-]*/.exec(source.slice(position, position + 256))?.[0];

  skipSpace();
  const name = nameAt() ?? "";
  position += name.length;
  skipSpace();
  let publicId: string | undefined;
  let systemId: string | undefined;
  if (source.startsWith("PUBLIC", position)) {
    position += 6;
    skipSpace();
    publicId = readQuoted();
    skipSpace();
    systemId = readQuoted();
    if (publicId === undefined || systemId === undefined) problems.push("Malformed PUBLIC DTD.");
  } else if (source.startsWith("SYSTEM", position)) {
    position += 6;
    skipSpace();
    systemId = readQuoted();
    if (systemId === undefined) problems.push("Malformed SYSTEM DTD.");
  }
  if (publicId !== undefined || systemId !== undefined) {
    const allowed =
      name === "svg" &&
      systemId !== undefined &&
      w3cDtd.test(systemId) &&
      (publicId === undefined || publicId.startsWith("-//W3C//DTD SVG "));
    if (!allowed) {
      problems.push(`External DTD ${JSON.stringify(systemId ?? publicId)} is not a W3C SVG DTD.`);
    }
  }

  skipSpace();
  if (source.charAt(position) === "[") {
    position += 1;
    for (;;) {
      skipSpace();
      if (position >= source.length) {
        problems.push("Unterminated DOCTYPE internal subset.");
        break;
      }
      if (source.charAt(position) === "]") {
        position += 1;
        break;
      }
      if (source.startsWith("<!--", position)) {
        const close = source.indexOf("-->", position + 4);
        position = close < 0 ? source.length : close + 3;
        continue;
      }
      if (source.startsWith("<!ENTITY", position)) {
        position += 8;
        skipSpace();
        if (source.charAt(position) === "%") {
          problems.push("Parameter entities are not allowed.");
          skipDeclaration();
          continue;
        }
        const entity = nameAt();
        if (!entity) {
          problems.push("Malformed <!ENTITY> declaration.");
          skipDeclaration();
          continue;
        }
        position += entity.length;
        skipSpace();
        if (source.startsWith("SYSTEM", position) || source.startsWith("PUBLIC", position)) {
          problems.push(`External entity ${JSON.stringify(entity)} is not allowed.`);
          skipDeclaration();
          continue;
        }
        const value = readQuoted();
        skipSpace();
        if (value === undefined || source.charAt(position) !== ">") {
          problems.push(`Malformed <!ENTITY> declaration for ${JSON.stringify(entity)}.`);
          skipDeclaration();
          continue;
        }
        position += 1;
        // XML keeps the first declaration of an entity; the predefined five cannot be redefined.
        if (!entities.has(entity) && !predefinedEntities.has(entity)) entities.set(entity, value);
        continue;
      }
      if (source.startsWith("<!ELEMENT", position) || source.startsWith("<!ATTLIST", position)) {
        skipDeclaration();
        continue;
      }
      problems.push(
        `Unsupported DTD content ${JSON.stringify(source.slice(position, position + 24))}.`,
      );
      skipDeclaration();
    }
  }
  skipSpace();
  if (source.charAt(position) === ">") position += 1;
  else problems.push("Malformed DOCTYPE.");
  return { name, publicId, systemId, entities, problems, end: position };
}

const maxEntityDepth = 8;
const maxExpandedLength = 8 * 1024 * 1024;

function expandEntities(
  text: string,
  entities: ReadonlyMap<string, string>,
  budget: { left: number },
  depth = 0,
): string {
  return text.replace(/&([A-Za-z_:][\w.:-]*);/g, (reference, name: string) => {
    const value = entities.get(name);
    if (value === undefined) return reference;
    if (depth >= maxEntityDepth) throw new Error("Entity references nest too deeply.");
    const expanded = expandEntities(value, entities, budget, depth + 1);
    budget.left -= expanded.length;
    if (budget.left < 0) throw new Error("Entity expansion exceeds the size limit.");
    return expanded;
  });
}

export type ParsedBrandSvg = {
  readonly document: Document | undefined;
  readonly doctype: BrandDoctype | undefined;
  /** Why parsing failed; undefined when `document` is set. */
  readonly error: string | undefined;
};

/**
 * Parses one logo strictly (xmldom warnings stop parsing). Internal entities are expanded in the
 * document body first, so later checks see the markup a browser would build.
 */
export function parseBrandSvg(source: string): ParsedBrandSvg {
  const doctype = readBrandDoctype(source);
  try {
    const text =
      doctype && doctype.entities.size > 0
        ? source.slice(0, doctype.end) +
          expandEntities(source.slice(doctype.end), doctype.entities, { left: maxExpandedLength })
        : source;
    const document = new DOMParser({ onError: onWarningStopParsing }).parseFromString(
      text,
      "application/xml",
    );
    if (!document.documentElement) {
      return { document: undefined, doctype, error: "No root element." };
    }
    return { document, doctype, error: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : "XML parsing failed.";
    return { document: undefined, doctype, error: message ?? "XML parsing failed." };
  }
}

/** An element's local name, without any namespace prefix. */
export function localName(element: Element): string {
  return element.localName ?? element.tagName.replace(/^[^:]*:/, "");
}

export function childElements(node: Node): Element[] {
  const children: Element[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child instanceof Element) children.push(child);
  }
  return children;
}

// ---------------------------------------------------------------------------------------------
// Paint analysis

type Declarations = Map<string, string>;

type CssRule = {
  readonly tag: string | undefined;
  readonly ids: readonly string[];
  readonly classes: readonly string[];
  readonly specificity: number;
  readonly order: number;
  readonly declarations: Declarations;
};

const styleProperties = new Set([
  "fill",
  "stroke",
  "color",
  "stop-color",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "stop-opacity",
  "display",
  "visibility",
]);

const paintProperties = new Set(["fill", "stroke", "color", "stop-color"]);

/** Whether a paint value is one this analysis understands; CSS drops declarations it cannot parse. */
function isUnderstoodPaint(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    ["none", "currentcolor", "inherit"].includes(lower) ||
    lower.startsWith("url(") ||
    parseCssColor(value) !== undefined
  );
}

/**
 * Reads a declaration block. A paint value that cannot be parsed is dropped, as CSS does, so a
 * fallback such as `fill:#EBF0F0;fill:lab(…)` keeps the colour it can read.
 */
function parseDeclarations(text: string): Declarations {
  const declarations: Declarations = new Map();
  for (const declaration of text.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration
      .slice(colon + 1)
      .replace(/!important\s*$/i, "")
      .trim();
    if (!styleProperties.has(property) || !value) continue;
    if (paintProperties.has(property) && !isUnderstoodPaint(value)) continue;
    declarations.set(property, value);
  }
  return declarations;
}

/**
 * Reads `<style>` rules. Selectors are matched on their last compound only (tag, classes, ids);
 * selectors with pseudo-classes such as `:hover` are skipped, since they do not paint at rest.
 */
function parseStylesheets(document: Document): CssRule[] {
  const rules: CssRule[] = [];
  const pending: Element[] = [document.documentElement as Element];
  while (pending.length > 0) {
    const element = pending.pop() as Element;
    for (const child of childElements(element)) pending.push(child);
    if (localName(element) !== "style") continue;
    const css = (element.textContent ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const declarations = parseDeclarations(match[2] ?? "");
      if (declarations.size === 0) continue;
      for (const selector of (match[1] ?? "").split(",")) {
        if (selector.includes(":") || selector.includes("@")) continue;
        const compound =
          selector
            .trim()
            .split(/[\s>+~]+/)
            .pop() ?? "";
        const parsed = /^([A-Za-z][\w-]*|\*)?((?:[.#][\w-]+|\[[^\]]*\])*)$/.exec(compound);
        if (!compound || !parsed) continue;
        const tokens = parsed[2]?.match(/[.#][\w-]+|\[[^\]]*\]/g) ?? [];
        const ids = tokens.filter((token) => token.startsWith("#")).map((token) => token.slice(1));
        const classes = tokens
          .filter((token) => token.startsWith("."))
          .map((token) => token.slice(1));
        const tag = parsed[1] && parsed[1] !== "*" ? parsed[1] : undefined;
        rules.push({
          tag,
          ids,
          classes,
          specificity: ids.length * 10000 + (tokens.length - ids.length) * 100 + (tag ? 1 : 0),
          order: rules.length,
          declarations,
        });
      }
    }
  }
  return rules.sort(
    (left, right) => left.specificity - right.specificity || left.order - right.order,
  );
}

/** Presentation attributes, then matching stylesheet rules, then the inline `style`. */
function declaredStyle(element: Element, rules: readonly CssRule[]): Declarations {
  const style: Declarations = new Map();
  for (const property of styleProperties) {
    const value = element.getAttribute(property)?.trim();
    if (value) style.set(property, value);
  }
  if (rules.length > 0) {
    const tag = localName(element);
    const id = element.getAttribute("id") ?? "";
    const classes = new Set((element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean));
    for (const rule of rules) {
      if (rule.tag !== undefined && rule.tag !== tag) continue;
      if (!rule.ids.every((entry) => entry === id)) continue;
      if (!rule.classes.every((entry) => classes.has(entry))) continue;
      for (const [property, value] of rule.declarations) style.set(property, value);
    }
  }
  const inline = element.getAttribute("style");
  if (inline) for (const [property, value] of parseDeclarations(inline)) style.set(property, value);
  return style;
}

type PaintState = {
  readonly fill: string | undefined;
  readonly stroke: string | undefined;
  readonly color: string | undefined;
  readonly fillOpacity: string | undefined;
  readonly strokeOpacity: string | undefined;
  readonly visibility: string | undefined;
};

type PaintContext = {
  readonly rules: readonly CssRule[];
  readonly ids: ReadonlyMap<string, Element>;
  readonly colors: Set<string>;
  readonly active: Set<Element>;
  readonly viewBox: Box | undefined;
  /** Painted shapes in paint order, with the colours each contributes. */
  readonly painted: PaintedShape[];
  /** Where `addPaint` collects colours: the current shape's set, else `colors`. */
  sink: Set<string>;
  /** Above zero while walking pattern content, whose shapes belong to the shape they paint. */
  serverDepth: number;
  raster: boolean;
};

type PaintedShape = {
  /** Bounding box, or undefined for text, whose extent is not measured. */
  readonly box: Box | undefined;
  /** One box per subpath. */
  readonly parts: readonly Box[];
  readonly colors: ReadonlySet<string>;
  readonly fills: boolean;
};

// Geometry, only precise enough to tell whether the first painted shape spans the artwork.

type Box = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};
type Matrix = readonly [number, number, number, number, number, number];
const identity: Matrix = [1, 0, 0, 1, 0, 0];

function multiply([a, b, c, d, e, f]: Matrix, [g, h, i, j, k, l]: Matrix): Matrix {
  return [
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ];
}

function parseTransform(value: string | null): Matrix {
  let matrix = identity;
  for (const match of (value ?? "").matchAll(
    /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g,
  )) {
    const n = (match[2] ?? "")
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (!n.every(Number.isFinite)) return identity;
    const [p = 0, q, r, t, u, v] = n;
    const radians = (p * Math.PI) / 180;
    let next: Matrix = identity;
    switch (match[1]) {
      case "matrix":
        next = [p, q ?? 0, r ?? 0, t ?? 1, u ?? 0, v ?? 0];
        break;
      case "translate":
        next = [1, 0, 0, 1, p, q ?? 0];
        break;
      case "scale":
        next = [p, 0, 0, q ?? p, 0, 0];
        break;
      case "rotate": {
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const [cx, cy] = [q ?? 0, r ?? 0];
        next = [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
        break;
      }
      case "skewX":
        next = [1, 0, Math.tan(radians), 1, 0, 0];
        break;
      case "skewY":
        next = [1, Math.tan(radians), 0, 1, 0, 0];
        break;
    }
    matrix = multiply(matrix, next);
  }
  return matrix;
}

/** Points that bound each subpath: end points, control points, and samples along arcs. */
function pathPoints(d: string): [number, number][][] {
  const subpaths: [number, number][][] = [];
  let points: [number, number][] = [];
  let index = 0;
  const skip = () => {
    while (index < d.length && /[\s,]/.test(d.charAt(index))) index += 1;
  };
  const number = (): number | undefined => {
    skip();
    const match = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(d.slice(index, index + 64));
    if (!match) return undefined;
    index += match[0].length;
    return Number(match[0]);
  };
  const flag = (): number | undefined => {
    skip();
    const character = d.charAt(index);
    if (character !== "0" && character !== "1") return undefined;
    index += 1;
    return Number(character);
  };
  const numbers = (count: number): number[] | undefined => {
    const values: number[] = [];
    for (let read = 0; read < count; read += 1) {
      const value = number();
      if (value === undefined) return undefined;
      values.push(value);
    }
    return values;
  };
  let [x, y, startX, startY] = [0, 0, 0, 0];
  let command = "";
  while (index < d.length) {
    skip();
    if (index >= d.length) break;
    const character = d.charAt(index);
    if (/[A-Za-z]/.test(character)) {
      command = character;
      index += 1;
      if (command === "Z" || command === "z") {
        [x, y] = [startX, startY];
        continue;
      }
    } else if (!command || command === "Z" || command === "z") break;
    const relative = command === command.toLowerCase();
    const [ox, oy] = relative ? [x, y] : [0, 0];
    const upper = command.toUpperCase();
    if (upper === "H" || upper === "V") {
      const value = number();
      if (value === undefined) break;
      if (upper === "H") x = (relative ? x : 0) + value;
      else y = (relative ? y : 0) + value;
      points.push([x, y]);
      continue;
    }
    if (upper === "A") {
      const radii = numbers(3);
      const large = flag();
      const sweep = flag();
      const end = numbers(2);
      if (!radii || large === undefined || sweep === undefined || !end) break;
      const [x1, y1] = [ox + (end[0] ?? 0), oy + (end[1] ?? 0)];
      points.push(
        ...arcPoints(x, y, radii[0] ?? 0, radii[1] ?? 0, radii[2] ?? 0, large, sweep, x1, y1),
      );
      [x, y] = [x1, y1];
      continue;
    }
    const count = { M: 2, L: 2, T: 2, S: 4, Q: 4, C: 6 }[upper];
    const values = count ? numbers(count) : undefined;
    if (!values) break;
    for (let pair = 0; pair < values.length; pair += 2) {
      points.push([ox + (values[pair] ?? 0), oy + (values[pair + 1] ?? 0)]);
    }
    if (upper === "M") {
      // Each moveto starts a subpath; its first point is the moveto's own pair.
      const [first, ...rest] = points.splice(points.length - values.length / 2);
      points = first ? [first] : [];
      subpaths.push(points);
      for (const point of rest) points.push(point);
    }
    const last = points.at(-1) ?? [x, y];
    [x, y] = last;
    if (upper === "M") {
      [startX, startY] = [x, y];
      command = relative ? "l" : "L";
    }
  }
  return subpaths.filter((subpath) => subpath.length > 0);
}

/** Samples an SVG arc after converting it to centre form (SVG 1.1, appendix F.6.5). */
function arcPoints(
  x0: number,
  y0: number,
  radiusX: number,
  radiusY: number,
  degrees: number,
  large: number,
  sweep: number,
  x1: number,
  y1: number,
): [number, number][] {
  let [rx, ry] = [Math.abs(radiusX), Math.abs(radiusY)];
  if (rx === 0 || ry === 0) return [[x1, y1]];
  const phi = (degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const dx = (x0 - x1) / 2;
  const dy = (y0 - y1) / 2;
  const px = cos * dx + sin * dy;
  const py = -sin * dx + cos * dy;
  const lambda = (px * px) / (rx * rx) + (py * py) / (ry * ry);
  if (lambda > 1) [rx, ry] = [rx * Math.sqrt(lambda), ry * Math.sqrt(lambda)];
  const numerator = rx * rx * ry * ry - rx * rx * py * py - ry * ry * px * px;
  const denominator = rx * rx * py * py + ry * ry * px * px;
  const coefficient =
    (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / (denominator || 1)));
  const cxp = (coefficient * rx * py) / ry;
  const cyp = (-coefficient * ry * px) / rx;
  const cx = cos * cxp - sin * cyp + (x0 + x1) / 2;
  const cy = sin * cxp + cos * cyp + (y0 + y1) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const start = angle(1, 0, (px - cxp) / rx, (py - cyp) / ry);
  let delta = angle((px - cxp) / rx, (py - cyp) / ry, (-px - cxp) / rx, (-py - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const points: [number, number][] = [];
  for (let step = 1; step <= 8; step += 1) {
    const theta = start + (delta * step) / 8;
    points.push([
      cx + rx * cos * Math.cos(theta) - ry * sin * Math.sin(theta),
      cy + rx * sin * Math.cos(theta) + ry * cos * Math.sin(theta),
    ]);
  }
  return points;
}

type ShapeExtent = { readonly box: Box; readonly parts: readonly Box[] };

function boundsOf(points: readonly (readonly [number, number])[]): Box | undefined {
  let [minX, minY, maxX, maxY] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return minX <= maxX ? { minX, minY, maxX, maxY } : undefined;
}

/**
 * A shape's bounding box in root user space, with one box per subpath for paths, or undefined for
 * text and unknown shapes.
 */
function shapeBox(
  element: Element,
  name: string,
  matrix: Matrix,
  viewBox: Box | undefined,
): ShapeExtent | undefined {
  const length = (attribute: string, axis: "x" | "y") => {
    const value = element.getAttribute(attribute)?.trim() ?? "";
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return 0;
    if (!value.endsWith("%") || !viewBox) return parsed;
    const size = axis === "x" ? viewBox.maxX - viewBox.minX : viewBox.maxY - viewBox.minY;
    return (parsed / 100) * size;
  };
  let points: [number, number][] = [];
  if (name === "rect") {
    const [x, y] = [length("x", "x"), length("y", "y")];
    points = [
      [x, y],
      [x + length("width", "x"), y + length("height", "y")],
    ];
  } else if (name === "circle" || name === "ellipse") {
    const [cx, cy] = [length("cx", "x"), length("cy", "y")];
    const rx = name === "circle" ? length("r", "x") : length("rx", "x");
    const ry = name === "circle" ? rx : length("ry", "y");
    points = [
      [cx - rx, cy - ry],
      [cx + rx, cy + ry],
    ];
  } else if (name === "line") {
    points = [
      [length("x1", "x"), length("y1", "y")],
      [length("x2", "x"), length("y2", "y")],
    ];
  } else if (name === "polygon" || name === "polyline") {
    const values = (element.getAttribute("points") ?? "")
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    for (let index = 0; index + 1 < values.length; index += 2) {
      points.push([values[index] ?? 0, values[index + 1] ?? 0]);
    }
  }
  // Rectangles and ellipses need all four corners once rotated or skewed.
  if (name === "rect" || name === "circle" || name === "ellipse") {
    const [[x0, y0], [x1, y1]] = points as [[number, number], [number, number]];
    points.push([x0, y1], [x1, y0]);
  }
  const subpaths = name === "path" ? pathPoints(element.getAttribute("d") ?? "") : [points];
  const [a, b, c, d, e, f] = matrix;
  const parts = subpaths.flatMap((subpath) => {
    const part = boundsOf(subpath.map(([x, y]) => [a * x + c * y + e, b * x + d * y + f] as const));
    return part ? [part] : [];
  });
  const box = boundsOf(
    parts.flatMap((part) => [[part.minX, part.minY] as const, [part.maxX, part.maxY] as const]),
  );
  return box ? { box, parts } : undefined;
}

/**
 * Share of the artwork's width and height the first painted shape must cover to count as a tile.
 * AWS category icons draw a 24-unit tile in a 32-unit viewBox (75%).
 */
export const tileCoverage = 0.7;

/** Whether a box covers at least `tileCoverage` of the artwork's width and height. */
function spansArtwork(box: Box | undefined, artwork: Box | undefined): boolean {
  if (!box || !artwork) return false;
  const width = artwork.maxX - artwork.minX;
  const height = artwork.maxY - artwork.minY;
  if (!(width > 0 && height > 0)) return false;
  const coveredX = Math.min(box.maxX, artwork.maxX) - Math.max(box.minX, artwork.minX);
  const coveredY = Math.min(box.maxY, artwork.maxY) - Math.max(box.minY, artwork.minY);
  return coveredX >= tileCoverage * width && coveredY >= tileCoverage * height;
}

/** The artwork's extent: the root viewBox, else its numeric width and height. */
function artworkBox(root: Element): Box | undefined {
  const viewBox = (root.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
    const [x = 0, y = 0, width = 0, height = 0] = viewBox;
    if (width > 0 && height > 0) return { minX: x, minY: y, maxX: x + width, maxY: y + height };
  }
  const width = Number.parseFloat(root.getAttribute("width") ?? "");
  const height = Number.parseFloat(root.getAttribute("height") ?? "");
  return width > 0 && height > 0 ? { minX: 0, minY: 0, maxX: width, maxY: height } : undefined;
}

/** Not rendered where they stand: definitions, masks, clip paths, filters, metadata, scripts. */
const unrenderedElements = new Set([
  "defs",
  "symbol",
  "mask",
  "clipPath",
  "filter",
  "marker",
  "metadata",
  "title",
  "desc",
  "style",
  "script",
  "linearGradient",
  "radialGradient",
  "pattern",
  "foreignObject",
  "font",
  "font-face",
  "glyph",
  "missing-glyph",
  "cursor",
  "view",
  "animate",
  "animateColor",
  "animateMotion",
  "animateTransform",
  "set",
]);
const shapeElements = new Set(["path", "rect", "circle", "ellipse", "line", "polygon", "polyline"]);
const textElements = new Set(["text", "tspan", "textPath"]);
const initialState: PaintState = {
  fill: undefined,
  stroke: undefined,
  color: undefined,
  fillOpacity: undefined,
  strokeOpacity: undefined,
  visibility: undefined,
};

function inherited(value: string | undefined, parent: string | undefined): string | undefined {
  return value === undefined || value.toLowerCase() === "inherit" ? parent : value;
}

function isZero(value: string | undefined): boolean {
  return value !== undefined && Number.parseFloat(value) === 0;
}

function referencedId(element: Element): string | undefined {
  const href = (element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? "").trim();
  return href.startsWith("#") ? href.slice(1) : undefined;
}

function hasOwnText(element: Element): boolean {
  for (let child = element.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 3 && (child.nodeValue ?? "").trim()) return true;
  }
  return false;
}

function addPaint(value: string, state: PaintState, context: PaintContext, depth: number): void {
  const text = value.trim();
  const lower = text.toLowerCase();
  if (depth > 8 || lower === "none" || lower === "transparent" || lower === "inherit") return;
  if (lower.startsWith("url(")) {
    const match = /^url\(\s*['"]?#([^'")\s]+)['"]?\s*\)\s*(.*)$/i.exec(text);
    const target = match?.[1] ? context.ids.get(match[1]) : undefined;
    if (target) paintServer(target, context, depth + 1);
    else if (match?.[2]) addPaint(match[2], state, context, depth + 1);
    return;
  }
  if (lower === "currentcolor") {
    if (state.color && state.color.toLowerCase() !== "currentcolor") {
      addPaint(state.color, { ...state, color: undefined }, context, depth + 1);
    } else context.sink.add("currentColor");
    return;
  }
  const rgba = parseCssColor(text);
  if (rgba && rgba.a > 0) context.sink.add(toHex(rgba));
}

/** Gradient stops (following `href` chains for inherited stops) and pattern content. */
function paintServer(target: Element, context: PaintContext, depth: number): void {
  if (context.active.has(target) || depth > 8) return;
  context.active.add(target);
  const name = localName(target);
  if (name === "linearGradient" || name === "radialGradient") {
    const stops = childElements(target).filter((child) => localName(child) === "stop");
    if (stops.length === 0) {
      const id = referencedId(target);
      const next = id ? context.ids.get(id) : undefined;
      if (next) paintServer(next, context, depth + 1);
    }
    for (const stop of stops) {
      const style = declaredStyle(stop, context.rules);
      if (isZero(style.get("stop-opacity"))) continue;
      // stop-color's initial value is black.
      addPaint(
        style.get("stop-color") ?? "black",
        { ...initialState, color: style.get("color") },
        context,
        depth + 1,
      );
    }
  } else if (name === "pattern") {
    context.serverDepth += 1;
    for (const child of childElements(target)) {
      walkPaint(child, initialState, identity, context, depth + 1);
    }
    context.serverDepth -= 1;
  }
  context.active.delete(target);
}

function walkPaint(
  element: Element,
  parent: PaintState,
  parentMatrix: Matrix,
  context: PaintContext,
  depth: number,
  viaUse = false,
): void {
  if (depth > 64) return;
  const name = localName(element);
  if (unrenderedElements.has(name) && !(viaUse && name === "symbol")) return;
  const style = declaredStyle(element, context.rules);
  if (style.get("display") === "none" || isZero(style.get("opacity"))) return;
  const state: PaintState = {
    fill: inherited(style.get("fill"), parent.fill),
    stroke: inherited(style.get("stroke"), parent.stroke),
    color: inherited(style.get("color"), parent.color),
    fillOpacity: inherited(style.get("fill-opacity"), parent.fillOpacity),
    strokeOpacity: inherited(style.get("stroke-opacity"), parent.strokeOpacity),
    visibility: inherited(style.get("visibility"), parent.visibility),
  };
  const matrix = multiply(parentMatrix, parseTransform(element.getAttribute("transform")));
  if (name === "image") {
    context.raster = true;
    return;
  }
  if (name === "use") {
    const id = referencedId(element);
    const target = id ? context.ids.get(id) : undefined;
    if (target && !context.active.has(target)) {
      const offset: Matrix = [
        1,
        0,
        0,
        1,
        Number.parseFloat(element.getAttribute("x") ?? "") || 0,
        Number.parseFloat(element.getAttribute("y") ?? "") || 0,
      ];
      context.active.add(target);
      walkPaint(target, state, multiply(matrix, offset), context, depth + 1, true);
      context.active.delete(target);
    }
    return;
  }
  const paints =
    shapeElements.has(name) || (textElements.has(name) && hasOwnText(element))
      ? state.visibility !== "hidden" && state.visibility !== "collapse"
      : false;
  if (paints) {
    // fill's initial value is black; a line has no interior to fill.
    const fill = state.fill ?? "black";
    const fills =
      name !== "line" && !isZero(state.fillOpacity) && !/^(?:none|transparent)$/i.test(fill.trim());
    const strokes =
      state.stroke !== undefined &&
      !isZero(state.strokeOpacity) &&
      !/^(?:none|transparent)$/i.test(state.stroke.trim());
    const outer = context.sink;
    const own = new Set<string>();
    context.sink = own;
    if (fills) addPaint(fill, state, context, 0);
    if (strokes && state.stroke !== undefined) addPaint(state.stroke, state, context, 0);
    context.sink = outer;
    for (const color of own) outer.add(color);
    if (own.size > 0 && context.serverDepth === 0) {
      const extent = shapeBox(element, name, matrix, context.viewBox);
      context.painted.push({ box: extent?.box, parts: extent?.parts ?? [], colors: own, fills });
    }
  }
  for (const child of childElements(element)) walkPaint(child, state, matrix, context, depth + 1);
}

/**
 * Measures which colours a logo paints: fills (black where none is set, as SVG renders it),
 * strokes, gradient stops and pattern content, with `<style>` rules, inheritance, `<use>` and
 * `currentColor` resolved. Masks, clip paths, filters and unreferenced definitions do not paint.
 * Raster `<image>` content cannot be measured, so it makes the background `any`. It also notes
 * whether the first painted shape is a filled tile spanning the artwork (see `brandBackground`).
 */
export function analyseBrandPaint(document: Document): BrandPaint {
  const root = document.documentElement;
  if (!root) return { background: "any", colors: [] };
  const ids = new Map<string, Element>();
  const pending: Element[] = [root];
  while (pending.length > 0) {
    const element = pending.pop() as Element;
    const id = element.getAttribute("id");
    if (id && !ids.has(id)) ids.set(id, element);
    for (const child of childElements(element)) pending.push(child);
  }
  const colors = new Set<string>();
  const context: PaintContext = {
    rules: parseStylesheets(document),
    ids,
    colors,
    active: new Set(),
    viewBox: artworkBox(root),
    painted: [],
    sink: colors,
    serverDepth: 0,
    raster: false,
  };
  walkPaint(root, initialState, identity, context, 0);
  const sorted = [...colors].sort(compareText);
  const [first] = context.painted;
  return {
    background: brandBackground(sorted, {
      raster: context.raster,
      tile: first?.fills === true && spansArtwork(first.box, context.viewBox),
      contained: extremesContained(context.painted, context.viewBox),
    }),
    colors: sorted,
  };
}

/** Exposed extreme-tone shapes below this share of the painted area do not decide the background. */
export const exposedExtremeShare = 0.2;

/**
 * For artwork mixing one extreme tone with mid-tones: whether the shapes painted only in the
 * extreme tone are carried by the rest. A subpath is carried when it lies within the box of a
 * filled shape of another tone, as white details on (or showing through) a coloured mark do and
 * white text beside a mark does not. Exposed shapes covering under `exposedExtremeShare` of the painted
 * box area (a small grey foot under a coloured icon) are carried too. Text, whose extent is not
 * measured, is always exposed.
 */
function extremesContained(painted: readonly PaintedShape[], artwork: Box | undefined): boolean {
  const tones = painted.map((shape) => new Set([...shape.colors].map(brandTone)));
  const all = new Set(tones.flatMap((set) => [...set]));
  if (!all.has("mid") || all.has("dark") === all.has("light")) return false;
  const extreme: BrandTone = all.has("dark") ? "dark" : "light";
  const slackX = artwork ? 0.02 * (artwork.maxX - artwork.minX) : 0;
  const slackY = artwork ? 0.02 * (artwork.maxY - artwork.minY) : 0;
  const area = (box: Box | undefined) =>
    box ? (box.maxX - box.minX) * (box.maxY - box.minY) : Number.POSITIVE_INFINITY;
  let total = 0;
  let exposed = 0;
  for (const [index, shape] of painted.entries()) {
    total += area(shape.box);
    const shapeTones = tones[index] as Set<BrandTone>;
    if (shapeTones.size !== 1 || !shapeTones.has(extreme)) continue;
    if (!shape.box) {
      exposed = Number.POSITIVE_INFINITY;
      continue;
    }
    for (const part of shape.parts) {
      const carried = painted.some((host, hostIndex) => {
        const hostBox = host.box;
        return (
          hostIndex !== index &&
          hostBox !== undefined &&
          host.fills &&
          [...(tones[hostIndex] as Set<BrandTone>)].some((value) => value !== extreme) &&
          part.minX >= hostBox.minX - slackX &&
          part.maxX <= hostBox.maxX + slackX &&
          part.minY >= hostBox.minY - slackY &&
          part.maxY <= hostBox.maxY + slackY
        );
      });
      if (!carried) exposed += area(part);
    }
  }
  if (exposed === Number.POSITIVE_INFINITY) return false;
  return total > 0 && exposed < exposedExtremeShare * total;
}

/**
 * Decodes a logo's bytes: UTF-8 unless the XML declaration names another encoding. A byte-order
 * mark is dropped. Throws on bytes that are invalid in that encoding.
 */
export function decodeBrandSvg(bytes: Uint8Array): string {
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  const head = new TextDecoder("latin1").decode(bytes.subarray(bom, bom + 256));
  const declared = /^<\?xml[^>]*?\bencoding\s*=\s*["']([A-Za-z0-9._-]+)["']/.exec(head)?.[1];
  return new TextDecoder(declared ?? "utf-8", { fatal: true }).decode(bytes);
}

/** Parses and measures one logo; unparseable files are `any` with no colours. */
export function classifyBrandSvg(source: string): BrandPaint {
  const { document } = parseBrandSvg(source);
  return document ? analyseBrandPaint(document) : { background: "any", colors: [] };
}
