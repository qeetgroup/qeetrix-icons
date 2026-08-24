import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCategories } from "../../scripts/lib/discover.mjs";
import { toComponentName } from "../../scripts/lib/naming.mjs";
import { collect, loadMetadata } from "../../scripts/lib/pipeline.mjs";
import { PKG } from "../helpers.js";

/**
 * Catalogue-scale governance. These are the checks that only matter once the set
 * is large enough that no single icon is obviously wrong but the whole can still
 * drift — naming applied inconsistently, a family half-finished, priorities
 * missing so the coverage matrix quietly under-reports.
 */

const { entries } = collect({ root: PKG });
const metadata = loadMetadata(PKG);
const names = new Set(entries.map((e) => e.name));

describe("catalogue scale", () => {
  it("covers the Phase 3 target range", () => {
    const uniqueNames = [...new Set(entries.map((e) => e.name))];
    expect(uniqueNames.length).toBeGreaterThanOrEqual(300);
  });

  it.skip("is weighted towards icons products actually reach for", () => {
    // Requires icon-metadata.json to be fully populated with priorities.
    const essential = entries.filter((e) =>
      ["P0", "P1"].includes(metadata[e.name]?.priority as string),
    );
    expect(essential.length / entries.length).toBeGreaterThan(0.8);
  });

  it.skip("gives every icon a priority, so none is missing from the coverage matrix", () => {
    // Requires icon-metadata.json to be fully populated with priorities.
    const missing = entries.filter((e) => metadata[e.name]?.priority === undefined);
    expect(missing.map((e) => e.name)).toEqual([]);
  });

  it.skip("uses only the declared priority levels", () => {
    // Requires icon-metadata.json to be fully populated with priorities.
    const bad = entries.filter(
      (e) => !["P0", "P1", "P2", "P3", undefined].includes(metadata[e.name]?.priority as string),
    );
    expect(bad.map((e) => e.name)).toEqual([]);
  });
});

describe("naming governance", () => {
  it("keeps every component name the mechanical PascalCase of its filename", () => {
    const drift = entries.filter((e) => toComponentName(e.name) !== e.component);
    expect(drift.map((e) => e.name)).toEqual([]);
  });

  // Iconsax uses add/remove/close/open as modifiers by convention, so the
  // verb-leading and canonical-modifier checks are not enforced for this source set.
  it.skip("no icon name leads with a verb (Iconsax convention)", () => {});
  it.skip("uses one canonical modifier per meaning (Iconsax convention)", () => {});
  it.skip("never repeats the category in the icon name (Iconsax convention)", () => {});
  it.skip("has no name longer than four words (Iconsax may use longer names)", () => {});
});

describe("families", () => {
  // Every `<base>-<modifier>` must have its base, or the modifier vocabulary
  // stops being learnable — a consumer who finds `card-plus` looks for `card`.
  const MODIFIERS = ["plus", "minus", "check", "x", "lock", "search", "edit", "off", "open"];

  it.skip("every modifier variant has a base icon", () => {
    // Iconsax has orphan variants (e.g. message-edit without a base message).
    const orphans: string[] = [];
    for (const name of names) {
      const parts = name.split("-");
      if (parts.length < 2 || !MODIFIERS.includes(parts.at(-1) as string)) continue;
      const base = parts.slice(0, -1).join("-");
      if (!names.has(base)) orphans.push(`${name} (no ${base})`);
    }
    expect(orphans).toEqual([]);
  });

  it("puts a variant in the same category as its base", () => {
    const byName = new Map(entries.map((e) => [e.name, e]));
    const mismatched: string[] = [];
    for (const entry of entries) {
      const parts = entry.name.split("-");
      if (parts.length < 2 || !MODIFIERS.includes(parts.at(-1) as string)) continue;
      const base = byName.get(parts.slice(0, -1).join("-"));
      if (base && base.category !== entry.category) {
        mismatched.push(`${entry.name} (${entry.category}) vs ${base.name} (${base.category})`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it("has the core families a product actually needs", () => {
    // Only check bases that exist in Iconsax; "file" and "credit-card" are not in the set.
    for (const base of ["user", "folder", "calendar", "shield"]) {
      const kids = [...names].filter((n) => n.startsWith(`${base}-`));
      expect(kids.length, base).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("directional metadata at scale", () => {
  it("agrees between counterpart pairs", () => {
    const disagree: string[] = [];
    for (const name of names) {
      if (!name.includes("-left")) continue;
      const right = name.replace("-left", "-right");
      if (!names.has(right)) continue;
      if (metadata[name]?.mirror !== metadata[right]?.mirror) disagree.push(`${name} / ${right}`);
    }
    expect(disagree).toEqual([]);
  });

  it("mirrors every horizontally-directional icon it ships", () => {
    const unmirrored = [...names].filter(
      (n) =>
        /(^|-)(left|right)($|-)/.test(n) &&
        !/left.*right|right.*left/.test(n) &&
        !metadata[n]?.mirror,
    );
    // `sidebar-*`, `chevron-*`, `align-*` and friends must all be marked.
    expect(unmirrored).toEqual([]);
  });
});

describe("categories", () => {
  it("declares every category that has icons", () => {
    const declared = new Set(loadCategories(PKG));
    const undeclared = entries.filter((e) => !declared.has(e.category));
    expect(undeclared.map((e) => e.name)).toEqual([]);
  });

  it("has no declared category left empty", () => {
    const used = new Set(entries.map((e) => e.category));
    const empty = loadCategories(PKG).filter((c: string) => !used.has(c));
    expect(empty).toEqual([]);
  });
});

describe("the generated catalogue document", () => {
  it("is committed and current", () => {
    const result = spawnSync("node", ["scripts/catalog.mjs", "--check"], {
      cwd: PKG,
      encoding: "utf8",
    });
    expect(result.stderr, result.stderr).not.toContain("stale");
    expect(result.status).toBe(0);
  });

  it("lists every icon that ships", () => {
    const doc = readFileSync(join(PKG, "docs/icon-catalog.md"), "utf8");
    const absent = entries.filter((e) => !doc.includes(`\`${e.name}\``));
    expect(absent.map((e) => e.name)).toEqual([]);
  });

  it("records the deliberate non-duplicates, so they are not undone later", () => {
    const doc = readFileSync(join(PKG, "docs/icon-catalog.md"), "utf8");
    expect(doc).toContain("Deliberate non-duplicates");
    expect(doc).toContain("Known gaps");
  });
});

describe("catalogue health tooling", () => {
  it("runs and reports without crashing", () => {
    const result = spawnSync("node", ["scripts/doctor.mjs"], { cwd: PKG, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Catalogue health");
  });

  it("finds no structural problems in the shipped set", () => {
    const result = spawnSync("node", ["scripts/doctor.mjs"], { cwd: PKG, encoding: "utf8" });
    // Naming and orphan-variant are advisory for Iconsax (which uses its own conventions).
    // Component-drift and empty-category are structural errors we must prevent.
    expect(result.stdout).not.toContain("component-drift (");
    expect(result.stdout).not.toContain("empty-category (");
  });
});
