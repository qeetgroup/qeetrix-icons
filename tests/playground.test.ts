import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { categories } from "../config/categories.js";
import { iconMetadata } from "../config/icon-metadata.js";
import { iconSystem } from "../config/icon-system.js";
import {
  buildCatalogue,
  type CatalogueIcon,
  categoryOptions,
  emptyFilter,
  filterIcons,
  formatSvgMarkup,
  groupByCategory,
  type IconModule,
  importSnippets,
  mirrorsInPreview,
  moduleId,
  selectedVariant,
  shapeOptions,
  variantFilterOptions,
} from "../playground/src/catalogue.js";
import { columnsFor, layoutGrid, moveInGrid, visibleRows } from "../playground/src/grid-layout.js";
import {
  collectionOptions,
  decodeLogoIndex,
  emptyLogoFilter,
  encodeLogoIndex,
  filterLogos,
  groupByCollection,
  kindOptions,
  type LogoEntry,
  licenseClasses,
  licenseInfo,
  licenseOptions,
  logoKinds,
  logoSnippets,
  pickVariant,
  suitsBackground,
  toLicenseClass,
} from "../playground/src/logo-catalogue.js";
import { checklistFor, designValues, strokeStyle } from "../playground/src/qa.js";
import { normalize, rankBy, scoreFields } from "../playground/src/search.js";
import {
  type AppState,
  defaultAppState,
  defaultIconsState,
  defaultLogosState,
  mergeNavigation,
  parseAppState,
  serializeAppState,
  sizeRange,
} from "../playground/src/url-state.js";
import { brandSourceDirectory } from "../scripts/check/validate-repository.js";
import { createGenerationPlan } from "../scripts/lib/generation-plan.js";
import { iconManifest } from "../src/manifest.js";
import type { IconManifest } from "../src/types/icon-manifest.js";
import { apiFixtureMetadata, apiFixtures, sharpApiFixtures, writeFixture } from "./helpers.js";

const PKG = join(import.meta.dirname, "..");

/** The synthetic fixture manifest, produced by the real generator, with stand-in components. */
const fixtureManifest: IconManifest = createGenerationPlan(
  apiFixtures,
  [],
  apiFixtureMetadata,
).manifest;
const component = () => null;
const fixtureModules = new Map<string, IconModule>(
  fixtureManifest.icons.map(({ id, componentName }) => [id, { [componentName]: component }]),
);
const catalogue = buildCatalogue(fixtureManifest, fixtureModules);
const ids = (items: readonly { id: string }[]) => items.map(({ id }) => id);

describe("playground catalogue", () => {
  it("resolves every real manifest concept to its real generated module", async () => {
    const modules = new Map<string, IconModule>();
    for (const file of readdirSync(join(PKG, "src/generated/icons"))) {
      modules.set(moduleId(file), await import(join(PKG, "src/generated/icons", file)));
    }
    const real = buildCatalogue(iconManifest, modules);
    expect(real.problems).toEqual([]);
    expect(real.icons.map(({ id }) => id)).toEqual(iconManifest.icons.map(({ id }) => id));
    // Imports every generated module; cold transforms of the full catalogue exceed the default.
  }, 60_000);

  it("is empty and consistent with no icons at all", () => {
    expect(buildCatalogue({ schemaVersion: 1, icons: [] }, new Map())).toEqual({
      icons: [],
      byId: new Map(),
      problems: [],
    });
    expect(filterIcons([], { ...emptyFilter, query: "star" })).toEqual([]);
  });

  it("derives every icon from the manifest and resolves its generated component", () => {
    expect(catalogue.problems).toEqual([]);
    expect(
      catalogue.icons.map(({ id, componentName, categoryLabel, variants, directionality }) => [
        id,
        componentName,
        categoryLabel,
        variants,
        directionality,
      ]),
    ).toEqual([
      ["fixture-search", "FixtureSearchIcon", "Arrows", ["outline"], "preserve"],
      ["fixture-arrow", "FixtureArrowIcon", "Navigation & Places", ["outline"], "mirror"],
      ["fixture-star", "FixtureStarIcon", "Shapes", ["outline", "filled"], "preserve"],
    ]);
    expect(catalogue.byId.get("fixture-star")?.Component).toBe(component);
  });

  it("maps generated icon and logo module paths to public ids", () => {
    expect(moduleId("../../src/generated/icons/fixture-star.tsx")).toBe("fixture-star");
    expect(moduleId("../../src/generated/logos/github.ts")).toBe("github");
  });

  it("reports stale generated output instead of inventing icons", () => {
    const modules = new Map(fixtureModules);
    modules.delete("fixture-arrow");
    modules.set("fixture-search", { WrongName: component });
    modules.set("fixture-star-filled", { FixtureStarFilledIcon: component });
    const stale = buildCatalogue(fixtureManifest, modules);
    expect(ids(stale.icons)).toEqual(["fixture-star"]);
    expect(stale.problems).toEqual([
      "fixture-search: no generated FixtureSearchIcon module.",
      "fixture-arrow: no generated FixtureArrowIcon module.",
      "fixture-star-filled: generated module is not in the manifest.",
    ]);
  });

  it("groups consecutive icons by primary category for the grouped grid", () => {
    expect(
      groupByCategory(catalogue.icons).map(({ id, label, icons }) => [id, label, ids(icons)]),
    ).toEqual([
      ["arrows", "Arrows", ["fixture-search"]],
      ["navigation", "Navigation & Places", ["fixture-arrow"]],
      ["shapes", "Shapes", ["fixture-star"]],
    ]);
  });
});

