import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { categories } from "../config/categories.js";
import { iconSystem } from "../config/icon-system.js";
import { validateRepository, validateSources } from "../scripts/check/validate-repository.js";
import {
  iconExportName,
  validateIconName,
  validateSourcePath,
} from "../scripts/check/validate-source-path.js";
import { maxSvgBytes, validateSvg } from "../scripts/check/validate-svg.js";
import { diagnostic, formatDiagnostics, sortDiagnostics } from "../scripts/lib/diagnostics.js";

const outlineAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: iconSystem.architecture.viewBox,
  fill: "none",
  stroke: iconSystem.architecture.color,
  "stroke-width": String(iconSystem.calibration.strokeWidth),
  "stroke-linecap": iconSystem.calibration.linecap,
  "stroke-linejoin": iconSystem.calibration.linejoin,
};

function syntheticSvg(
  attributes: Record<string, string | undefined> = {},
  content = '<path d="M 5 7 L 11 13"/>',
): string {
  const serialized = Object.entries({ ...outlineAttributes, ...attributes })
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}="${value}"`)
    .join(" ");
  return `<svg ${serialized}>${content}</svg>`;
}

const outlineFile = "icons/outline/actions/fixture.svg";

const temporaryRepositories: string[] = [];

function writeFixture(root: string, file: string, source: string | Uint8Array): void {
  const absolute = join(root, file);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, source);
}

function temporaryRepository(): string {
  const root = mkdtempSync(join(tmpdir(), "qeetrix-validation-"));
  temporaryRepositories.push(root);
  writeFixture(root, "icons/.gitkeep", "");
  return root;
}

afterEach(() => {
  for (const root of temporaryRepositories.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("repository-wide identity", () => {
  it("accepts zero sources", () => {
    expect(validateSources([])).toEqual({ iconCount: 0, diagnostics: [] });
  });

  it("allows selective variants and correctly matched counterparts", () => {
    const sources = [
      { file: outlineFile, source: syntheticSvg() },
      { file: "icons/filled/actions/fixture.svg", source: syntheticSvg({ fill: "currentColor" }) },
      {
        file: "icons/filled/status/other-fixture.svg",
        source: syntheticSvg({ fill: "currentColor" }),
      },
    ];
    expect(validateSources(sources)).toEqual({ iconCount: 3, diagnostics: [] });
  });

  it("rejects duplicate canonical names across categories", () => {
    const result = validateSources([
      { file: outlineFile, source: syntheticSvg() },
      { file: "icons/outline/data/fixture.svg", source: syntheticSvg() },
    ]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-DUP-001", file: "icons/outline/data/fixture.svg" }),
    ]);
  });

  it.each(["Fixture.svg", "fixture.SVG"])(
    "detects case-insensitive collision with %s independently of the host filesystem",
    (name) => {
      const result = validateSources([
        { file: outlineFile, source: syntheticSvg() },
        { file: `icons/outline/actions/${name}`, source: syntheticSvg() },
      ]);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "QXI-DUP-002" }),
          expect.objectContaining({ code: "QXI-NAME-001" }),
        ]),
      );
    },
  );

  it("rejects distinct valid names that normalize to the same React export", () => {
    const result = validateSources([
      { file: "icons/outline/actions/fixture-3d.svg", source: syntheticSvg() },
      { file: "icons/outline/data/fixture3d.svg", source: syntheticSvg() },
    ]);
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "QXI-DUP-003" })]);
  });

  it("requires counterpart categories to match", () => {
    const result = validateSources([
      { file: outlineFile, source: syntheticSvg() },
      { file: "icons/filled/status/fixture.svg", source: syntheticSvg({ fill: "currentColor" }) },
    ]);
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "QXI-DUP-004" })]);
  });

  it("combines SVG and path errors in stable codepoint order", () => {
    const sources = [
      { file: outlineFile, source: syntheticSvg({ stroke: "red" }) },
      { file: "icons/outline/data/fixture.svg", source: syntheticSvg() },
      { file: "icons/random.svg", source: syntheticSvg() },
      { file: "icons/outline/actions/Fixture.svg", source: syntheticSvg() },
    ];
    const result = validateSources(sources);
    expect(validateSources([...sources].reverse())).toEqual(result);
    expect(result.diagnostics).toEqual(sortDiagnostics(result.diagnostics));
    expect(result.diagnostics.every((entry) => entry.severity === "error")).toBe(true);
  });
});

describe("production scanner and fixture isolation", () => {
  it("anchors the CLI to this repository instead of the working directory", () => {
    const root = temporaryRepository();
    writeFixture(root, outlineFile, "<script/>");
    const script = fileURLToPath(new URL("../scripts/check/check-icons.ts", import.meta.url));
    const output = execFileSync("bun", [script], { cwd: root, encoding: "utf8" });
    expect(output.trim()).toBe("0 production icons validated.");
  });

  it("passes an empty source root and never scans test fixtures", () => {
    const root = temporaryRepository();
    writeFixture(root, "tests/fixtures/svg/invalid.svg", "<script/>");
    writeFixture(root, "dist/invalid.svg", "<script/>");
    expect(validateRepository(root)).toEqual({ iconCount: 0, diagnostics: [] });
  });

  it("scans only production SVG files and reports a stable relative path", () => {
    const root = temporaryRepository();
    writeFixture(root, outlineFile, syntheticSvg());
    expect(validateRepository(root)).toEqual({ iconCount: 1, diagnostics: [] });
    writeFixture(root, "icons/outline/data/fixture.svg", syntheticSvg());
    expect(validateRepository(root)).toEqual({
      iconCount: 2,
      diagnostics: [
        expect.objectContaining({ code: "QXI-DUP-001", file: "icons/outline/data/fixture.svg" }),
      ],
    });
  });

  it.each([
    ["icons/fixture.svg", "QXI-PATH-001"],
    ["icons/outline/actions/nested/fixture.svg", "QXI-PATH-001"],
    ["icons/outline/crypto/fixture.svg", "QXI-PATH-002"],
    ["icons/bold/actions/fixture.svg", "QXI-PATH-003"],
    ["icons/outline/actions/fixture.SVG", "QXI-NAME-001"],
  ])("finds misplaced or invalid production file %s", (file, code) => {
    const root = temporaryRepository();
    writeFixture(root, file, syntheticSvg());
    expect(validateRepository(root)).toEqual({
      iconCount: 1,
      diagnostics: [expect.objectContaining({ code, file })],
    });
  });

  it("reports malformed SVG through the aggregate check", () => {
    const root = temporaryRepository();
    writeFixture(root, outlineFile, "<svg>");
    expect(validateRepository(root)).toEqual({
      iconCount: 1,
      diagnostics: [expect.objectContaining({ code: "QXI-XML-001", file: outlineFile })],
    });
  });

  it("rejects non-SVG source files", () => {
    const root = temporaryRepository();
    writeFixture(root, "icons/raster.png", new Uint8Array([1, 2, 3]));
    expect(validateRepository(root)).toEqual({
      iconCount: 0,
      diagnostics: [expect.objectContaining({ code: "QXI-IO-001", file: "icons/raster.png" })],
    });
  });

  it("rejects missing or non-directory source roots", () => {
    const root = temporaryRepository();
    rmSync(join(root, "icons"), { recursive: true });
    expect(validateRepository(root).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-IO-001", file: "icons" }),
    ]);
    writeFixture(root, "icons", "not a directory");
    expect(validateRepository(root).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-IO-001", file: "icons" }),
    ]);
  });

  it("does not follow symbolic links to fixtures outside the source root", () => {
    const root = temporaryRepository();
    writeFixture(root, "fixtures/actions/fixture.svg", syntheticSvg());
    symlinkSync(join(root, "fixtures"), join(root, "icons/outline"), "junction");
    expect(validateRepository(root)).toEqual({
      iconCount: 0,
      diagnostics: [expect.objectContaining({ code: "QXI-IO-001", file: "icons/outline" })],
    });
  });

  it("rejects a symbolic-link production root", () => {
    const root = temporaryRepository();
    rmSync(join(root, "icons"), { recursive: true });
    writeFixture(root, "fixtures/outline/actions/fixture.svg", syntheticSvg());
    symlinkSync(join(root, "fixtures"), join(root, "icons"), "junction");
    expect(validateRepository(root).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-IO-001", file: "icons" }),
    ]);
  });

  it("rejects invalid UTF-8 and oversized source files", () => {
    const root = temporaryRepository();
    writeFixture(root, outlineFile, new Uint8Array([0xff, 0xfe]));
    expect(validateRepository(root).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-IO-001" }),
    ]);
    writeFixture(root, outlineFile, " ".repeat(maxSvgBytes + 1));
    expect(validateRepository(root)).toEqual({
      iconCount: 1,
      diagnostics: [expect.objectContaining({ code: "QXI-XML-001", file: outlineFile })],
    });
  });
});

describe("SVG structure and paint", () => {
  it("accepts a minimal synthetic outline using the shared calibration", () => {
    expect(validateSvg(syntheticSvg(), outlineFile, "outline")).toEqual([]);
  });

  it.each([
    '<circle cx="12" cy="12" r="4"/>',
    '<ellipse cx="12" cy="12" rx="4" ry="3"/>',
    '<rect x="4" y="5" width="8" height="6" rx="0"/>',
    '<line x1="4" y1="5" x2="12" y2="8"/>',
    '<polyline points="4,5 8,6 12,8"/>',
    '<polygon points="4,5 8,6 12,8"/>',
    '<g fill="none"><path d="M.5.75 L1e1 12z"/></g>',
    '<!-- <script> is not an element in a comment --><path d="m 5 7 h 3 v 4"/>',
  ])("accepts supported geometry %s", (content) => {
    expect(validateSvg(syntheticSvg({}, content), outlineFile, "outline")).toEqual([]);
  });

  it("accepts XML declarations and equivalent numeric viewBox formatting", () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>${syntheticSvg({ viewBox: "0, 0, 24.0, 24" })}`;
    expect(validateSvg(source, outlineFile, "outline")).toEqual([]);
  });

  it("accepts a standalone filled source without requiring an outline pair", () => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconSystem.architecture.viewBox}" fill="currentColor"><rect x="4" y="5" width="8" height="6"/></svg>`;
    expect(validateSvg(source, "icons/filled/actions/fixture.svg", "filled")).toEqual([]);
  });

  it.each([
    ["viewBox", "0 0 32 32", "QXI-SVG-002"],
    ["viewBox", undefined, "QXI-SVG-002"],
    ["viewBox", "0,,0,24,24", "QXI-SVG-002"],
    ["viewBox", "0 0 24 Infinity", "QXI-SVG-002"],
    ["width", "24", "QXI-SVG-003"],
    ["height", "24", "QXI-SVG-003"],
    ["fill", "currentColor", "QXI-SVG-007"],
    ["fill", undefined, "QXI-SVG-007"],
    ["stroke", "none", "QXI-SVG-007"],
    ["stroke", undefined, "QXI-SVG-007"],
    ["stroke-width", String(iconSystem.calibration.strokeWidth + 1), "QXI-SVG-007"],
    ["stroke-width", undefined, "QXI-SVG-007"],
    [
      "stroke-linecap",
      iconSystem.calibration.linecap === "round" ? "butt" : "round",
      "QXI-SVG-007",
    ],
    ["stroke-linecap", undefined, "QXI-SVG-007"],
    [
      "stroke-linejoin",
      iconSystem.calibration.linejoin === "round" ? "bevel" : "round",
      "QXI-SVG-007",
    ],
    ["stroke-linejoin", undefined, "QXI-SVG-007"],
    ["xmlns", "http://www.w3.org/1999/xhtml", "QXI-SVG-001"],
    ["xmlns", undefined, "QXI-SVG-001"],
  ])("rejects %s=%s", (name, value, code) => {
    expect(validateSvg(syntheticSvg({ [name]: value }), outlineFile, "outline")).toEqual(
      expect.arrayContaining([expect.objectContaining({ code, file: outlineFile })]),
    );
  });

  it.each([
    "#000",
    "#000000",
    "#fff",
    "#ffffff",
    "rgb(0,0,0)",
    "rgba(0,0,0,1)",
    "hsl(0,0%,0%)",
    "hsla(0,0%,0%,1)",
    "red",
    "black",
    "white",
    "url(#paint)",
    "inherit",
    "var(--color)",
  ])("rejects artwork paint %s", (paint) => {
    expect(
      validateSvg(
        syntheticSvg({}, `<g stroke="${paint}"><path d="M 5 7 L 11 13"/></g>`),
        outlineFile,
        "outline",
      ),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: "QXI-SVG-006" })]));
  });

  it("checks descendant outline overrides and filled root paint", () => {
    expect(
      validateSvg(
        syntheticSvg({}, '<path d="M 5 7 L 11 13" fill="currentColor"/>'),
        outlineFile,
        "outline",
      ),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: "QXI-SVG-007" })]));
    expect(validateSvg(syntheticSvg(), "icons/filled/actions/fixture.svg", "filled")).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "QXI-SVG-007" })]),
    );
  });

  it.each([
    '<circle r="NaN"/>',
    '<circle r="Infinity"/>',
    '<circle r="-1"/>',
    '<ellipse rx="0" ry="2"/>',
    '<rect width="0" height="4"/>',
    '<line x1="12px"/>',
    '<line x1="0x10"/>',
    '<line x1="1e999"/>',
    '<line x1=""/>',
    "<path/>",
    '<path d=""/>',
    '<path d="H 4"/>',
    '<path d="M 4"/>',
    '<path d="M 4 5 L"/>',
    '<path d="M 4 5 X 6 7"/>',
    '<path d="M 4 5 L NaN 8"/>',
    '<path d="M 4 5 L 1e999 8"/>',
    '<path d="M 4 5 L 6px 8"/>',
    '<polyline points="0,0 1"/>',
    '<polygon points="0,0 1,1"/>',
    '<polygon points="0,,0 1,1 2,2"/>',
    "<g/>",
  ])("rejects malformed or empty geometry %s", (content) => {
    expect(validateSvg(syntheticSvg({}, content), outlineFile, "outline")).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "QXI-SVG-008" })]),
    );
  });

  it("rejects long malformed numbers without overlapping digit groups", () => {
    const coordinate = `${"9".repeat(25_000)}x`;
    const source = syntheticSvg({}, `<line x1="${coordinate}"/>`);
    expect(validateSvg(source, outlineFile, "outline")).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "QXI-SVG-008" })]),
    );
  });

  it("does not pretend to enforce painted bounds or optical balance", () => {
    expect(
      validateSvg(
        syntheticSvg({}, '<line x1="-2" y1="0" x2="32" y2="0"/>'),
        outlineFile,
        "outline",
      ),
    ).toEqual([]);
  });
});

