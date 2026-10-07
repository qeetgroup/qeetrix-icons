import { rankBy } from "./search.js";

/**
 * The playground's logo data model. The browser never bundles `config/brands.json`: the Vite
 * config reads it at build time and hands the browser a compact index through the
 * `virtual:qeetrix-logos` module, encoded by `encodeLogoIndex` and decoded by `decodeLogoIndex`.
 * Logo artwork never travels in the index: each card lazy-loads its generated component. Pure and
 * browser-free (no Node APIs), because the Vite config imports it too; every field of the source
 * file is treated as untrusted and checked.
 */

export type LogoBackground = "light" | "dark" | "any";
export type BackgroundMode = "light" | "dark" | "checker";

export const backgroundModes: readonly { value: BackgroundMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "checker", label: "Transparent" },
];

/** How strongly a licence class asks for review before a logo ships. */
export type LicenseTone = "safe" | "caution" | "warning";

/** Licence classes as `config/brands.json` records them, from least to most restrictive. */
export const licenseClasses = [
  {
    id: "first-party",
    label: "First-party",
    tone: "safe",
    summary: "Qeet's own artwork. The Qeet name and mark are trademarks of Qeet Group.",
  },
  {
    id: "public-domain",
    label: "Public domain",
    tone: "safe",
    summary: "No conditions: use, modify, and redistribute freely (CC0, Unlicense).",
  },
  {
    id: "permissive",
    label: "Permissive",
    tone: "safe",
    summary: "Free to use; keep the licence notice (MIT, Apache-2.0, BSD).",
  },
  {
    id: "attribution",
    label: "Attribution",
    tone: "caution",
    summary: "Free to use with credit to the author (CC BY).",
  },
  {
    id: "no-derivatives",
    label: "No derivatives",
    tone: "caution",
    summary: "Use only as published; do not modify the artwork (CC BY-ND).",
  },
  {
    id: "share-alike",
    label: "Share-alike",
    tone: "caution",
    summary: "Adaptations must carry the same licence (CC BY-SA).",
  },
  {
    id: "non-commercial",
    label: "Non-commercial",
    tone: "warning",
    summary: "Not for commercial use (CC BY-NC). Do not ship in a product without permission.",
  },
  {
    id: "copyleft",
    label: "Copyleft",
    tone: "warning",
    summary: "GPL-family terms that can extend to the work that includes it. Review before use.",
  },
  {
    id: "no-licence",
    label: "Unlicensed",
    tone: "warning",
    summary:
      "No open licence: trademark, brand-use, or fair-use terms only. Get permission before use.",
  },
] as const satisfies readonly {
  id: string;
  label: string;
  tone: LicenseTone;
  summary: string;
}[];

export type LicenseClass = (typeof licenseClasses)[number]["id"];
export const licenseClassIds: readonly LicenseClass[] = licenseClasses.map(({ id }) => id);

export function licenseInfo(id: LicenseClass) {
  return (
    licenseClasses.find((entry) => entry.id === id) ?? licenseClasses[licenseClasses.length - 1]
  );
}

/** Variant families a logo can offer, recognised from its variant names and backgrounds. */
export const variantKinds = [
  { id: "mono", label: "Mono", test: (name: string) => hasToken(name, "mono") },
  {
    id: "wordmark",
    label: "Wordmark",
    test: (name: string) => ["wordmark", "lockup", "horizontal"].some((t) => hasToken(name, t)),
  },
  {
    id: "dark",
    label: "Dark",
    test: (name: string, background: LogoBackground) =>
      hasToken(name, "dark") || background === "dark",
  },
  { id: "light", label: "Light", test: (name: string) => hasToken(name, "light") },
  { id: "color", label: "Colour", test: (name: string) => hasToken(name, "color") },
  { id: "line", label: "Line", test: (name: string) => hasToken(name, "line") },
  { id: "sized", label: "Pixel sizes", test: (name: string) => /^\d+$/.test(name) },
] as const;

export type VariantKind = (typeof variantKinds)[number]["id"];
export const variantKindIds: readonly VariantKind[] = variantKinds.map(({ id }) => id);

function hasToken(name: string, token: string): boolean {
  return name.split("-").includes(token);
}

export type LogoVariant = {
  readonly name: string;
  readonly background: LogoBackground;
  /** Colours painted by the file, as upstream lists them (`#181717`, `currentColor`, …). */
  readonly colors: readonly string[];
};