describe("playground search", () => {
  it("normalizes case, spaces, and underscores", () => {
    expect(normalize("  Arrow  Right_Up ")).toBe("arrow-right-up");
  });

  it("ranks exact over prefix over word start over anywhere, names over aliases over tags", () => {
    const items = [
      { id: "anywhere", primary: ["xstarx"] },
      { id: "word", primary: ["big-star"] },
      { id: "prefix", primary: ["starling"] },
      { id: "exact", primary: ["star"] },
      { id: "alias", primary: ["shape"], secondary: ["star"] },
      { id: "tag", primary: ["shape"], keywords: ["star"] },
      { id: "none", primary: ["moon"] },
    ];
    expect(ids(rankBy(items, "Star", (item) => item))).toEqual([
      "exact",
      "alias",
      "prefix",
      "word",
      "tag",
      "anywhere",
    ]);
    expect(scoreFields({ primary: ["moon"] }, "star")).toBe(0);
    expect(scoreFields({ primary: ["moon"] }, "")).toBe(1);
    expect(ids(rankBy(items, "", (item) => item, 2))).toEqual(["anywhere", "word"]);
    expect(ids(rankBy(items, "star", (item) => item, 1))).toEqual(["exact"]);
  });

  it("keeps catalogue order among equally good matches", () => {
    const items = [{ id: "b-one" }, { id: "a-two" }, { id: "c-three" }];
    expect(ids(rankBy(items, "-", (item) => ({ primary: [item.id] })))).toEqual([
      "b-one",
      "a-two",
      "c-three",
    ]);
  });
});

describe("playground icon search and filters", () => {
  it.each([
    ["STAR", ["fixture-star"]],
    ["  fixturesearchicon ", ["fixture-search"]],
    ["navigation", ["fixture-arrow"]],
    ["shapes", ["fixture-star"]],
    ["fixture", ["fixture-search", "fixture-arrow", "fixture-star"]],
    ["", ["fixture-search", "fixture-arrow", "fixture-star"]],
    ["no-such-icon", []],
  ])("matches %j case-insensitively on id, component, and category", (query, expected) => {
    expect(ids(filterIcons(catalogue.icons, { ...emptyFilter, query }))).toEqual(expected);
  });

  it("searches tags and aliases, ranks names first, and filters by every listed category", () => {
    const manifest = createGenerationPlan(apiFixtures, [], {
      ...apiFixtureMetadata,
      "fixture-star": {
        categories: ["shapes", "social"],
        tags: ["favorite", "search"],
        aliases: ["fixture-star-2"],
      },
    }).manifest;
    const modules = new Map<string, IconModule>(
      manifest.icons.map(({ id, componentName }) => [id, { [componentName]: component }]),
    );
    const tagged = buildCatalogue(manifest, modules).icons;
    const find = (change: Partial<typeof emptyFilter>) =>
      ids(filterIcons(tagged, { ...emptyFilter, ...change }));
    expect(find({ query: "FAVOR" })).toEqual(["fixture-star"]);
    expect(find({ query: "star-2" })).toEqual(["fixture-star"]);
    // "search" names fixture-search and tags fixture-star: the name match comes first.
    expect(find({ query: "search" })).toEqual(["fixture-search", "fixture-star"]);
    expect(find({ category: "social" })).toEqual(["fixture-star"]);
    expect(categoryOptions(tagged).find(({ id }) => id === "social")?.count).toBe(1);
  });

  it("filters by category, variant availability, and directionality", () => {
    const filter = (change: Partial<typeof emptyFilter>) =>
      ids(filterIcons(catalogue.icons, { ...emptyFilter, ...change }));
    expect(filter({ category: "shapes" })).toEqual(["fixture-star"]);
    expect(filter({ variant: "default-only" })).toEqual(["fixture-search", "fixture-arrow"]);
    expect(filter({ variant: "filled" })).toEqual(["fixture-star"]);
    expect(filter({ directionality: "mirror" })).toEqual(["fixture-arrow"]);
    expect(filter({ directionality: "preserve", variant: "default-only" })).toEqual([
      "fixture-search",
    ]);
  });

  it("lists every configured category in configured order, with counts", () => {
    const options = categoryOptions(catalogue.icons);
    expect(options.map(({ id }) => id)).toEqual(categories.map(({ id }) => id));
    expect(options.filter(({ count }) => count > 0)).toEqual([
      { id: "arrows", label: "Arrows", count: 1 },
      { id: "navigation", label: "Navigation & Places", count: 1 },
      { id: "shapes", label: "Shapes", count: 1 },
    ]);
  });

  it("derives variant filters from the configured variants", () => {
    expect(variantFilterOptions()).toEqual([
      { value: "all", label: "All variants" },
      { value: "default-only", label: "Outline only" },
      { value: "filled", label: "Has filled" },
    ]);
  });
});

