import type { ComponentType, SVGProps } from "react";

/**
 * The icon catalogue, derived from the filesystem at build time.
 *
 * Nothing here is hand-maintained and there is no metadata file to fall out of
 * date: the component list comes from `src/icons/`, and which style variants
 * each icon actually ships comes from the `icons/` SVG tree. If the generator
 * emits a new icon, it appears here on the next refresh.
 */

export type IconProps = SVGProps<SVGSVGElement> & { variant?: string };
export type Icon = {
  /** kebab-case name, matching the source filename. */
  name: string;
  /** PascalCase export name. */
  component: string;
  /** Directory the icon lives in. */
  category: string;
  /** Styles this icon actually ships, e.g. ["outline", "solid"]. */
  variants: string[];
  Component: ComponentType<IconProps>;
};

// Generated components: ../../src/icons/<category>/<name>.tsx
const modules = import.meta.glob<Record<string, ComponentType<IconProps>>>(
  "../../src/icons/*/*.tsx",
  { eager: true },
);

// Source SVGs: ../../icons/<style>/<category>/<name>.svg — keys only, so this
// costs nothing at runtime. Tells us which variants genuinely exist.
const svgPaths = Object.keys(import.meta.glob("../../icons/*/*/*.svg"));

const variantsByName = new Map<string, Set<string>>();
for (const path of svgPaths) {
  const match = path.match(/\/icons\/([^/]+)\/[^/]+\/([^/]+)\.svg$/);
  if (!match) continue;
  const [, style, name] = match;
  if (!variantsByName.has(name)) variantsByName.set(name, new Set());
  variantsByName.get(name)?.add(style);
}

/** Preferred display order, so `outline` is the default everywhere. */
const STYLE_ORDER = ["outline", "solid"];
const ordered = (styles: Set<string>) =>
  [...styles].sort((a, b) => STYLE_ORDER.indexOf(a) - STYLE_ORDER.indexOf(b));

export const icons: Icon[] = Object.entries(modules)
  .flatMap(([path, mod]) => {
    const match = path.match(/\/src\/icons\/([^/]+)\/([^/]+)\.tsx$/);
    if (!match) return [];
    const [, category, name] = match;

    // Each generated file has exactly one named export: the component.
    const entry = Object.entries(mod).find(([key]) => /^[A-Z]/.test(key));
    if (!entry) return [];
    const [component, Component] = entry;

    return [
      {
        name,
        component,
        category,
        variants: ordered(variantsByName.get(name) ?? new Set(["outline"])),
        Component,
      },
    ];
  })
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

export const categories = [...new Set(icons.map((i) => i.category))].sort();

export const allVariants = [...new Set(icons.flatMap((i) => i.variants))].sort(
  (a, b) => STYLE_ORDER.indexOf(a) - STYLE_ORDER.indexOf(b),
);

/** Totals worth seeing at a glance when checking the set over. */
export const stats = {
  icons: icons.length,
  files: svgPaths.length,
  categories: categories.length,
  bothStyles: icons.filter((i) => i.variants.length > 1).length,
  outlineOnly: icons.filter((i) => i.variants.length === 1 && i.variants[0] === "outline").length,
  solidOnly: icons.filter((i) => i.variants.length === 1 && i.variants[0] === "solid").length,
};
