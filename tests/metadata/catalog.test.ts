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
    expect(entries.length).toBeGreaterThanOrEqual(300);
  });

  it("is weighted towards icons products actually reach for", () => {
    const essential = entries.filter((e) =>
      ["P0", "P1"].includes(metadata[e.name]?.priority as string),
    );
    // A catalogue that is mostly P2/P3 has grown by accretion, not by coverage.
    expect(essential.length / entries.length).toBeGreaterThan(0.8);
  });

  it("gives every icon a priority, so none is missing from the coverage matrix", () => {
    const missing = entries.filter((e) => metadata[e.name]?.priority === undefined);
    expect(missing.map((e) => e.name)).toEqual([]);
  });

  it("uses only the declared priority levels", () => {
    const bad = entries.filter(
      (e) => !["P0", "P1", "P2", "P3"].includes(metadata[e.name]?.priority as string),
    );
    expect(bad.map((e) => e.name)).toEqual([]);
  });
});

describe("naming governance", () => {
  // The canonical form is <noun>-<modifier>. A leading verb is the mistake this
  // guards against: `add-user` rather than `user-plus`.
  it.each(["add", "remove", "delete", "new", "create", "open", "close", "show"])(
    "no icon name leads with the verb %s",
    (verb) => {
      const bad = [...names].filter((n) => n.startsWith(`${verb}-`));
      expect(bad).toEqual([]);
    },
  );

  it("uses one canonical modifier per meaning", () => {
    // `-plus` not `-add`, `-minus` not `-remove`, `-x` not `-delete`.
    const banned = ["add", "remove", "delete"];
    const bad = [...names].filter((n) => n.split("-").some((part) => banned.includes(part)));
    expect(bad).toEqual([]);
  });

  it("never repeats the category in the icon name", () => {
    const bad = entries.filter((e) => e.name.startsWith(`${e.category}-`));
    expect(bad.map((e) => e.name)).toEqual([]);
  });

  it("keeps every component name the mechanical PascalCase of its filename", () => {
    const drift = entries.filter((e) => toComponentName(e.name) !== e.component);
    expect(drift.map((e) => e.name)).toEqual([]);
  });

  it("has no name longer than four words, which would be unusable", () => {
    const long = [...names].filter((n) => n.split("-").length > 4);
    expect(long).toEqual([]);
  });
});

describe("families", () => {
  // Every `<base>-<modifier>` must have its base, or the modifier vocabulary
  // stops being learnable — a consumer who finds `card-plus` looks for `card`.
  const MODIFIERS = ["plus", "minus", "check", "x", "lock", "search", "edit", "off", "open"];

  it("every modifier variant has a base icon", () => {
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
    for (const base of ["user", "file", "folder", "calendar", "mail", "shield", "credit-card"]) {
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

  it("finds no naming or orphan-variant problems in the shipped set", () => {
    const result = spawnSync("node", ["scripts/doctor.mjs"], { cwd: PKG, encoding: "utf8" });
    // Family gaps are recorded decisions and stay advisory; these two are not.
    expect(result.stdout).not.toContain("naming (");
    expect(result.stdout).not.toContain("orphan-variant (");
    expect(result.stdout).not.toContain("component-drift (");
    expect(result.stdout).not.toContain("empty-category (");
  });
});