describe("playground inspection rules", () => {
  const search = catalogue.byId.get("fixture-search") as CatalogueIcon;
  const star = catalogue.byId.get("fixture-star") as CatalogueIcon;
  const arrow = catalogue.byId.get("fixture-arrow") as CatalogueIcon;

  it("offers only the variants an icon has, defaulting to outline", () => {
    expect(selectedVariant(star)).toBe("outline");
    expect(selectedVariant(star, "filled")).toBe("filled");
    expect(selectedVariant(search, "filled")).toBe("outline");
    expect(selectedVariant(search, "outline")).toBe("outline");
  });

  it("mirrors the RTL QA preview from manifest directionality only", () => {
    expect(mirrorsInPreview(arrow, "rtl")).toBe(true);
    expect(mirrorsInPreview(arrow, "ltr")).toBe(false);
    expect(mirrorsInPreview(star, "rtl")).toBe(false);
    // A directional-sounding name never implies mirroring.
    expect(mirrorsInPreview({ ...star, id: "arrow-back", name: "arrow-back" }, "rtl")).toBe(false);
  });

  it("shows public imports only, never generated paths, with the props on show", () => {
    const imports = {
      root: 'import { FixtureStarIcon } from "@qeetrix/icons";',
      direct: 'import { FixtureStarIcon } from "@qeetrix/icons/icons/fixture-star";',
    };
    expect(importSnippets(star)).toEqual({ ...imports, usage: "<FixtureStarIcon />" });
    expect(importSnippets(star, "round", "outline")).toEqual(importSnippets(star));
    // Every shape comes from the same imports: the shape is a prop, never an entry point.
    expect(importSnippets(star, "sharp")).toEqual({
      ...imports,
      usage: '<FixtureStarIcon shape="sharp" />',
    });
    expect(importSnippets(star, "sharp", "filled").usage).toBe(
      '<FixtureStarIcon shape="sharp" variant="filled" />',
    );
    expect(importSnippets(star, "round", "filled").usage).toBe(
      '<FixtureStarIcon variant="filled" />',
    );
  });

  it("echoes non-default size, stroke, and colour in the usage line", () => {
    const { defaultSize, strokeWidth } = iconSystem.design;
    expect(importSnippets(star, "round", "outline", { size: defaultSize, strokeWidth }).usage).toBe(
      "<FixtureStarIcon />",
    );
    expect(
      importSnippets(star, "round", "outline", { size: 32, strokeWidth: 1.5, color: "#ea580c" })
        .usage,
    ).toBe('<FixtureStarIcon size={32} strokeWidth={1.5} color="#ea580c" />');
    // A filled drawing has no stroke, so the stroke width is not part of its usage.
    expect(importSnippets(star, "round", "filled", { strokeWidth: 1.5 }).usage).toBe(
      '<FixtureStarIcon variant="filled" />',
    );
  });

  it("formats rendered SVG markup one element per line", () => {
    expect(
      formatSvgMarkup(
        '<svg viewBox="0 0 24 24"><g><path d="M1 1"></path><circle r="2"/></g></svg>',
      ),
    ).toBe(
      [
        '<svg viewBox="0 0 24 24">',
        "  <g>",
        '    <path d="M1 1"/>',
        '    <circle r="2"/>',
        "  </g>",
        "</svg>",
      ].join("\n"),
    );
    expect(formatSvgMarkup("")).toBe("");
  });

  it("offers the configured styles as shapes, default first", () => {
    expect(shapeOptions()).toEqual([
      { value: "round", label: "Round" },
      { value: "sharp", label: "Sharp" },
    ]);
    expect(shapeOptions().map(({ value }) => value)).toEqual(iconSystem.architecture.styles);
    expect(shapeOptions()[0].value).toBe(iconSystem.architecture.defaultStyle);
  });

  it("adds variant and RTL review items only where they apply", () => {
    const titles = (icon: CatalogueIcon) => checklistFor(icon).map(({ title }) => title);
    expect(titles(star)).toContain("Variants");
    expect(titles(search)).not.toContain("Variants");
    const direction = (icon: CatalogueIcon) =>
      checklistFor(icon).find(({ title }) => title === "Direction")?.items ?? [];
    expect(direction(arrow)).toHaveLength(2);
    expect(direction(search)).toHaveLength(1);
  });

  it("reports design values straight from the shared config", () => {
    const values = Object.fromEntries(designValues().map(({ name, value }) => [name, value]));
    expect(values["Stroke width"]).toBe(String(iconSystem.design.strokeWidth));
    expect(values["Recommended sizes"]).toBe(iconSystem.design.recommendedSizes.join(", "));
    expect(values["Safe-area inset"]).toContain(String(iconSystem.design.safeAreaInset));
    expect(values["Stroke caps and joins"]).toBe("round / round");
    expect(values).not.toHaveProperty("Miter limit");

    const { sharp } = iconSystem.design;
    const sharpValues = Object.fromEntries(
      designValues("sharp").map(({ name, value }) => [name, value]),
    );
    expect(sharpValues["Stroke caps and joins"]).toBe(`${sharp.linecap} / ${sharp.linejoin}`);
    expect(sharpValues["Miter limit"]).toBe(String(sharp.miterLimit));
    expect(sharpValues["Stroke width"]).toBe(values["Stroke width"]);
    expect(strokeStyle("round")).toEqual({ linecap: "round", linejoin: "round" });
    expect(strokeStyle("sharp")).toEqual(sharp);
  });
});

/* Logos */

