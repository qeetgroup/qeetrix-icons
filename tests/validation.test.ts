import { execFileSync } from "node:child_process";
import { rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { categories } from "../config/categories.js";
import { iconMetadata } from "../config/icon-metadata.js";
import { iconSystem } from "../config/icon-system.js";
import {
  scanIconSources,
  validateRepository,
  validateSources,
  validateStyleParity,
} from "../scripts/check/validate-repository.js";
import {
  componentNameFromFilename,
  iconExportName,
  validateIconName,
  validateSourcePath,
} from "../scripts/check/validate-source-path.js";
import { maxSvgBytes, validateSvg } from "../scripts/check/validate-svg.js";
import { diagnostic, formatDiagnostics, sortDiagnostics } from "../scripts/lib/diagnostics.js";
import {
  createRepositoryFixture,
  filledAttributes,
  sharpAttributes,
  syntheticSvg,
  writeFixture,
} from "./helpers.js";

const outlineFile = "icons/round-outline/arrows/fixture.svg";
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

const temporaryRepositories: string[] = [];

function temporaryRepository(): string {
  const root = createRepositoryFixture();
  temporaryRepositories.push(root);
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

  it("allows outline-only concepts and one matched filled counterpart per name", () => {
    const sources = [
      { file: outlineFile, source: syntheticSvg() },
      {
        file: "icons/round-filled/arrows/fixture.svg",
        source: syntheticSvg({ fill: "currentColor" }),
      },
      { file: "icons/round-outline/shapes/other-fixture.svg", source: syntheticSvg() },
    ];
    expect(validateSources(sources)).toEqual({ iconCount: 3, diagnostics: [] });
  });

  it("rejects a filled drawing without its outline drawing", () => {
    const result = validateSources([
      { file: outlineFile, source: syntheticSvg() },
      {
        file: "icons/round-filled/shapes/other-fixture.svg",
        source: syntheticSvg({ fill: "currentColor" }),
      },
    ]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "QXI-VAR-001",
        file: "icons/round-filled/shapes/other-fixture.svg",
        message: expect.stringContaining("icons/round-outline/shapes/other-fixture.svg"),
      }),
    ]);
  });

  it("checks each style separately, and keeps every drawing of a name in one category", () => {
    const round = { file: "icons/round-outline/arrows/fixture.svg", source: syntheticSvg() };
    const roundFilled = {
      file: "icons/round-filled/arrows/fixture.svg",
      source: syntheticSvg(filledAttributes),
    };
    const sharpOutline = {
      file: "icons/sharp-outline/arrows/fixture.svg",
      source: syntheticSvg(sharpAttributes),
    };
    const sharpFilled = {
      file: "icons/sharp-filled/arrows/fixture.svg",
      source: syntheticSvg(filledAttributes),
    };
    expect(validateSources([round, roundFilled, sharpOutline, sharpFilled]).diagnostics).toEqual(
      [],
    );
    expect(validateSources([round, roundFilled, sharpFilled]).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-STYLE-001", file: round.file }),
      expect.objectContaining({
        code: "QXI-VAR-001",
        file: sharpFilled.file,
        message: expect.stringContaining("icons/sharp-outline/arrows/fixture.svg"),
      }),
    ]);
    const elsewhere = { ...sharpOutline, file: "icons/sharp-outline/shapes/fixture.svg" };
    expect(validateSources([round, elsewhere]).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-DUP-004", file: elsewhere.file }),
    ]);
  });

  it("rejects a duplicate drawing of the same name and variant", () => {
    const result = validateSources([
      {
        file: "icons/round-filled/arrows/fixture.svg",
        source: syntheticSvg({ fill: "currentColor" }),
      },
      {
        file: "icons/round-filled/charts/fixture.svg",
        source: syntheticSvg({ fill: "currentColor" }),
      },
      { file: outlineFile, source: syntheticSvg() },
    ]);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "QXI-DUP-001" })]),
    );
  });

  it("rejects duplicate canonical names across categories", () => {
    const result = validateSources([
      { file: outlineFile, source: syntheticSvg() },
      { file: "icons/round-outline/charts/fixture.svg", source: syntheticSvg() },
    ]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "QXI-DUP-001",
        file: "icons/round-outline/charts/fixture.svg",
      }),
    ]);
  });

  it.each(["Fixture.svg", "fixture.SVG"])(
    "detects case-insensitive collision with %s independently of the host filesystem",
    (name) => {
      const result = validateSources([
        { file: outlineFile, source: syntheticSvg() },
        { file: `icons/round-outline/arrows/${name}`, source: syntheticSvg() },
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
      { file: "icons/round-outline/arrows/fixture-3d.svg", source: syntheticSvg() },
      { file: "icons/round-outline/charts/fixture3d.svg", source: syntheticSvg() },
    ]);
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "QXI-DUP-003" })]);
  });

  it.each([
    [
      "outline first",
      "icons/round-outline/shapes/fixture.svg",
      "icons/round-filled/arrows/fixture.svg",
    ],
    [
      "filled first",
      "icons/round-outline/arrows/fixture.svg",
      "icons/round-filled/shapes/fixture.svg",
    ],
  ])("requires counterpart categories to match (%s)", (_, outline, filled) => {
    const result = validateSources([
      { file: outline, source: syntheticSvg() },
      { file: filled, source: syntheticSvg({ fill: "currentColor" }) },
    ]);
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "QXI-DUP-004" })]);
  });

  it("combines SVG and path errors in stable codepoint order", () => {
    const sources = [
      { file: outlineFile, source: syntheticSvg({ stroke: "red" }) },
      { file: "icons/round-outline/charts/fixture.svg", source: syntheticSvg() },
      { file: "icons/random.svg", source: syntheticSvg() },
      { file: "icons/round-outline/arrows/Fixture.svg", source: syntheticSvg() },
    ];
    const result = validateSources(sources);
    expect(validateSources([...sources].reverse())).toEqual(result);
    expect(result.diagnostics).toEqual(sortDiagnostics(result.diagnostics));
    expect(result.diagnostics.every((entry) => entry.severity === "error")).toBe(true);
  });
});

