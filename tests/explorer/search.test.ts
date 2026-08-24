import { describe, expect, it } from "vitest";
import { filterIcons, RANK, rankIcons, scoreTerm } from "../../scripts/lib/search.mjs";
import { icons } from "../../src/metadata.js";

/**
 * The ranking contract.
 *
 * The explorer inlines this exact module, so these assertions describe what a
 * developer sees when they type. Ranking is a fixed tier list rather than a
 * relevance model precisely so it can be pinned like this — a query's answer
 * must not drift as the catalogue grows.
 */

const all = [...icons];
const names = (query: string) => rankIcons(all, query).map((i) => i.name);

describe("tier ordering", () => {
  it("puts an exact name first", () => {
    expect(names("shield")[0]).toBe("shield");
  });

  it("follows an exact name with its prefix matches", () => {
    const top = names("shield").slice(0, 7);
    expect(top[0]).toBe("shield");
    for (const name of top.slice(1)) expect(name.startsWith("shield")).toBe(true);
  });

  it("ranks an exact alias above a component prefix", () => {
    // `verified` is an alias of shield-tick and appears in no icon's name.
    expect(names("verified")[0]).toBe("shield-tick");
  });

  it("finds an icon through a tag alone", () => {
    // `find` is a tag on `search` and is not part of any icon name.
    expect(names("find")).toContain("search");
    expect(names("find")[0]).toBe("search");
  });

  it("finds an icon through an alias alone", () => {
    expect(names("delete")[0]).toBe("trash");
    expect(names("gear")[0]).toBe("settings");
    expect(names("hamburger")[0]).toBe("menu");
    expect(names("checkbox")[0]).toBe("tick-square");
  });

  it("matches a component name", () => {
    expect(names("ShieldTick")).toContain("shield-tick");
    expect(names("arrowleft")).toContain("arrow-left");
  });

  it("matches a category", () => {
    expect(names("security").length).toBeGreaterThan(5);
  });

  it("scores each tier in the documented order", () => {
    const icon = {
      name: "shield-check",
      component: "ShieldCheck",
      category: "security",
      tags: ["protected"],
      aliases: ["verified"],
    };
    expect(scoreTerm(icon, "shield-check")).toBe(RANK.NAME_EXACT);
    expect(scoreTerm(icon, "shield")).toBe(RANK.NAME_PREFIX);
    expect(scoreTerm(icon, "verified")).toBe(RANK.ALIAS_EXACT);
    expect(scoreTerm(icon, "shieldc")).toBe(RANK.COMPONENT_PREFIX);
    expect(scoreTerm(icon, "check")).toBe(RANK.NAME_SUBSTRING);
    expect(scoreTerm(icon, "protected")).toBe(RANK.TAG_EXACT);
    expect(scoreTerm(icon, "protect")).toBe(RANK.TAG_SUBSTRING);
    expect(scoreTerm(icon, "security")).toBe(RANK.CATEGORY_EXACT);
    expect(scoreTerm(icon, "nonsense")).toBe(0);
  });
});

describe("query behaviour", () => {
  it("treats multiple words as AND", () => {
    const result = names("shield tick");
    expect(result).toContain("shield-tick");
    // `shield` alone does not match the term `tick`, so it is excluded.
    expect(result).not.toContain("shield");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(names("  SHIELD-Tick ")[0]).toBe("shield-tick");
  });

  it("returns the whole catalogue, name-sorted, for an empty query", () => {
    const result = names("");
    expect(result).toHaveLength(icons.length);
    expect(result).toEqual([...result].sort());
  });

  it("returns nothing for a query that matches nothing", () => {
    expect(names("zzzzznotanicon")).toEqual([]);
  });

  it("is deterministic across repeated runs", () => {
    // Ties break by length then codepoint, so the order is total.
    const a = names("user");
    for (let i = 0; i < 5; i++) expect(names("user")).toEqual(a);
  });

  it("does not depend on input order", () => {
    const shuffled = [...all].reverse();
    expect(rankIcons(shuffled, "user").map((i) => i.name)).toEqual(names("user"));
  });

  it("orders ties by name length then alphabetically", () => {
    // All "arrow-ci" matches start with that prefix → same tier → sorted by length.
    const result = names("arrow-ci");
    expect(result.length).toBeGreaterThan(1);
    const lengths = result.map((n) => n.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
  });
});

describe("filters", () => {
  it("narrows by category", () => {
    const result = filterIcons({ icons: all, category: "security" });
    expect(result.length).toBeGreaterThan(5);
    expect(result.every((i) => i.category === "security")).toBe(true);
  });

  it("narrows by mirror", () => {
    const result = filterIcons({ icons: all, mirrorOnly: true });
    expect(result.length).toBeGreaterThan(10);
    expect(result.every((i) => i.mirror)).toBe(true);
  });

  it("composes filters with the query", () => {
    const result = filterIcons({ icons: all, query: "shield", category: "security" });
    expect(result[0].name).toBe("shield");
    expect(result.every((i) => i.category === "security")).toBe(true);
  });

  it("can exclude deprecated icons, for pickers that should not offer them", () => {
    const withDeprecated = [
      ...all,
      {
        name: "old-thing",
        component: "OldThing",
        category: "interface",
        tags: ["legacy"],
        aliases: [],
        mirror: false,
        deprecated: { since: "0.2.0", replacement: "square", reason: "Renamed." },
      },
    ];
    expect(filterIcons({ icons: withDeprecated, query: "old-thing" })).toHaveLength(1);
    expect(
      filterIcons({ icons: withDeprecated, query: "old-thing", includeDeprecated: false }),
    ).toHaveLength(0);
  });
});

describe("the searches a developer actually types", () => {
  it.each([
    ["shield", "shield"],
    ["user", "user"],
    ["arrow", "arrow-up"],
    ["trash", "trash"],
    ["bin", "trash"],
    ["close", "close-circle"],
    ["add", "add"],
    ["stop", "stop"],
    ["sign-out", "logout"],
    ["magnifying-glass", "search"],
    ["dark-mode", "moon"],
    ["notification", "bell"],
    ["padlock", "lock"],
    ["webauthn", "finger-scan"],
  ])("%s finds %s", (query, expected) => {
    expect(names(query)).toContain(expected);
  });
});