/** A small `config/brands.json` with the shapes and oddities the real file has. */
const fixtureBrands = {
  source: "https://example.test/thesvg",
  commit: "0123456789abcdef0123456789abcdef01234567",
  packageVersion: "9.9.9",
  collections: [
    { id: "brands", label: "Brands", count: 3 },
    { id: "aws", label: "AWS architecture", count: 1 },
  ],
  logos: {
    zeta: {
      title: "Zeta",
      collection: "brands",
      componentName: "ZetaLogo",
      defaultVariant: "default",
      variants: {
        default: { file: "x", background: "light", colors: ["#111111"] },
        dark: { file: "x", background: "dark", colors: ["#ffffff"] },
        wordmark: { file: "x", background: "light", colors: ["#111111"] },
        "wordmark-dark": { file: "x", background: "dark", colors: ["#ffffff"] },
        mono: { file: "x", background: "light", colors: ["currentColor"] },
      },
      hex: "ff5500",
      categories: ["Software", "AI"],
      aliases: ["zed"],
      license: "MIT",
      licenseClass: "permissive",
      licenseRaw: "MIT",
      website: "https://zeta.example.test",
      guidelines: null,
      source: "https://example.test/icon/zeta",
    },
    alpha: {
      title: "Alpha",
      collection: "brands",
      componentName: "AlphaLogo",
      defaultVariant: "missing",
      variants: { color: { file: "x", background: "any", colors: ["#00aa00", "#ffffff"] } },
      hex: null,
      categories: ["Finance"],
      aliases: [],
      license: "GPL-3.0-only",
      licenseClass: "copyleft",
      website: null,
      guidelines: "https://alpha.example.test/brand",
      source: "https://elsewhere.test/alpha",
    },
    "aws-lambda": {
      title: "AWS Lambda",
      collection: "aws",
      componentName: "AwsLambdaLogo",
      defaultVariant: "default",
      variants: {
        default: { file: "x", background: "any", colors: ["#ff9900"] },
        "16": { file: "x", background: "any", colors: [] },
      },
      hex: "FF9900",
      categories: ["Compute"],
      aliases: ["serverless"],
      license: "CC-BY-ND-2.0",
      licenseClass: "no-derivatives",
      website: null,
      guidelines: null,
      source: "https://example.test/icon/aws-lambda",
    },
    beta: {
      title: "beta",
      collection: "extra",
      componentName: "BetaLogo",
      defaultVariant: "default",
      variants: { default: { file: "x", background: "dark", colors: ["#ffffff"] } },
      hex: "not-a-hex",
      categories: [],
      aliases: [],
      license: "Trademark",
      licenseClass: "something-new",
      website: null,
      guidelines: null,
      source: "https://example.test/icon/beta",
    },
    "Bad Slug": { title: "Bad", collection: "brands", componentName: "BadLogo", variants: {} },
    novariants: {
      title: "No variants",
      collection: "brands",
      componentName: "NoLogo",
      variants: {},
    },
    untitled: { collection: "brands", componentName: "UntitledLogo", variants: { default: {} } },
  },
};

const index = decodeLogoIndex(JSON.parse(JSON.stringify(encodeLogoIndex(fixtureBrands))));
const logo = (id: string) => index.logos.find((entry) => entry.id === id) as LogoEntry;

describe("playground logo index", () => {
  it("encodes compactly and decodes to the catalogue the pages read", () => {
    expect(index.source).toBe(fixtureBrands.source);
    expect(index.commit).toBe(fixtureBrands.commit);
    expect(index.version).toBe("9.9.9");
    // Configured collections first; an unknown one is appended under its own id.
    expect(index.collections).toEqual([
      { id: "brands", label: "Brands" },
      { id: "aws", label: "AWS architecture" },
      { id: "extra", label: "extra" },
    ]);
    // Malformed logos are dropped; the rest are grouped by collection, then by title.
    expect(ids(index.logos)).toEqual(["alpha", "zeta", "aws-lambda", "beta"]);
    expect(logo("zeta")).toEqual({
      id: "zeta",
      title: "Zeta",
      collection: "brands",
      componentName: "ZetaLogo",
      defaultVariant: "default",
      variants: [
        { name: "default", background: "light", colors: ["#111111"] },
        { name: "dark", background: "dark", colors: ["#ffffff"] },
        { name: "wordmark", background: "light", colors: ["#111111"] },
        { name: "wordmark-dark", background: "dark", colors: ["#ffffff"] },
        { name: "mono", background: "light", colors: ["currentColor"] },
      ],
      hex: "FF5500",
      categories: ["Software", "AI"],
      aliases: ["zed"],
      license: "MIT",
      licenseClass: "permissive",
      website: "https://zeta.example.test",
      guidelines: null,
      source: "https://example.test/icon/zeta",
    });
  });

  it("falls back safely for missing defaults, odd hex values, and unknown licence classes", () => {
    expect(logo("alpha").defaultVariant).toBe("color");
    expect(logo("alpha").source).toBe("https://elsewhere.test/alpha");
    expect(logo("beta").hex).toBeNull();
    expect(logo("beta").licenseClass).toBe("no-licence");
    expect(toLicenseClass("copyleft")).toBe("copyleft");
    expect(toLicenseClass(undefined)).toBe("no-licence");
  });

  it("shares one source prefix instead of repeating it for every logo", () => {
    const encoded = encodeLogoIndex(fixtureBrands);
    expect(encoded.sourcePrefix).toBe("https://example.test/icon/");
    expect(JSON.stringify(encoded)).not.toContain("example.test/icon/zeta");
  });

  it("is empty, not broken, without a usable file", () => {
    for (const file of [undefined, null, 42, "x", { logos: [] }, {}]) {
      expect(decodeLogoIndex(encodeLogoIndex(file))).toMatchObject({ logos: [], collections: [] });
    }
    expect(decodeLogoIndex(undefined).logos).toEqual([]);
    expect(decodeLogoIndex({ v: 2, logos: [] }).logos).toEqual([]);
  });

  it("indexes the real brand catalogue, with a generated component for every logo", () => {
    const file = join(PKG, "config/brands.json");
    if (!existsSync(file)) return;
    const brands = JSON.parse(readFileSync(file, "utf8"));
    const real = decodeLogoIndex(encodeLogoIndex(brands));
    expect(real.logos.length).toBe(Object.keys(brands.logos).length);
    expect(collectionOptions(real).reduce((sum, { count }) => sum + count, 0)).toBe(
      real.logos.length,
    );
    const generated = join(PKG, "src/generated/logos");
    if (existsSync(generated)) {
      const modules = new Set(readdirSync(generated).map(moduleId));
      expect(real.logos.filter(({ id }) => !modules.has(id)).map(({ id }) => id)).toEqual([]);
    }
  });
});