describe("SVG XML and security", () => {
  it.each([
    "",
    "<svg>",
    "<svg><g></svg>",
    "<svg width=24/>",
    '<svg duplicate="a" duplicate="b"/>',
    "<svg/><svg/>",
    "<svg>&missing;</svg>",
    "<svg></svg\njunk>",
    syntheticSvg({}, '<path d="M 4 5" invalid="<"/>'),
  ])("rejects malformed XML %s", (source) => {
    expect(validateSvg(source, outlineFile, "outline")).toEqual([
      expect.objectContaining({ code: "QXI-XML-001" }),
    ]);
  });

  it("requires a true SVG document root", () => {
    expect(validateSvg("<root/>", outlineFile, "outline")).toEqual([
      expect.objectContaining({ code: "QXI-SVG-001" }),
    ]);
  });

  it.each([
    "script",
    "style",
    "foreignObject",
    "image",
    "iframe",
    "audio",
    "video",
    "animate",
    "animateMotion",
    "animateTransform",
    "set",
    "defs",
    "clipPath",
    "mask",
    "filter",
    "linearGradient",
    "radialGradient",
    "pattern",
    "symbol",
    "use",
    "title",
    "desc",
    "text",
    "svg",
  ])("rejects unsupported <%s>", (element) => {
    expect(validateSvg(syntheticSvg({}, `<${element}/>`), outlineFile, "outline")).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "QXI-SVG-004" })]),
    );
  });

  it.each([
    ["href", "https://example.invalid/file.svg"],
    ["href", "#local"],
    ["href", "data:image/png;base64,AAAA"],
    ["onclick", "alert(1)"],
    ["onload", "alert(1)"],
    ["onmouseover", "alert(1)"],
    ["id", "shared"],
    ["transform", "translate(2 3)"],
    ["style", "stroke:red"],
    ["class", "external-css"],
    ["color", "orange"],
    ["role", "img"],
    ["aria-label", "Label"],
    ["aria-labelledby", "label"],
    ["aria-describedby", "description"],
    ["tabindex", "0"],
    ["focusable", "false"],
    ["vector-effect", "non-scaling-stroke"],
  ])("rejects forbidden attribute %s", (name, value) => {
    expect(validateSvg(syntheticSvg({ [name]: value }), outlineFile, "outline")).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "QXI-SVG-005" })]),
    );
  });

  it("rejects namespaced links and foreign namespace geometry", () => {
    const linked = syntheticSvg(
      { "xmlns:xlink": "http://www.w3.org/1999/xlink" },
      '<path d="M 4 5 L 8 9" xlink:href="https://example.invalid/remote.svg"/>',
    );
    expect(validateSvg(linked, outlineFile, "outline")).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "QXI-SVG-005" })]),
    );
    expect(
      validateSvg(
        syntheticSvg({}, '<g xmlns="http://www.w3.org/1999/xhtml"/>'),
        outlineFile,
        "outline",
      ),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: "QXI-SVG-004" })]));
  });

  it.each([
    `<!DOCTYPE svg SYSTEM "https://example.invalid/external.dtd">${syntheticSvg()}`,
    `<?xml-stylesheet href="https://example.invalid/style.css"?>${syntheticSvg()}`,
    syntheticSvg({}, "<![CDATA[arbitrary content]]>"),
    syntheticSvg({}, "arbitrary text"),
  ])("rejects non-geometric XML constructs", (source) => {
    expect(validateSvg(source, outlineFile, "outline")).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "QXI-XML-002" })]),
    );
  });

  it("does not expand custom entities and rejects oversized input", () => {
    const entity = `<!DOCTYPE svg [<!ENTITY paint "currentColor">]>${syntheticSvg({ stroke: "&paint;" })}`;
    expect(validateSvg(entity, outlineFile, "outline").length).toBeGreaterThan(0);
    expect(validateSvg(" ".repeat(maxSvgBytes + 1), outlineFile, "outline")).toEqual([
      expect.objectContaining({ code: "QXI-XML-001" }),
    ]);
  });
});

