import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { iconSystem } from "../config/icon-system.js";

export function syntheticSvg(
  attributes: Record<string, string | undefined> = {},
  content = '<path d="M 5 7 L 11 13"/>',
): string {
  const serialized = Object.entries({
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: iconSystem.architecture.viewBox,
    fill: "none",
    stroke: iconSystem.architecture.color,
    "stroke-width": String(iconSystem.design.strokeWidth),
    "stroke-linecap": iconSystem.design.linecap,
    "stroke-linejoin": iconSystem.design.linejoin,
    ...attributes,
  })
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}="${value}"`)
    .join(" ");
  return `<svg ${serialized}>${content}</svg>`;
}

export function writeFixture(root: string, file: string, source: string | Uint8Array): void {
  const absolute = join(root, file);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, source);
}

export function createRepositoryFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "qeetrix-icons-test-"));
  writeFixture(root, "icons/.gitkeep", "");
  return root;
}

/** Root attributes for a filled synthetic source, in either style. */
export const filledAttributes = {
  fill: "currentColor",
  stroke: undefined,
  "stroke-width": undefined,
  "stroke-linecap": undefined,
  "stroke-linejoin": undefined,
};

/** Root stroke attributes for a sharp outline synthetic source, from the icon system. */
export const sharpAttributes = {
  "stroke-linecap": iconSystem.design.sharp.linecap,
  "stroke-linejoin": iconSystem.design.sharp.linejoin,
  "stroke-miterlimit": String(iconSystem.design.sharp.miterLimit),
};

/**
 * The sharp counterpart of a round synthetic source: the same geometry in the sharp folder, with
 * sharp caps and joins wherever the round source sets them and the miter limit on the root.
 */
export function sharpCounterpart({ file, source }: { file: string; source: string }): {
  file: string;
  source: string;
} {
  const { design } = iconSystem;
  return {
    file: file.replace(/^icons\/round-/, "icons/sharp-"),
    source: source
      .replace(
        `stroke-linejoin="${design.linejoin}"`,
        `stroke-linejoin="${design.linejoin}" stroke-miterlimit="${design.sharp.miterLimit}"`,
      )
      .replaceAll(`stroke-linecap="${design.linecap}"`, `stroke-linecap="${design.sharp.linecap}"`)
      .replaceAll(
        `stroke-linejoin="${design.linejoin}"`,
        `stroke-linejoin="${design.sharp.linejoin}"`,
      ),
  };
}

/**
 * A synthetic, test-only source set spanning categories, both variants of one concept, and one
 * authored directionality override. Each drawing has distinct geometry so bundles can be inspected.
 * Never written to the production `icons/` tree.
 */
export const apiFixtures = [
  {
    file: "icons/round-outline/arrows/fixture-search.svg",
    source: syntheticSvg({}, '<path d="M 3.125 7 L 11 13"/>'),
  },
  {
    file: "icons/round-outline/shapes/fixture-star.svg",
    source: syntheticSvg({}, '<circle cx="12" cy="12" r="6.25"/>'),
  },
  {
    file: "icons/round-filled/shapes/fixture-star.svg",
    source: syntheticSvg(filledAttributes, '<circle cx="12" cy="12" r="7.5"/>'),
  },
  {
    file: "icons/round-outline/navigation/fixture-arrow.svg",
    source: syntheticSvg({}, '<polyline points="9.375,6 15,12 9.375,18"/>'),
  },
] as const;

/**
 * Sharp counterparts of `apiFixtures`, so the set mirrors in both styles as validation requires
 * once any sharp drawing exists. Geometry is distinct from the round drawings', for inspection.
 */
export const sharpApiFixtures = [
  {
    file: "icons/sharp-outline/arrows/fixture-search.svg",
    source: syntheticSvg(sharpAttributes, '<path d="M 3.375 7 L 11 13"/>'),
  },
  {
    file: "icons/sharp-outline/shapes/fixture-star.svg",
    source: syntheticSvg(sharpAttributes, '<circle cx="12" cy="12" r="6.875"/>'),
  },
  {
    file: "icons/sharp-filled/shapes/fixture-star.svg",
    source: syntheticSvg(filledAttributes, '<circle cx="12" cy="12" r="8.125"/>'),
  },
  {
    file: "icons/sharp-outline/navigation/fixture-arrow.svg",
    source: syntheticSvg(sharpAttributes, '<polyline points="9.625,6 15,12 9.625,18"/>'),
  },
] as const;

export const apiFixtureMetadata = { "fixture-arrow": { directionality: "mirror" } } as const;