describe("playground logo browsing", () => {
  const find = (change: Partial<typeof emptyLogoFilter>) =>
    ids(filterLogos(index.logos, { ...emptyLogoFilter, ...change }));

  it("searches titles, slugs, component names, aliases, and categories, best first", () => {
    expect(find({ query: "zeta" })).toEqual(["zeta"]);
    expect(find({ query: "ZED" })).toEqual(["zeta"]);
    expect(find({ query: "serverless" })).toEqual(["aws-lambda"]);
    expect(find({ query: "finance" })).toEqual(["alpha"]);
    expect(find({ query: "lambda" })).toEqual(["aws-lambda"]);
    expect(find({ query: "awslambdalogo" })).toEqual(["aws-lambda"]);
    expect(find({ query: "a" })[0]).toBe("alpha");
    expect(find({ query: "nothing-like-it" })).toEqual([]);
  });

  it("filters by collection, licence classes (any), and variant kinds (all)", () => {
    expect(find({ collection: "aws" })).toEqual(["aws-lambda"]);
    expect(find({ licenses: ["permissive", "copyleft"] })).toEqual(["alpha", "zeta"]);
    expect(find({ licenses: ["non-commercial"] })).toEqual([]);
    expect(find({ kinds: ["wordmark", "dark"] })).toEqual(["zeta"]);
    expect(find({ kinds: ["dark"] })).toEqual(["zeta", "beta"]);
    expect(find({ kinds: ["sized"] })).toEqual(["aws-lambda"]);
    expect(find({ kinds: ["color"], licenses: ["copyleft"], collection: "brands" })).toEqual([
      "alpha",
    ]);
  });

  it("recognises variant families from names and backgrounds", () => {
    expect(logoKinds(logo("zeta"))).toEqual(["mono", "wordmark", "dark"]);
    expect(logoKinds(logo("alpha"))).toEqual(["color"]);
    expect(logoKinds(logo("beta"))).toEqual(["dark"]);
    expect(logoKinds(logo("aws-lambda"))).toEqual(["sized"]);
  });

  it("counts collections, licence classes, and variant kinds", () => {
    expect(collectionOptions(index)).toEqual([
      { id: "brands", label: "Brands", count: 2 },
      { id: "aws", label: "AWS architecture", count: 1 },
      { id: "extra", label: "extra", count: 1 },
    ]);
    const licences = Object.fromEntries(licenseOptions(index.logos).map((o) => [o.id, o.count]));
    expect(licences).toMatchObject({
      permissive: 1,
      copyleft: 1,
      "no-derivatives": 1,
      "no-licence": 1,
      "public-domain": 0,
    });
    expect(licenseOptions(index.logos).map(({ id }) => id)).toEqual(
      licenseClasses.map(({ id }) => id),
    );
    const kinds = Object.fromEntries(kindOptions(index.logos).map((o) => [o.id, o.count]));
    expect(kinds).toMatchObject({ mono: 1, wordmark: 1, dark: 2, color: 1, sized: 1, light: 0 });
  });

  it("labels every licence class and flags the ones that need review", () => {
    expect(licenseClasses.map(({ label }) => label)).toEqual([
      "Public domain",
      "Permissive",
      "Attribution",
      "No derivatives",
      "Share-alike",
      "Non-commercial",
      "Copyleft",
      "Unlicensed",
    ]);
    expect(licenseClasses.filter(({ tone }) => tone === "warning").map(({ id }) => id)).toEqual([
      "non-commercial",
      "copyleft",
      "no-licence",
    ]);
    expect(licenseInfo("no-licence").label).toBe("Unlicensed");
  });

  it("groups consecutive logos by collection for the grouped grid", () => {
    expect(groupByCollection(index.logos, index).map(({ id, logos }) => [id, ids(logos)])).toEqual([
      ["brands", ["alpha", "zeta"]],
      ["aws", ["aws-lambda"]],
      ["extra", ["beta"]],
    ]);
  });

  it("picks the variant drawn for each card background", () => {
    const name = (id: string, mode: "light" | "dark" | "checker") =>
      pickVariant(logo(id), mode).name;
    expect(name("zeta", "light")).toBe("default");
    expect(name("zeta", "dark")).toBe("dark");
    expect(name("zeta", "checker")).toBe("default");
    expect(name("alpha", "dark")).toBe("color");
    // Only drawn for dark: on light there is nothing better, so the card says so.
    expect(name("beta", "light")).toBe("default");
    expect(suitsBackground(pickVariant(logo("beta"), "light"), "light")).toBe(false);
    expect(suitsBackground(pickVariant(logo("beta"), "dark"), "dark")).toBe(true);
    // An explicit counterpart beats a default that merely works anywhere.
    const anyDefault: LogoEntry = {
      ...logo("zeta"),
      variants: [
        { name: "default", background: "any", colors: [] },
        { name: "dark", background: "dark", colors: [] },
      ],
    };
    expect(pickVariant(anyDefault, "dark").name).toBe("dark");
    expect(pickVariant(anyDefault, "light").name).toBe("default");
    const wordmarkDefault: LogoEntry = { ...logo("zeta"), defaultVariant: "wordmark" };
    expect(pickVariant(wordmarkDefault, "dark").name).toBe("wordmark-dark");
  });

  it("writes the import and JSX for a logo, naming only non-default props", () => {
    expect(logoSnippets(logo("zeta"))).toEqual({
      import: 'import { ZetaLogo } from "@qeetrix/icons";',
      usage: '<ZetaLogo alt="Zeta" />',
    });
    expect(logoSnippets(logo("zeta"), "default", 24).usage).toBe('<ZetaLogo alt="Zeta" />');
    expect(logoSnippets(logo("zeta"), "wordmark-dark", 48).usage).toBe(
      '<ZetaLogo variant="wordmark-dark" height={48} alt="Zeta" />',
    );
    expect(logoSnippets({ ...logo("zeta"), title: 'Say "hi"' }).usage).toBe(
      '<ZetaLogo alt="Say &quot;hi&quot;" />',
    );
  });
});