describe("style parity", () => {
  const roundOutline = { file: outlineFile, source: syntheticSvg() };
  const roundFilled = {
    file: "icons/round-filled/arrows/fixture.svg",
    source: syntheticSvg(filledAttributes),
  };
  const sharpOutline = {
    file: "icons/sharp-outline/arrows/fixture.svg",
    source: syntheticSvg(sharpAttributes),
  };
  const sharpFilled = {
    file: "icons/sharp-filled/arrows/fixture.svg",
    source: syntheticSvg(filledAttributes),
  };
  const other = { file: "icons/round-outline/shapes/other-fixture.svg", source: syntheticSvg() };
  const otherSharp = {
    file: "icons/sharp-outline/shapes/other-fixture.svg",
    source: syntheticSvg(sharpAttributes),
  };

  it("does not apply while every drawing is in the default style", () => {
    expect(validateSources([roundOutline, roundFilled, other]).diagnostics).toEqual([]);
  });

  it("accepts styles that mirror one another drawing for drawing", () => {
    const sources = [roundOutline, roundFilled, sharpOutline, sharpFilled, other, otherSharp];
    expect(validateSources(sources)).toEqual({ iconCount: 6, diagnostics: [] });
  });

  it("requires every default-style drawing in each style that is in use", () => {
    expect(validateSources([roundOutline, roundFilled, sharpOutline, other]).diagnostics).toEqual([
      expect.objectContaining({
        code: "QXI-STYLE-001",
        file: roundFilled.file,
        message: expect.stringContaining("sharp counterpart icons/sharp-filled/arrows/fixture.svg"),
      }),
      expect.objectContaining({
        code: "QXI-STYLE-001",
        file: other.file,
        message: expect.stringContaining("icons/sharp-outline/shapes/other-fixture.svg"),
      }),
    ]);
  });

  it("requires a default-style drawing for every drawing in another style", () => {
    expect(validateSources([roundOutline, sharpOutline, sharpFilled]).diagnostics).toEqual([
      expect.objectContaining({
        code: "QXI-STYLE-001",
        file: sharpFilled.file,
        message: expect.stringContaining("round counterpart icons/round-filled/arrows/fixture.svg"),
      }),
    ]);
    // Sharp drawings alone: nothing for the package root to export.
    expect(validateSources([sharpOutline, otherSharp]).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-STYLE-001", file: sharpOutline.file }),
      expect.objectContaining({ code: "QXI-STYLE-001", file: otherSharp.file }),
    ]);
  });

  it("is independent of source order and pure over the locations it is given", () => {
    const sources = [roundOutline, roundFilled, sharpOutline, other];
    expect(validateSources([...sources].reverse())).toEqual(validateSources(sources));
    const locations = [roundOutline, sharpFilled].flatMap(
      ({ file }) => validateSourcePath(file).location ?? [],
    );
    expect(validateStyleParity(locations)).toEqual([
      expect.objectContaining({ code: "QXI-STYLE-001", file: roundOutline.file }),
      expect.objectContaining({ code: "QXI-STYLE-001", file: sharpFilled.file }),
    ]);
    expect(validateStyleParity([])).toEqual([]);
  });

  it("holds for the repository's own sources", () => {
    const { sources } = scanIconSources(repositoryRoot);
    const locations = sources.flatMap(({ file }) => validateSourcePath(file).location ?? []);
    expect(new Set(locations.map(({ style }) => style))).toEqual(
      new Set(iconSystem.architecture.styles),
    );
    expect(validateStyleParity(locations)).toEqual([]);
    // Reads every drawing in the repository.
  }, 60_000);
});

