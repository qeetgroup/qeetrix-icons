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
import { iconSystem } from "../config/icon-system.js";
import { checkGenerationPlan, writeGenerationPlan } from "../scripts/lib/generated-output.js";
import {
  createGenerationPlan,
  type GeneratedIcon,
  generatedIconsDirectory,
  planRepositoryGeneration,
} from "../scripts/lib/generation-plan.js";
import { reactAttributeName, svgToReact } from "../scripts/lib/svg-to-react.js";
import { createRepositoryFixture, syntheticSvg, writeFixture } from "./helpers.js";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const sourceFile = "icons/outline/actions/fixture.svg";
const outputFile = "src/generated/icons/outline/actions/fixture.tsx";
const filled = {
  fill: "currentColor",
  stroke: undefined,
  "stroke-width": undefined,
  "stroke-linecap": undefined,
  "stroke-linejoin": undefined,
};
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

function generate(content: string, file = sourceFile, attributes = {}): GeneratedIcon {
  const plan = createGenerationPlan([{ file, source: syntheticSvg(attributes, content) }]);
  expect(plan.diagnostics).toEqual([]);
  return plan.files[0];
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
      {
        file: sourceFile,
        source: `<?xml version="1.0" encoding="UTF-8"?>\n${syntheticSvg()}`,
      },
    ]);
    expect(declared.files[0].code).toBe(generate('<path d="M 5 7 L 11 13"/>').code);
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

import { resolveIconProps } from "../../../../runtime/resolve-icon-props.js";
import type { IconProps } from "../../../../types/icon-props.js";

export function FixtureIcon(props: IconProps) {
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
    const { code } = generate('<path d="M 5 7 L 11 13"/>');
    expect(code).not.toMatch(
      /use client|forwardRef|displayName|export default|dangerouslySetInnerHTML|Date|Math\.random|process\.|\r/,
    );
    expect(code).not.toContain(PKG);
    expect(code).not.toContain(tmpdir());
  });

  it("keep outline and filled counterparts in variant-separated files without name suffixes", () => {
    const plan = createGenerationPlan([
      { file: sourceFile, source: syntheticSvg() },
      { file: "icons/filled/actions/fixture.svg", source: syntheticSvg(filled) },
    ]);
    expect(plan.diagnostics).toEqual([]);
    expect(plan.files.map(({ componentName, outputPath }) => [componentName, outputPath])).toEqual([
      ["FixtureIcon", outputFile],
      ["FixtureIcon", "src/generated/icons/filled/actions/fixture.tsx"],
    ]);
    expect(plan.files[1].code).toContain('fill="currentColor"');
    expect(plan.files[1].code).not.toContain("stroke=");
  });
});