export type LogoEntry = {
  readonly id: string;
  readonly title: string;
  readonly collection: string;
  readonly componentName: string;
  readonly defaultVariant: string;
  readonly variants: readonly LogoVariant[];
  /** Six hex digits without `#`, or null. */
  readonly hex: string | null;
  readonly categories: readonly string[];
  readonly aliases: readonly string[];
  /** SPDX identifier where one applies, otherwise upstream's licence text. */
  readonly license: string;
  readonly licenseClass: LicenseClass;
  readonly website: string | null;
  readonly guidelines: string | null;
  readonly source: string | null;
};

export type LogoCollection = { readonly id: string; readonly label: string };

export type LogoIndex = {
  readonly source: string | null;
  readonly commit: string | null;
  readonly version: string | null;
  readonly collections: readonly LogoCollection[];
  /** Grouped by collection in collection order, then by title. */
  readonly logos: readonly LogoEntry[];
};

export const emptyLogoIndex: LogoIndex = {
  source: null,
  commit: null,
  version: null,
  collections: [],
  logos: [],
};

/* Encoding. Tuples, not objects: half the bytes of the keyed form. */

type EncodedVariant = [name: string, background: "l" | "d" | "a", colors: string[]];
type EncodedLogo = [
  id: string,
  title: string,
  collection: string,
  componentName: string,
  defaultVariant: string,
  variants: EncodedVariant[],
  hex: string | null,
  categories: string[],
  aliases: string[],
  license: string,
  licenseClass: string,
  website: string | null,
  guidelines: string | null,
  /** `0` when the source is `sourcePrefix` followed by the id. */
  source: string | null | 0,
];

export type EncodedLogoIndex = {
  readonly v: 1;
  readonly source: string | null;
  readonly commit: string | null;
  readonly version: string | null;
  readonly collections: readonly [string, string][];
  readonly sourcePrefix: string;
  readonly logos: readonly EncodedLogo[];
};

const backgroundCodes = { light: "l", dark: "d", any: "a" } as const;
const backgroundNames = { l: "light", d: "dark", a: "any" } as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;
const texts = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** A licence class from the file, or the most cautious class for anything unrecognised. */
export function toLicenseClass(value: unknown): LicenseClass {
  return licenseClassIds.includes(value as LicenseClass) ? (value as LicenseClass) : "no-licence";
}

function toBackground(value: unknown): LogoBackground {
  return value === "light" || value === "dark" ? value : "any";
}

/**
 * The compact index for `config/brands.json`'s parsed contents. Logos without a usable title,
 * collection, component name, or at least one variant are dropped rather than guessed.
 */
export function encodeLogoIndex(file: unknown): EncodedLogoIndex {
  const root = isRecord(file) ? file : {};
  const collections: [string, string][] = [];
  for (const entry of Array.isArray(root.collections) ? root.collections : []) {
    const id = isRecord(entry) ? text(entry.id) : null;
    if (id && isRecord(entry)) collections.push([id, text(entry.label) ?? id]);
  }
  const order = new Map(collections.map(([id], index) => [id, index]));
  const sources = new Map<string, number>();
  const logos: EncodedLogo[] = [];
  for (const [id, raw] of Object.entries(isRecord(root.logos) ? root.logos : {})) {
    if (!isRecord(raw) || !/^[a-z0-9][a-z0-9-]*$/.test(id)) continue;
    const title = text(raw.title);
    const collection = text(raw.collection);
    const componentName = text(raw.componentName);
    const variants: EncodedVariant[] = Object.entries(isRecord(raw.variants) ? raw.variants : {})
      .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
      .map(([name, variant]) => [
        name,
        backgroundCodes[toBackground(variant.background)],
        texts(variant.colors),
      ]);
    if (!title || !collection || !componentName || variants.length === 0) continue;
    if (!order.has(collection)) {
      order.set(collection, order.size);
      collections.push([collection, collection]);
    }
    const defaultVariant = text(raw.defaultVariant);
    const source = text(raw.source);
    if (source?.endsWith(id)) {
      const prefix = source.slice(0, -id.length);
      sources.set(prefix, (sources.get(prefix) ?? 0) + 1);
    }
    logos.push([
      id,
      title,
      collection,
      componentName,
      defaultVariant && variants.some(([name]) => name === defaultVariant)
        ? defaultVariant
        : variants[0][0],
      variants,
      typeof raw.hex === "string" && /^[0-9a-f]{6}$/i.test(raw.hex) ? raw.hex.toUpperCase() : null,
      texts(raw.categories),
      texts(raw.aliases),
      text(raw.license) ?? "Unknown",
      toLicenseClass(raw.licenseClass),
      text(raw.website),
      text(raw.guidelines),
      source,
    ]);
  }
  const sourcePrefix = [...sources].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  for (const logo of logos) {
    if (sourcePrefix && logo[13] === `${sourcePrefix}${logo[0]}`) logo[13] = 0;
  }
  logos.sort(
    (a, b) =>
      (order.get(a[2]) ?? 0) - (order.get(b[2]) ?? 0) ||
      a[1].localeCompare(b[1], "en", { sensitivity: "base" }) ||
      a[0].localeCompare(b[0]),
  );
  return {
    v: 1,
    source: text(root.source),
    commit: text(root.commit),
    version: text(root.packageVersion),
    collections,
    sourcePrefix,
    logos,
  };
}