describe("icon names", () => {
  it.each([
    "search.svg",
    "arrow-left.svg",
    "chevron-down.svg",
    "user-plus.svg",
    "shield-check.svg",
    "file-text.svg",
    "x.svg",
    "copy.svg",
    "map.svg",
    "image.svg",
    "file.svg",
    "record.svg",
    "file-3d.svg",
    "layout-2-columns.svg",
    "protocol-v2.svg",
  ])("accepts semantic name %s", (filename) => {
    expect(validateIconName(filename)).toEqual([]);
    expect(iconExportName(filename.slice(0, -4))).toMatch(/^[A-Z][A-Za-z0-9]*Icon$/);
  });

  it.each([
    "Search.svg",
    "search_icon.svg",
    "search-icon.svg",
    "searchIcon.svg",
    "search copy.svg",
    "search-final.svg",
    "search-new.svg",
    "search-alt.svg",
    "search-copy.svg",
    "search-2.svg",
    "search-24.svg",
    "search--value.svg",
    "search.SVG",
    "search.svg\n",
    "search.svg\r\n",
    "search.png",
    "3d-cube.svg",
    "../search.svg",
    "con.svg",
    "com1.svg",
    "",
  ])("rejects invalid name %s", (filename) => {
    expect(validateIconName(filename)).toEqual([
      expect.objectContaining({ code: "QXI-NAME-001", file: filename, severity: "error" }),
    ]);
  });

  it("computes export identities without a category prefix", () => {
    expect(iconExportName("file-text")).toBe("FileTextIcon");
    expect(iconExportName("map")).toBe("MapIcon");
    expect(iconExportName("file-3d")).toBe(iconExportName("file3d"));
  });
});

