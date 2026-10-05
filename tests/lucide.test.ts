import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  type LucideData,
  lucideData,
  normalizeLucideSvg,
  outlineSourcePath,
  readLucideRelease,
  renderCategoriesModule,
} from "../scripts/lib/lucide.js";
import { writeFixture } from "./helpers.js";

const PKG = join(import.meta.dirname, "..");
const lucideSvg = `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676" />
  <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
</svg>
`;

describe("normalizeLucideSvg", () => {
  it("drops width and height, keeps paint and geometry, one element per line", () => {
    expect(normalizeLucideSvg(lucideSvg)).toBe(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
        '  <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676"/>',
        '  <circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
        "</svg>",
        "",
      ].join("\n"),
    );
  });

  it("is idempotent, and every synced outline is already in normal form", () => {
    expect(normalizeLucideSvg(normalizeLucideSvg(lucideSvg))).toBe(normalizeLucideSvg(lucideSvg));
    const root = join(PKG, "icons/round-outline");
    for (const category of readdirSync(root)) {
      for (const file of readdirSync(join(root, category))) {
        const source = readFileSync(join(root, category, file), "utf8");
        expect(normalizeLucideSvg(source), file).toBe(source);
      }
    }
    // Normalizes every round outline in the repository.
  }, 60_000);

  it("rejects nested elements rather than flattening them", () => {
    expect(() =>
      normalizeLucideSvg('<svg xmlns="http://www.w3.org/2000/svg"><g><path d="M1 1"/></g></svg>'),
    ).toThrow("nested <g>");
  });
});

describe("readLucideRelease", () => {
  const root = mkdtempSync(join(tmpdir(), "qeetrix-lucide-test-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const release = (files: Record<string, string>) => {
    const directory = mkdtempSync(join(root, "release-"));
    for (const [file, contents] of Object.entries(files)) writeFixture(directory, file, contents);
    return directory;
  };
  const base = {
    "categories/shapes.json": '{ "title": "Shapes", "icon": "circle" }',
    "categories/arrows.json": '{ "title": "Arrows", "icon": "arrow-up" }',
    "icons/arrow-up.svg": lucideSvg,
    "icons/arrow-up.json": '{ "categories": ["arrows", "shapes"], "tags": ["up"] }',
    "icons/trash.svg": lucideSvg,
    "icons/trash.json":
      '{ "categories": ["shapes"], "tags": [], "aliases": [{ "name": "trash-2", "deprecated": true }, "bin"] }',
    "icons/old.svg": lucideSvg,
    "icons/old.json": '{ "categories": ["shapes"], "deprecated": true }',
  };

  it("reads categories in id order, icons with aliases, and skips deprecated icons", () => {
    const result = readLucideRelease(release(base), "9.9.9");
    expect(result.version).toBe("9.9.9");
    expect(result.categories).toEqual([
      { id: "arrows", label: "Arrows" },
      { id: "shapes", label: "Shapes" },
    ]);
    expect(result.skipped).toEqual(["old"]);
    expect(
      result.icons.map(({ name, categories, tags, aliases }) => [name, categories, tags, aliases]),
    ).toEqual([
      ["arrow-up", ["arrows", "shapes"], ["up"], []],
      ["trash", ["shapes"], [], ["trash-2", "bin"]],
    ]);
    expect(outlineSourcePath(result.icons[0])).toBe("icons/round-outline/arrows/arrow-up.svg");
    expect(lucideData(result).icons.trash).toEqual({
      categories: ["shapes"],
      tags: [],
      aliases: ["trash-2", "bin"],
    });
  });

  it.each([
    ["no categories", '{ "categories": [] }', "lists no categories"],
    ["an unknown category", '{ "categories": ["nowhere"] }', "unknown nowhere"],
    ["malformed tags", '{ "categories": ["shapes"], "tags": "up" }', "tags must be"],
  ])("rejects an icon with %s", (_, meta, message) => {
    expect(() =>
      readLucideRelease(release({ ...base, "icons/arrow-up.json": meta }), "9.9.9"),
    ).toThrow(message);
  });
});

describe("committed Lucide data", () => {
  const data = JSON.parse(readFileSync(join(PKG, "config/lucide.json"), "utf8")) as LucideData;

  it("matches the generated categories module", () => {
    const file = join(mkdtempSync(join(tmpdir(), "qeetrix-categories-")), "categories.ts");
    writeFileSync(file, renderCategoriesModule(data));
    // Biome may reflow the generated module; compare the data, not the layout.
    const ids = (source: string) => [...source.matchAll(/id: "([^"]+)"/g)].map(([, id]) => id);
    const committed = readFileSync(join(PKG, "config/categories.ts"), "utf8");
    expect(ids(committed)).toEqual(ids(readFileSync(file, "utf8")));
    expect(committed).toContain(`from Lucide ${data.version}.`);
  });
});