/** The browser-side index from its compact form. Malformed entries are skipped. */
export function decodeLogoIndex(encoded: unknown): LogoIndex {
  if (!isRecord(encoded) || encoded.v !== 1 || !Array.isArray(encoded.logos)) return emptyLogoIndex;
  const prefix = typeof encoded.sourcePrefix === "string" ? encoded.sourcePrefix : "";
  const logos: LogoEntry[] = [];
  for (const row of encoded.logos as unknown[]) {
    if (!Array.isArray(row) || row.length < 14 || !Array.isArray(row[5])) continue;
    const [id, title, collection, componentName, defaultVariant] = row as string[];
    const variants = (row[5] as unknown[])
      .filter((variant): variant is EncodedVariant => Array.isArray(variant))
      .map(([name, background, colors]) => ({
        name: String(name),
        background: backgroundNames[background] ?? "any",
        colors: texts(colors),
      }));
    if (variants.length === 0) continue;
    logos.push({
      id,
      title,
      collection,
      componentName,
      defaultVariant,
      variants,
      hex: text(row[6]),
      categories: texts(row[7]),
      aliases: texts(row[8]),
      license: text(row[9]) ?? "Unknown",
      licenseClass: toLicenseClass(row[10]),
      website: text(row[11]),
      guidelines: text(row[12]),
      source: row[13] === 0 ? `${prefix}${id}` : text(row[13]),
    });
  }
  return {
    source: text(encoded.source),
    commit: text(encoded.commit),
    version: text(encoded.version),
    collections: (Array.isArray(encoded.collections) ? encoded.collections : [])
      .filter((entry): entry is [string, string] => Array.isArray(entry))
      .map(([id, label]) => ({ id, label })),
    logos,
  };
}

/* Browsing. */

export type LogoFilter = {
  readonly query: string;
  /** A collection id, or "" for every collection. */
  readonly collection: string;
  /** Any of these classes (none selected: every class). */
  readonly licenses: readonly LicenseClass[];
  /** Every one of these families (none selected: no constraint). */
  readonly kinds: readonly VariantKind[];
};

export const emptyLogoFilter: LogoFilter = { query: "", collection: "", licenses: [], kinds: [] };

export function logoKinds(logo: LogoEntry): VariantKind[] {
  return variantKinds
    .filter(({ test }) => logo.variants.some(({ name, background }) => test(name, background)))
    .map(({ id }) => id);
}

/** What search reads for one logo, strongest first. */
export function logoSearchFields(logo: LogoEntry) {
  return {
    primary: [logo.title, logo.id, logo.componentName],
    secondary: logo.aliases,
    keywords: logo.categories,
  };
}

/**
 * Search over title, slug, component name, aliases, and categories, then the filters. With a
 * query the best matches come first; otherwise the index order (collection, then title) holds.
 */
export function filterLogos(logos: readonly LogoEntry[], filter: LogoFilter): LogoEntry[] {
  const filtered = logos.filter(
    (logo) =>
      (!filter.collection || logo.collection === filter.collection) &&
      (filter.licenses.length === 0 || filter.licenses.includes(logo.licenseClass)) &&
      (filter.kinds.length === 0 ||
        filter.kinds.every((kind) => {
          const { test } = variantKinds.find(({ id }) => id === kind) ?? {};
          return test ? logo.variants.some(({ name, background }) => test(name, background)) : true;
        })),
  );
  return rankBy(filtered, filter.query, logoSearchFields);
}

