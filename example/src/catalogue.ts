import type { ComponentType, SVGProps } from "react";

/**
 * The icon catalogue, derived from the filesystem at build time.
 *
 * Nothing here is hand-maintained and there is no metadata file to fall out of
 * date: the component list comes from `src/icons/`, and which style variants
 * each icon actually ships comes from the `icons/` SVG tree. If the generator
 * emits a new icon, it appears here on the next refresh.
 */

export type IconProps = SVGProps<SVGSVGElement> & { variant?: string; shape?: string };
export type Icon = {
  /** kebab-case name, matching the source filename. */
  name: string;
  /** PascalCase export name. */
  component: string;
  /** Directory the icon lives in. */
  category: string;
  /** Variants this icon actually ships, e.g. ["outline", "solid"]. */
  variants: string[];
  /** Shapes this icon actually ships, e.g. ["round"]. */
  shapes: string[];
  /** Every `<shape>-<variant>` pair with artwork on disk. */
  pairs: { shape: string; variant: string }[];
  Component: ComponentType<IconProps>;
};

// Generated components: ../../src/icons/<category>/<name>.tsx
const modules = import.meta.glob<Record<string, ComponentType<IconProps>>>(
  "../../src/icons/*/*.tsx",
  { eager: true },
);

// Source SVGs: ../../icons/<shape>-<variant>/<category>/<name>.svg — keys only,
// so this costs nothing at runtime. Tells us which pairs genuinely exist, which
// is how an empty `sharp-*` directory correctly contributes nothing.
const svgPaths = Object.keys(import.meta.glob("../../icons/*/*/*.svg"));

/** Preferred display order on each axis, so the defaults sort first. */
const SHAPE_ORDER = ["round", "sharp"];
const VARIANT_ORDER = ["outline", "solid"];
const rank = (order: string[]) => (a: string, b: string) => order.indexOf(a) - order.indexOf(b);

const pairsByName = new Map<string, { shape: string; variant: string }[]>();
for (const path of svgPaths) {
  const match = path.match(/\/icons\/([^/]+)-([^/]+)\/[^/]+\/([^/]+)\.svg$/);
  if (!match) continue;
  const [, shape, variant, name] = match;
  if (!pairsByName.has(name)) pairsByName.set(name, []);
  pairsByName.get(name)?.push({ shape, variant });
}

export const icons: Icon[] = Object.entries(modules)
  .flatMap(([path, mod]) => {
    const match = path.match(/\/src\/icons\/([^/]+)\/([^/]+)\.tsx$/);
    if (!match) return [];
    const [, category, name] = match;

    // Each generated file has exactly one named export: the component.
    const entry = Object.entries(mod).find(([key]) => /^[A-Z]/.test(key));
    if (!entry) return [];
    const [component, Component] = entry;

    const pairs = (pairsByName.get(name) ?? []).sort(
      (a, b) => rank(SHAPE_ORDER)(a.shape, b.shape) || rank(VARIANT_ORDER)(a.variant, b.variant),
    );

    return [
      {
        name,
        component,
        category,
        pairs,
        variants: [...new Set(pairs.map((p) => p.variant))].sort(rank(VARIANT_ORDER)),
        shapes: [...new Set(pairs.map((p) => p.shape))].sort(rank(SHAPE_ORDER)),
        Component,
      },
    ];
  })
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

export const categories = [...new Set(icons.map((i) => i.category))].sort();

export const allVariants = [...new Set(icons.flatMap((i) => i.variants))].sort(rank(VARIANT_ORDER));

export const allShapes = [...new Set(icons.flatMap((i) => i.shapes))].sort(rank(SHAPE_ORDER));

/** Totals worth seeing at a glance when checking the set over. */
export const stats = {
  icons: icons.length,
  files: svgPaths.length,
  categories: categories.length,
  shapes: allShapes.length,
  bothStyles: icons.filter((i) => i.variants.length > 1).length,
  outlineOnly: icons.filter((i) => i.variants.length === 1 && i.variants[0] === "outline").length,
  solidOnly: icons.filter((i) => i.variants.length === 1 && i.variants[0] === "solid").length,
  sharp: icons.filter((i) => i.shapes.includes("sharp")).length,
};
