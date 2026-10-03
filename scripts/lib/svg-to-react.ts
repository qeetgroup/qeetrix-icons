import { DOMParser, Element, Node, onWarningStopParsing } from "@xmldom/xmldom";
import { compareText } from "./diagnostics.js";

/** One SVG element with React attribute names, children in source drawing order. */
export type ReactSvgElement = {
  readonly tag: string;
  readonly attributes: readonly (readonly [name: string, value: string])[];
  readonly children: readonly ReactSvgElement[];
};

/**
 * How each known SVG attribute is spelled in React. This table decides spelling only; Phase 2B
 * validation decides what source may contain. An attribute missing here fails generation rather
 * than leaking an invalid JSX name, so widening the validator forces a deliberate entry here.
 */
const reactAttributeNames = new Map([
  ["class", "className"],
  ["clip-rule", "clipRule"],
  ["cx", "cx"],
  ["cy", "cy"],
  ["d", "d"],
  ["fill", "fill"],
  ["fill-rule", "fillRule"],
  ["height", "height"],
  ["points", "points"],
  ["r", "r"],
  ["rx", "rx"],
  ["ry", "ry"],
  ["stroke", "stroke"],
  ["stroke-linecap", "strokeLinecap"],
  ["stroke-linejoin", "strokeLinejoin"],
  ["stroke-width", "strokeWidth"],
  ["viewBox", "viewBox"],
  ["width", "width"],
  ["x", "x"],
  ["x1", "x1"],
  ["x2", "x2"],
  ["xmlns", "xmlns"],
  ["y", "y"],
  ["y1", "y1"],
  ["y2", "y2"],
]);

/** Characters a JSX string attribute cannot carry verbatim: quotes, entities, braces, controls. */
const unsafeJsxText = /["&\\{}<>\p{Cc}]/u;

export function reactAttributeName(name: string): string {
  const mapped = reactAttributeNames.get(name);
  if (!mapped) throw new Error(`No React attribute mapping for ${JSON.stringify(name)}.`);
  return mapped;
}

function convertElement(element: Element): ReactSvgElement {
  if (!/^[a-z]+$/.test(element.tagName)) {
    throw new Error(`Cannot emit element <${element.tagName}> as JSX.`);
  }
  const attributes = Array.from(element.attributes, ({ name, value }) => {
    if (unsafeJsxText.test(value)) {
      throw new Error(`Cannot emit ${name}=${JSON.stringify(value)} as a JSX string attribute.`);
    }
    return [reactAttributeName(name), value] as const;
  }).sort(([left], [right]) => compareText(left, right));

  const children: ReactSvgElement[] = [];
  for (let node = element.firstChild; node; node = node.nextSibling) {
    if (node instanceof Element) children.push(convertElement(node));
    else if (node.nodeType === Node.TEXT_NODE && /[^\t\n\r ]/.test(node.nodeValue ?? "")) {
      throw new Error("Cannot emit SVG text content.");
    }
  }
  return { tag: element.tagName, attributes, children };
}

/**
 * Converts an already-validated SVG source into a React element tree.
 *
 * Geometry is carried over verbatim: values keep their exact source text and children keep their
 * drawing order. Comments, whitespace, and the XML declaration are dropped because they do not
 * render. Attributes are sorted by React name so authoring-tool attribute order cannot change the
 * generated output. This is conversion, not validation: callers must run Phase 2B validation first.
 */
export function svgToReact(source: string): ReactSvgElement {
  const root = new DOMParser({ onError: onWarningStopParsing }).parseFromString(
    source,
    "application/xml",
  ).documentElement;
  if (root?.tagName !== "svg") throw new Error("Validated source has no <svg> root.");
  return convertElement(root);
}
