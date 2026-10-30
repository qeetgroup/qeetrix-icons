import { DOMParser, type Element, Node, onWarningStopParsing } from "@xmldom/xmldom";
import CanvasKitInit, { type CanvasKit, type Path } from "canvaskit-wasm";
import { childElements, classifyBrandSvg, decodeBrandSvg, localName } from "./brands.js";
import type { LogoPlan } from "./logo-plan.js";
import { decodeSvgDataUri } from "./logo-source.js";

/**
 * The Qeet logos as plain SVG files in the package, for platforms that draw SVG themselves
 * (Android VectorDrawable, iOS vector assets):
 *
 * - `svg/logos/<slug>/<variant>.svg`: each variant's file byte for byte, the same bytes its
 *   component embeds;
 * - `svg/logos/<slug>/<variant>.mask-free.svg`: for a file that draws with `<mask>`, which those
 *   platforms cannot draw, the same drawing with every mask applied to the geometry it masks.
 *
 * Paths are relative to `dist/`; the build writes them (`scripts/build/package-assets.ts`), never
 * into the repository. Like the rest of the logo pipeline, this shares no code with the icons'.
 */

export const logoSvgDirectory = "svg/logos";

export const logoSvgPath = (slug: string, variant: string) =>
  `${logoSvgDirectory}/${slug}/${variant}.svg`;

export const maskFreeLogoSvgPath = (slug: string, variant: string) =>
  `${logoSvgDirectory}/${slug}/${variant}.mask-free.svg`;

export type LogoPackageFile = {
  readonly path: string;
  readonly contents: string | Uint8Array;
};

/** A mask this derivation cannot apply exactly; the message says which part and why. */
export class MaskFreeError extends Error {}

const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

let canvasKit: Promise<CanvasKit> | undefined;

/** CanvasKit's path engine (Skia PathOps), loaded once and only for a file that has a mask. */
function loadCanvasKit(): Promise<CanvasKit> {
  canvasKit ??= CanvasKitInit();
  return canvasKit;
}

/**
 * Every logo file the package ships, in path order: each variant's file as its component embeds
 * it, and the mask-free derivation of each one drawn with `<mask>`.
 */
export async function renderLogoPackageFiles(plan: LogoPlan): Promise<LogoPackageFile[]> {
  if (plan.diagnostics.length > 0) throw new Error("The logo plan has errors.");
  const files: LogoPackageFile[] = [];
  for (const logo of plan.logos) {
    for (const variant of logo.variants) {
      const bytes = decodeSvgDataUri(variant.src);
      files.push({ path: logoSvgPath(logo.id, variant.name), contents: bytes });
      const maskFree = await deriveMaskFreeSvg(decodeBrandSvg(bytes), variant.file);
      if (maskFree !== undefined) {
        files.push({ path: maskFreeLogoSvgPath(logo.id, variant.name), contents: maskFree });
      }
    }
  }
  return files.sort((left, right) => compareText(left.path, right.path));
}

// ---------------------------------------------------------------------------------------------
// Mask-free derivation

const white = new Set(["#fff", "#ffffff", "white"]);
const black = new Set(["#000", "#000000", "black"]);
const number = /^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?\s*$/i;
const percentage = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)%\s*$/i;

/** The element and every element inside it, in document order. */
function elements(root: Element): Element[] {
  return [root, ...childElements(root).flatMap(elements)];
}

const rectAttributes = ["x", "y", "width", "height", "fill"];

/** A user-space number, or a percentage of `base` where `base` is given. */
function length(value: string | null, base: number | undefined, fallback: number): number {
  if (value === null) return fallback;
  if (number.test(value)) return Number(value);
  const match = percentage.exec(value);
  if (match && base !== undefined) return (Number(match[1]) / 100) * base;
  throw new MaskFreeError(`unsupported length ${JSON.stringify(value)}`);
}

function only(element: Element, allowed: readonly string[], what: string): void {
  for (const { name } of Array.from(element.attributes)) {
    if (!allowed.includes(name)) {
      throw new MaskFreeError(`${what} has ${name}=, which this derivation does not apply`);
    }
  }
}

/** A rectangle as a path; empty when it has no area, as SVG draws nothing for it. */
function rectangle(CK: CanvasKit, x: number, y: number, width: number, height: number): Path {
  const path = CK.Path.MakeFromSVGString(
    width > 0 && height > 0 ? `M${x} ${y}H${x + width}V${y + height}H${x}Z` : "",
  );
  if (!path) throw new MaskFreeError("Skia could not build a rectangle");
  return path;
}