/** Collections in configured order, with counts from the logos themselves. */
export function collectionOptions(index: LogoIndex) {
  const counts = new Map<string, number>();
  for (const { collection } of index.logos) {
    counts.set(collection, (counts.get(collection) ?? 0) + 1);
  }
  return index.collections
    .map(({ id, label }) => ({ id, label, count: counts.get(id) ?? 0 }))
    .filter(({ count }) => count > 0);
}

/** Every licence class with the number of logos in it, in restrictiveness order. */
export function licenseOptions(logos: readonly LogoEntry[]) {
  return licenseClasses.map((entry) => ({
    ...entry,
    count: logos.filter(({ licenseClass }) => licenseClass === entry.id).length,
  }));
}

/** Every variant family with the number of logos that offer it. */
export function kindOptions(logos: readonly LogoEntry[]) {
  return variantKinds.map(({ id, label, test }) => ({
    id,
    label,
    count: logos.filter((logo) =>
      logo.variants.some(({ name, background }) => test(name, background)),
    ).length,
  }));
}

/** Consecutive logos of one collection, as the grouped "All logos" view shows them. */
export function groupByCollection(logos: readonly LogoEntry[], index: LogoIndex) {
  const labels = new Map(index.collections.map(({ id, label }) => [id, label]));
  const groups: { id: string; label: string; logos: LogoEntry[] }[] = [];
  for (const logo of logos) {
    const last = groups.at(-1);
    if (last?.id === logo.collection) last.logos.push(logo);
    else {
      groups.push({
        id: logo.collection,
        label: labels.get(logo.collection) ?? logo.collection,
        logos: [logo],
      });
    }
  }
  return groups;
}

export function defaultLogoVariant(logo: LogoEntry): LogoVariant {
  return logo.variants.find(({ name }) => name === logo.defaultVariant) ?? logo.variants[0];
}

/** Whether a variant is drawn for a page background. Transparent (checker) suits everything. */
export function suitsBackground(variant: LogoVariant, mode: BackgroundMode): boolean {
  return mode === "checker" || variant.background === "any" || variant.background === mode;
}

/**
 * The variant to show on a background. The default when it is drawn for exactly that background;
 * otherwise its counterpart drawn for it (`default` → `dark`, `wordmark` → `wordmark-dark`); then
 * the default if it works anywhere; then any variant drawn for the background, then any that works
 * anywhere; the default as a last resort (the card then says no variant suits).
 */
export function pickVariant(logo: LogoEntry, mode: BackgroundMode): LogoVariant {
  const fallback = defaultLogoVariant(logo);
  if (mode === "checker" || fallback.background === mode) return fallback;
  const counterpartName =
    fallback.name === "default" || fallback.name === "color" ? mode : `${fallback.name}-${mode}`;
  const counterpart = logo.variants.find((variant) => variant.name === counterpartName);
  if (counterpart?.background === mode) return counterpart;
  if (fallback.background === "any") return fallback;
  if (counterpart && suitsBackground(counterpart, mode)) return counterpart;
  return (
    logo.variants.find((variant) => variant.background === mode) ??
    logo.variants.find((variant) => suitsBackground(variant, mode)) ??
    fallback
  );
}

/** The package entry logos are imported from. */
export const logoImportSource = "@qeetrix/icons";
/** Mirrors the logo runtime's default height, so the usage line names only a changed height. */
export const defaultLogoHeight = 24;

/** Import and JSX for one logo variant, naming only non-default props. */
export function logoSnippets(logo: LogoEntry, variant?: string, height = defaultLogoHeight) {
  const props = [
    ...(variant && variant !== logo.defaultVariant ? [`variant="${variant}"`] : []),
    ...(height === defaultLogoHeight ? [] : [`height={${height}}`]),
    `alt="${logo.title.replace(/"/g, "&quot;")}"`,
  ];
  return {
    import: `import { ${logo.componentName} } from "${logoImportSource}";`,
    usage: `<${[logo.componentName, ...props].join(" ")} />`,
  };
}
