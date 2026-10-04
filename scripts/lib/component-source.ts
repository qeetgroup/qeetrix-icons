import { posix } from "node:path";
import type { IconShape, IconVariant } from "../../src/types/icon.js";
import type { ReactSvgElement } from "./svg-to-react.js";

/** Matches `formatter.lineWidth` in biome.json; tests prove Biome leaves the output unchanged. */
const lineWidth = 100;

export const runtimeModule = "src/runtime/resolve-icon-props.js";
export const propsModule = "src/types/icon-props.js";

/** One drawing of a concept. */
export type VariantSource = {
  readonly variant: IconVariant;
  /** Repository-relative source SVG, for the header. */
  readonly sourcePath: string;
  readonly svg: ReactSvgElement;
};

/** Every drawing of a concept in one shape (drawing style). */
export type ShapeSource = {
  readonly shape: IconShape;
  /** In configured variant order; the first is the default. */
  readonly variants: readonly VariantSource[];
};

export type ComponentSource = {
  /** Repository-relative `.tsx` path the module will be written to. */
  readonly outputPath: string;
  readonly componentName: string;
  /** Every shape of the concept, each with the same variants; the first is the default shape. */
  readonly shapes: readonly ShapeSource[];
};

function importPath(outputPath: string, module: string): string {
  const path = posix.relative(posix.dirname(outputPath), module);
  return path.startsWith(".") ? path : `./${path}`;
}

/**
 * Prints one element the way Biome's JSX formatter does for this restricted output: on one line
 * when it fits (or carries a single string attribute, which Biome never breaks), otherwise one
 * attribute per line with the closing bracket on its own line. Element children always break.
 */
function printElement(element: ReactSvgElement, depth: number, spread?: string): string[] {
  const indent = "  ".repeat(depth);
  const attributes = element.attributes.map(([name, value]) => `${name}="${value}"`);
  if (spread) attributes.push(spread);
  const hasChildren = element.children.length > 0;
  const close = hasChildren ? ">" : " />";
  const flat = `${indent}<${element.tag}${attributes.map((attribute) => ` ${attribute}`).join("")}${close}`;
  const singleString = attributes.length === 1 && !spread;

  const lines =
    attributes.length === 0 || singleString || flat.length <= lineWidth
      ? [flat]
      : [
          `${indent}<${element.tag}`,
          ...attributes.map((attribute) => `${indent}  ${attribute}`),
          `${indent}${close.trim()}`,
        ];
  if (!hasChildren) return lines;
  return [
    ...lines,
    ...element.children.flatMap((child) => printElement(child, depth + 1)),
    `${indent}</${element.tag}>`,
  ];
}

/** A `return (...)` of one drawing, with `resolveIconProps` spread last onto its root. */
function printReturn(svg: ReactSvgElement, depth: number): string[] {
  const indent = "  ".repeat(depth);
  return [
    `${indent}return (`,
    ...printElement(svg, depth + 1, "{...resolveIconProps(props)}"),
    `${indent});`,
  ];
}

/**
 * The drawings of one shape: each non-default variant is one `if` branch, and the default variant
 * is the fall-through, so an outline-only shape has no branch at all.
 */
function printVariants(variants: readonly VariantSource[], depth: number): string[] {
  const indent = "  ".repeat(depth);
  const [fallback, ...branches] = variants;
  return [
    ...branches.flatMap(({ variant, svg }) => [
      `${indent}if (props.variant === ${JSON.stringify(variant)}) {`,
      ...printReturn(svg, depth + 1),
      `${indent}}`,
    ]),
    ...printReturn(fallback.svg, depth),
  ];
}

/**
 * Renders the one component module of a concept, with every drawing in every shape.
 *
 * The props type is narrowed to the variants that exist, the same in every shape, so an
 * unavailable `variant` is a type error. Each non-default shape is one `if` block, checked first;
 * the default shape is the fall-through, so a default render is unchanged by the other shapes.
 * Within a shape, each non-default variant is one `if` branch and the default variant falls
 * through. Every branch spreads the same `resolveIconProps`, which consumes `shape` and `variant`,
 * so size, native props, refs, and accessibility behave identically in every drawing.
 *
 * The output is deterministic and already Biome-formatted: no timestamps, absolute paths, or
 * environment data; LF newlines; imports in Biome's order. Each source SVG's root attributes come
 * first and `resolveIconProps` is spread last, so caller props override the authored defaults.
 */
export function renderComponentSource({
  outputPath,
  componentName,
  shapes,
}: ComponentSource): string {
  const [fallback, ...others] = shapes;
  if (!fallback?.variants.length) throw new Error(`${componentName} has no drawings.`);
  const variants = fallback.variants.map(({ variant }) => variant);
  for (const { shape, variants: drawn } of others) {
    if (drawn.map(({ variant }) => variant).join() !== variants.join()) {
      throw new Error(`${componentName} has different variants in its ${shape} shape.`);
    }
  }
  const props = `props: IconProps<${variants.map((variant) => JSON.stringify(variant)).join(" | ")}>`;
  const signature = `export function ${componentName}(${props}) {`;
  const sources = shapes.flatMap((shape) => shape.variants.map(({ sourcePath }) => sourcePath));
  return [
    `// Generated by @qeetrix/icons from ${sources.join(", ")}.`,
    `// Do not edit this file directly. Edit the source SVG${sources.length > 1 ? "s" : ""} and run \`bun run generate\`.`,
    "",
    `import { resolveIconProps } from ${JSON.stringify(importPath(outputPath, runtimeModule))};`,
    `import type { IconProps } from ${JSON.stringify(importPath(outputPath, propsModule))};`,
    "",
    ...(signature.length <= lineWidth
      ? [signature]
      : [`export function ${componentName}(`, `  ${props},`, ") {"]),
    ...others.flatMap(({ shape, variants: drawn }) => [
      `  if (props.shape === ${JSON.stringify(shape)}) {`,
      ...printVariants(drawn, 2),
      "  }",
    ]),
    ...printVariants(fallback.variants, 1),
    "}",
    "",
  ].join("\n");
}
