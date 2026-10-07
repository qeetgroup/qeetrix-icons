import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Element, NAMESPACE, Node } from "@xmldom/xmldom";
import {
  analyseBrandPaint,
  type BrandPaint,
  type BrandsData,
  brandBackgrounds,
  brandComponentName,
  brandLicenseClasses,
  brandsDataPath,
  brandsRoot,
  brandVariantFile,
  decodeBrandSvg,
  identifierPattern,
  isKebabCase,
  localName,
  parseBrandSvg,
} from "../lib/brands.js";
import { compareText } from "../lib/diagnostics.js";

/**
 * Validation for Qeet's logos in `icons/brand-icons/`. Logos stay byte-for-byte as drawn, so this
 * does not judge their drawing; it checks that every file is listed in
 * `config/brands.json` (and the reverse), that each file is a well-formed SVG with a size, and that
 * none can run script or load anything from outside the file.
 */

export type BrandDiagnosticCode =
  /** A file or `config/brands.json` cannot be read. */
  | "QXB-IO-001"
  /** Malformed XML, undecodable bytes or an oversized file. */
  | "QXB-XML-001"
  /** A DOCTYPE with external entities, parameter entities or a non-W3C external DTD. */
  | "QXB-XML-002"
  /** The root element is not `<svg>` in the SVG namespace. */
  | "QXB-SVG-001"
  /** No usable `viewBox` and no numeric `width`/`height`. */
  | "QXB-SVG-002"
  /** A `<script>` element. */
  | "QXB-SVG-003"
  /** An `on*` event attribute, or an animation that sets one. */
  | "QXB-SVG-004"
  /** A `<foreignObject>` element. */
  | "QXB-SVG-005"
  /** A reference outside the file: `href`, `url()`, `@import` or `xml-stylesheet`. */
  | "QXB-SVG-006"
  /** Warning: the root has no namespace, so the file renders inline but not as an image file. */
  | "QXB-SVG-007"
  /** Warning: the `viewBox` is unusable; `width`/`height` size the file instead. */
  | "QXB-SVG-008"
  /** A file under `icons/brand-icons/` that `config/brands.json` does not list. */
  | "QXB-MAP-001"
  /** A file `config/brands.json` lists that does not exist. */
  | "QXB-MAP-002"
  /** A listed path that does not follow `icons/brand-icons/<slug>/<variant>.svg`. */
  | "QXB-MAP-003"
  /** A component name that is not a valid identifier or does not follow the naming rule. */
  | "QXB-NAME-001"
  /** Two logos with the same component name. */
  | "QXB-NAME-002"
  /** `config/brands.json` does not match its schema. */
  | "QXB-META-001"
  /** A file's recorded background or colours no longer match its content. */
  | "QXB-META-002";

export type BrandDiagnostic = {
  readonly code: BrandDiagnosticCode;
  readonly file: string;
  readonly message: string;
  readonly severity: "error" | "warning";
};

const warningCodes = new Set<BrandDiagnosticCode>(["QXB-SVG-007", "QXB-SVG-008"]);

export function brandDiagnostic(
  code: BrandDiagnosticCode,
  file: string,
  message: string,
): BrandDiagnostic {
  return { code, file, message, severity: warningCodes.has(code) ? "warning" : "error" };
}

export function sortBrandDiagnostics(diagnostics: readonly BrandDiagnostic[]): BrandDiagnostic[] {
  return [...diagnostics].sort(
    (left, right) =>
      compareText(left.file, right.file) ||
      compareText(left.code, right.code) ||
      compareText(left.message, right.message),
  );
}

export function formatBrandDiagnostics(diagnostics: readonly BrandDiagnostic[]): string {
  return sortBrandDiagnostics(diagnostics)
    .map((entry) => `${entry.code} ${JSON.stringify(entry.file)}\n  ${entry.message}`)
    .join("\n");
}

export const maxBrandSvgBytes = 4 * 1024 * 1024;

const animationElements = new Set(["animate", "animateColor", "animateMotion", "animateTransform"]);
const lengthPattern = /^\s*(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:px|pt|pc|mm|cm|in)?\s*$/i;

