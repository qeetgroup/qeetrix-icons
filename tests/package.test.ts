import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { iconMetadata } from "../config/icon-metadata.js";
import { iconSystem } from "../config/icon-system.js";
import { brandSourceDirectory } from "../scripts/check/validate-repository.js";
import { iconManifest, logoManifest } from "../src/manifest.js";
import { apiFixtureMetadata, apiFixtures, sharpApiFixtures, writeFixture } from "./helpers.js";

/**
 * The published contract, proved against a real tarball.
 *
 * A temporary copy of this repository gets the synthetic fixtures, runs the real `generate` CLI
 * and `bun pm pack` (which builds), and the tarball is installed into a throwaway consumer. Nothing
 * here touches the production `icons/`, `src/generated/`, or manifest.
 */

const PKG = join(import.meta.dirname, "..");
/** The real production concepts, packed alongside the synthetic fixtures. */
const production = iconManifest.icons;
/**
 * Concepts proved one by one against the tarball. Every concept goes through the same generator,
 * so a fixed sample stands for all of them: per category, the first concept and the first with a
 * filled drawing, plus names that stress the PascalCase conversion. Spawning Node and bundling
 * once per concept for all of them would take most of an hour.
 */
const sampled = [
  ...new Set(
    [
      ...[...new Set(production.map(({ category }) => category))].flatMap((category) => {
        const inCategory = production.filter((icon) => icon.category === category);
        return [inCategory[0], inCategory.find(({ variants }) => variants.includes("filled"))];
      }),
      ...production.filter(({ id }) => ["clock-12", "type-outline", "a-arrow-down"].includes(id)),
    ].filter((icon) => icon !== undefined),
  ),
];
const generatedSource = (id: string) =>
  readFileSync(join(PKG, "src/generated/icons", `${id}.tsx`), "utf8");
/** Each real concept's path data, read from its generated module; distinctive enough to exclude. */
const geometry = new Map(
  production.map(({ id }) => [
    id,
    [...generatedSource(id).matchAll(/\b(?:d|points)="([^"]+)"/g)].map(([, value]) => value),
  ]),
);
/**
 * Patterns that find a concept in rendered markup or a minified bundle. Path data is matched
 * literally; shape elements without path data (dot grids, for example) are matched by their
 * attribute values in order, whatever the quoting: `cx="6" cy="12"` and `cx:"6",cy:"12"` both match.
 */
