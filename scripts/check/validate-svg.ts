import { Buffer } from "node:buffer";
import {
  DOMParser,
  type Document,
  Element,
  NAMESPACE,
  Node,
  onWarningStopParsing,
} from "@xmldom/xmldom";
import { iconSystem } from "../../config/icon-system.js";
import type { IconVariant } from "../../src/types/icon.js";
import { type Diagnostic, diagnostic, sortDiagnostics } from "../lib/diagnostics.js";

export const maxSvgBytes = 1024 * 1024;

const presentationAttributes = new Set([
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "fill-rule",
]);

const elementAttributes = new Map<string, readonly string[]>([
  ["svg", ["viewBox", "xmlns"]],
  ["g", []],
  ["path", ["d"]],
  ["circle", ["cx", "cy", "r"]],
  ["ellipse", ["cx", "cy", "rx", "ry"]],
  ["rect", ["x", "y", "width", "height", "rx", "ry"]],
  ["line", ["x1", "y1", "x2", "y2"]],
  ["polyline", ["points"]],
  ["polygon", ["points"]],
]);

const requiredAttributes = new Map<string, readonly string[]>([
  ["path", ["d"]],
  ["circle", ["r"]],
  ["ellipse", ["rx", "ry"]],
  ["rect", ["width", "height"]],
  ["polyline", ["points"]],
  ["polygon", ["points"]],
]);

const numericAttributes = new Set([
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "stroke-width",
]);
const positiveAttributes = new Set(["r", "width", "height", "stroke-width"]);
const numberPattern = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
const scalarPattern = new RegExp(`^${numberPattern}$`);
const listPattern = new RegExp(
  `^${numberPattern}(?:(?:[\\t\\n\\r ]*,[\\t\\n\\r ]*|[\\t\\n\\r ]+)${numberPattern})*$`,
);

function isFiniteNumber(value: string): boolean {
  return scalarPattern.test(value) && Number.isFinite(Number(value));
}

function numberList(value: string): number[] | undefined {
  const trimmed = value.trim();
  if (!listPattern.test(trimmed)) return undefined;
  const numbers = trimmed.split(/[\t\n\r ,]+/).map(Number);
  return numbers.every(Number.isFinite) ? numbers : undefined;
}

function hasValidPathTokens(value: string): boolean {
  const tokenPattern = new RegExp(`${numberPattern}|[MmZzLlHhVvCcSsQqTtAa]|[\\t\\n\\r ,]+`, "gy");
  const tokens: string[] = [];
  let position = 0;
  while (position < value.length) {
    tokenPattern.lastIndex = position;
    const match = tokenPattern.exec(value);
    if (!match) return false;
    position = tokenPattern.lastIndex;
    if (/^[\t\n\r ,]+$/.test(match[0])) continue;
    if (!/^[A-Za-z]$/.test(match[0]) && !isFiniteNumber(match[0])) return false;
    tokens.push(match[0]);
  }
  if (!/^[Mm]$/.test(tokens[0] ?? "")) return false;
  if (!isFiniteNumber(tokens[1] ?? "") || !isFiniteNumber(tokens[2] ?? "")) return false;
  return tokens.every(
    (token, index) =>
      !/^[MmLlHhVvCcSsQqTtAa]$/.test(token) || isFiniteNumber(tokens[index + 1] ?? ""),
  );
}

function validateVariant(
  element: Element,
  variant: IconVariant,
  root: boolean,
  file: string,
): Diagnostic[] {
  const { architecture, calibration } = iconSystem;
  const diagnostics: Diagnostic[] = [];
  const expected: Record<string, string> =
    variant === "outline"
      ? {
          fill: "none",
          stroke: architecture.color,
          "stroke-width": String(calibration.strokeWidth),
          "stroke-linecap": calibration.linecap,
          "stroke-linejoin": calibration.linejoin,
        }
      : { fill: architecture.color };

  for (const [name, expectedValue] of Object.entries(expected)) {
    if (!root && (variant === "filled" || !element.hasAttribute(name))) continue;
    const actual = element.getAttribute(name)?.trim();
    const matches =
      name === "stroke-width"
        ? actual !== undefined &&
          isFiniteNumber(actual) &&
          Number(actual) === calibration.strokeWidth
        : actual === expectedValue;
    if (!matches) {
      diagnostics.push(
        diagnostic(
          "QXI-SVG-007",
          file,
          `<${element.tagName}> ${name} must be ${JSON.stringify(expectedValue)} for ${variant} source.`,
        ),
      );
    }
  }
  return diagnostics;
}

function validateGeometry(element: Element, file: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const name of requiredAttributes.get(element.tagName) ?? []) {
    if (!element.hasAttribute(name) || !element.getAttribute(name)?.trim()) {
      diagnostics.push(diagnostic("QXI-SVG-008", file, `<${element.tagName}> requires ${name}.`));
    }
  }
  for (const attribute of element.attributes) {
    const { name } = attribute;
    const value = attribute.value.trim();
    if (numericAttributes.has(name)) {
      const numeric = Number(value);
      if (
        !isFiniteNumber(value) ||
        (positiveAttributes.has(name) && numeric <= 0) ||
        ((name === "rx" || name === "ry") &&
          (numeric < 0 || (element.tagName === "ellipse" && numeric === 0)))
      ) {
        diagnostics.push(
          diagnostic(
            "QXI-SVG-008",
            file,
            `<${element.tagName}> has invalid numeric ${name}=${JSON.stringify(value)}.`,
          ),
        );
      }
    }
    if (name === "d" && !hasValidPathTokens(value)) {
      diagnostics.push(
        diagnostic(
          "QXI-SVG-008",
          file,
          "Path data needs an initial moveto pair, known commands, and finite numeric tokens.",
        ),
      );
    }
    if (name === "points") {
      const points = numberList(value);
      const minimum = element.tagName === "polygon" ? 6 : 4;
      if (!points || points.length < minimum || points.length % 2 !== 0) {
        diagnostics.push(
          diagnostic(
            "QXI-SVG-008",
            file,
            `<${element.tagName}> needs finite coordinate pairs for at least ${minimum / 2} points.`,
          ),
        );
      }
    }
  }
  return diagnostics;
}