/* Windowed grids */

describe("playground grid layout", () => {
  const metrics = { columns: 3, rowHeight: 100, rowGap: 10, headerHeight: 40 };

  it("fits columns to the width, never fewer than one", () => {
    expect(columnsFor(1000, 100, 0)).toBe(10);
    expect(columnsFor(1000, 196, 12)).toBe(4);
    expect(columnsFor(50, 100, 0)).toBe(1);
    expect(columnsFor(0, 100, 12)).toBe(1);
  });

  it("starts every group on a new row under its header", () => {
    const { rows, rowOfItem, height } = layoutGrid([4, 0, 2], metrics);
    expect(rows).toEqual([
      { kind: "header", group: 0, top: 0, height: 40 },
      { kind: "items", group: 0, start: 0, end: 3, top: 40, height: 100 },
      { kind: "items", group: 0, start: 3, end: 4, top: 150, height: 100 },
      { kind: "header", group: 2, top: 260, height: 40 },
      { kind: "items", group: 2, start: 4, end: 6, top: 300, height: 100 },
    ]);
    expect(rowOfItem).toEqual([1, 1, 1, 2, 4, 4]);
    expect(height).toBe(400);
    expect(layoutGrid([], metrics)).toEqual({ rows: [], rowOfItem: [], height: 0 });
    expect(layoutGrid([5], { ...metrics, headerHeight: 0 }).rows.map((row) => row.kind)).toEqual([
      "items",
      "items",
    ]);
  });

  it("finds the rows that intersect the viewport", () => {
    const { rows } = layoutGrid([4, 0, 2], metrics);
    expect(visibleRows(rows, 0, 39)).toEqual([0, 0]);
    expect(visibleRows(rows, 45, 160)).toEqual([1, 2]);
    expect(visibleRows(rows, -500, 10_000)).toEqual([0, 4]);
    expect(visibleRows(rows, 5_000, 6_000)).toEqual([0, -1]);
    expect(visibleRows([], 0, 100)).toEqual([0, -1]);
  });

  it("moves with the arrow, Home, End, and Page keys across rows and headers", () => {
    const layout = layoutGrid([4, 0, 2], metrics);
    expect(moveInGrid(layout, 0, "ArrowRight")).toBe(1);
    expect(moveInGrid(layout, 2, "ArrowRight")).toBe(3);
    expect(moveInGrid(layout, 5, "ArrowRight")).toBe(5);
    expect(moveInGrid(layout, 0, "ArrowLeft")).toBe(0);
    // Down keeps the column, clamped to a shorter row, and skips the header.
    expect(moveInGrid(layout, 2, "ArrowDown")).toBe(3);
    expect(moveInGrid(layout, 3, "ArrowDown")).toBe(4);
    expect(moveInGrid(layout, 5, "ArrowDown")).toBe(5);
    expect(moveInGrid(layout, 5, "ArrowUp")).toBe(3);
    expect(moveInGrid(layout, 1, "ArrowUp")).toBe(1);
    expect(moveInGrid(layout, 1, "Home")).toBe(0);
    expect(moveInGrid(layout, 1, "End")).toBe(2);
    expect(moveInGrid(layout, 1, "End", { toEdge: true })).toBe(5);
    expect(moveInGrid(layout, 5, "Home", { toEdge: true })).toBe(0);
    expect(moveInGrid(layout, 0, "PageDown", { pageRows: 2 })).toBe(4);
    expect(moveInGrid(layout, 4, "PageUp", { pageRows: 5 })).toBe(0);
    expect(moveInGrid(layout, 99, "ArrowRight")).toBe(0);
    expect(moveInGrid(layoutGrid([], metrics), 0, "ArrowRight")).toBe(-1);
  });
});

/* URL state */