describe("production scanner and fixture isolation", () => {
  it("captures a sorted source snapshot for validation and generation", () => {
    const root = temporaryRepository();
    const first = "icons/round-outline/arrows/fixture-alpha.svg";
    const last = "icons/round-outline/arrows/fixture-zeta.svg";
    const source = syntheticSvg();
    writeFixture(root, last, source);
    writeFixture(root, first, source);
    const scan = scanIconSources(root);
    expect(scan).toEqual({
      iconCount: 2,
      sources: [
        { file: first, source },
        { file: last, source },
      ],
      diagnostics: [],
    });
    writeFixture(root, first, "<svg>");
    expect(validateSources(scan.sources).diagnostics).toEqual([]);
    expect(validateRepository(root).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-XML-001", file: first }),
    ]);
  });

  it("anchors the CLI to this repository instead of the working directory", () => {
    const root = temporaryRepository();
    writeFixture(root, outlineFile, "<script/>");
    const script = fileURLToPath(new URL("../scripts/check/check-icons.ts", import.meta.url));
    const output = execFileSync("bun", [script], { cwd: root, encoding: "utf8" });
    // The temporary root's invalid fixture is ignored: the CLI validates this repository.
    expect(output.trim()).toBe(
      `${validateRepository(repositoryRoot, iconMetadata).iconCount} production icons validated.`,
    );
    // Validates every drawing in the repository twice: once in the CLI, once here.
  }, 60_000);

  it("leaves original brand logos in icons/brand-icons/ to their own validator", () => {
    const root = temporaryRepository();
    const source = syntheticSvg();
    writeFixture(root, outlineFile, source);
    writeFixture(root, "icons/brand-icons/simple-icons/github/mono.svg", "<script/>");
    writeFixture(root, "icons/brand-icons/notes.txt", "not an icon");
    expect(scanIconSources(root)).toEqual({
      iconCount: 1,
      sources: [{ file: outlineFile, source }],
      diagnostics: [],
    });
    expect(validateRepository(root)).toEqual({ iconCount: 1, diagnostics: [] });
    // Only that directory: a look-alike folder is still an unknown source folder.
    writeFixture(root, "icons/brand-icons-old/arrows/fixture-old.svg", source);
    expect(validateRepository(root).diagnostics).toEqual([
      expect.objectContaining({
        code: "QXI-PATH-003",
        file: "icons/brand-icons-old/arrows/fixture-old.svg",
      }),
    ]);
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
    writeFixture(root, "icons/round-outline/charts/fixture.svg", syntheticSvg());
    expect(validateRepository(root)).toEqual({
      iconCount: 2,
      diagnostics: [
        expect.objectContaining({
          code: "QXI-DUP-001",
          file: "icons/round-outline/charts/fixture.svg",
        }),
      ],
    });
  });

  it.each([
    ["icons/fixture.svg", "QXI-PATH-001"],
    ["icons/round-outline/arrows/nested/fixture.svg", "QXI-PATH-001"],
    ["icons/round-outline/crypto/fixture.svg", "QXI-PATH-002"],
    ["icons/bold/arrows/fixture.svg", "QXI-PATH-003"],
    ["icons/round-outline/arrows/fixture.SVG", "QXI-NAME-001"],
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
    writeFixture(root, "fixtures/arrows/fixture.svg", syntheticSvg());
    symlinkSync(join(root, "fixtures"), join(root, "icons/round-outline"), "junction");
    expect(validateRepository(root)).toEqual({
      iconCount: 0,
      diagnostics: [expect.objectContaining({ code: "QXI-IO-001", file: "icons/round-outline" })],
    });
  });

  it("rejects a symbolic-link production root", () => {
    const root = temporaryRepository();
    rmSync(join(root, "icons"), { recursive: true });
    writeFixture(root, "fixtures/outline/arrows/fixture.svg", syntheticSvg());
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
    expect(validateSvg(source, "icons/round-filled/arrows/fixture.svg", "filled")).toEqual([]);
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
    ["stroke-width", String(iconSystem.design.strokeWidth + 1), "QXI-SVG-007"],
    ["stroke-width", undefined, "QXI-SVG-007"],
    ["stroke-linecap", iconSystem.design.linecap === "round" ? "butt" : "round", "QXI-SVG-007"],
    ["stroke-linecap", undefined, "QXI-SVG-007"],
    ["stroke-linejoin", iconSystem.design.linejoin === "round" ? "bevel" : "round", "QXI-SVG-007"],
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
        syntheticSvg({}, '<path d="M 5 7 L 11 13" stroke-linecap="butt"/>'),
        outlineFile,
        "outline",
      ),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: "QXI-SVG-007" })]));
    expect(validateSvg(syntheticSvg(), "icons/round-filled/arrows/fixture.svg", "filled")).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "QXI-SVG-007" })]),
    );
  });

  it("lets an outline descendant fill itself, as Lucide's solid dots do", () => {
    const dot = '<circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>';
    expect(validateSvg(syntheticSvg({}, dot), outlineFile, "outline")).toEqual([]);
    expect(
      validateSvg(syntheticSvg({}, dot.replace("currentColor", "red")), outlineFile, "outline"),
    ).toEqual([expect.objectContaining({ code: "QXI-SVG-006" })]);
  });

  it("checks sharp sources against the sharp caps, joins, and miter limit", () => {
    const sharp = sharpAttributes;
    const file = "icons/sharp-outline/arrows/fixture.svg";
    expect(validateSvg(syntheticSvg(sharp), file, "outline", "sharp")).toEqual([]);
    expect(
      validateSvg(
        syntheticSvg({ ...sharp, "stroke-miterlimit": undefined }),
        file,
        "outline",
        "sharp",
      ),
    ).toEqual([expect.objectContaining({ code: "QXI-SVG-007" })]);
    const otherLimit = String(iconSystem.design.sharp.miterLimit + 1);
    expect(
      validateSvg(
        syntheticSvg({ ...sharp, "stroke-miterlimit": otherLimit }),
        file,
        "outline",
        "sharp",
      ),
    ).toEqual([expect.objectContaining({ code: "QXI-SVG-007" })]);
    expect(validateSvg(syntheticSvg(), file, "outline", "sharp")).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "QXI-SVG-007" })]),
    );
    // Round sources never carry a miter limit.
    expect(validateSvg(syntheticSvg({ "stroke-miterlimit": "2" }), outlineFile, "outline")).toEqual(
      [expect.objectContaining({ code: "QXI-SVG-005" })],
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
    // Lucide names are taken verbatim, including numeric and modifier suffixes.
    "clock-12.svg",
    "book-copy.svg",
    "type-outline.svg",
    "search-2.svg",
    "search-icon.svg",
    "star-filled.svg",
  ])("accepts name %s", (filename) => {
    expect(validateIconName(filename)).toEqual([]);
    expect(iconExportName(filename.slice(0, -4))).toMatch(/^[A-Z][A-Za-z0-9]*Icon$/);
    expect(componentNameFromFilename(filename)).toBe(iconExportName(filename.slice(0, -4)));
  });

  it.each([
    "Search.svg",
    "search_icon.svg",
    "searchIcon.svg",
    "search copy.svg",
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
    expect(() => componentNameFromFilename(filename)).toThrow("QXI-NAME-001");
  });

  it("computes export identities without a category prefix", () => {
    expect(iconExportName("file-text")).toBe("FileTextIcon");
    expect(iconExportName("map")).toBe("MapIcon");
    expect(iconExportName("file-3d")).toBe(iconExportName("file3d"));
  });

  it("derives one component name per concept, never from variant or category", () => {
    expect(componentNameFromFilename("star.svg")).toBe("StarIcon");
    expect(componentNameFromFilename("shield-check.svg")).toBe("ShieldCheckIcon");
    for (const variant of iconSystem.architecture.variants) {
      const location = validateSourcePath(`icons/round-${variant}/shapes/star.svg`).location;
      expect(location?.variant).toBe(variant);
      expect(componentNameFromFilename(`${location?.name}.svg`)).toBe("StarIcon");
    }
    expect(componentNameFromFilename("star.svg")).not.toMatch(/Outline|Filled|Solid|Status/);
  });
});