function tracesOf(source: string): RegExp[] {
  const shapes = [...source.matchAll(/<(?:circle|ellipse|rect|line)\b([^>]*?)\/>/g)];
  const shapePatterns = shapes.map(
    ([, attributes]) =>
      new RegExp(
        // Generated elements list attributes in codepoint order, so the render does too.
        [...attributes.matchAll(/(\w+)="([^"]+)"/g)]
          .sort(([, left], [, right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([, name, value]) => `${name}\\W+${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
          .join("\\W+"),
      ),
  );
  const pathPatterns = [...source.matchAll(/\b(?:d|points)="([^"]+)"/g)].map(
    ([, value]) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  return [...pathPatterns, ...shapePatterns];
}
/** The default (outline) drawing's patterns, read from its source SVG: what a default render shows. */
const outlineTraces = new Map(
  production.map(({ id, category }) => [
    id,
    tracesOf(readFileSync(join(PKG, "icons/round-outline", category, `${id}.svg`), "utf8")),
  ]),
);
/** The sharp outline drawing's patterns: what `shape="sharp"` shows. */
const sharpOutlineTraces = new Map(
  production.map(({ id, category }) => [
    id,
    tracesOf(readFileSync(join(PKG, "icons/sharp-outline", category, `${id}.svg`), "utf8")),
  ]),
);
const traces = new Map(
  production.map(({ id }) => {
    const shapes = [...generatedSource(id).matchAll(/<(?:circle|ellipse|rect|line)\b([^>]*?)\/>/g)];
    const shapePatterns = shapes.map(
      ([, attributes]) =>
        new RegExp(
          [...attributes.matchAll(/(\w+)="([^"]+)"/g)]
            .map(([, name, value]) => `${name}\\W+${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
            .join("\\W+"),
        ),
    );
    const pathPatterns = (geometry.get(id) ?? []).map(
      (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    return [id, [...pathPatterns, ...shapePatterns]];
  }),
);
let workspace = "";
let consumer = "";
let tarball = "";

const run = (command: string, args: string[], cwd: string) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });

function linkDependency(name: string): void {
  mkdirSync(join(consumer, "node_modules", name, ".."), { recursive: true });
  symlinkSync(join(PKG, "node_modules", name), join(consumer, "node_modules", name), "junction");
}

/**
 * Runs an ES module in the consumer under Node specifically, so resolution follows Node's exports
 * semantics whichever runtime executes the test suite. (Bun's resolver is more lenient: it also
 * resolves an extension-bearing `@qeetrix/icons/icons/<id>.js`, which is not part of the contract.)
 */
function node(script: string): unknown {
  return JSON.parse(run("node", ["--input-type=module", "-e", script], consumer));
}

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), "qeetrix-icons-package-"));
  const repository = join(workspace, "repository");
  cpSync(PKG, repository, {
    recursive: true,
    // Brand logo sources feed their own pipeline, never icon generation or the build.
    filter: (source) =>
      relative(PKG, source).split(sep).join("/") !== brandSourceDirectory &&
      !relative(PKG, source)
        .split(sep)
        .some((part) => ["node_modules", "dist", ".git", "coverage"].includes(part)),
  });
  symlinkSync(join(PKG, "node_modules"), join(repository, "node_modules"), "junction");
  // Both shapes: once a repository has sharp drawings, every concept needs them.
  for (const { file, source } of [...apiFixtures, ...sharpApiFixtures]) {
    writeFixture(repository, file, source);
  }
  writeFixture(
    repository,
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
  run("bun", ["scripts/build/generate-icons.ts"], repository);
  tarball = run("bun", ["pm", "pack", "--quiet", "--destination", workspace], repository)
    .trim()
    .split("\n")
    .pop() as string;
  if (!tarball.startsWith(sep)) tarball = join(workspace, tarball);

  consumer = join(workspace, "consumer");
  const installed = join(consumer, "node_modules/@qeetrix/icons");
  mkdirSync(installed, { recursive: true });
  run("tar", ["-xzf", tarball, "-C", installed, "--strip-components=1"], workspace);
  for (const name of ["react", "react-dom", "@types/react", "@types/react-dom"])
    linkDependency(name);
  writeFixture(
    consumer,
    "package.json",
    '{ "name": "consumer", "private": true, "type": "module" }',
  );
  // Copies the repository, generates, and packs, which builds every module under src/: the icon
  // components and, alongside them, the generated logo modules.
}, 300_000);

afterAll(() => {
  if (workspace) rmSync(workspace, { recursive: true, force: true });
});