/** Local references (`#fragment`, `data:`) are allowed; anything else leaves the file. */
function isLocalReference(target: string): boolean {
  const value = target.trim();
  return value === "" || value.startsWith("#") || /^data:/i.test(value);
}

/** Targets of `url()` and `@import` in CSS or an attribute value that point outside the file. */
export function externalCssReferences(css: string): string[] {
  const targets: string[] = [];
  for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gis)) targets.push(match[2] ?? "");
  for (const match of css.matchAll(/@import\s+(?:url\(\s*(['"]?)(.*?)\1\s*\)|(['"])(.*?)\3)/gis)) {
    targets.push(match[2] ?? match[4] ?? "");
  }
  for (const match of css.matchAll(/@import\s+(?!url\(|['"])(\S+)/gi)) targets.push(match[1] ?? "");
  return targets.filter((target) => !isLocalReference(target));
}

function shorten(value: string): string {
  const text = value.trim();
  return JSON.stringify(text.length > 80 ? `${text.slice(0, 77)}...` : text);
}

function numberList(value: string | null): number[] | undefined {
  if (value === null) return undefined;
  const parts = value.trim().split(/[\s,]+/);
  const numbers = parts.map(Number);
  return parts.every((part) => /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(part))
    ? numbers
    : undefined;
}

/**
 * Validates one logo's source and, when it parses, measures its paint for the staleness check.
 * Internal entities are expanded before checking, so an entity cannot smuggle in a reference.
 */
export function inspectBrandSvg(
  source: string,
  file: string,
): { diagnostics: BrandDiagnostic[]; paint: BrandPaint | undefined } {
  const diagnostics: BrandDiagnostic[] = [];
  const report = (code: BrandDiagnosticCode, message: string) =>
    diagnostics.push(brandDiagnostic(code, file, message));
  const result = () => {
    const unique = new Map(diagnostics.map((entry) => [`${entry.code}\0${entry.message}`, entry]));
    return sortBrandDiagnostics([...unique.values()]);
  };

  if (source.length > maxBrandSvgBytes) {
    report("QXB-XML-001", `SVG source exceeds the ${maxBrandSvgBytes}-byte parsing limit.`);
    return { diagnostics: result(), paint: undefined };
  }
  const { document, doctype, error } = parseBrandSvg(source);
  for (const problem of doctype?.problems ?? []) report("QXB-XML-002", problem);
  if (!document) {
    report("QXB-XML-001", `Malformed XML: ${JSON.stringify(error)}`);
    return { diagnostics: result(), paint: undefined };
  }

  const root = document.documentElement;
  if (
    !root ||
    localName(root) !== "svg" ||
    (root.namespaceURI !== null && root.namespaceURI !== NAMESPACE.SVG)
  ) {
    report("QXB-SVG-001", `The root must be <svg> in the ${NAMESPACE.SVG} namespace.`);
    return { diagnostics: result(), paint: undefined };
  }
  if (root.namespaceURI === null) {
    report(
      "QXB-SVG-007",
      `The root has no xmlns=${JSON.stringify(NAMESPACE.SVG)}; it renders inline but not as an image file.`,
    );
  }

  const viewBox = numberList(root.getAttribute("viewBox"));
  const usableViewBox =
    viewBox?.length === 4 &&
    (viewBox[2] ?? 0) > 0 &&
    (viewBox[3] ?? 0) > 0 &&
    viewBox.every(Number.isFinite);
  const width = root.getAttribute("width");
  const height = root.getAttribute("height");
  const sized =
    width !== null &&
    height !== null &&
    lengthPattern.test(width) &&
    lengthPattern.test(height) &&
    Number.parseFloat(width) > 0 &&
    Number.parseFloat(height) > 0;
  if (!usableViewBox && !sized) {
    report(
      "QXB-SVG-002",
      "The root needs a viewBox with a positive size, or numeric width and height.",
    );
  } else if (root.hasAttribute("viewBox") && !usableViewBox) {
    report(
      "QXB-SVG-008",
      `viewBox=${shorten(root.getAttribute("viewBox") ?? "")} is unusable; width and height size the file.`,
    );
  }

  const pending: Node[] = [document];
  while (pending.length > 0) {
    const node = pending.pop() as Node;
    for (let child = node.lastChild; child; child = child.previousSibling) pending.push(child);
    if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE && node.nodeName === "xml-stylesheet") {
      const href = /\bhref\s*=\s*(["'])(.*?)\1/s.exec(node.nodeValue ?? "")?.[2] ?? "";
      if (!isLocalReference(href)) {
        report("QXB-SVG-006", `xml-stylesheet loads ${shorten(href)} from outside the file.`);
      }
      continue;
    }
    if (!(node instanceof Element)) continue;
    const name = localName(node);
    if (name === "script") report("QXB-SVG-003", "<script> is not allowed.");
    if (name === "foreignObject") report("QXB-SVG-005", "<foreignObject> is not allowed.");
    if (name === "style") {
      for (const target of externalCssReferences(node.textContent ?? "")) {
        report("QXB-SVG-006", `<style> references ${shorten(target)} outside the file.`);
      }
    }
    if (animationElements.has(name) || name === "set") {
      const attribute = (node.getAttribute("attributeName") ?? "").replace(/^[^:]*:/, "");
      if (/^on/i.test(attribute)) {
        report("QXB-SVG-004", `<${name}> sets the event attribute ${JSON.stringify(attribute)}.`);
      }
      if (attribute === "href") {
        for (const field of ["to", "from", "by", "values"]) {
          for (const value of (node.getAttribute(field) ?? "").split(";")) {
            if (!isLocalReference(value)) {
              report("QXB-SVG-006", `<${name}> sets href to ${shorten(value)} outside the file.`);
            }
          }
        }
      }
    }
    for (const attribute of node.attributes) {
      const attributeName = attribute.localName ?? attribute.name.replace(/^[^:]*:/, "");
      if (attribute.prefix === "xmlns" || attribute.name === "xmlns") continue;
      if (/^on/i.test(attributeName)) {
        report("QXB-SVG-004", `Event attribute ${JSON.stringify(attribute.name)} on <${name}>.`);
      }
      if (attributeName === "href" && !isLocalReference(attribute.value)) {
        report(
          "QXB-SVG-006",
          `${attribute.name} on <${name}> points to ${shorten(attribute.value)} outside the file.`,
        );
      }
      if (/url\(|@import/i.test(attribute.value)) {
        for (const target of externalCssReferences(attribute.value)) {
          report(
            "QXB-SVG-006",
            `${attribute.name} on <${name}> references ${shorten(target)} outside the file.`,
          );
        }
      }
    }
  }
  return { diagnostics: result(), paint: analyseBrandPaint(document) };
}

export function validateBrandSvg(source: string, file: string): BrandDiagnostic[] {
  return inspectBrandSvg(source, file).diagnostics;
}

// ---------------------------------------------------------------------------------------------
// config/brands.json

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

const colorPattern = /^(?:#[0-9a-f]{6}|currentColor)$/;

/**
 * Checks `config/brands.json` against its schema: every logo's fields, the file layout, the
 * collection counts, and component names (valid, following the rule, and unique).
 */
export function validateBrandsData(value: unknown): {
  diagnostics: BrandDiagnostic[];
  data: BrandsData | undefined;
} {
  const diagnostics: BrandDiagnostic[] = [];
  const meta = (message: string) =>
    diagnostics.push(brandDiagnostic("QXB-META-001", brandsDataPath, message));
  if (!isRecord(value)) {
    meta("The file must hold a JSON object.");
    return { diagnostics, data: undefined };
  }
  if (!Array.isArray(value.collections) || !isRecord(value.logos)) {
    meta("collections must be an array and logos an object.");
    return { diagnostics, data: undefined };
  }

  const collections = new Map<string, number>();
  for (const [index, collection] of value.collections.entries()) {
    if (
      !isRecord(collection) ||
      typeof collection.id !== "string" ||
      !isKebabCase(collection.id) ||
      typeof collection.label !== "string" ||
      !Number.isInteger(collection.count)
    ) {
      meta(`collections[${index}] needs a kebab-case id, a label and an integer count.`);
      continue;
    }
    if (collections.has(collection.id)) meta(`Collection ${collection.id} is listed twice.`);
    collections.set(collection.id, collection.count as number);
  }

  const counts = new Map<string, number>();
  const componentNames = new Map<string, string>();
  for (const [slug, logo] of Object.entries(value.logos)) {
    const at = `logos.${slug}`;
    if (!isKebabCase(slug)) meta(`${at}: the slug must be kebab-case.`);
    if (!isRecord(logo)) {
      meta(`${at} must be an object.`);
      continue;
    }
    for (const field of ["title", "collection", "componentName", "defaultVariant", "license"]) {
      if (typeof logo[field] !== "string" || !logo[field]) meta(`${at}.${field} must be a string.`);
    }
    for (const field of ["licenseRaw", "website", "guidelines"]) {
      if (!isNullableString(logo[field])) meta(`${at}.${field} must be a string or null.`);
    }
    if (typeof logo.source !== "string" || !/^https:\/\//.test(logo.source)) {
      meta(`${at}.source must be an https URL.`);
    }
    if (logo.hex !== null && (typeof logo.hex !== "string" || !/^[0-9A-F]{6}$/.test(logo.hex))) {
      meta(`${at}.hex must be uppercase RRGGBB or null.`);
    }
    if (!isStringList(logo.categories) || !isStringList(logo.aliases)) {
      meta(`${at}.categories and aliases must be arrays of strings.`);
    }
    // Only Qeet's own artwork ships; third-party brand logos come from theSVG directly.
    if (logo.firstParty !== true)
      meta(`${at}.firstParty must be true: only first-party logos ship.`);
    if ((logo.firstParty === true) !== (logo.licenseClass === "first-party")) {
      meta(`${at}: firstParty and licenseClass "first-party" go together.`);
    }
    if (!brandLicenseClasses.includes(logo.licenseClass as never)) {
      meta(`${at}.licenseClass must be one of ${brandLicenseClasses.join(", ")}.`);
    }
    const collection = typeof logo.collection === "string" ? logo.collection : "";
    if (!collections.has(collection))
      meta(`${at}: collection ${JSON.stringify(collection)} is not listed.`);
    counts.set(collection, (counts.get(collection) ?? 0) + 1);

    const componentName = logo.componentName;
    if (typeof componentName === "string") {
      if (!identifierPattern.test(componentName) || componentName !== brandComponentName(slug)) {
        diagnostics.push(
          brandDiagnostic(
            "QXB-NAME-001",
            brandsDataPath,
            `${at}.componentName must be ${JSON.stringify(brandComponentName(slug))}.`,
          ),
        );
      }
      const clash = componentNames.get(componentName);
      if (clash) {
        diagnostics.push(
          brandDiagnostic(
            "QXB-NAME-002",
            brandsDataPath,
            `${clash} and ${slug} share the component name ${componentName}.`,
          ),
        );
      } else componentNames.set(componentName, slug);
    }

    if (!isRecord(logo.variants) || Object.keys(logo.variants).length === 0) {
      meta(`${at}.variants must be a non-empty object.`);
      continue;
    }
    if (typeof logo.defaultVariant === "string" && !(logo.defaultVariant in logo.variants)) {
      meta(`${at}.defaultVariant ${JSON.stringify(logo.defaultVariant)} is not a variant.`);
    }
    for (const [name, variant] of Object.entries(logo.variants)) {
      const vat = `${at}.variants.${name}`;
      if (!isKebabCase(name)) meta(`${vat}: the variant name must be kebab-case.`);
      if (!isRecord(variant)) {
        meta(`${vat} must be an object.`);
        continue;
      }
      if (variant.file !== brandVariantFile(slug, name)) {
        diagnostics.push(
          brandDiagnostic(
            "QXB-MAP-003",
            String(variant.file),
            `${vat}.file must be ${JSON.stringify(brandVariantFile(slug, name))}.`,
          ),
        );
      }
      if (!brandBackgrounds.includes(variant.background as never)) {
        meta(`${vat}.background must be one of ${brandBackgrounds.join(", ")}.`);
      }
      if (
        !isStringList(variant.colors) ||
        !variant.colors.every((color) => colorPattern.test(color))
      ) {
        meta(`${vat}.colors must list #rrggbb colours or currentColor.`);
      }
    }
  }
  for (const [id, count] of collections) {
    if ((counts.get(id) ?? 0) !== count) {
      meta(`Collection ${id} counts ${count} logos but ${counts.get(id) ?? 0} belong to it.`);
    }
  }
  return {
    diagnostics,
    data: diagnostics.some((entry) => entry.code === "QXB-META-001")
      ? undefined
      : (value as unknown as BrandsData),
  };
}

// ---------------------------------------------------------------------------------------------
// Repository

/** Repository-relative paths of every file under `icons/brand-icons/`, except `.gitkeep`. */
export function listBrandFiles(repositoryRoot: string): string[] {
  const files: string[] = [];
  const visit = (relative: string) => {
    const absolute = join(repositoryRoot, relative);
    if (!existsSync(absolute)) return;
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue;
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(path);
      else if (path !== `${brandsRoot}/.gitkeep`) files.push(path);
    }
  };
  visit(brandsRoot);
  return files.sort(compareText);
}

export type BrandsRepositoryResult = {
  readonly diagnostics: readonly BrandDiagnostic[];
  readonly logoCount: number;
  readonly fileCount: number;
  readonly bytes: number;
};

/**
 * Validates `config/brands.json` and `icons/brand-icons/` together. With `content: false` only the
 * schema and the file mapping are checked, which skips reading and parsing every file.
 */
export function validateBrandsRepository(
  repositoryRoot: string,
  options: { readonly content?: boolean } = {},
): BrandsRepositoryResult {
  const diagnostics: BrandDiagnostic[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(repositoryRoot, brandsDataPath), "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    diagnostics.push(brandDiagnostic("QXB-IO-001", brandsDataPath, `Cannot read: ${message}`));
    return { diagnostics, logoCount: 0, fileCount: 0, bytes: 0 };
  }
  const { diagnostics: schema, data } = validateBrandsData(parsed);
  diagnostics.push(...schema);
  if (!data)
    return { diagnostics: sortBrandDiagnostics(diagnostics), logoCount: 0, fileCount: 0, bytes: 0 };

  const listed = new Map<string, BrandPaint>();
  for (const logo of Object.values(data.logos)) {
    for (const variant of Object.values(logo.variants)) listed.set(variant.file, variant);
  }
  const onDisk = listBrandFiles(repositoryRoot);
  const present = new Set(onDisk);
  for (const file of onDisk) {
    if (!listed.has(file)) {
      diagnostics.push(brandDiagnostic("QXB-MAP-001", file, `Not listed in ${brandsDataPath}.`));
    }
  }
  let bytes = 0;
  for (const [file, recorded] of listed) {
    if (!present.has(file)) {
      diagnostics.push(
        brandDiagnostic("QXB-MAP-002", file, `Listed in ${brandsDataPath}, but missing.`),
      );
      continue;
    }
    if (options.content === false) continue;
    let source: string;
    try {
      const buffer = readFileSync(join(repositoryRoot, file));
      bytes += buffer.length;
      source = decodeBrandSvg(buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      diagnostics.push(brandDiagnostic("QXB-XML-001", file, `Cannot decode: ${message}`));
      continue;
    }
    const { diagnostics: found, paint } = inspectBrandSvg(source, file);
    diagnostics.push(...found);
    if (
      paint &&
      (paint.background !== recorded.background ||
        paint.colors.join(" ") !== recorded.colors.join(" "))
    ) {
      diagnostics.push(
        brandDiagnostic(
          "QXB-META-002",
          file,
          `Recorded ${recorded.background} [${recorded.colors.join(" ")}] but the file paints ` +
            `${paint.background} [${paint.colors.join(" ")}]; update ${brandsDataPath}.`,
        ),
      );
    }
  }
  return {
    diagnostics: sortBrandDiagnostics(diagnostics),
    logoCount: Object.keys(data.logos).length,
    fileCount: listed.size,
    bytes,
  };
}
