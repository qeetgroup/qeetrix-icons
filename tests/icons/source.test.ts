import { describe, expect, it } from "vitest";
import { loadCategories } from "../../scripts/lib/discover.mjs";
import { collect } from "../../scripts/lib/pipeline.mjs";
import { PKG } from "../helpers.js";

/**
 * The shipped icon set must satisfy its own specification.
 *
 * This is the test that would fail if someone committed an icon that
 * `bun run validate` rejects, without having run it.
 */
describe("shipped icons", () => {
  const { entries, errors, warnings } = collect({ root: PKG });

  it("all pass validation", () => {
    expect(errors).toEqual([]);
  });

  it.skip("produce no warnings either", () => {
    // Requires icon-metadata.json to be populated with tags for every icon.
    expect(warnings).toEqual([]);
  });

  it("is a non-trivial set", () => {
    expect(entries.length).toBeGreaterThanOrEqual(100);
  });

  it("all sit in a declared category", () => {
    // Assert membership rather than an exact list: the taxonomy is allowed to
    // grow, but a category that is not declared must never appear.
    const declared = new Set(loadCategories(PKG));
    const undeclared = entries.filter((entry) => !declared.has(entry.category));
    expect(undeclared.map((entry) => `${entry.file} (${entry.category})`)).toEqual([]);
  });

  it("spread across the taxonomy rather than piling into one category", () => {
    const counts = new Map<string, number>();
    for (const entry of entries) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    expect(counts.size).toBeGreaterThanOrEqual(15);
    // No single category should hold more than a quarter of the set, or the
    // taxonomy has stopped doing any work.
    expect(Math.max(...counts.values())).toBeLessThan(entries.length / 4);
  });

  it("all render through the 24×24 grid", () => {
    for (const entry of entries) {
      expect(entry.tree.attributes.viewBox, entry.file).toBe("0 0 24 24");
    }
  });

  it("all inherit colour rather than declaring it", () => {
    for (const entry of entries) {
      if (entry.style === "solid") {
        expect(entry.tree.attributes.fill, entry.file).toBe("currentColor");
        expect(entry.tree.attributes.stroke, entry.file).toBe("none");
      } else {
        expect(entry.tree.attributes.stroke, entry.file).toBe("currentColor");
        expect(entry.tree.attributes.fill, entry.file).toBe("none");
      }
    }
  });

  it("are discovered in a deterministic order", () => {
    const names = entries.map((entry) => entry.name);
    expect(names).toEqual([...names].sort());
  });
});