export function validateSvg(source: string, file: string, variant: IconVariant): Diagnostic[] {
  if (Buffer.byteLength(source, "utf8") > maxSvgBytes) {
    return [
      diagnostic("QXI-XML-001", file, `SVG source exceeds the ${maxSvgBytes}-byte parsing limit.`),
    ];
  }

  let document: Document;
  try {
    document = new DOMParser({ onError: onWarningStopParsing }).parseFromString(
      source,
      "application/xml",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "XML parsing failed.";
    return [diagnostic("QXI-XML-001", file, `Malformed XML: ${JSON.stringify(message)}`)];
  }

  const root = document.documentElement;
  if (
    root?.tagName !== "svg" ||
    root.namespaceURI !== NAMESPACE.SVG ||
    root.getAttribute("xmlns") !== NAMESPACE.SVG
  ) {
    return [
      diagnostic(
        "QXI-SVG-001",
        file,
        `Use an unprefixed <svg> root with xmlns=${JSON.stringify(NAMESPACE.SVG)}.`,
      ),
    ];
  }

  const diagnostics: Diagnostic[] = [];
  const expectedViewBox = iconSystem.architecture.viewBox.split(" ").map(Number);
  const viewBox = numberList(root.getAttribute("viewBox") ?? "");
  if (
    !viewBox ||
    viewBox.length !== expectedViewBox.length ||
    viewBox.some((value, index) => value !== expectedViewBox[index])
  ) {
    diagnostics.push(
      diagnostic(
        "QXI-SVG-002",
        file,
        `viewBox must describe ${JSON.stringify(iconSystem.architecture.viewBox)}.`,
      ),
    );
  }

  let geometryCount = 0;
  const pending: Node[] = [document];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) break;
    for (let child = node.lastChild; child; child = child.previousSibling) pending.push(child);
    if (!(node instanceof Element)) {
      const allowed =
        node.nodeType === Node.DOCUMENT_NODE ||
        node.nodeType === Node.COMMENT_NODE ||
        (node.nodeType === Node.TEXT_NODE && /^[\t\n\r ]*$/.test(node.nodeValue ?? "")) ||
        (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE && node.nodeName === "xml");
      if (!allowed) {
        diagnostics.push(
          diagnostic(
            "QXI-XML-002",
            file,
            "Only geometry, whitespace, comments, and an optional XML declaration are allowed; no DTD, processing instructions, CDATA, or text.",
          ),
        );
      }
      continue;
    }

    const attributes = elementAttributes.get(node.tagName);
    if (
      !attributes ||
      node.namespaceURI !== NAMESPACE.SVG ||
      (node !== root && node.tagName === "svg")
    ) {
      diagnostics.push(diagnostic("QXI-SVG-004", file, `Unsupported element <${node.tagName}>.`));
      continue;
    }
    if (node !== root && !["svg", "g"].includes(node.parentElement?.tagName ?? "")) {
      diagnostics.push(
        diagnostic("QXI-SVG-004", file, `Place <${node.tagName}> inside the root <svg> or a <g>.`),
      );
    }
    if (node.tagName !== "svg" && node.tagName !== "g") geometryCount += 1;

    for (const attribute of node.attributes) {
      const { name } = attribute;
      const value = attribute.value.trim();
      if (node === root && (name === "width" || name === "height")) {
        diagnostics.push(
          diagnostic(
            "QXI-SVG-003",
            file,
            `Root ${name} is controlled by the future runtime, not the artwork.`,
          ),
        );
      } else if (!attributes.includes(name) && !presentationAttributes.has(name)) {
        diagnostics.push(
          diagnostic(
            "QXI-SVG-005",
            file,
            `Attribute ${JSON.stringify(name)} is not allowed on <${node.tagName}>.`,
          ),
        );
      }
      if (
        (name === "fill" || name === "stroke") &&
        value !== iconSystem.architecture.color &&
        value !== "none"
      ) {
        diagnostics.push(
          diagnostic(
            "QXI-SVG-006",
            file,
            `Paint ${JSON.stringify(value)} is not allowed; use ${iconSystem.architecture.color} or none.`,
          ),
        );
      }
      const allowedValues =
        name === "stroke-linecap"
          ? ["butt", "round", "square"]
          : name === "stroke-linejoin"
            ? ["miter", "round", "bevel"]
            : name === "fill-rule"
              ? ["nonzero", "evenodd"]
              : undefined;
      if (allowedValues && !allowedValues.includes(value)) {
        diagnostics.push(
          diagnostic(
            "QXI-SVG-007",
            file,
            `Invalid ${name}=${JSON.stringify(value)} on <${node.tagName}>.`,
          ),
        );
      }
    }
    diagnostics.push(...validateVariant(node, variant, node === root, file));
    diagnostics.push(...validateGeometry(node, file));
  }
  if (geometryCount === 0) {
    diagnostics.push(
      diagnostic("QXI-SVG-008", file, "Include at least one supported geometry element."),
    );
  }
  return sortDiagnostics(diagnostics);
}