describe("source paths", () => {
  it("accepts every configured category and variant", () => {
    for (const { id } of categories) {
      for (const variant of iconSystem.architecture.variants) {
        const file = `icons/${variant}/${id}/fixture.svg`;
        expect(validateSourcePath(file)).toEqual({
          location: { file, name: "fixture", category: id, variant },
          diagnostics: [],
        });
      }
    }
  });

  it.each([
    "icons/search.svg",
    "icons/random/search.svg",
    "icons/round-outline/search.svg",
    "icons/outline/actions/nested/search.svg",
    "/icons/outline/actions/search.svg",
    "icons/outline/../search.svg",
    "icons/outline//search.svg",
    "icons\\outline\\actions\\search.svg",
  ])("rejects misplaced path %s", (file) => {
    expect(validateSourcePath(file).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-PATH-001", file }),
    ]);
  });

  it.each(["crypto", "seasonal", "nature", "social", "travel", "Actions"])(
    "rejects unconfigured category %s",
    (category) => {
      expect(validateSourcePath(`icons/outline/${category}/fixture.svg`).diagnostics).toEqual([
        expect.objectContaining({ code: "QXI-PATH-002" }),
      ]);
    },
  );

  it.each([
    "round-outline",
    "round-solid",
    "sharp-outline",
    "sharp-solid",
    "thin",
    "light",
    "bold",
    "duotone",
  ])("rejects unsupported variant %s", (variant) => {
    expect(validateSourcePath(`icons/${variant}/actions/fixture.svg`).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-PATH-003" }),
    ]);
  });

  it("retains invalid-case names so repository checks can report collisions", () => {
    const result = validateSourcePath("icons/outline/actions/Fixture.svg");
    expect(result.location?.name).toBe("Fixture");
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "QXI-NAME-001" })]);
  });
});

describe("diagnostics", () => {
  it("sorts by file, code, then message without depending on input order", () => {
    const diagnostics = [
      diagnostic("QXI-PATH-003", "icons/b.svg", "Unknown variant."),
      diagnostic("QXI-NAME-001", "icons/a.svg", "Second message."),
      diagnostic("QXI-NAME-001", "icons/a.svg", "First message."),
    ];
    expect(sortDiagnostics(diagnostics)).toEqual([diagnostics[2], diagnostics[1], diagnostics[0]]);
    expect(formatDiagnostics(diagnostics)).toBe(formatDiagnostics([...diagnostics].reverse()));
    expect(formatDiagnostics(diagnostics)).toContain(
      'QXI-NAME-001 "icons/a.svg"\n  First message.',
    );
  });

  it("escapes control characters in diagnostic filenames", () => {
    expect(formatDiagnostics([diagnostic("QXI-NAME-001", "bad\nname.svg", "Invalid name.")])).toBe(
      'QXI-NAME-001 "bad\\nname.svg"\n  Invalid name.',
    );
  });
});