/**
 * The painted extent of one area-painting element, as a CanvasKit path in its user space.
 * Only `<path>` and `<rect>` without rounded corners: what hole-cutting masks use.
 */
function shapeOf(
  CK: CanvasKit,
  element: Element,
  what: string,
  rule = element.getAttribute("fill-rule"),
): Path {
  const tag = localName(element);
  let path: Path | null = null;
  if (tag === "path") {
    path = CK.Path.MakeFromSVGString(element.getAttribute("d") ?? "");
  } else if (tag === "rect") {
    const x = length(element.getAttribute("x"), undefined, 0);
    const y = length(element.getAttribute("y"), undefined, 0);
    const width = length(element.getAttribute("width"), undefined, 0);
    const height = length(element.getAttribute("height"), undefined, 0);
    path = rectangle(CK, x, y, width, height);
  } else {
    throw new MaskFreeError(`${what} is a <${tag}>; only <path> and <rect> are applied`);
  }
  if (!path) throw new MaskFreeError(`${what} has unreadable path data`);
  if (rule === "evenodd") path.setFillType(CK.FillType.EvenOdd);
  else if (rule !== null && rule !== "nonzero") {
    path.delete();
    throw new MaskFreeError(`${what} has fill-rule=${JSON.stringify(rule)}`);
  }
  return path;
}

function operate(CK: CanvasKit, left: Path, right: Path, op: "union" | "difference" | "intersect") {
  const result = CK.Path.MakeFromOp(
    left,
    right,
    op === "union"
      ? CK.PathOp.Union
      : op === "difference"
        ? CK.PathOp.Difference
        : CK.PathOp.Intersect,
  );
  if (!result) throw new MaskFreeError(`Skia could not compute the ${op} of two shapes`);
  return result;
}

/**
 * The area a luminance mask keeps, in the masked element's user space: its region, painted in
 * order by white shapes (kept) and black shapes (cut). Unpainted mask is black, so nothing else
 * is kept. Only opaque pure white and black, untransformed and unstroked, are applied; anything
 * with partial coverage (grey, opacity, gradients) has no exact path form.
 */
function keptArea(CK: CanvasKit, mask: Element, viewBox: readonly number[]): Path {
  const id = mask.getAttribute("id");
  const what = `<mask id=${JSON.stringify(id)}>`;
  only(
    mask,
    ["id", "maskUnits", "maskContentUnits", "mask-type", "x", "y", "width", "height"],
    what,
  );
  if (mask.getAttribute("maskUnits") !== "userSpaceOnUse") {
    throw new MaskFreeError(`${what} needs maskUnits="userSpaceOnUse"`);
  }
  for (const [name, wanted] of [
    ["maskContentUnits", "userSpaceOnUse"],
    ["mask-type", "luminance"],
  ] as const) {
    const value = mask.getAttribute(name);
    if (value !== null && value !== wanted) {
      throw new MaskFreeError(`${what} has ${name}=${JSON.stringify(value)}`);
    }
  }
  const [, , width = 0, height = 0] = viewBox;
  // A region left out is -10% / 120% of the viewport on each axis, as SVG defines it.
  const region = rectangle(
    CK,
    length(mask.getAttribute("x"), width, -0.1 * width),
    length(mask.getAttribute("y"), height, -0.1 * height),
    length(mask.getAttribute("width"), width, 1.2 * width),
    length(mask.getAttribute("height"), height, 1.2 * height),
  );
  let kept = rectangle(CK, 0, 0, 0, 0);
  try {
    for (let child = mask.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === Node.TEXT_NODE && /\S/.test(child.nodeValue ?? "")) {
        throw new MaskFreeError(`${what} has text content`);
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const element = child as Element;
      const tag = localName(element);
      const part = `${what} <${tag}>`;
      if (tag !== "path" && tag !== "rect") {
        throw new MaskFreeError(`${part}: only <path> and <rect> are applied`);
      }
      only(element, tag === "path" ? ["d", "fill", "fill-rule"] : rectAttributes, part);
      const fill = (element.getAttribute("fill") ?? "black").trim().toLowerCase();
      if (!white.has(fill) && !black.has(fill)) {
        throw new MaskFreeError(`${part} is filled ${JSON.stringify(fill)}, not white or black`);
      }
      const shape = shapeOf(CK, element, part);
      const next = operate(CK, kept, shape, white.has(fill) ? "union" : "difference");
      shape.delete();
      kept.delete();
      kept = next;
    }
    const inRegion = operate(CK, kept, region, "intersect");
    kept.delete();
    kept = inRegion;
    return kept;
  } catch (error) {
    kept.delete();
    throw error;
  } finally {
    region.delete();
  }
}

