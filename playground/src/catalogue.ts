import type { ComponentType } from "react";
import { categories } from "../../config/categories.js";
import { iconSystem } from "../../config/icon-system.js";
import type { IconDirectionality, IconShape, IconVariant } from "../../src/types/icon.js";
import type { IconManifest, IconManifestEntry } from "../../src/types/icon-manifest.js";
import type { IconProps } from "../../src/types/icon-props.js";
import { rankBy } from "./search.js";

/**
 * The playground's data model. Everything here derives from the generated manifest, the generated
 * icon modules, and the shared config; there is no second catalogue to keep in sync. Pure and
 * browser-free, so tests can inject synthetic manifests and modules.
 */

export type IconComponent = ComponentType<IconProps>;
/** A generated icon module: its named exports, one of which is the concept's component. */
export type IconModule = Readonly<Record<string, unknown>>;

export type CatalogueIcon = IconManifestEntry & {
  readonly categoryLabel: string;
  readonly Component: IconComponent;
};

export type Catalogue = {
  /** Manifest order: configured category, then name. */
  readonly icons: readonly CatalogueIcon[];
  readonly byId: ReadonlyMap<string, CatalogueIcon>;
  /** Manifest entries and generated modules that disagree, which means stale generated output. */
  readonly problems: readonly string[];
};

const { defaultStyle, defaultVariant, styles, variants } = iconSystem.architecture;
const categoryLabels = new Map<string, string>(categories.map(({ id, label }) => [id, label]));

/** `…/src/generated/icons/star.tsx` → `star`; logo modules (`…/logos/github.ts`) alike. */
export function moduleId(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.tsx?$/, "");
}

export function buildCatalogue(
  manifest: IconManifest,
  modules: ReadonlyMap<string, IconModule>,
): Catalogue {
  const icons: CatalogueIcon[] = [];
  const problems: string[] = [];
  for (const entry of manifest.icons) {
    const Component = modules.get(entry.id)?.[entry.componentName];
    if (typeof Component !== "function") {
      problems.push(`${entry.id}: no generated ${entry.componentName} module.`);
      continue;
    }
    icons.push({
      ...entry,
      categoryLabel: categoryLabels.get(entry.category) ?? entry.category,
      Component: Component as IconComponent,
    });
  }
  const listed = new Set(manifest.icons.map(({ id }) => id));
  for (const id of [...modules.keys()].sort()) {
    if (!listed.has(id)) problems.push(`${id}: generated module is not in the manifest.`);
  }
  return { icons, byId: new Map(icons.map((icon) => [icon.id, icon])), problems };
}

/** `"all"`, icons with only the default drawing, or icons that have a given extra variant. */
export type VariantFilter = "all" | "default-only" | IconVariant;

export type CatalogueFilter = {
  readonly query: string;
  readonly category: string;
  readonly variant: VariantFilter;
  readonly directionality: "all" | IconDirectionality;
};

export const emptyFilter: CatalogueFilter = {
  query: "",
  category: "",
  variant: "all",
  directionality: "all",
};

/**
 * Case-insensitive search over id, name, component name, categories, tags, and aliases; then the
 * filters. A category filter matches every icon listed under that category, not only its folder.
 * With a query, the best matches come first (names before aliases before tags); ties, and every
 * result without a query, keep manifest order.
 */
export function filterIcons(
  icons: readonly CatalogueIcon[],
  filter: CatalogueFilter,
): CatalogueIcon[] {
  const filtered = icons.filter(
    (icon) =>
      (!filter.category || icon.categories.includes(filter.category)) &&
      (filter.variant === "all" ||
        (filter.variant === "default-only"
          ? icon.variants.length === 1
          : icon.variants.includes(filter.variant))) &&
      (filter.directionality === "all" || icon.directionality === filter.directionality),
  );
  return rankBy(filtered, filter.query, iconSearchFields);
}

/** What search reads for one icon, strongest first. */
export function iconSearchFields(icon: CatalogueIcon) {
  return {
    primary: [icon.id, icon.name, icon.componentName],
    secondary: icon.aliases,
    keywords: [icon.categoryLabel, ...icon.categories, ...icon.tags],
  };
}