describe("authored metadata", () => {
  const star = { file: outlineFile, source: syntheticSvg() };
  const filledStar = {
    file: "icons/round-filled/arrows/fixture.svg",
    source: syntheticSvg({ fill: "currentColor" }),
  };

  it("accepts overrides for existing names, covering every variant of the name", () => {
    expect(
      validateSources([star, filledStar], { fixture: { directionality: "mirror" } }).diagnostics,
    ).toEqual([]);
  });

  it("rejects metadata for a name with no source", () => {
    expect(
      validateSources([star], { "fixture-renamed": { directionality: "mirror" } }).diagnostics,
    ).toEqual([
      expect.objectContaining({
        code: "QXI-META-001",
        file: "config/icon-metadata.ts",
        message: expect.stringContaining('"fixture-renamed"'),
      }),
    ]);
  });

  it("rejects unsupported directionality values", () => {
    const metadata = JSON.parse('{ "fixture": { "directionality": "auto" } }');
    expect(validateSources([star], metadata).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-META-002", file: "config/icon-metadata.ts" }),
    ]);
  });

  it("accepts metadata without directionality", () => {
    expect(
      validateSources([star], { fixture: { categories: ["arrows", "navigation"], tags: ["x"] } })
        .diagnostics,
    ).toEqual([]);
  });

  it("requires metadata categories to be configured, with the source folder first", () => {
    expect(
      validateSources([star], { fixture: { categories: ["navigation", "arrows"] } }).diagnostics,
    ).toEqual([expect.objectContaining({ code: "QXI-META-003", file: outlineFile })]);
    expect(
      validateSources([star], { fixture: { categories: ["arrows", "nowhere"] } }).diagnostics,
    ).toEqual([expect.objectContaining({ code: "QXI-META-003", file: "config/icon-metadata.ts" })]);
    expect(validateSources([star], { fixture: { categories: [] } }).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-META-003" }),
    ]);
  });

  it("does not treat inherited object properties as metadata", () => {
    const constructorIcon = {
      file: "icons/round-outline/arrows/constructor.svg",
      source: syntheticSvg(),
    };
    expect(validateSources([constructorIcon], {}).diagnostics).toEqual([]);
  });
});