describe("packed @qeetrix/icons", () => {
  it("ships only built output and package metadata", () => {
    const entries = run("tar", ["-tzf", tarball], workspace)
      .trim()
      .split("\n")
      .map((entry) => entry.replace(/^package\//, ""))
      .sort();
    for (const entry of entries) {
      expect(
        ["package.json", "README.md", "LICENSE"].includes(entry) || entry.startsWith("dist/"),
        entry,
      ).toBe(true);
      expect(entry, entry).not.toMatch(
        /\.svg$|(?<!\.d)\.tsx?$|icon-manifest\.json|scripts\/|config\//,
      );
    }
    expect(entries).toEqual(
      expect.arrayContaining([
        "dist/index.js",
        "dist/index.d.ts",
        "dist/manifest.js",
        "dist/manifest.d.ts",
        "dist/generated/icons/fixture-search.js",
        "dist/generated/icons/fixture-search.d.ts",
        "dist/generated/icons/fixture-star.js",
        "dist/generated/icons/fixture-star.d.ts",
      ]),
    );
    // Variants and shapes are props of each icon, never entry points or modules of their own.
    // Brand logos are excluded: their slugs legitimately contain words like "sharp" (c-sharp).
    const iconEntries = entries.filter((entry) => !entry.startsWith("dist/generated/logos/"));
    expect(iconEntries.filter((entry) => entry.includes("filled"))).toEqual([]);
    expect(iconEntries.filter((entry) => entry.includes("sharp"))).toEqual([]);
  });

  it("resolves one component per concept from root, direct, and manifest entry points", () => {
    const result = node(`
      import * as root from "@qeetrix/icons";
      import { FixtureSearchIcon } from "@qeetrix/icons/icons/fixture-search";
      import { FixtureStarIcon } from "@qeetrix/icons/icons/fixture-star";
      import { iconManifest } from "@qeetrix/icons/manifest";
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      const render = (Icon, props) => renderToStaticMarkup(createElement(Icon, props));
      console.log(JSON.stringify({
        root: Object.keys(root).sort(),
        hasFilledExport: "FixtureStarFilledIcon" in root,
        sameModules: root.FixtureSearchIcon === FixtureSearchIcon && root.FixtureStarIcon === FixtureStarIcon,
        byDefault: render(FixtureStarIcon, { size: 20 }),
        outline: render(FixtureStarIcon, { size: 20, variant: "outline" }),
        filled: render(FixtureStarIcon, { size: 20, variant: "filled", "aria-label": "Starred" }),
        round: render(FixtureStarIcon, { size: 20, shape: "round" }),
        sharp: render(FixtureStarIcon, { size: 20, shape: "sharp" }),
        sharpFilled: render(FixtureStarIcon, { size: 20, shape: "sharp", variant: "filled", "aria-label": "Starred" }),
        manifest: iconManifest.icons
          .filter(({ id }) => id.startsWith("fixture-"))
          .map(({ id, componentName, variants, shapes, directionality }) => [id, componentName, variants, shapes, directionality]),
        production: iconManifest.icons.filter(({ id }) => !id.startsWith("fixture-")),
      }));
    `) as Record<string, unknown>;
    const outline =
      '<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="20" height="20" focusable="false" aria-hidden="true"><circle cx="12" cy="12" r="6.25"></circle></svg>';
    const { sharp } = iconSystem.design;
    expect(result).toEqual({
      root: [
        "FixtureArrowIcon",
        "FixtureSearchIcon",
        "FixtureStarIcon",
        ...production.map(({ componentName }) => componentName),
        ...logoManifest.logos.map(({ componentName }) => componentName),
      ].sort(),
      hasFilledExport: false,
      sameModules: true,
      byDefault: outline,
      outline,
      filled:
        '<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="Starred" width="20" height="20" focusable="false" role="img"><circle cx="12" cy="12" r="7.5"></circle></svg>',
      round: outline,
      sharp: `<svg fill="none" stroke="currentColor" stroke-linecap="${sharp.linecap}" stroke-linejoin="${sharp.linejoin}" stroke-miterlimit="${sharp.miterLimit}" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="20" height="20" focusable="false" aria-hidden="true"><circle cx="12" cy="12" r="6.875"></circle></svg>`,
      sharpFilled:
        '<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="Starred" width="20" height="20" focusable="false" role="img"><circle cx="12" cy="12" r="8.125"></circle></svg>',
      manifest: [
        ["fixture-search", "FixtureSearchIcon", ["outline"], ["round", "sharp"], "preserve"],
        ["fixture-arrow", "FixtureArrowIcon", ["outline"], ["round", "sharp"], "mirror"],
        ["fixture-star", "FixtureStarIcon", ["outline", "filled"], ["round", "sharp"], "preserve"],
      ],
      production,
    });
    // Imports every production concept through three entry points.
  }, 60_000);

  it("renders a production icon's sharp drawings from the same component, with the same props behaviour", () => {
    const result = node(`
      import { TrashIcon } from "@qeetrix/icons";
      import { TrashIcon as Direct } from "@qeetrix/icons/icons/trash";
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      const render = (props) => renderToStaticMarkup(createElement(TrashIcon, props));
      const props = { size: "1.5em", className: "x", "aria-label": "Delete" };
      console.log(JSON.stringify({
        same: TrashIcon === Direct,
        round: render(props),
        sharp: render({ ...props, shape: "sharp" }),
        sharpFilled: render({ ...props, shape: "sharp", variant: "filled" }),
        roundFilled: render({ ...props, variant: "filled" }),
        decorative: render({ shape: "sharp" }),
      }));
    `) as { same: boolean } & Record<
      "round" | "sharp" | "sharpFilled" | "roundFilled" | "decorative",
      string
    >;
    const { same, ...markup } = result;
    expect(same).toBe(true);
    // The drawing differs; everything the props control is identical.
    const props = (svg: string) =>
      (svg.match(/^<svg([^>]*)>/)?.[1] ?? "")
        .replace(/ (?:fill|stroke[\w-]*|viewBox|xmlns)="[^"]*"/g, "")
        .trim();
    const { sharp } = iconSystem.design;
    expect(markup.sharp).not.toBe(markup.round);
    expect(markup.sharpFilled).not.toBe(markup.roundFilled);
    expect(markup.sharp).toContain(
      `stroke-linecap="${sharp.linecap}" stroke-linejoin="${sharp.linejoin}" stroke-miterlimit="${sharp.miterLimit}"`,
    );
    for (const svg of [markup.round, markup.sharp, markup.sharpFilled, markup.roundFilled]) {
      expect(props(svg)).toBe(
        'class="x" aria-label="Delete" width="1.5em" height="1.5em" focusable="false" role="img"',
      );
      expect(svg).not.toMatch(/shape|variant/);
    }
    expect(props(markup.decorative)).toBe(
      'width="24" height="24" focusable="false" aria-hidden="true"',
    );
    expect(sharpOutlineTraces.get("trash")?.length).toBeGreaterThan(0);
    for (const pattern of sharpOutlineTraces.get("trash") ?? []) {
      expect(markup.sharp).toMatch(pattern);
    }
  });

  it.each(sampled.map(({ id, componentName }) => [id, componentName]))(
    "serves production concept %s from the root and its direct subpath",
    (id, componentName) => {
      const result = node(`
        import * as root from "@qeetrix/icons";
        import { ${componentName} } from "@qeetrix/icons/icons/${id}";
        import { createElement } from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        console.log(JSON.stringify({
          same: root.${componentName} === ${componentName},
          markup: renderToStaticMarkup(createElement(${componentName})),
          outline: renderToStaticMarkup(createElement(${componentName}, { variant: "outline" })),
          round: renderToStaticMarkup(createElement(${componentName}, { shape: "round" })),
          sharp: renderToStaticMarkup(createElement(${componentName}, { shape: "sharp" })),
        }));
      `) as { same: boolean; markup: string; outline: string; round: string; sharp: string };
      expect(result.same).toBe(true);
      expect(result.markup).toBe(result.outline);
      expect(result.markup).toBe(result.round);
      expect(result.markup).toContain('stroke="currentColor"');
      expect(result.markup).not.toContain("variant");
      expect(outlineTraces.get(id)?.length, `${id} geometry`).toBeGreaterThan(0);
      for (const pattern of outlineTraces.get(id) ?? []) expect(result.markup).toMatch(pattern);
      expect(result.sharp).toContain(`stroke-linecap="${iconSystem.design.sharp.linecap}"`);
      expect(result.sharp).not.toMatch(/shape|variant/);
      expect(sharpOutlineTraces.get(id)?.length, `${id} sharp geometry`).toBeGreaterThan(0);
      for (const pattern of sharpOutlineTraces.get(id) ?? []) expect(result.sharp).toMatch(pattern);
    },
  );

  it("serves brand logos from the root and their direct subpath, embedding each file unmodified", () => {
    const result = node(`
      import * as root from "@qeetrix/icons";
      import { GithubLogo } from "@qeetrix/icons/logos/github";
      import { logoManifest } from "@qeetrix/icons/manifest";
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      const render = (props) => renderToStaticMarkup(createElement(GithubLogo, props));
      console.log(JSON.stringify({
        same: root.GithubLogo === GithubLogo,
        decorative: render({}),
        mono: render({ variant: "mono", height: 40, "aria-label": "GitHub" }),
        entry: logoManifest.logos.find(({ id }) => id === "github"),
      }));
    `) as { same: boolean; decorative: string; mono: string; entry: { componentName: string } };
    const srcOf = (markup: string) =>
      decodeURIComponent(
        markup
          .match(/src="data:image\/svg\+xml,([^"]*)"/)?.[1]
          .replaceAll("&amp;", "&")
          .replaceAll("&quot;", '"')
          .replaceAll("&#x27;", "'")
          .replaceAll("&lt;", "<")
          .replaceAll("&gt;", ">") ?? "",
      );
    const file = (variant: string) =>
      readFileSync(join(PKG, "icons/brand-icons/brands/github", `${variant}.svg`), "utf8");
    expect(result.same).toBe(true);
    expect(result.entry.componentName).toBe("GithubLogo");
    expect(result.decorative).toMatch(/^<img /);
    expect(result.decorative).toContain('alt=""');
    expect(result.decorative).toContain('aria-hidden="true"');
    expect(result.decorative).toContain('height="24"');
    expect(srcOf(result.decorative)).toBe(file("default"));
    expect(result.mono).toContain('alt="GitHub"');
    expect(result.mono).not.toContain("aria-hidden");
    expect(result.mono).toContain('height="40"');
    expect(srcOf(result.mono)).toBe(file("mono"));
  });

  it("tree-shakes logos: an icon ships no logo, and a logo ships no other logo", () => {
    const bundle = (entry: string) => {
      writeFixture(consumer, "entry.js", entry);
      return run(
        "bun",
        ["build", "entry.js", "--minify", "--external", "react", "--external", "react/jsx-runtime"],
        consumer,
      );
    };
    const icon = bundle('import { TrashIcon } from "@qeetrix/icons"; console.log(TrashIcon);');
    expect(icon).not.toContain("data:image/svg+xml");
    const logo = bundle('import { GithubLogo } from "@qeetrix/icons"; console.log(GithubLogo);');
    expect(logo).toContain("data:image/svg+xml");
    expect(logo.match(/data:image\/svg\+xml,/g)?.length).toBe(
      logoManifest.logos.find(({ id }) => id === "github")?.variants.length,
    );
    expect(logo).not.toContain("GitLab");
  }, 120_000);

  it("refuses internal, category, layout, and extension-bearing subpaths", () => {
    const specifiers = [
      "@qeetrix/icons/runtime/resolve-icon-props",
      "@qeetrix/icons/types/icon-props",
      "@qeetrix/icons/generated/icon-index",
      "@qeetrix/icons/generated/icons/fixture-alpha",
      "@qeetrix/icons/config/icon-system",
      "@qeetrix/icons/scripts/lib/generation-plan",
      "@qeetrix/icons/dist/index.js",
      "@qeetrix/icons/icon-manifest.json",
      "@qeetrix/icons/actions",
      "@qeetrix/icons/icons/shapes/fixture-star",
      "@qeetrix/icons/icons/round-outline/shapes/fixture-star",
      "@qeetrix/icons/icons/fixture-search.js",
      "@qeetrix/icons/icons/fixture-star-filled",
      "@qeetrix/icons/icons/../runtime/resolve-icon-props",
      "@qeetrix/icons/sharp",
      "@qeetrix/icons/sharp/icons/fixture-star",
      "@qeetrix/icons/icons/sharp/fixture-star",
      "@qeetrix/icons/icons/sharp-outline/shapes/fixture-star",
    ];
    const result = node(`
      const outcomes = {};
      for (const specifier of ${JSON.stringify(specifiers)}) {
        try { await import(specifier); outcomes[specifier] = "resolved"; }
        catch (error) { outcomes[specifier] = error.code; }
      }
      console.log(JSON.stringify(outcomes));
    `) as Record<string, string>;
    for (const specifier of specifiers) {
      expect(result[specifier], specifier).toMatch(
        /^ERR_(PACKAGE_PATH_NOT_EXPORTED|MODULE_NOT_FOUND|INVALID_MODULE_SPECIFIER)$/,
      );
    }
  });

  it.each(["bundler", "nodenext"])(
    "typechecks a strict consumer against the shipped declarations with %s resolution",
    (moduleResolution) => {
      writeFixture(
        consumer,
        `tsconfig.${moduleResolution}.json`,
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            lib: ["ES2022", "DOM"],
            module: moduleResolution === "bundler" ? "ESNext" : "NodeNext",
            moduleResolution,
            jsx: "react-jsx",
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            types: [],
          },
          files: ["app.tsx"],
        }),
      );
      writeFixture(
        consumer,
        "app.tsx",
        `import { createRef } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  PlusIcon,
  XIcon,
  FixtureSearchIcon,
  FixtureStarIcon,
  type IconDirectionality,
  type IconProps,
  type IconShape,
  type IconVariant,
  TrashIcon,
} from "@qeetrix/icons";
import { FixtureArrowIcon } from "@qeetrix/icons/icons/fixture-arrow";
import { PlusIcon as DirectPlusIcon } from "@qeetrix/icons/icons/plus";
import { ChevronDownIcon as DirectChevronDownIcon } from "@qeetrix/icons/icons/chevron-down";
import { FixtureStarIcon as DirectStarIcon } from "@qeetrix/icons/icons/fixture-star";
import { type IconManifest, type IconManifestEntry, iconManifest } from "@qeetrix/icons/manifest";
// @ts-expect-error runtime internals are not exported
import { resolveIconProps } from "@qeetrix/icons/runtime/resolve-icon-props";
// @ts-expect-error categories are not part of import paths
import { FixtureStarIcon as ByCategory } from "@qeetrix/icons/icons/shapes/fixture-star";
// @ts-expect-error filled drawings have no subpath of their own
import { FixtureStarFilledIcon as BySubpath } from "@qeetrix/icons/icons/fixture-star-filled";
// @ts-expect-error filled drawings are a variant, never a separate export
import { FixtureStarFilledIcon } from "@qeetrix/icons";
// @ts-expect-error the manifest is not a root export
import { iconManifest as rootManifest } from "@qeetrix/icons";
// @ts-expect-error shapes are a prop, never an entry point
import { TrashIcon as SharpEntry } from "@qeetrix/icons/sharp";

declare const saved: boolean;
declare const shape: IconShape;
const ref = createRef<SVGSVGElement>();
const props: IconProps<"outline"> = { size: "1em", "aria-label": "Fixture" };
const manifest: IconManifest = iconManifest;
const entry: IconManifestEntry | undefined = manifest.icons[0];
const variants: readonly IconVariant[] | undefined = entry?.variants;
const directionality: IconDirectionality | undefined = entry?.directionality;
export const usage = [
  <PlusIcon key="p1" />,
  <XIcon key="p2" variant="outline" />,
  <CheckIcon key="p3" size={16} aria-label="Done" />,
  <ChevronDownIcon key="p4" ref={ref} />,
  <DirectPlusIcon key="p5" size="1em" />,
  <DirectChevronDownIcon key="p6" />,
  // @ts-expect-error the calibration icons are outline-only
  <PlusIcon key="p7" variant="filled" />,
  // @ts-expect-error the calibration icons are outline-only
  <ChevronDownIcon key="p8" variant="filled" />,
  <FixtureSearchIcon key="a" ref={ref} {...props} />,
  <FixtureSearchIcon key="b" variant="outline" />,
  // @ts-expect-error FixtureSearch has no filled drawing
  <FixtureSearchIcon key="c" variant="filled" />,
  <FixtureStarIcon key="d" />,
  <FixtureStarIcon key="e" variant="filled" size={18} className="x" />,
  <DirectStarIcon key="f" variant={saved ? "filled" : "outline"} ref={ref} />,
  // @ts-expect-error not a Qeetrix variant
  <FixtureStarIcon key="g" variant="solid" />,
  <FixtureArrowIcon key="h" aria-labelledby="label" />,
  <TrashIcon key="s1" shape="sharp" />,
  <TrashIcon key="s2" shape="sharp" variant="filled" />,
  <PlusIcon key="s3" shape={shape} ref={ref} />,
  <DirectStarIcon key="s4" shape="sharp" variant={saved ? "filled" : "outline"} />,
  <FixtureSearchIcon key="s5" shape="round" {...props} />,
  // @ts-expect-error the calibration icons are outline-only in every shape
  <PlusIcon key="s6" shape="sharp" variant="filled" />,
  // @ts-expect-error FixtureSearch has no filled drawing in any shape
  <FixtureSearchIcon key="s7" shape="sharp" variant="filled" />,
  // @ts-expect-error not a Qeetrix shape
  <TrashIcon key="s8" shape="square" />,
  SharpEntry,
  variants,
  directionality,
  resolveIconProps,
  ByCategory,
  BySubpath,
  FixtureStarFilledIcon,
  rootManifest,
];
`,
      );
      const tsc = join(PKG, "node_modules/typescript/bin/tsc");
      run(process.execPath, [tsc, "-p", `tsconfig.${moduleResolution}.json`], consumer);
    },
    60_000,
  );

  it("tree-shakes per concept: one icon ships its own drawings only, never the manifest", () => {
    const bundle = (entry: string) => {
      writeFixture(consumer, "entry.js", entry);
      return run(
        "bun",
        ["build", "entry.js", "--minify", "--external", "react", "--external", "react/jsx-runtime"],
        consumer,
      );
    };
    const occurrences = (output: string, text: string) => output.split(text).length - 1;

    // Other concepts' drawings in both shapes, and the catalogue.
    const otherThanSearch = ["6.25", "7.5", "9.375", "6.875", "8.125", "9.625"];
    for (const entry of [
      'import { FixtureSearchIcon } from "@qeetrix/icons"; console.log(FixtureSearchIcon);',
      'import { FixtureSearchIcon } from "@qeetrix/icons/icons/fixture-search"; console.log(FixtureSearchIcon);',
    ]) {
      const output = bundle(entry);
      // Both shapes of the imported concept: its one module carries them.
      expect(output).toContain("M 3.125 7 L 11 13");
      expect(output).toContain("M 3.375 7 L 11 13");
      expect(output).toContain("aria-hidden");
      for (const excluded of [...otherThanSearch, "schemaVersion", "directionality"]) {
        expect(output, excluded).not.toContain(excluded);
      }
    }

    // Every drawing of the imported concept ships together; nothing else does. Mixing root and
    // direct imports still bundles the concept module once.
    const star = bundle(
      'import { FixtureStarIcon } from "@qeetrix/icons"; import { FixtureStarIcon as Direct } from "@qeetrix/icons/icons/fixture-star"; console.log(FixtureStarIcon, Direct);',
    );
    for (const own of ['"6.25"', '"7.5"', '"6.875"', '"8.125"']) {
      expect(occurrences(star, own), own).toBe(1);
    }
    for (const excluded of [
      "3.125",
      "9.375",
      "3.375",
      "9.625",
      "schemaVersion",
      "directionality",
    ]) {
      expect(star, excluded).not.toContain(excluded);
    }

    const manifestOnly = bundle(
      'import { iconManifest } from "@qeetrix/icons/manifest"; console.log(iconManifest);',
    );
    expect(manifestOnly).toContain("fixture-star");
    expect(manifestOnly).not.toMatch(/3\.125|6\.25|3\.375|6\.875|aria-hidden|viewBox/);
  });

  it.each(sampled.map(({ id, componentName }) => [id, componentName]))(
    "tree-shakes production concept %s away from every other concept and the manifest",
    (id, componentName) => {
      writeFixture(
        consumer,
        "entry.js",
        `import { ${componentName} } from "@qeetrix/icons"; console.log(${componentName});`,
      );
      const output = run(
        "bun",
        ["build", "entry.js", "--minify", "--external", "react", "--external", "react/jsx-runtime"],
        consumer,
      );
      expect(traces.get(id)?.length, `${id} geometry`).toBeGreaterThan(0);
      for (const pattern of traces.get(id) ?? []) expect(output).toMatch(pattern);
      const own = new Set(geometry.get(id));
      for (const [other, values] of geometry) {
        if (other === id) continue;
        // Whole quoted attribute values: one icon's path may legitimately extend another's.
        // Lucide reuses identical elements (a dot such as "M9 12h.01") across icons; those prove
        // nothing about tree-shaking, so only geometry this concept doesn't share is checked.
        for (const value of values) {
          if (!own.has(value)) expect(output, `${other} in ${id}`).not.toContain(`"${value}"`);
        }
      }
      for (const excluded of ["schemaVersion", "directionality", "fixture-"]) {
        expect(output, excluded).not.toContain(excluded);
      }
    },
  );

  it("samples every category, with and without filled drawings", () => {
    const categories = new Set(production.map(({ category }) => category));
    expect(new Set(sampled.map(({ category }) => category))).toEqual(categories);
    expect(sampled.some(({ variants }) => variants.includes("filled"))).toBe(true);
    expect(sampled.length).toBeLessThan(100);
  });

  it("leaves the production tree free of fixtures", () => {
    const files = readdirSync(join(PKG, "icons"), { encoding: "utf8", recursive: true });
    expect(files.filter((file) => file.includes("fixture"))).toEqual([]);
    expect(production.filter(({ id }) => id.startsWith("fixture-"))).toEqual([]);
  });
});