/**
 * Absolute area enclosed by a path's contours, curves sampled finely. Used only to tell an empty
 * result from a real one, so overlapping contours counting twice does not matter.
 */
function pathArea(CK: CanvasKit, path: Path): number {
  const cmds = path.toCmds();
  let total = 0;
  let contour = 0;
  let start: [number, number] = [0, 0];
  let last: [number, number] = [0, 0];
  const edge = (to: [number, number]) => {
    contour += last[0] * to[1] - to[0] * last[1];
    last = to;
  };
  const close = () => {
    edge(start);
    total += Math.abs(contour) / 2;
    contour = 0;
  };
  const sample = (at: (t: number) => [number, number]) => {
    for (let step = 1; step <= 32; step += 1) edge(at(step / 32));
  };
  let index = 0;
  while (index < cmds.length) {
    const verb = cmds[index];
    index += 1;
    const [x0, y0] = last;
    if (verb === CK.MOVE_VERB) {
      close();
      start = [cmds[index], cmds[index + 1]];
      last = start;
      index += 2;
    } else if (verb === CK.LINE_VERB) {
      edge([cmds[index], cmds[index + 1]]);
      index += 2;
    } else if (verb === CK.QUAD_VERB) {
      const [x1, y1, x2, y2] = Array.from(cmds.subarray(index, index + 4));
      sample((t) => [
        (1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t ** 2 * x2,
        (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t ** 2 * y2,
      ]);
      index += 4;
    } else if (verb === CK.CONIC_VERB) {
      const [x1, y1, x2, y2, w] = Array.from(cmds.subarray(index, index + 5));
      sample((t) => {
        const a = (1 - t) ** 2;
        const b = 2 * w * (1 - t) * t;
        const c = t ** 2;
        const d = a + b + c;
        return [(a * x0 + b * x1 + c * x2) / d, (a * y0 + b * y1 + c * y2) / d];
      });
      index += 5;
    } else if (verb === CK.CUBIC_VERB) {
      const [x1, y1, x2, y2, x3, y3] = Array.from(cmds.subarray(index, index + 6));
      sample((t) => [
        (1 - t) ** 3 * x0 + 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3 * x3,
        (1 - t) ** 3 * y0 + 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3 * y3,
      ]);
      index += 6;
    } else if (verb === CK.CLOSE_VERB) {
      close();
      last = start;
    }
  }
  close();
  return total;
}

/**
 * Applies one mask to the `<path>` it masks. When the mask removes none of the path's area (it
 * cuts a hole the path already leaves open, as the Qeet mark's does), the mask goes and the
 * geometry stays exactly as drawn. Otherwise the path becomes its intersection with the area the
 * mask keeps, with the fill rule Skia computed it under.
 */
function applyMask(
  CK: CanvasKit,
  element: Element,
  mask: Element,
  viewBox: readonly number[],
): void {
  const what = `<${localName(element)} mask=${JSON.stringify(element.getAttribute("mask"))}>`;
  if (localName(element) !== "path") {
    throw new MaskFreeError(`${what}: only a masked <path> is applied`);
  }
  for (let node: Element | null = element; node; node = node.parentNode as Element | null) {
    if (node.nodeType !== Node.ELEMENT_NODE) break;
    for (const name of ["transform", "style", "class", "clip-path", "filter"]) {
      if (node.getAttribute(name) !== null) {
        throw new MaskFreeError(`${what}: ${name}= on it or around it is not applied`);
      }
    }
  }
  // The fill rule the path is painted with: its own, or the nearest ancestor's.
  let rule: string | null = null;
  for (
    let node: Element | null = element;
    node && rule === null;
    node = node.parentNode as Element | null
  ) {
    if (node.nodeType !== Node.ELEMENT_NODE) break;
    rule = node.getAttribute("fill-rule");
  }
  const kept = keptArea(CK, mask, viewBox);
  const shape = shapeOf(CK, element, what, rule);
  try {
    const removed = operate(CK, shape, kept, "difference");
    const nothingRemoved = pathArea(CK, removed) <= 1e-9 * (viewBox[2] ?? 0) * (viewBox[3] ?? 0);
    removed.delete();
    if (!nothingRemoved) {
      const result = operate(CK, shape, kept, "intersect");
      element.setAttribute("d", result.toSVGString());
      element.setAttribute(
        "fill-rule",
        result.getFillType() === CK.FillType.EvenOdd ? "evenodd" : "nonzero",
      );
      result.delete();
    }
    element.removeAttribute("mask");
  } finally {
    shape.delete();
    kept.delete();
  }
}

const escapeAttribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const escapeText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Prints the document: elements and attributes in source order, attribute whitespace collapsed
 * (XML has already turned the source's line breaks in path data into spaces), comments and the
 * XML declaration dropped. One element per line; an element with text (`<title>`) on one line.
 */
function serialize(root: Element): string {
  const open = (element: Element) =>
    `<${element.tagName}${Array.from(element.attributes, ({ name, value }) => ` ${name}="${escapeAttribute(value.replace(/\s+/g, " ").trim())}"`).join("")}`;
  const inline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
      return escapeText(node.nodeValue ?? "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const element = node as Element;
    const children = Array.from(element.childNodes, inline).join("");
    return children === ""
      ? `${open(element)}/>`
      : `${open(element)}>${children}</${element.tagName}>`;
  };
  const block = (element: Element, depth: number): string[] => {
    const indent = "  ".repeat(depth);
    const nodes = Array.from(element.childNodes);
    const hasText = nodes.some(
      (node) =>
        (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) &&
        /\S/.test(node.nodeValue ?? ""),
    );
    if (hasText) return [`${indent}${inline(element)}`];
    const children = childElements(element);
    if (children.length === 0) return [`${indent}${open(element)}/>`];
    return [
      `${indent}${open(element)}>`,
      ...children.flatMap((child) => block(child, depth + 1)),
      `${indent}</${element.tagName}>`,
    ];
  };
  return [...block(root, 0), ""].join("\n");
}

/**
 * The mask-free version of a logo file, or `undefined` when it has no mask. Every `<mask>` is
 * applied to the `<path>` it masks and removed, with any `<defs>` it leaves empty; the rest of the
 * document is printed as it was. The result is checked to have no mask left and to paint the
 * same colours as the file; anything the derivation cannot apply exactly throws instead of
 * shipping a drawing that renders differently.
 */
export async function deriveMaskFreeSvg(source: string, file: string): Promise<string | undefined> {
  const document = new DOMParser({ onError: onWarningStopParsing }).parseFromString(
    source,
    "application/xml",
  );
  const root = document.documentElement;
  if (!root || localName(root) !== "svg") throw new MaskFreeError(`${file}: no <svg> root.`);
  const all = elements(root);
  const masked = all.filter((element) => element.getAttribute("mask") !== null);
  const masks = all.filter((element) => localName(element) === "mask");
  if (masked.length === 0 && masks.length === 0) {
    if (/mask/i.test(all.map((element) => element.getAttribute("style") ?? "").join(" "))) {
      throw new MaskFreeError(`${file}: a CSS mask is not applied.`);
    }
    return undefined;
  }
  if (all.some((element) => localName(element) === "style")) {
    throw new MaskFreeError(`${file}: a <style> element could mask too; it is not applied.`);
  }
  const viewBox = (root.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))) {
    throw new MaskFreeError(`${file}: a mask is applied in the viewBox's units; it has none.`);
  }
  try {
    const CK = await loadCanvasKit();
    for (const element of masked) {
      const reference = /^\s*url\(\s*#([^)\s]+)\s*\)\s*$/.exec(element.getAttribute("mask") ?? "");
      const mask = masks.find((candidate) => candidate.getAttribute("id") === reference?.[1]);
      if (!mask) {
        throw new MaskFreeError(
          `mask=${JSON.stringify(element.getAttribute("mask"))} is no <mask>`,
        );
      }
      applyMask(CK, element, mask, viewBox);
    }
  } catch (error) {
    if (error instanceof MaskFreeError) throw new MaskFreeError(`${file}: ${error.message}.`);
    throw error;
  }
  for (const mask of masks) {
    const parent = mask.parentNode;
    parent?.removeChild(mask);
    if (
      parent &&
      localName(parent as Element) === "defs" &&
      childElements(parent as Element).length === 0
    ) {
      parent.parentNode?.removeChild(parent);
    }
  }
  const result = serialize(root);
  if (/<mask\b|\bmask=/.test(result)) throw new MaskFreeError(`${file}: a mask is left.`);
  const before = classifyBrandSvg(source).colors;
  const after = classifyBrandSvg(result).colors;
  if (after.join() !== before.join()) {
    throw new MaskFreeError(
      `${file}: the mask-free drawing paints ${after.join(", ")}, not ${before.join(", ")}.`,
    );
  }
  return result;
}