describe("source paths", () => {
  it("accepts every configured category, style, and variant", () => {
    for (const { id } of categories) {
      for (const style of iconSystem.architecture.styles) {
        for (const variant of iconSystem.architecture.variants) {
          const file = `icons/${style}-${variant}/${id}/fixture.svg`;
          expect(validateSourcePath(file)).toEqual({
            location: { file, name: "fixture", category: id, style, variant },
            diagnostics: [],
          });
        }
      }
    }
  });

  it.each([
    "icons/search.svg",
    "icons/random/search.svg",
    "icons/round-outline/search.svg",
    "icons/round-outline/arrows/nested/search.svg",
    "/icons/round-outline/arrows/search.svg",
    "icons/round-outline/../search.svg",
    "icons/round-outline//search.svg",
    "icons\\outline\\actions\\search.svg",
  ])("rejects misplaced path %s", (file) => {
    expect(validateSourcePath(file).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-PATH-001", file }),
    ]);
  });

  it.each(["crypto", "seasonal", "actions", "status", "identity", "Arrows"])(
    "rejects unconfigured category %s",
    (category) => {
      expect(validateSourcePath(`icons/round-outline/${category}/fixture.svg`).diagnostics).toEqual(
        [expect.objectContaining({ code: "QXI-PATH-002" })],
      );
    },
  );

  it.each([
    "outline",
    "filled",
    "round",
    "round-solid",
    "sharp-solid",
    "outline-round",
    "thin",
    "bold",
    "duotone",
  ])("rejects unsupported source folder %s", (folder) => {
    expect(validateSourcePath(`icons/${folder}/arrows/fixture.svg`).diagnostics).toEqual([
      expect.objectContaining({ code: "QXI-PATH-003" }),
    ]);
  });

  it("retains invalid-case names so repository checks can report collisions", () => {
    const result = validateSourcePath("icons/round-outline/arrows/Fixture.svg");
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