/** Consecutive icons that share a primary category, as the grouped "All icons" view shows them. */
export function groupByCategory(icons: readonly CatalogueIcon[]) {
  const groups: { id: string; label: string; icons: CatalogueIcon[] }[] = [];
  for (const icon of icons) {
    const last = groups.at(-1);
    if (last?.id === icon.category) last.icons.push(icon);
    else groups.push({ id: icon.category, label: icon.categoryLabel, icons: [icon] });
  }
  return groups;
}

/** Every configured category, in configured order, with the number of icons listed under it. */
export function categoryOptions(icons: readonly CatalogueIcon[]) {
  return categories.map(({ id, label }) => ({
    id,
    label,
    count: icons.filter((icon) => icon.categories.includes(id)).length,
  }));
}

/** Variant filter choices, derived from the configured variants rather than hard-coded. */
export function variantFilterOptions(): { value: VariantFilter; label: string }[] {
  return [
    { value: "all", label: "All variants" },
    { value: "default-only", label: `${capitalize(defaultVariant)} only` },
    ...variants
      .filter((variant) => variant !== defaultVariant)
      .map((variant) => ({ value: variant, label: `Has ${variant}` })),
  ];
}

/** Shape switch choices: the source styles, in configured order (`Round`, `Sharp`). */
export function shapeOptions(): { value: IconShape; label: string }[] {
  return styles.map((style) => ({ value: style, label: capitalize(style) }));
}

/** The drawing to show: the requested one if this icon has it, otherwise the default. */
export function selectedVariant(icon: IconManifestEntry, requested?: IconVariant): IconVariant {
  return requested && icon.variants.includes(requested) ? requested : defaultVariant;
}

/**
 * Whether the RTL QA preview mirrors this icon. Decided only by manifest directionality, never by
 * the name. The package runtime does not mirror; this is a playground preview.
 */
export function mirrorsInPreview(icon: IconManifestEntry, direction: "ltr" | "rtl"): boolean {
  return direction === "rtl" && icon.directionality === "mirror";
}

/** Rendering props shown in the usage line when they differ from the component defaults. */
export type UsageProps = {
  readonly size?: number;
  readonly strokeWidth?: number;
  /** A CSS colour for the `color` prop; omitted when the icon simply inherits `currentColor`. */
  readonly color?: string;
};

/**
 * How to import and render the drawing on show. Every shape and variant is a prop of the one
 * component, so the imports never change; the usage line names only non-default props.
 */
export function importSnippets(
  icon: IconManifestEntry,
  shape: IconShape = defaultStyle,
  variant: IconVariant = defaultVariant,
  usage: UsageProps = {},
) {
  const { size, strokeWidth, color } = usage;
  const props = [
    ...(shape === defaultStyle ? [] : [`shape="${shape}"`]),
    ...(variant === defaultVariant ? [] : [`variant="${variant}"`]),
    ...(size === undefined || size === iconSystem.design.defaultSize ? [] : [`size={${size}}`]),
    ...(strokeWidth === undefined ||
    strokeWidth === iconSystem.design.strokeWidth ||
    variant !== defaultVariant
      ? []
      : [`strokeWidth={${strokeWidth}}`]),
    ...(color ? [`color="${color}"`] : []),
  ];
  return {
    root: `import { ${icon.componentName} } from "@qeetrix/icons";`,
    direct: `import { ${icon.componentName} } from "@qeetrix/icons/icons/${icon.id}";`,
    usage: `<${[icon.componentName, ...props].join(" ")} />`,
  };
}

/**
 * Rendered SVG markup, one element per line, for the "Copy SVG" action. React's serialized
 * attributes are kept as they are, so the markup is exactly what the component renders.
 */
export function formatSvgMarkup(markup: string): string {
  let depth = 0;
  const lines: string[] = [];
  // React serializes childless SVG elements as `<path …></path>`; one line each reads better.
  const collapsed = markup.replace(/<([a-zA-Z][\w:-]*)([^<>]*?)>\s*<\/\1>/g, "<$1$2/>");
  for (const token of collapsed.replace(/>\s*</g, ">\n<").split("\n")) {
    const line = token.trim();
    if (!line) continue;
    if (line.startsWith("</")) depth = Math.max(0, depth - 1);
    lines.push(`${"  ".repeat(depth)}${line}`);
    if (!line.startsWith("</") && !line.endsWith("/>") && !line.includes("</")) depth += 1;
  }
  return lines.join("\n");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
