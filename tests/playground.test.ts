import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
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
  type IconModule,
  importSnippets,
  mirrorsInPreview,
  moduleId,
  selectedVariant,
  variantFilterOptions,
} from "../playground/src/catalogue.js";
import { checklistFor, provisionalValues } from "../playground/src/qa.js";
import {
  defaultUrlState,
  parseUrlState,
  serializeUrlState,
  sizeRange,
} from "../playground/src/url-state.js";
import { createGenerationPlan } from "../scripts/lib/generation-plan.js";
import { iconManifest } from "../src/manifest.js";
import type { IconManifest } from "../src/types/icon-manifest.js";
import { apiFixtureMetadata, apiFixtures, writeFixture } from "./helpers.js";

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
const ids = (icons: readonly CatalogueIcon[]) => icons.map(({ id }) => id);

describe("playground catalogue", () => {
  it("resolves every real manifest concept to its real generated module", async () => {
    const modules = new Map<string, IconModule>();
    for (const file of readdirSync(join(PKG, "src/generated/icons"))) {
      modules.set(moduleId(file), await import(join(PKG, "src/generated/icons", file)));
    }
    const real = buildCatalogue(iconManifest, modules);
    expect(real.problems).toEqual([]);
    expect(real.icons.map(({ id }) => id)).toEqual(iconManifest.icons.map(({ id }) => id));
  });

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
      ["fixture-search", "FixtureSearchIcon", "Actions", ["outline"], "preserve"],
      ["fixture-arrow", "FixtureArrowIcon", "Navigation", ["outline"], "mirror"],
      ["fixture-star", "FixtureStarIcon", "Status", ["outline", "filled"], "preserve"],
    ]);
    expect(catalogue.byId.get("fixture-star")?.Component).toBe(component);
  });

  it("maps generated module paths to public ids", () => {
    expect(moduleId("../../src/generated/icons/fixture-star.tsx")).toBe("fixture-star");
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
});