describe("generated output passes Biome and strict TypeScript", () => {
  // Path data whose generated line straddles Biome's 100-column limit, both for a two-attribute
  // element and for the single-string-attribute case Biome never breaks.
  const pathLengths = Array.from({ length: 24 }, (_, index) => 52 + index);
  // A group whose opening tag straddles the limit; equal numeric spellings stay valid.
  const groupPadding = Array.from({ length: 12 }, (_, index) => 18 + index);
  const longName = `fixture-${"long-".repeat(15)}name`;

  function biomeFixtures(): GeneratedIcon[] {
    const sources = [
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
      {
        file: "icons/filled/status/filled-fixture.svg",
        source: syntheticSvg(filled, '<polygon points="4,5 8,6 12,8"/>'),
      },
      { file: `icons/outline/time/${longName}.svg`, source: syntheticSvg() },
    ];
    const plan = createGenerationPlan(sources);
    expect(plan.diagnostics).toEqual([]);
    return [...plan.files];
  }

  it("is already formatted, import-sorted, and lint-clean under the repository Biome config", () => {
    const root = temporaryDirectory();
    copyFileSync(join(PKG, "biome.json"), join(root, "biome.json"));
    const files = biomeFixtures();
    for (const file of files) writeFixture(root, file.outputPath, file.code);
    expect(files.some(({ code }) => code.includes("export function FixtureLong"))).toBe(true);
    const biome = createRequire(import.meta.url).resolve("@biomejs/biome/bin/biome");
    // Throws, failing the test with Biome's report, on any format, import-order, or lint issue.
    execFileSync(process.execPath, [biome, "check", "--vcs-enabled=false", "src"], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
    });
  });

  it("typechecks under the strict repository config, including refs and native props", () => {
    const { options } = ts.parseJsonConfigFileContent(
      ts.readConfigFile(join(PKG, "tsconfig.json"), ts.sys.readFile).config,
      ts.sys,
      PKG,
    );
    const component = generate('<path d="M 5 7 L 11 13"/>');
    const virtual = new Map([
      [join(PKG, component.outputPath), component.code],
      [
        join(PKG, generatedIconsDirectory, "usage.tsx"),
        `import { createRef } from "react";
import { FixtureIcon } from "./outline/actions/fixture.js";

const ref = createRef<SVGSVGElement>();
export const usages = [
  <FixtureIcon key="a" />,
  <FixtureIcon key="b" size={20} />,
  <FixtureIcon key="c" size="1.25em" className="x" style={{ opacity: 0.5 }} />,
  <FixtureIcon key="d" aria-label="Fixture" data-testid="fixture" onClick={() => {}} />,
  <FixtureIcon key="e" ref={ref} />,
  // @ts-expect-error icons render their own artwork
  <FixtureIcon key="f">child</FixtureIcon>,
  // @ts-expect-error size is a number or a CSS length string
  <FixtureIcon key="g" size={true} />,
];
`,
      ],
    ]);
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
  it("accepts zero sources without placeholder components", () => {
    expect(createGenerationPlan([])).toEqual({ iconCount: 0, files: [], diagnostics: [] });
  });

  it("is deterministic and independent of discovery order", () => {
    const sources = [
      { file: "icons/filled/status/fixture-beta.svg", source: syntheticSvg(filled) },
      { file: "icons/outline/data/fixture-gamma.svg", source: syntheticSvg() },
      { file: "icons/outline/actions/fixture-zeta.svg", source: syntheticSvg() },
      { file: "icons/outline/actions/fixture-alpha.svg", source: syntheticSvg() },
    ];
    const plan = createGenerationPlan(sources);
    expect(plan.diagnostics).toEqual([]);
    expect(plan.files.map(({ outputPath }) => outputPath)).toEqual([
      "src/generated/icons/outline/actions/fixture-alpha.tsx",
      "src/generated/icons/outline/actions/fixture-zeta.tsx",
      "src/generated/icons/outline/data/fixture-gamma.tsx",
      "src/generated/icons/filled/status/fixture-beta.tsx",
    ]);
    expect(createGenerationPlan([...sources].reverse())).toEqual(plan);
    expect(createGenerationPlan(sources)).toEqual(plan);
  });

  it("returns no partial plan when any input fails authoritative validation", () => {
    const result = createGenerationPlan([
      { file: sourceFile, source: syntheticSvg() },
      { file: "icons/outline/actions/invalid-fixture.svg", source: "<svg>" },
    ]);
    expect(result.files).toEqual([]);
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "QXI-XML-001" })]);
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
  it("handles zero icons without creating placeholders or directories", () => {
    const root = temporaryRepository();
    const plan = planRepositoryGeneration(root);
    expect(checkGenerationPlan(root, plan)).toEqual([]);
    expect(writeGenerationPlan(root, plan)).toEqual({
      generatedCount: 0,
      changedCount: 0,
      removedCount: 0,
      diagnostics: [],
    });
    expect(existsSync(join(root, "src"))).toBe(false);
  });

  it("is idempotent and reproduces identical bytes after the output is deleted", () => {
    const root = temporaryRepository();
    writeFixture(root, sourceFile, syntheticSvg());
    writeFixture(root, "icons/filled/actions/fixture.svg", syntheticSvg(filled));
    expect(writeGenerationPlan(root, planRepositoryGeneration(root))).toEqual({
      generatedCount: 2,
      changedCount: 2,
      removedCount: 0,
      diagnostics: [],
    });
    const first = readFileSync(join(root, outputFile));
    expect(writeGenerationPlan(root, planRepositoryGeneration(root))).toEqual({
      generatedCount: 2,
      changedCount: 0,
      removedCount: 0,
      diagnostics: [],
    });
    expect(checkGenerationPlan(root, planRepositoryGeneration(root))).toEqual([]);
    rmSync(join(root, "src/generated"), { recursive: true });
    writeGenerationPlan(root, planRepositoryGeneration(root));
    expect(readFileSync(join(root, outputFile)).equals(first)).toBe(true);

    const elsewhere = temporaryRepository();
    writeFixture(elsewhere, sourceFile, syntheticSvg());
    writeFixture(elsewhere, "icons/filled/actions/fixture.svg", syntheticSvg(filled));
    writeGenerationPlan(elsewhere, planRepositoryGeneration(elsewhere));
    expect(readFileSync(join(elsewhere, outputFile)).equals(first)).toBe(true);
  });

  it("removes only stale generated files and never touches anything outside the boundary", () => {
    const root = temporaryRepository();
    writeFixture(root, sourceFile, syntheticSvg());
    writeFixture(root, "src/manual.ts", "handwritten");
    writeFixture(root, "src/generated/keep.txt", "outside the icon output boundary");
    const stale = "src/generated/icons/outline/actions/stale-fixture.tsx";
    const staleDirectory = "src/generated/icons/filled/status/stale.tsx";
    writeFixture(root, stale, "// stale\n");
    writeFixture(root, staleDirectory, "// stale\n");
    const plan = planRepositoryGeneration(root);
    expect(writeGenerationPlan(root, plan)).toEqual({
      generatedCount: 1,
      changedCount: 1,
      removedCount: 2,
      diagnostics: [],
    });
    expect(readFileSync(join(root, outputFile), "utf8")).toBe(plan.files[0].code);
    expect(existsSync(join(root, stale))).toBe(false);
    expect(existsSync(join(root, "src/generated/icons/filled"))).toBe(false);
    expect(existsSync(join(root, generatedIconsDirectory))).toBe(true);
    expect(readFileSync(join(root, sourceFile), "utf8")).toBe(syntheticSvg());
    expect(readFileSync(join(root, "src/manual.ts"), "utf8")).toBe("handwritten");
    expect(readFileSync(join(root, "src/generated/keep.txt"), "utf8")).toBe(
      "outside the icon output boundary",
    );
  });

  it("removes stale files when the final source disappears", () => {
    const root = temporaryRepository();
    writeFixture(root, sourceFile, syntheticSvg());
    writeGenerationPlan(root, planRepositoryGeneration(root));
    rmSync(join(root, sourceFile));
    expect(writeGenerationPlan(root, planRepositoryGeneration(root))).toEqual({
      generatedCount: 0,
      changedCount: 0,
      removedCount: 1,
      diagnostics: [],
    });
    expect(existsSync(join(root, outputFile))).toBe(false);
    expect(checkGenerationPlan(root, planRepositoryGeneration(root))).toEqual([]);
  });

  it("detects missing, edited, source-changed, and stale output without writing", () => {
    const root = temporaryRepository();
    writeFixture(root, sourceFile, syntheticSvg());
    const plan = planRepositoryGeneration(root);
    expect(checkGenerationPlan(root, plan)).toEqual([
      expect.objectContaining({ code: "QXI-GEN-003", message: expect.stringContaining("missing") }),
    ]);
    expect(existsSync(join(root, "src"))).toBe(false);

    writeGenerationPlan(root, plan);
    writeFixture(root, outputFile, "manually edited");
    expect(checkGenerationPlan(root, plan)).toEqual([
      expect.objectContaining({
        code: "QXI-GEN-003",
        message: expect.stringContaining("out of date"),
      }),
    ]);
    expect(readFileSync(join(root, outputFile), "utf8")).toBe("manually edited");

    writeGenerationPlan(root, plan);
    const unchanged = readFileSync(join(root, outputFile), "utf8");
    writeFixture(root, sourceFile, syntheticSvg({}, '<circle cx="12" cy="12" r="3"/>'));
    expect(checkGenerationPlan(root, planRepositoryGeneration(root))).toEqual([
      expect.objectContaining({ code: "QXI-GEN-003", file: outputFile }),
    ]);
    expect(readFileSync(join(root, outputFile), "utf8")).toBe(unchanged);

    writeFixture(root, `${generatedIconsDirectory}/stale.txt`, "stale");
    expect(checkGenerationPlan(root, plan)).toEqual([
      expect.objectContaining({ file: `${generatedIconsDirectory}/stale.txt` }),
    ]);
    expect(readFileSync(join(root, `${generatedIconsDirectory}/stale.txt`), "utf8")).toBe("stale");
  });

  it("never partially writes or cleans after a source validation failure", () => {
    const root = temporaryRepository();
    writeFixture(root, sourceFile, syntheticSvg());
    writeGenerationPlan(root, planRepositoryGeneration(root));
    const previous = readFileSync(join(root, outputFile), "utf8");
    const stale = `${generatedIconsDirectory}/stale.tsx`;
    writeFixture(root, stale, "must survive the aborted operation");
    writeFixture(root, sourceFile, syntheticSvg({}, '<circle cx="12" cy="12" r="3"/>'));
    writeFixture(root, "icons/outline/actions/invalid-fixture.svg", "<svg>");
    const plan = planRepositoryGeneration(root);
    expect(plan.files).toEqual([]);
    const result = writeGenerationPlan(root, plan);
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "QXI-XML-001" })]);
    expect(result).toMatchObject({ changedCount: 0, removedCount: 0 });
    expect(readFileSync(join(root, outputFile), "utf8")).toBe(previous);
    expect(readFileSync(join(root, stale), "utf8")).toBe("must survive the aborted operation");
    expect(checkGenerationPlan(root, plan)).toEqual(plan.diagnostics);
  });

  it.each([
    "src/manual.tsx",
    "src/generated/icons/../../manual.tsx",
    "/outside.tsx",
    "C:\\outside.tsx",
    "src/generated/icons/fixture.tsx",
    "src/generated/icons/outline/actions/other-fixture.tsx",
    "src/generated/icons/outline/actions/./fixture.tsx",
  ])("rejects a forged output target %s before creating anything", (outputPath) => {
    const root = temporaryRepository();
    const plan = createGenerationPlan([{ file: sourceFile, source: syntheticSvg() }]);
    const forged = { ...plan, files: [{ ...plan.files[0], outputPath }] };
    expect(writeGenerationPlan(root, forged).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-GEN-002" }),
    ]);
    expect(checkGenerationPlan(root, forged)).toEqual([
      expect.objectContaining({ code: "QXI-GEN-002" }),
    ]);
    expect(existsSync(join(root, "src"))).toBe(false);
  });

  it.each([
    "src",
    "src/generated",
    generatedIconsDirectory,
    `${generatedIconsDirectory}/outline/actions`,
  ])("refuses a symbolic-link directory at %s without touching its target", (path) => {
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
  });

  it("refuses hard-linked files before they could overwrite outside data", () => {
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

  it("preflights file/directory conflicts and duplicate targets", () => {
    const root = temporaryRepository();
    writeFixture(root, sourceFile, syntheticSvg());
    writeFixture(root, `${outputFile}/keep.txt`, "untouched");
    const plan = planRepositoryGeneration(root);
    expect(writeGenerationPlan(root, plan).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-GEN-002" }),
    ]);
    expect(readFileSync(join(root, `${outputFile}/keep.txt`), "utf8")).toBe("untouched");

    rmSync(join(root, generatedIconsDirectory), { recursive: true });
    writeFixture(root, `${generatedIconsDirectory}/outline`, "directory conflict");
    expect(writeGenerationPlan(root, plan).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-GEN-002" }),
    ]);
    expect(readFileSync(join(root, `${generatedIconsDirectory}/outline`), "utf8")).toBe(
      "directory conflict",
    );
    const duplicated = { ...plan, files: [...plan.files, ...plan.files] };
    expect(writeGenerationPlan(root, duplicated).diagnostics).toEqual([
      expect.objectContaining({
        code: "QXI-GEN-002",
        message: expect.stringContaining("Duplicate"),
      }),
    ]);
  });
});

describe("generation CLIs", () => {
  it("check:generated passes on this repository without writing", () => {
    const script = join(PKG, "scripts/check/check-generated.ts");
    const output = execFileSync("bun", [script], { cwd: temporaryDirectory(), encoding: "utf8" });
    expect(output.trim()).toBe(
      "Generated output is up to date: 0 React icon components from 0 production icons.",
    );
  });
});
