/**
 * Parse a source SVG into a shape the validator and the emitter can both use.
 *
 * One parse serves both: validation walks the same tree the React component is
 * emitted from, so it is impossible for a rule to pass against markup that
 * differs from what actually ships.
 *
 * `svgson` is a devDependency — it runs at generate time only and is never
 * shipped, which is why this package has no runtime `dependencies` at all.
 *
 * Two things about svgson's own behaviour are handled here rather than trusted:
 * it returns a partially-undefined object instead of throwing when given more
 * than one root element, and it throws a bare `TypeError` on unbalanced tags.
 * Both are normalised into a plain `{ error }` result.
 */

import { parseSync } from "svgson";

/**
 * @typedef {object} SvgNode
 * @property {"element"|"text"} type
 * @property {string} name Element name, or `"#text"`.
 * @property {Record<string, string>} attributes
 * @property {SvgNode[]} children
 * @property {string} value Text content, for text nodes.
 * @property {string} path Human-readable location, e.g. `svg > g > path[1]`.
 */

/**
 * @typedef {object} ParsedSvg
 * @property {SvgNode|null} root Root `<svg>` node, or null when parsing failed.
 * @property {SvgNode[]} elements Depth-first list of every node, root included.
 * @property {string|null} error Why parsing failed, or null on success.
 */

/**
 * @param {string} source Raw file contents.
 * @returns {ParsedSvg}
 */
export function parseSvg(source) {
  let raw;
  try {
    raw = parseSync(source);
  } catch (cause) {
    // svgson throws "nothing to parse" for non-XML and an opaque TypeError for
    // unbalanced tags. Neither message is useful to a contributor.
    return { root: null, elements: [], error: `not valid SVG (${cause.message})` };
  }

  if (raw?.type !== "element" || typeof raw.name !== "string") {
    // The multi-root case lands here: svgson returns `{}` rather than throwing.
    return {
      root: null,
      elements: [],
      error: "not valid SVG (expected exactly one root element)",
    };
  }
  if (raw.name !== "svg") {
    return { root: null, elements: [], error: `root element must be <svg>, found <${raw.name}>` };
  }

  const root = normalise(raw, "svg");
  return { root, elements: flatten(root), error: null };
}

function normalise(node, path) {
  const children = (node.children ?? []).map((child, index) =>
    normalise(child, `${path} > ${child.name ?? "#text"}[${index}]`),
  );
  return {
    type: node.type === "element" ? "element" : "text",
    name: node.type === "element" ? node.name : "#text",
    attributes: node.attributes ?? {},
    children,
    value: node.value ?? "",
    path,
  };
}

/** Depth-first list of every node, root included. Order is deterministic. */
function flatten(node) {
  return [node, ...node.children.flatMap(flatten)];
}

/**
 * Serialise a node's children back to JSX-ready descriptors.
 *
 * Attribute names are mapped to their React (camelCase) spelling here, so the
 * emitter stays a pure string template with no SVG knowledge of its own.
 */
export function toJsxChildren(root) {
  return root.children
    .filter((child) => child.type === "element")
    .map((child) => toJsxElement(child));
}

function toJsxElement(node) {
  return {
    name: node.name,
    props: Object.entries(node.attributes).map(([key, value]) => [toReactAttr(key), value]),
    children: node.children.filter((c) => c.type === "element").map(toJsxElement),
  };
}

/**
 * SVG attribute name → React prop name.
 *
 * React accepts the hyphenated spelling for `data-`/`aria-` only; every
 * presentation attribute has to be camelCased or React warns at runtime.
 */
export function toReactAttr(name) {
  if (name.startsWith("data-") || name.startsWith("aria-")) return name;
  return name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
