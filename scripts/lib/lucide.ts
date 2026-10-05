import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DOMParser, Element, onWarningStopParsing } from "@xmldom/xmldom";
import { compareText } from "./diagnostics.js";

/** One Lucide category, as published in the release's `categories/<id>.json`. */
export type LucideCategory = {
  readonly id: string;
  readonly label: string;
};

/** Per-icon Lucide metadata kept in `config/lucide.json`. */
export type LucideIconData = {
  /** Every category Lucide lists, in Lucide's order. The first decides the source folder. */
  readonly categories: readonly string[];
  /** Lucide's search keywords. */
  readonly tags: readonly string[];
  /** Earlier Lucide names for the icon, such as `trash-2` for `trash`. Never exported. */
  readonly aliases: readonly string[];
};

/** `config/lucide.json`: the pinned release and everything the library takes from it. */
export type LucideData = {
  readonly version: string;
  readonly categories: readonly LucideCategory[];
  readonly icons: Readonly<Record<string, LucideIconData>>;
};

export type LucideIcon = LucideIconData & {
  readonly name: string;
  readonly svg: string;
};

export type LucideRelease = {
  readonly version: string;
  readonly categories: readonly LucideCategory[];
  readonly icons: readonly LucideIcon[];
  /** Deprecated upstream icons, which are left out. */
  readonly skipped: readonly string[];
};

/** Root attributes in the order every synced source is written. Width and height are dropped. */
const rootAttributes = [
  "xmlns",
  "viewBox",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
];

/**
 * Rewrites one Lucide SVG in this repository's source format: the root keeps its paint and
 * `viewBox` but not `width`/`height`, which the runtime controls, and each geometry element is
 * one line with its attributes in Lucide's order. Geometry is never changed.
 */
export function normalizeLucideSvg(source: string, name = "icon"): string {
  const root = new DOMParser({ onError: onWarningStopParsing }).parseFromString(
    source,
    "application/xml",
  ).documentElement;
  if (root?.tagName !== "svg") throw new Error(`${name}: no <svg> root.`);

  const attributes = rootAttributes.flatMap((attribute) => {
    const value = root.getAttribute(attribute);
    return value === null ? [] : [`${attribute}="${value}"`];
  });
  const children: string[] = [];
  for (let node = root.firstChild; node; node = node.nextSibling) {
    if (!(node instanceof Element)) continue;
    if (node.firstChild) throw new Error(`${name}: nested <${node.tagName}> is not supported.`);
    const childAttributes = Array.from(node.attributes, (a) => ` ${a.name}="${a.value}"`).join("");
    children.push(`  <${node.tagName}${childAttributes}/>`);
  }
  return [`<svg ${attributes.join(" ")}>`, ...children, "</svg>", ""].join("\n");
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
}

/** Alias names; Lucide lists them as strings or as `{ name, deprecated, … }` objects. */
function aliasNames(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  return value.map((alias) => {
    const name = typeof alias === "string" ? alias : (alias as { name?: unknown })?.name;
    if (typeof name !== "string") throw new Error(`${field} has an alias without a name.`);
    return name;
  });
}

function strings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${field} must be an array of strings.`);
  }
  return value;
}

/** Reads an extracted Lucide release: `icons/<name>.{svg,json}` and `categories/<id>.json`. */
export function readLucideRelease(directory: string, version: string): LucideRelease {
  const categories = readdirSync(join(directory, "categories"))
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const { title } = readJson(join(directory, "categories", file));
      if (typeof title !== "string") throw new Error(`categories/${file}: missing title.`);
      return { id: file.slice(0, -5), label: title };
    })
    .sort((left, right) => compareText(left.id, right.id));
  const known = new Set(categories.map(({ id }) => id));

  const icons: LucideIcon[] = [];
  const skipped: string[] = [];
  const names = readdirSync(join(directory, "icons"))
    .filter((file) => file.endsWith(".svg"))
    .map((file) => file.slice(0, -4))
    .sort(compareText);
  for (const name of names) {
    const meta = readJson(join(directory, "icons", `${name}.json`));
    if (meta.deprecated === true) {
      skipped.push(name);
      continue;
    }
    const iconCategories = strings(meta.categories, `icons/${name}.json categories`);
    if (iconCategories.length === 0) throw new Error(`icons/${name}.json lists no categories.`);
    for (const category of iconCategories) {
      if (!known.has(category)) throw new Error(`icons/${name}.json: unknown ${category}.`);
    }
    icons.push({
      name,
      categories: iconCategories,
      tags: strings(meta.tags ?? [], `icons/${name}.json tags`),
      aliases: aliasNames(meta.aliases, `icons/${name}.json aliases`),
      svg: normalizeLucideSvg(readFileSync(join(directory, "icons", `${name}.svg`), "utf8"), name),
    });
  }
  return { version, categories, icons, skipped };
}

/** Repository-relative outline source path: the folder is the first Lucide category. */
export function outlineSourcePath(icon: Pick<LucideIcon, "name" | "categories">): string {
  return `icons/round-outline/${icon.categories[0]}/${icon.name}.svg`;
}

export function lucideData(release: LucideRelease): LucideData {
  return {
    version: release.version,
    categories: release.categories,
    icons: Object.fromEntries(
      release.icons.map(({ name, categories, tags, aliases }) => [
        name,
        { categories, tags, aliases },
      ]),
    ),
  };
}

/** `config/categories.ts`, regenerated on every sync so the taxonomy is always Lucide's. */
export function renderCategoriesModule({ version, categories }: LucideData): string {
  return [
    `// Generated by \`bun run sync:lucide\` from Lucide ${version}. Do not edit this file directly.`,
    "",
    "/**",
    " * Lucide's category taxonomy, in id order. Each icon's source folder is the first category",
    " * Lucide lists for it; the manifest records all of them. IDs never prefix component names.",
    " */",
    "export const categories = [",
    ...categories.flatMap(({ id, label }) => [
      "  {",
      `    id: ${JSON.stringify(id)},`,
      `    label: ${JSON.stringify(label)},`,
      "  },",
    ]),
    "] as const;",
    "",
  ].join("\n");
}
