import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { iconMetadata } from "../config/icon-metadata.js";
import { iconSystem } from "../config/icon-system.js";
import { checkGenerationPlan, writeGenerationPlan } from "../scripts/lib/generated-output.js";
import {
  barrelPath,
  createGenerationPlan,
  type GenerationPlan,
  generatedDirectory,
  generatedIconsDirectory,
  manifestJsonPath,
  manifestModulePath,
  type PlannedConcept,
  planRepositoryGeneration,
} from "../scripts/lib/generation-plan.js";
import { reactAttributeName, svgToReact } from "../scripts/lib/svg-to-react.js";
import {
  apiFixtureMetadata,
  apiFixtures,
  createRepositoryFixture,
  filledAttributes,
  syntheticSvg,
  writeFixture,
} from "./helpers.js";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const sourceFile = "icons/outline/actions/fixture.svg";
const outputFile = "src/generated/icons/fixture.tsx";
const temporaryRoots: string[] = [];

function temporaryRepository(): string {
  const root = createRepositoryFixture();
  temporaryRoots.push(root);
  return root;
}

function temporaryDirectory(): string {
  const root = mkdtempSync(join(tmpdir(), "qeetrix-icons-generation-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function contentsOf(plan: GenerationPlan, path: string): string {
  const file = plan.files.find((candidate) => candidate.path === path);
  if (!file) throw new Error(`The plan has no ${path}.`);
  return file.contents;
}

function generate(
  content: string,
  file = sourceFile,
  attributes = {},
): PlannedConcept & { code: string } {
  const plan = createGenerationPlan([{ file, source: syntheticSvg(attributes, content) }]);
  expect(plan.diagnostics).toEqual([]);
  return { ...plan.concepts[0], code: contentsOf(plan, plan.concepts[0].outputPath) };
}

function fixturePlan(): GenerationPlan {
  const plan = createGenerationPlan(apiFixtures, [], apiFixtureMetadata);
  expect(plan.diagnostics).toEqual([]);
  return plan;
}

function writeFixtures(root: string, sources: readonly { file: string; source: string }[]): void {
  for (const { file, source } of sources) writeFixture(root, file, source);
}

describe("SVG to React conversion", () => {
  it.each([
    ["stroke-width", "strokeWidth"],
    ["stroke-linecap", "strokeLinecap"],
    ["stroke-linejoin", "strokeLinejoin"],
    ["fill-rule", "fillRule"],
    ["clip-rule", "clipRule"],
    ["class", "className"],
    ["viewBox", "viewBox"],
    ["xmlns", "xmlns"],
    ["cx", "cx"],
  ])("spells %s as %s", (source, expected) => {
    expect(reactAttributeName(source)).toBe(expected);
  });

  it("fails closed on attributes without a deliberate mapping", () => {
    for (const name of ["unknown-attribute", "onclick", "style", "href", "transform"]) {
      expect(() => reactAttributeName(name)).toThrow("No React attribute mapping");
    }
  });

  it("does not widen the validator allowlist just because a mapping exists", () => {
    const plan = createGenerationPlan([
      { file: sourceFile, source: syntheticSvg({ "clip-rule": "evenodd" }) },
    ]);
    expect(plan.files).toEqual([]);
    expect(plan.diagnostics).toEqual([expect.objectContaining({ code: "QXI-SVG-005" })]);
  });

  it.each([
    ['<path d="M 5 7 L 11 13"/>', '<path d="M 5 7 L 11 13" />'],
    ['<circle cx="12" cy="12" r="4"/>', '<circle cx="12" cy="12" r="4" />'],
    ['<ellipse cx="12" cy="12" rx="4" ry="3"/>', '<ellipse cx="12" cy="12" rx="4" ry="3" />'],
    [
      '<rect x="4" y="5" width="8" height="6" rx="1"/>',
      '<rect height="6" rx="1" width="8" x="4" y="5" />',
    ],
    ['<line x1="4" y1="5" x2="12" y2="8"/>', '<line x1="4" x2="12" y1="5" y2="8" />'],
    ['<polyline points="4,5 8,6 12,8"/>', '<polyline points="4,5 8,6 12,8" />'],
    ['<polygon points="4,5 8,6 12,8"/>', '<polygon points="4,5 8,6 12,8" />'],
    [
      '<g fill-rule="evenodd"><path d="M 5 7 L 11 13"/></g>',
      '<g fillRule="evenodd">\n        <path d="M 5 7 L 11 13" />\n      </g>',
    ],
  ])("converts %s", (content, expected) => {
    expect(generate(content).code).toContain(`\n      ${expected}\n`);
  });

  it("maps root presentation attributes to React names", () => {
    const { code } = generate('<path d="M 5 7 L 11 13"/>');
    for (const attribute of [
      'fill="none"',
      'stroke="currentColor"',
      `strokeWidth="${iconSystem.calibration.strokeWidth}"`,
      'strokeLinecap="round"',
      'strokeLinejoin="round"',
      'viewBox="0 0 24 24"',
      'xmlns="http://www.w3.org/2000/svg"',
    ]) {
      expect(code).toContain(`\n      ${attribute}\n`);
    }
    expect(code).not.toMatch(/stroke-|fill-rule|class=/);
  });

  it("preserves exact geometry text and drawing order", () => {
    const { code } = generate(
      '<circle cx="12" cy="12" r="4.000000000000001"/><path d="M .123456789123456789 7 L 11 13"/><rect x="4" y="5" width="8" height="6"/>',
    );
    expect(code).toContain('r="4.000000000000001"');
    expect(code).toContain('d="M .123456789123456789 7 L 11 13"');
    expect(code.indexOf("<circle")).toBeLessThan(code.indexOf("<path"));
    expect(code.indexOf("<path")).toBeLessThan(code.indexOf("<rect"));
  });

  it("uses one string-literal representation for every value", () => {
    const { code } = generate('<circle cx="12" cy="12" r="4"/>');
    expect(code).toContain('strokeWidth="1.75"');
    expect(code).not.toMatch(/=\{["\d]/);
  });

  it("drops comments and the XML declaration, which do not render", () => {
    const { code } = generate('<!-- note --><path d="M 5 7 L 11 13"/>');
    expect(code).not.toContain("<!--");
    const declared = createGenerationPlan([
      { file: sourceFile, source: `<?xml version="1.0" encoding="UTF-8"?>\n${syntheticSvg()}` },
    ]);
    expect(contentsOf(declared, outputFile)).toBe(generate('<path d="M 5 7 L 11 13"/>').code);
  });

  it("canonicalizes attribute order, so authoring-tool order cannot change output", () => {
    const source = syntheticSvg({}, '<path d="M 5 7 L 11 13"/>');
    const document = new DOMParser().parseFromString(source, "application/xml");
    const root = document.documentElement;
    if (!root) throw new Error("Missing fixture root.");
    const attributes = Array.from(root.attributes, ({ name, value }) => [name, value] as const);
    for (const [name] of attributes) root.removeAttribute(name);
    for (const [name, value] of attributes.reverse()) root.setAttribute(name, value);
    const reordered = new XMLSerializer().serializeToString(document);
    expect(createGenerationPlan([{ file: sourceFile, source: reordered }])).toEqual(
      createGenerationPlan([{ file: sourceFile, source }]),
    );
  });

  it("refuses values a JSX string attribute cannot carry verbatim", () => {
    expect(() =>
      svgToReact(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M 1 1 &amp;"/></svg>',
      ),
    ).toThrow("Cannot emit d=");
  });
});

describe("generated component modules", () => {
  it("are complete, clearly generated, and free of environment data", () => {
    const { code, componentName, outputPath } = generate('<path d="M 5 7 L 11 13"/>');
    expect(componentName).toBe("FixtureIcon");
    expect(outputPath).toBe(outputFile);
    expect(code).toBe(`// Generated by @qeetrix/icons from icons/outline/actions/fixture.svg.
// Do not edit this file directly. Edit the source SVG and run \`bun run generate\`.

import { resolveIconProps } from "../../runtime/resolve-icon-props.js";
import type { IconProps } from "../../types/icon-props.js";

export function FixtureIcon(props: IconProps<"outline">) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...resolveIconProps(props)}
    >
      <path d="M 5 7 L 11 13" />
    </svg>
  );
}
`);
  });

  it("contain no client directive, legacy ref wrapper, display name, or runtime parsing", () => {
    for (const { contents } of fixturePlan().files) {
      expect(contents).not.toMatch(
        /use client|forwardRef|displayName|export default|dangerouslySetInnerHTML|Date|Math\.random|process\.|\r/,
      );
      expect(contents).not.toContain(PKG);
      expect(contents).not.toContain(tmpdir());
    }
  });

  it("combine a concept's outline and filled drawings into one typed component", () => {
    const plan = createGenerationPlan([
      {
        file: "icons/filled/actions/fixture.svg",
        source: syntheticSvg(filledAttributes, '<circle cx="12" cy="12" r="7.5"/>'),
      },
      { file: sourceFile, source: syntheticSvg({}, '<circle cx="12" cy="12" r="6.25"/>') },
    ]);
    expect(plan.diagnostics).toEqual([]);
    expect(plan.concepts).toHaveLength(1);
    expect(plan.files.map(({ path }) => path)).not.toContain(
      "src/generated/icons/fixture-filled.tsx",
    );
    expect(
      contentsOf(plan, outputFile),
    ).toBe(`// Generated by @qeetrix/icons from icons/outline/actions/fixture.svg, icons/filled/actions/fixture.svg.
// Do not edit this file directly. Edit the source SVGs and run \`bun run generate\`.

import { resolveIconProps } from "../../runtime/resolve-icon-props.js";
import type { IconProps } from "../../types/icon-props.js";

export function FixtureIcon(props: IconProps<"outline" | "filled">) {
  if (props.variant === "filled") {
    return (
      <svg
        fill="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        {...resolveIconProps(props)}
      >
        <circle cx="12" cy="12" r="7.5" />
      </svg>
    );
  }
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...resolveIconProps(props)}
    >
      <circle cx="12" cy="12" r="6.25" />
    </svg>
  );
}
`);
  });

  it("narrow each signature to the drawings that exist and never branch for a missing one", () => {
    const plan = fixturePlan();
    expect(contentsOf(plan, "src/generated/icons/fixture-search.tsx")).toContain(
      'export function FixtureSearchIcon(props: IconProps<"outline">) {\n  return (',
    );
    expect(contentsOf(plan, "src/generated/icons/fixture-search.tsx")).not.toContain("variant");
    expect(contentsOf(plan, "src/generated/icons/fixture-star.tsx")).toContain(
      'export function FixtureStarIcon(props: IconProps<"outline" | "filled">) {',
    );
    for (const { contents } of plan.files) {
      expect(contents).not.toMatch(/FilledIcon|OutlineIcon|-filled|Actions|Status/);
    }
  });
});

describe("root exports and manifest", () => {
  it("derives one public name and id per concept, with no category or variant in it", () => {
    expect(fixturePlan().concepts.map(({ id, componentName }) => [id, componentName])).toEqual([
      ["fixture-search", "FixtureSearchIcon"],
      ["fixture-arrow", "FixtureArrowIcon"],
      ["fixture-star", "FixtureStarIcon"],
    ]);
  });

  it("generates one static re-export per concept in codepoint order of public id", () => {
    expect(contentsOf(fixturePlan(), barrelPath)).toBe(
      `// Generated by @qeetrix/icons from icons/. Do not edit this file directly.
// Run \`bun run generate\` to update it.

export { FixtureArrowIcon } from "./icons/fixture-arrow.js";
export { FixtureSearchIcon } from "./icons/fixture-search.js";
export { FixtureStarIcon } from "./icons/fixture-star.js";
`,
    );
  });

  it("keeps the barrel free of the manifest, registries, and runtime code", () => {
    const barrel = contentsOf(fixturePlan(), barrelPath);
    const statements = barrel.split("\n").filter((line) => line && !line.startsWith("//"));
    for (const line of statements) {
      expect(line).toMatch(/^export \{ \w+Icon \} from "\.\/icons\/[a-z0-9-]+\.js";$/);
    }
  });

  it("records one manifest entry per concept with its available variants", () => {
    const plan = fixturePlan();
    expect(plan.manifest).toEqual({
      schemaVersion: 1,
      icons: [
        {
          id: "fixture-search",
          name: "fixture-search",
          componentName: "FixtureSearchIcon",
          category: "actions",
          variants: ["outline"],
          directionality: "preserve",
        },
        {
          id: "fixture-arrow",
          name: "fixture-arrow",
          componentName: "FixtureArrowIcon",
          category: "navigation",
          variants: ["outline"],
          directionality: "mirror",
        },
        {
          id: "fixture-star",
          name: "fixture-star",
          componentName: "FixtureStarIcon",
          category: "status",
          variants: ["outline", "filled"],
          directionality: "preserve",
        },
      ],
    });
    expect(plan.iconCount).toBe(4);
    expect(JSON.parse(contentsOf(plan, manifestJsonPath))).toEqual(plan.manifest);
    expect(contentsOf(plan, manifestJsonPath)).toContain(
      '      "variants": ["outline", "filled"],\n',
    );
    const module = contentsOf(plan, manifestModulePath);
    expect(module).toContain('import type { IconManifest } from "../types/icon-manifest.js";');
    expect(module).toContain("export const iconManifest: IconManifest = {");
    expect(module).toContain('      variants: ["outline", "filled"],\n');
    expect(module).not.toMatch(/\bvariant:/);
  });

  it("orders variants by configuration, whatever the discovery order", () => {
    const star = apiFixtures.filter(({ file }) => file.includes("fixture-star"));
    for (const sources of [star, [...star].reverse()]) {
      expect(createGenerationPlan(sources).manifest.icons[0].variants).toEqual(
        iconSystem.architecture.variants,
      );
    }
  });

  it("applies directionality only from concept metadata, never from the filename", () => {
    const arrow = apiFixtures.filter(({ file }) => file.includes("fixture-arrow"));
    expect(createGenerationPlan(arrow).manifest.icons[0].directionality).toBe("preserve");
    expect(
      createGenerationPlan([
        { file: "icons/outline/navigation/arrow-back.svg", source: syntheticSvg() },
      ]).manifest.icons[0].directionality,
    ).toBe("preserve");
    const star = createGenerationPlan(
      apiFixtures.filter(({ file }) => file.includes("fixture-star")),
      [],
      { "fixture-star": { directionality: "mirror" } },
    );
    expect(star.manifest.icons).toEqual([
      expect.objectContaining({ variants: ["outline", "filled"], directionality: "mirror" }),
    ]);
  });

  it("produces a valid empty barrel and manifest for zero icons", () => {
    const plan = createGenerationPlan([]);
    expect(plan.files.map(({ path }) => path)).toEqual([
      manifestJsonPath,
      barrelPath,
      manifestModulePath,
    ]);
    expect(contentsOf(plan, barrelPath)).toMatch(/\nexport \{\};\n$/);
    expect(JSON.parse(contentsOf(plan, manifestJsonPath))).toEqual({ schemaVersion: 1, icons: [] });
    expect(contentsOf(plan, manifestModulePath)).toContain("  icons: [],\n");
  });

  it("matches the committed generated artifacts in this repository", () => {
    for (const { path, contents } of planRepositoryGeneration(PKG, iconMetadata).files) {
      expect(readFileSync(join(PKG, path), "utf8"), path).toBe(contents);
    }
  });
});

describe("generated output passes Biome and strict TypeScript", () => {
  // Path data whose generated line straddles Biome's 100-column limit, both for a two-attribute
  // element and for the single-string-attribute case Biome never breaks.
  const pathLengths = Array.from({ length: 24 }, (_, index) => 52 + index);
  // A group whose opening tag straddles the limit; equal numeric spellings stay valid.
  const groupPadding = Array.from({ length: 12 }, (_, index) => 18 + index);
  const longName = `fixture-${"long-".repeat(16)}name`;

  function biomeFixturePlan(): GenerationPlan {
    const plan = createGenerationPlan([
      ...apiFixtures,
      ...pathLengths.map((length) => ({
        file: `icons/outline/actions/path-${String.fromCharCode(97 + length - 52)}.svg`,
        source: syntheticSvg(
          {},
          `<path d="M 1 1 L ${"1".repeat(length)} 1" fill="none"/><path d="M 1 1 L ${"1".repeat(length + 20)} 1"/>`,
        ),
      })),
      ...groupPadding.map((zeros) => ({
        file: `icons/outline/data/group-${String.fromCharCode(97 + zeros - 18)}.svg`,
        source: syntheticSvg(
          {},
          `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.75${"0".repeat(zeros)}"><circle cx="12" cy="12" r="4"/><g><rect x="4" y="5" width="8" height="6"/></g></g>`,
        ),
      })),
      { file: `icons/outline/time/${longName}.svg`, source: syntheticSvg() },
      { file: `icons/filled/time/${longName}.svg`, source: syntheticSvg(filledAttributes) },
    ]);
    expect(plan.diagnostics).toEqual([]);
    return plan;
  }

  it.each([
    ["a full catalogue", biomeFixturePlan],
    ["zero icons", () => createGenerationPlan([])],
  ])("is already formatted and lint-clean for %s under the repository Biome config", (_, plan) => {
    const root = temporaryDirectory();
    copyFileSync(join(PKG, "biome.json"), join(root, "biome.json"));
    const { files } = plan();
    for (const file of files) writeFixture(root, file.path, file.contents);
    const biome = createRequire(import.meta.url).resolve("@biomejs/biome/bin/biome");
    // Throws, failing the test with Biome's report, on any format or lint issue.
    execFileSync(
      process.execPath,
      [biome, "check", "--vcs-enabled=false", "src", "icon-manifest.json"],
      { cwd: root, encoding: "utf8", stdio: "pipe" },
    );
  });

  it("keeps long names Biome-formatted in signatures and barrel lines", () => {
    const plan = biomeFixturePlan();
    expect(
      plan.files.some(({ contents }) =>
        /export function FixtureLong\w+Icon\(\n {2}props: IconProps<"outline" \| "filled">,\n\) \{/.test(
          contents,
        ),
      ),
    ).toBe(true);
    expect(contentsOf(plan, barrelPath)).toContain("export { FixtureLong");
    expect(contentsOf(plan, manifestModulePath)).toContain("      componentName:\n        ");
  });

  it("types each variant prop to the drawings that exist, under the strict repository config", () => {
    const { options } = ts.parseJsonConfigFileContent(
      ts.readConfigFile(join(PKG, "tsconfig.json"), ts.sys.readFile).config,
      ts.sys,
      PKG,
    );
    const virtual = new Map(
      fixturePlan()
        .files.filter(({ path }) => path.startsWith(`${generatedDirectory}/`))
        .map(({ path, contents }) => [join(PKG, path), contents]),
    );
    virtual.set(
      join(PKG, "src/usage.tsx"),
      `import { type ComponentType, createRef } from "react";
import { FixtureArrowIcon } from "./generated/icons/fixture-arrow.js";
import {
  FixtureSearchIcon,
  FixtureStarIcon,
  type IconProps,
  type IconVariant,
  // @ts-expect-error filled drawings are a variant, never a separate export
  FixtureStarFilledIcon,
  // @ts-expect-error the manifest is not a root export
  iconManifest as rootManifest,
} from "./index.js";
import { type IconManifestEntry, iconManifest } from "./manifest.js";

declare const saved: boolean;
declare const anyVariant: IconVariant;
const ref = createRef<SVGSVGElement>();
const props: IconProps<"outline"> = { size: 18, "aria-label": "Fixture", variant: "outline" };
const entry: IconManifestEntry | undefined = iconManifest.icons[0];
// Every icon has an outline drawing, so this type holds any icon.
const anyIcon: ComponentType<IconProps<"outline">>[] = [
  FixtureSearchIcon,
  FixtureStarIcon,
  FixtureArrowIcon,
];
export const usages = [
  <FixtureSearchIcon key="a" />,
  <FixtureSearchIcon key="b" variant="outline" />,
  // @ts-expect-error FixtureSearch has no filled drawing
  <FixtureSearchIcon key="c" variant="filled" />,
  <FixtureStarIcon key="d" />,
  <FixtureStarIcon key="e" variant="outline" size={20} />,
  <FixtureStarIcon key="f" variant="filled" size="1.25em" className="x" style={{ opacity: 0.5 }} />,
  <FixtureStarIcon key="g" variant={saved ? "filled" : "outline"} />,
  <FixtureStarIcon key="h" variant={anyVariant} />,
  // @ts-expect-error not a Qeetrix variant
  <FixtureStarIcon key="i" variant="solid" />,
  // @ts-expect-error not a Qeetrix variant
  <FixtureStarIcon key="j" variant="round" />,
  // @ts-expect-error not a Qeetrix variant
  <FixtureStarIcon key="k" variant="sharp" />,
  <FixtureArrowIcon key="l" aria-label="Fixture" data-testid="fixture" onClick={() => {}} />,
  <FixtureSearchIcon key="m" ref={ref} {...props} />,
  <FixtureStarIcon key="n" ref={ref} variant="filled" />,
  // @ts-expect-error icons render their own artwork
  <FixtureSearchIcon key="o">child</FixtureSearchIcon>,
  // @ts-expect-error size is a number or a CSS length string
  <FixtureSearchIcon key="p" size={true} />,
  // @ts-expect-error a system-wide IconVariant may be "filled", which FixtureSearch lacks
  <FixtureSearchIcon key="q" variant={anyVariant} />,
  entry?.componentName,
  anyIcon,
  rootManifest,
  FixtureStarFilledIcon,
];
`,
    );
    const virtualDirectories = new Set(
      [...virtual.keys()].flatMap((file) => {
        const parents: string[] = [];
        for (let parent = dirname(file); parent !== dirname(parent); parent = dirname(parent)) {
          parents.push(parent);
        }
        return parents;
      }),
    );
    const host = ts.createCompilerHost(options);
    const { fileExists, readFile, getSourceFile } = host;
    host.directoryExists = (directory) =>
      virtualDirectories.has(directory) || ts.sys.directoryExists(directory);
    host.fileExists = (file) => virtual.has(file) || fileExists(file);
    host.readFile = (file) => virtual.get(file) ?? readFile(file);
    host.getSourceFile = (file, language, ...rest) => {
      const text = virtual.get(file);
      return text === undefined
        ? getSourceFile(file, language, ...rest)
        : ts.createSourceFile(file, text, language, true);
    };
    const program = ts.createProgram({
      rootNames: [...virtual.keys()],
      options: { ...options, noEmit: true, incremental: false, tsBuildInfoFile: undefined },
      host,
    });
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .map((entry) => ts.flattenDiagnosticMessageText(entry.messageText, "\n"));
    expect(diagnostics, diagnostics.join("\n")).toEqual([]);
  }, 30_000);
});

describe("generation planning", () => {
  it("is deterministic and independent of discovery order", () => {
    const plan = fixturePlan();
    expect(plan.files.map(({ path }) => path)).toEqual([
      manifestJsonPath,
      "src/generated/icons/fixture-arrow.tsx",
      "src/generated/icons/fixture-search.tsx",
      "src/generated/icons/fixture-star.tsx",
      barrelPath,
      manifestModulePath,
    ]);
    expect(createGenerationPlan([...apiFixtures].reverse(), [], apiFixtureMetadata)).toEqual(plan);
    expect(createGenerationPlan(apiFixtures, [], apiFixtureMetadata)).toEqual(plan);
  });

  it("returns no partial plan when any input fails authoritative validation", () => {
    const result = createGenerationPlan([
      { file: sourceFile, source: syntheticSvg() },
      { file: "icons/outline/actions/invalid-fixture.svg", source: "<svg>" },
    ]);
    expect(result.files).toEqual([]);
    expect(result.concepts).toEqual([]);
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "QXI-XML-001" })]);
  });

  it("returns no plan when authored metadata is stale", () => {
    const result = createGenerationPlan(apiFixtures, [], {
      "fixture-removed": { directionality: "mirror" },
    });
    expect(result.files).toEqual([]);
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "QXI-META-001" })]);
  });

  it("carries scan diagnostics into the plan", () => {
    const root = temporaryRepository();
    writeFixture(root, sourceFile, syntheticSvg());
    writeFixture(root, "icons/outline/actions/notes.txt", "not an icon");
    const plan = planRepositoryGeneration(root);
    expect(plan.files).toEqual([]);
    expect(plan.diagnostics).toEqual([expect.objectContaining({ code: "QXI-IO-001" })]);
  });
});