describe("playground URL state", () => {
  it("defaults to the Icons page, round shape, configured sizes, system theme, and LTR", () => {
    expect(parseAppState("")).toEqual(defaultAppState);
    expect(defaultIconsState.shape).toBe(iconSystem.architecture.defaultStyle);
    expect(defaultIconsState.size).toBe(iconSystem.design.defaultSize);
    expect(defaultIconsState.preview).toBe(iconSystem.design.defaultSize);
    expect(defaultIconsState.stroke).toBe(iconSystem.design.strokeWidth);
    expect(serializeAppState(defaultAppState)).toBe("");
    expect(serializeAppState({ ...defaultAppState, page: "logos" })).toBe("?page=logos");
  });

  it("round-trips the Icons page: search, filters, display, inspection, and theme", () => {
    const search =
      "?q=arrow&category=arrows&variants=filled&direction=mirror&shape=sharp&preview=32&stroke=1.5&color=accent&icon=fixture-star&variant=filled&size=16&dir=rtl&theme=dark";
    const state = parseAppState(search);
    expect(state).toEqual({
      page: "icons",
      theme: "dark",
      icons: {
        q: "arrow",
        category: "arrows",
        variants: "filled",
        directionality: "mirror",
        shape: "sharp",
        preview: 32,
        stroke: 1.5,
        color: "accent",
        icon: "fixture-star",
        variant: "filled",
        size: 16,
        dir: "rtl",
      },
      logos: defaultLogosState,
    });
    expect(serializeAppState(state)).toBe(search);
    expect(
      serializeAppState({ ...state, icons: { ...state.icons, variant: "outline" } }),
    ).not.toContain("variant=");
  });

  it("still opens links from the previous playground", () => {
    expect(
      parseAppState("?icon=fixture-star&shape=sharp&variant=filled&size=16&theme=dark&dir=rtl"),
    ).toEqual({
      ...defaultAppState,
      theme: "dark",
      icons: {
        ...defaultIconsState,
        icon: "fixture-star",
        shape: "sharp",
        variant: "filled",
        size: 16,
        dir: "rtl",
      },
    });
  });

  it("round-trips the Logos page, with licence and kind lists in canonical order", () => {
    const state = parseAppState(
      "?page=logos&q=git&collection=brands&license=copyleft,permissive,copyleft,bogus&kind=dark,mono&bg=checker&logo=github",
    );
    expect(state).toEqual({
      page: "logos",
      theme: "system",
      icons: defaultIconsState,
      logos: {
        q: "git",
        collection: "brands",
        licenses: ["permissive", "copyleft"],
        kinds: ["mono", "dark"],
        bg: "checker",
        logo: "github",
      },
    });
    expect(serializeAppState(state)).toBe(
      "?page=logos&q=git&collection=brands&license=permissive,copyleft&kind=mono,dark&bg=checker&logo=github",
    );
    expect(parseAppState(serializeAppState(state))).toEqual(state);
  });

  it("writes only the current page's parameters", () => {
    const state: AppState = {
      page: "logos",
      theme: "light",
      icons: { ...defaultIconsState, q: "star", icon: "star" },
      logos: { ...defaultLogosState, logo: "github" },
    };
    expect(serializeAppState(state)).toBe("?page=logos&logo=github&theme=light");
    expect(serializeAppState({ ...state, page: "icons" })).toBe("?q=star&icon=star&theme=light");
  });

  it("keeps the other page's state across back and forward navigation", () => {
    const current: AppState = {
      ...defaultAppState,
      icons: { ...defaultIconsState, q: "star" },
      logos: { ...defaultLogosState, q: "git" },
    };
    const toLogos = mergeNavigation(current, parseAppState("?page=logos&logo=github&theme=dark"));
    expect(toLogos.page).toBe("logos");
    expect(toLogos.theme).toBe("dark");
    expect(toLogos.icons).toEqual(current.icons);
    expect(toLogos.logos).toEqual({ ...defaultLogosState, logo: "github" });
    const toIcons = mergeNavigation(toLogos, parseAppState("?icon=star"));
    expect(toIcons.icons).toEqual({ ...defaultIconsState, icon: "star" });
    expect(toIcons.logos).toEqual(toLogos.logos);
  });

  it("accepts colour tokens and six-digit hex colours only", () => {
    expect(parseAppState("?color=FF5500").icons.color).toBe("ff5500");
    expect(parseAppState("?color=red").icons.color).toBe("red");
    for (const color of ["#ff5500", "fff", "pink", "url(x)"]) {
      expect(parseAppState(`?color=${encodeURIComponent(color)}`).icons.color).toBe("foreground");
    }
  });

  it.each([
    "?icon=Star&variant=solid&size=500&theme=neon&dir=up",
    "?shape=square&variants=sharp&direction=sideways",
    "?shape=Sharp&variant=sharp&category=not-a-category",
    "?icon=../star&size=12.5&preview=17&stroke=2.1",
    "?size=abc&variant=&stroke=0.25&stroke=9",
    `?size=${sizeRange.min - 1}&preview=-24`,
    "?icon=%3Cscript%3E&page=admin",
  ])("falls back safely for invalid Icons state %s", (search) => {
    expect(parseAppState(search)).toEqual(defaultAppState);
  });

  it.each([
    "?page=logos&collection=../x&license=,,&kind=everything&bg=purple&logo=Not%20A%20Slug",
    "?page=logos&logo=%3Cimg%3E&collection=Brands",
  ])("falls back safely for invalid Logos state %s", (search) => {
    expect(parseAppState(search)).toEqual({ ...defaultAppState, page: "logos" });
  });

  it("strips control characters from search text and caps its length", () => {
    expect(parseAppState("?q=a%00b%1Fc").icons.q).toBe("abc");
    expect(parseAppState(`?q=${"x".repeat(500)}`).icons.q).toHaveLength(120);
  });
});