describe("playground search and filters", () => {
  it.each([
    ["STAR", ["fixture-star"]],
    ["  fixturesearchicon ", ["fixture-search"]],
    ["navigation", ["fixture-arrow"]],
    ["status", ["fixture-star"]],
    ["fixture", ["fixture-search", "fixture-arrow", "fixture-star"]],
    ["", ["fixture-search", "fixture-arrow", "fixture-star"]],
    ["no-such-icon", []],
  ])("matches %j case-insensitively on id, component, and category", (query, expected) => {
    expect(ids(filterIcons(catalogue.icons, { ...emptyFilter, query }))).toEqual(expected);
  });

  it("filters by category, variant availability, and directionality", () => {
    const filter = (change: Partial<typeof emptyFilter>) =>
      ids(filterIcons(catalogue.icons, { ...emptyFilter, ...change }));
    expect(filter({ category: "status" })).toEqual(["fixture-star"]);
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
      { id: "actions", label: "Actions", count: 1 },
      { id: "navigation", label: "Navigation", count: 1 },
      { id: "status", label: "Status", count: 1 },
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

  it("shows public imports only, never generated paths", () => {
    expect(importSnippets(star)).toEqual({
      root: 'import { FixtureStarIcon } from "@qeetrix/icons";',
      direct: 'import { FixtureStarIcon } from "@qeetrix/icons/icons/fixture-star";',
    });
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

  it("reports provisional design values straight from the shared config", () => {
    const values = Object.fromEntries(provisionalValues().map(({ name, value }) => [name, value]));
    expect(values["Stroke width"]).toBe(String(iconSystem.calibration.strokeWidth));
    expect(values["Recommended sizes"]).toBe(iconSystem.calibration.recommendedSizes.join(", "));
    expect(values["Safe-area inset"]).toContain(String(iconSystem.calibration.safeAreaInset));
    expect(Object.keys(values)).toEqual(
      expect.arrayContaining(["Corner treatment", "Small-size optical corrections"]),
    );
  });
});

describe("playground URL state", () => {
  it("defaults to the configured size, system theme, and LTR", () => {
    expect(parseUrlState("")).toEqual({ ...defaultUrlState, icon: undefined, variant: undefined });
    expect(defaultUrlState.size).toBe(iconSystem.calibration.defaultSize);
    expect(serializeUrlState(defaultUrlState)).toBe("");
  });

  it("round-trips shareable inspection state", () => {
    const search = "?icon=fixture-star&variant=filled&size=16&theme=dark&dir=rtl";
    const state = parseUrlState(search);
    expect(state).toEqual({
      icon: "fixture-star",
      variant: "filled",
      size: 16,
      theme: "dark",
      dir: "rtl",
    });
    expect(serializeUrlState(state)).toBe(search);
    expect(serializeUrlState({ ...state, variant: "outline" })).not.toContain("variant");
  });

  it.each([
    "?icon=Star&variant=solid&size=500&theme=neon&dir=up",
    "?icon=../star&size=12.5",
    "?size=abc&variant=",
    `?size=${sizeRange.min - 1}`,
    "?icon=%3Cscript%3E",
  ])("falls back safely for invalid state %s", (search) => {
    expect(parseUrlState(search)).toEqual({
      ...defaultUrlState,
      icon: undefined,
      variant: undefined,
    });
  });
});

describe("playground boundary", () => {
  const sources = readdirSync(join(PKG, "playground/src")).map((file) =>
    readFileSync(join(PKG, "playground/src", file), "utf8"),
  );

  it("imports only React and repository code: no UI kit, router, or icon library", () => {
    const external = sources
      .flatMap((source) =>
        [...source.matchAll(/^import\b[\s\S]*?\bfrom "([^"]+)";/gm)].map(([, module]) => module),
      )
      .filter((module) => !module.startsWith("."));
    expect([...new Set(external)].sort()).toEqual(["react", "react-dom/client"]);
  });

  it("reads generated output without writing to it or fetching anything", () => {
    for (const source of sources) {
      expect(source).not.toMatch(/writeFile|node:fs|fetch\(|https?:\/\/(?!www\.w3\.org)/);
    }
  });
});

describe("playground build", () => {
  let workspace = "";
  afterAll(() => {
    if (workspace) rmSync(workspace, { recursive: true, force: true });
  });

  it("compiles real generated fixture modules through the Vite-only module loader", () => {
    workspace = mkdtempSync(join(tmpdir(), "qeetrix-icons-playground-"));
    cpSync(PKG, workspace, {
      recursive: true,
      filter: (source) =>
        !relative(PKG, source)
          .split(sep)
          .some((part) => ["node_modules", "dist", ".git", "coverage"].includes(part)),
    });
    symlinkSync(join(PKG, "node_modules"), join(workspace, "node_modules"), "junction");
    for (const { file, source } of apiFixtures) writeFixture(workspace, file, source);
    writeFixture(
      workspace,
      "config/icon-metadata.ts",
      `import type { IconDirectionality } from "../src/types/icon.js";
export type IconMetadataOverride = { readonly directionality: IconDirectionality };
export const iconMetadata: Readonly<Record<string, IconMetadataOverride>> = ${JSON.stringify({ ...iconMetadata, ...apiFixtureMetadata })};
`,
    );
    const run = (args: string[]) =>
      execFileSync(args[0], args.slice(1), { cwd: workspace, encoding: "utf8", stdio: "pipe" });
    run(["bun", "scripts/build/generate-icons.ts"]);
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
    const bundle = readdirSync(assets)
      .filter((file) => file.endsWith(".js"))
      .map((file) => readFileSync(join(assets, file), "utf8"))
      .join("\n");
    // Both drawings of the two-variant concept, the other concepts, and the manifest entries.
    for (const marker of ["3.125", "6.25", "7.5", "9.375", "fixture-star", "FixtureArrowIcon"]) {
      expect(bundle, marker).toContain(marker);
    }
  }, 60_000);
});