describe("writing and checking generated output", () => {
  it("writes the empty barrel and manifest for zero icons, with no component directory", () => {
    const root = temporaryRepository();
    const plan = planRepositoryGeneration(root);
    expect(checkGenerationPlan(root, plan)).toHaveLength(3);
    expect(writeGenerationPlan(root, plan)).toEqual({
      generatedCount: 0,
      changedCount: 3,
      removedCount: 0,
      diagnostics: [],
    });
    expect(checkGenerationPlan(root, plan)).toEqual([]);
    expect(existsSync(join(root, generatedIconsDirectory))).toBe(false);
  });

  it("is idempotent and reproduces identical bytes for every artifact", () => {
    const root = temporaryRepository();
    writeFixtures(root, apiFixtures);
    const first = writeGenerationPlan(root, planRepositoryGeneration(root, apiFixtureMetadata));
    expect(first).toEqual({ generatedCount: 3, changedCount: 6, removedCount: 0, diagnostics: [] });
    const snapshot = new Map(
      fixturePlan().files.map(({ path }) => [path, readFileSync(join(root, path))]),
    );
    expect(writeGenerationPlan(root, planRepositoryGeneration(root, apiFixtureMetadata))).toEqual({
      generatedCount: 3,
      changedCount: 0,
      removedCount: 0,
      diagnostics: [],
    });
    expect(checkGenerationPlan(root, planRepositoryGeneration(root, apiFixtureMetadata))).toEqual(
      [],
    );

    rmSync(join(root, generatedDirectory), { recursive: true });
    rmSync(join(root, manifestJsonPath));
    writeGenerationPlan(root, planRepositoryGeneration(root, apiFixtureMetadata));
    const elsewhere = temporaryRepository();
    writeFixtures(elsewhere, [...apiFixtures].reverse());
    writeGenerationPlan(elsewhere, planRepositoryGeneration(elsewhere, apiFixtureMetadata));
    for (const [path, bytes] of snapshot) {
      expect(readFileSync(join(root, path)).equals(bytes), path).toBe(true);
      expect(readFileSync(join(elsewhere, path)).equals(bytes), path).toBe(true);
    }
  });

  it("owns all of src/generated but nothing outside it except the manifest JSON", () => {
    const root = temporaryRepository();
    writeFixture(root, sourceFile, syntheticSvg());
    writeFixture(root, "src/manual.ts", "handwritten");
    writeFixture(root, "src/generated-notes.md", "not generated");
    writeFixture(root, "manifest.json", "unrelated root file");
    writeFixture(root, "src/generated/keep.txt", "inside the generated boundary");
    writeFixture(root, "src/generated/icons/stale-fixture.tsx", "// stale\n");
    writeFixture(root, "src/generated/legacy/outline/actions/old.tsx", "// stale\n");
    const plan = planRepositoryGeneration(root);
    expect(writeGenerationPlan(root, plan)).toEqual({
      generatedCount: 1,
      changedCount: 4,
      removedCount: 3,
      diagnostics: [],
    });
    expect(readFileSync(join(root, outputFile), "utf8")).toBe(contentsOf(plan, outputFile));
    for (const stale of ["keep.txt", "icons/stale-fixture.tsx", "legacy"]) {
      expect(existsSync(join(root, generatedDirectory, stale)), stale).toBe(false);
    }
    expect(readFileSync(join(root, sourceFile), "utf8")).toBe(syntheticSvg());
    expect(readFileSync(join(root, "src/manual.ts"), "utf8")).toBe("handwritten");
    expect(readFileSync(join(root, "src/generated-notes.md"), "utf8")).toBe("not generated");
    expect(readFileSync(join(root, "manifest.json"), "utf8")).toBe("unrelated root file");
  });

  it("tracks drawings within a concept and removes a concept with its outline", () => {
    const root = temporaryRepository();
    writeFixtures(root, apiFixtures);
    writeGenerationPlan(root, planRepositoryGeneration(root, apiFixtureMetadata));
    const star = "src/generated/icons/fixture-star.tsx";
    expect(readFileSync(join(root, star), "utf8")).toContain('props.variant === "filled"');

    rmSync(join(root, "icons/filled/status/fixture-star.svg"));
    expect(writeGenerationPlan(root, planRepositoryGeneration(root, apiFixtureMetadata))).toEqual({
      generatedCount: 3,
      changedCount: 3,
      removedCount: 0,
      diagnostics: [],
    });
    expect(readFileSync(join(root, star), "utf8")).toContain('props: IconProps<"outline">');
    expect(readFileSync(join(root, star), "utf8")).not.toContain("variant");
    expect(JSON.parse(readFileSync(join(root, manifestJsonPath), "utf8")).icons).toContainEqual(
      expect.objectContaining({ id: "fixture-star", variants: ["outline"] }),
    );

    rmSync(join(root, "icons/outline/navigation/fixture-arrow.svg"));
    expect(writeGenerationPlan(root, planRepositoryGeneration(root, {}))).toEqual({
      generatedCount: 2,
      changedCount: 3,
      removedCount: 1,
      diagnostics: [],
    });
    expect(existsSync(join(root, "src/generated/icons/fixture-arrow.tsx"))).toBe(false);
    for (const path of [barrelPath, manifestModulePath, manifestJsonPath]) {
      expect(readFileSync(join(root, path), "utf8")).not.toContain("FixtureArrowIcon");
    }
  });

  it("flags and removes a former variant-specific module as stale", () => {
    const root = temporaryRepository();
    writeFixtures(root, apiFixtures);
    writeGenerationPlan(root, planRepositoryGeneration(root, apiFixtureMetadata));
    const former = "src/generated/icons/fixture-star-filled.tsx";
    writeFixture(root, former, "export function FixtureStarFilledIcon() {}\n");
    expect(checkGenerationPlan(root, planRepositoryGeneration(root, apiFixtureMetadata))).toEqual([
      expect.objectContaining({
        code: "QXI-GEN-003",
        file: former,
        message: expect.stringContaining("Stale"),
      }),
    ]);
    expect(
      writeGenerationPlan(root, planRepositoryGeneration(root, apiFixtureMetadata)),
    ).toMatchObject({
      removedCount: 1,
      diagnostics: [],
    });
    expect(existsSync(join(root, former))).toBe(false);
  });

  it.each([
    ["a component", outputFile],
    ["the barrel", barrelPath],
    ["the manifest module", manifestModulePath],
    ["the manifest JSON", manifestJsonPath],
  ])("detects a missing or edited %s without writing", (_, path) => {
    const root = temporaryRepository();
    writeFixture(root, sourceFile, syntheticSvg());
    const plan = planRepositoryGeneration(root);
    writeGenerationPlan(root, plan);
    writeFixture(root, path, "manually edited");
    expect(checkGenerationPlan(root, plan)).toEqual([
      expect.objectContaining({
        code: "QXI-GEN-003",
        file: path,
        message: expect.stringContaining("out of date"),
      }),
    ]);
    expect(readFileSync(join(root, path), "utf8")).toBe("manually edited");
    rmSync(join(root, path));
    expect(checkGenerationPlan(root, plan)).toEqual([
      expect.objectContaining({
        code: "QXI-GEN-003",
        file: path,
        message: expect.stringContaining("missing"),
      }),
    ]);
    expect(existsSync(join(root, path))).toBe(false);
  });

  it("detects source changes and stale files across every artifact without writing", () => {
    const root = temporaryRepository();
    writeFixtures(root, apiFixtures);
    const plan = planRepositoryGeneration(root, apiFixtureMetadata);
    writeGenerationPlan(root, plan);
    writeFixture(root, "icons/outline/actions/fixture-beta.svg", syntheticSvg());
    expect(
      checkGenerationPlan(root, planRepositoryGeneration(root, apiFixtureMetadata)).map(
        ({ file }) => file,
      ),
    ).toEqual([
      manifestJsonPath,
      "src/generated/icons/fixture-beta.tsx",
      barrelPath,
      manifestModulePath,
    ]);
    expect(existsSync(join(root, "src/generated/icons/fixture-beta.tsx"))).toBe(false);

    rmSync(join(root, "icons/outline/actions/fixture-beta.svg"));
    writeFixture(
      root,
      "icons/filled/actions/fixture-search.svg",
      syntheticSvg(filledAttributes, '<circle cx="12" cy="12" r="5"/>'),
    );
    expect(
      checkGenerationPlan(root, planRepositoryGeneration(root, apiFixtureMetadata)).map(
        ({ file }) => file,
      ),
    ).toEqual([manifestJsonPath, "src/generated/icons/fixture-search.tsx", manifestModulePath]);

    writeFixture(root, `${generatedDirectory}/stale.txt`, "stale");
    expect(checkGenerationPlan(root, plan)).toEqual([
      expect.objectContaining({ file: `${generatedDirectory}/stale.txt` }),
    ]);
    expect(readFileSync(join(root, `${generatedDirectory}/stale.txt`), "utf8")).toBe("stale");
  });

  it("never partially writes or cleans any artifact after a validation failure", () => {
    const root = temporaryRepository();
    writeFixtures(root, apiFixtures);
    writeGenerationPlan(root, planRepositoryGeneration(root, apiFixtureMetadata));
    const before = fixturePlan().files.map(({ path }) => [
      path,
      readFileSync(join(root, path), "utf8"),
    ]);
    const stale = `${generatedIconsDirectory}/stale.tsx`;
    writeFixture(root, stale, "must survive the aborted operation");
    writeFixture(root, "icons/outline/actions/fixture-beta.svg", syntheticSvg());
    writeFixture(root, "icons/outline/actions/invalid-fixture.svg", "<svg>");
    const plan = planRepositoryGeneration(root, apiFixtureMetadata);
    expect(plan.files).toEqual([]);
    const result = writeGenerationPlan(root, plan);
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "QXI-XML-001" })]);
    expect(result).toMatchObject({ changedCount: 0, removedCount: 0 });
    for (const [path, contents] of before) {
      expect(readFileSync(join(root, path), "utf8"), path).toBe(contents);
    }
    expect(readFileSync(join(root, stale), "utf8")).toBe("must survive the aborted operation");
    expect(checkGenerationPlan(root, plan)).toEqual(plan.diagnostics);
  });

  it.each([
    ["src/manual.tsx"],
    ["src/generated/icons/../../manual.tsx"],
    ["/outside.tsx"],
    ["C:\\outside.tsx"],
    ["src/generated/icons/outline/actions/fixture.tsx"],
    ["src/generated/icons/other-fixture.tsx"],
    ["src/generated/icons/./fixture.tsx"],
    ["src/generated/icons/fixture-filled.tsx"],
  ])("rejects a forged component target %s before creating anything", (outputPath) => {
    const root = temporaryRepository();
    const plan = createGenerationPlan([{ file: sourceFile, source: syntheticSvg() }]);
    const forged = {
      ...plan,
      concepts: [{ ...plan.concepts[0], outputPath }],
      files: plan.files.map((file) =>
        file.path === outputFile ? { ...file, path: outputPath } : file,
      ),
    };
    expect(writeGenerationPlan(root, forged).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-GEN-002" }),
    ]);
    expect(checkGenerationPlan(root, forged)).toEqual([
      expect.objectContaining({ code: "QXI-GEN-002" }),
    ]);
    expect(existsSync(join(root, "src"))).toBe(false);
    expect(existsSync(join(root, manifestJsonPath))).toBe(false);
  });

  it.each([
    [
      "an extra file",
      (plan: GenerationPlan) => [...plan.files, { path: "src/extra.ts", contents: "" }],
      "not a canonical",
    ],
    ["a duplicate file", (plan: GenerationPlan) => [...plan.files, plan.files[0]], "Duplicate"],
    [
      "a missing artifact",
      (plan: GenerationPlan) => plan.files.filter(({ path }) => path !== barrelPath),
      "omits",
    ],
  ])("rejects a plan with %s before creating anything", (_, files, message) => {
    const root = temporaryRepository();
    const plan = createGenerationPlan([{ file: sourceFile, source: syntheticSvg() }]);
    expect(writeGenerationPlan(root, { ...plan, files: files(plan) }).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-GEN-002", message: expect.stringContaining(message) }),
    ]);
    expect(existsSync(join(root, "src"))).toBe(false);
  });

  it.each([
    ["a mismatched category", { category: "data" as const }],
    ["a mismatched name", { name: "other-fixture" }],
    ["no default-variant source", { sources: [] }],
  ])("rejects a concept with %s before creating anything", (_, change) => {
    const root = temporaryRepository();
    const plan = createGenerationPlan([{ file: sourceFile, source: syntheticSvg() }]);
    const forged = { ...plan, concepts: [{ ...plan.concepts[0], ...change }] };
    expect(writeGenerationPlan(root, forged).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-GEN-002" }),
    ]);
    expect(existsSync(join(root, "src"))).toBe(false);
  });

  it.each(["src", "src/generated", generatedIconsDirectory])(
    "refuses a symbolic-link directory at %s without touching its target",
    (path) => {
      const root = temporaryRepository();
      writeFixture(root, sourceFile, syntheticSvg());
      writeFixture(root, "outside/keep.txt", "untouched");
      mkdirSync(dirname(join(root, path)), { recursive: true });
      symlinkSync(join(root, "outside"), join(root, path), "junction");
      const plan = planRepositoryGeneration(root);
      expect(writeGenerationPlan(root, plan).diagnostics).toEqual([
        expect.objectContaining({ code: "QXI-GEN-002" }),
      ]);
      expect(checkGenerationPlan(root, plan)).toEqual([
        expect.objectContaining({ code: "QXI-GEN-002" }),
      ]);
      expect(readFileSync(join(root, "outside/keep.txt"), "utf8")).toBe("untouched");
      expect(existsSync(join(root, "outside/fixture.tsx"))).toBe(false);
      expect(existsSync(join(root, manifestJsonPath))).toBe(false);
    },
  );

  it.each([
    [
      "a symbolic link",
      (root: string, target: string) => symlinkSync(target, join(root, manifestJsonPath)),
    ],
    [
      "a hard link",
      (root: string, target: string) => linkSync(target, join(root, manifestJsonPath)),
    ],
  ])("refuses a manifest JSON that is %s", (_, link) => {
    const root = temporaryRepository();
    writeFixture(root, sourceFile, syntheticSvg());
    writeFixture(root, "outside.json", "untouched");
    link(root, join(root, "outside.json"));
    expect(writeGenerationPlan(root, planRepositoryGeneration(root)).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-GEN-002", file: manifestJsonPath }),
    ]);
    expect(readFileSync(join(root, "outside.json"), "utf8")).toBe("untouched");
    expect(existsSync(join(root, "src"))).toBe(false);
  });

  it("refuses hard-linked generated files before they could overwrite outside data", () => {
    const root = temporaryRepository();
    writeFixture(root, sourceFile, syntheticSvg());
    writeFixture(root, "outside.tsx", "untouched");
    mkdirSync(dirname(join(root, outputFile)), { recursive: true });
    linkSync(join(root, "outside.tsx"), join(root, outputFile));
    expect(writeGenerationPlan(root, planRepositoryGeneration(root)).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-GEN-002" }),
    ]);
    expect(readFileSync(join(root, "outside.tsx"), "utf8")).toBe("untouched");
  });

  it("preflights file/directory conflicts", () => {
    const root = temporaryRepository();
    writeFixture(root, sourceFile, syntheticSvg());
    const plan = planRepositoryGeneration(root);

    writeFixture(root, `${outputFile}/keep.txt`, "untouched");
    expect(writeGenerationPlan(root, plan).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-GEN-002" }),
    ]);
    expect(readFileSync(join(root, `${outputFile}/keep.txt`), "utf8")).toBe("untouched");
    rmSync(join(root, generatedDirectory), { recursive: true });

    writeFixture(root, generatedIconsDirectory, "directory conflict");
    expect(writeGenerationPlan(root, plan).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-GEN-002" }),
    ]);
    expect(readFileSync(join(root, generatedIconsDirectory), "utf8")).toBe("directory conflict");
    rmSync(join(root, generatedDirectory), { recursive: true });

    mkdirSync(join(root, manifestJsonPath));
    expect(writeGenerationPlan(root, plan).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-GEN-002", file: manifestJsonPath }),
    ]);
    expect(existsSync(join(root, generatedDirectory))).toBe(false);
  });
});

describe("generation CLIs", () => {
  it("check:generated passes on this repository without writing", () => {
    const script = join(PKG, "scripts/check/check-generated.ts");
    const output = execFileSync("bun", [script], { cwd: temporaryDirectory(), encoding: "utf8" });
    const plan = planRepositoryGeneration(PKG, iconMetadata);
    expect(output.trim()).toBe(
      `Generated output is up to date: ${plan.concepts.length} React icon components, the root exports, and the manifest from ${plan.iconCount} production icons.`,
    );
  });
});