describe("playground boundary", () => {
  const sources = readdirSync(join(PKG, "playground/src")).map((file) =>
    readFileSync(join(PKG, "playground/src", file), "utf8"),
  );

  it("imports only React, its own build-time data, and repository code: no UI kit or router", () => {
    const external = sources
      .flatMap((source) =>
        [...source.matchAll(/^import\b[\s\S]*?\bfrom "([^"]+)";/gm)].map(([, module]) => module),
      )
      .filter((module) => !module.startsWith("."));
    expect([...new Set(external)].sort()).toEqual([
      "react",
      "react-dom/client",
      "virtual:qeetrix-meta",
    ]);
  });

  it("reads generated output without writing to it or fetching anything", () => {
    for (const source of sources) {
      expect(source).not.toMatch(/writeFile|node:fs|fetch\(|https?:\/\/(?!www\.w3\.org)/);
    }
  });

  it("never imports the logo modules, brand file, or logo barrel eagerly", () => {
    const all = sources.join("\n");
    expect(all).not.toMatch(/generated\/logos\/[^"*]*["']/);
    expect(all).not.toMatch(
      /(from |import\()["'][^"']*(brands\.json|logo-index|logo-manifest|src\/manifest)[^"']*["']/,
    );
    expect(all).not.toMatch(/import\.meta\.glob[^;]*generated\/logos[^;]*eager/);
  });
});

describe("playground build", () => {
  let workspace = "";
  afterAll(() => {
    if (workspace) rmSync(workspace, { recursive: true, force: true });
  });

  it("compiles icons eagerly and logos lazily, from fixtures, without the brand catalogue", () => {
    workspace = mkdtempSync(join(tmpdir(), "qeetrix-icons-playground-"));
    // The brand sources (63 MB), the logo modules (50 MB), and the brand file stay behind:
    // fixtures below stand in for them.
    const skipped = new Set([
      brandSourceDirectory,
      "src/generated/logos",
      "src/generated/logo-index.ts",
      "src/generated/logo-manifest.ts",
      "config/brands.json",
    ]);
    cpSync(PKG, workspace, {
      recursive: true,
      filter: (source) => {
        const path = relative(PKG, source).split(sep).join("/");
        return (
          !skipped.has(path) &&
          !path
            .split("/")
            .some((part) => ["node_modules", "dist", ".git", "coverage"].includes(part))
        );
      },
    });
    symlinkSync(join(PKG, "node_modules"), join(workspace, "node_modules"), "junction");
    // Both shapes, as validation requires once the repository has sharp drawings.
    for (const { file, source } of [...apiFixtures, ...sharpApiFixtures]) {
      writeFixture(workspace, file, source);
    }
    writeFixture(
      workspace,
      "config/icon-metadata.ts",
      `import type { IconDirectionality } from "../src/types/icon.js";
export type IconMetadata = {
  readonly directionality?: IconDirectionality;
  readonly categories?: readonly string[];
  readonly tags?: readonly string[];
  readonly aliases?: readonly string[];
};
export const iconMetadata: Readonly<Record<string, IconMetadata>> = ${JSON.stringify({ ...iconMetadata, ...apiFixtureMetadata })};
`,
    );
    const run = (args: string[]) =>
      execFileSync(args[0], args.slice(1), { cwd: workspace, encoding: "utf8", stdio: "pipe" });
    run(["bun", "scripts/build/generate-icons.ts"]);
    // Two fixture logos: the brand file the index is built from, and one stand-in module each.
    writeFixture(workspace, "config/brands.json", JSON.stringify(fixtureBrands));
    for (const [id, componentName] of [
      ["zeta", "ZetaLogo"],
      ["alpha", "AlphaLogo"],
    ]) {
      writeFixture(
        workspace,
        `src/generated/logos/${id}.ts`,
        `export function ${componentName}() {\n  return "fixture-logo-module-${id}";\n}\n`,
      );
    }
    run([
      process.execPath,
      join(PKG, "node_modules/vite/bin/vite.js"),
      "build",
      "--config",
      "playground/vite.config.ts",
      "--logLevel",
      "warn",
    ]);
    const assets = join(workspace, "playground/dist/assets");
    const chunks = readdirSync(assets).filter((file) => file.endsWith(".js"));
    const read = (file: string) => readFileSync(join(assets, file), "utf8");
    const entry = chunks.find((file) => /^index-/.test(file)) as string;
    const main = read(entry);
    // Every drawing in both shapes, the other concepts, and the manifest entries, through the one
    // module glob: the sharp drawings travel inside each concept's module.
    for (const marker of [
      "3.125",
      "6.25",
      "7.5",
      "9.375",
      "3.375",
      "6.875",
      "8.125",
      "9.625",
      "fixture-star",
      "FixtureArrowIcon",
      // Version stamps come from the small meta module, not the large config files.
      "9.9.9",
    ]) {
      expect(main, marker).toContain(marker);
    }
    // Logo modules and the logo index are separate chunks, loaded on demand.
    for (const id of ["zeta", "alpha"]) {
      expect(main).not.toContain(`fixture-logo-module-${id}`);
      const chunk = chunks.find((file) => read(file).includes(`fixture-logo-module-${id}`));
      expect(chunk, id).toBeDefined();
    }
    expect(main).not.toContain("AWS Lambda");
    const logoIndex = chunks.find((file) => read(file).includes("AWS Lambda"));
    expect(logoIndex).toBeDefined();
    expect(read(logoIndex as string)).not.toContain("example.test/icon/zeta");
    // Nothing of the real brand catalogue rode along.
    const size = chunks.reduce((sum, file) => sum + statSync(join(assets, file)).size, 0);
    expect(size).toBeLessThan(12 * 1024 * 1024);
    expect(chunks.some((file) => read(file).includes("GithubLogo"))).toBe(false);
  }, 120_000);
});
