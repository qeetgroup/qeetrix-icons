import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collect } from "../../scripts/lib/pipeline.mjs";
import { iconNames, icons } from "../../src/metadata.js";
import { PKG } from "../helpers.js";

const { entries } = collect({ root: PKG });
const registry = JSON.parse(readFileSync(join(PKG, "icon-metadata.json"), "utf8"));

describe("generated metadata", () => {
  it("has one record per source icon", () => {
    expect(icons).toHaveLength(entries.length);
  });

  it("covers every source icon exactly once", () => {
    expect(icons.map((icon) => icon.name)).toEqual(entries.map((entry) => entry.name));
  });

  it("is sorted by name, so diffs stay minimal as the set grows", () => {
    const names = icons.map((icon) => icon.name);
    expect(names).toEqual([...names].sort());
  });

  it("keeps iconNames in step with icons", () => {
    expect([...iconNames]).toEqual(icons.map((icon) => icon.name));
  });

  it("derives category from the directory rather than the registry", () => {
    // The registry has no `category` key at all — proving categories cannot
    // drift out of step with the filesystem.
    for (const [key, value] of Object.entries<Record<string, unknown>>(registry)) {
      if (key.startsWith("$")) continue;
      expect(Object.keys(value), key).not.toContain("category");
    }
    for (const entry of entries) {
      const record = icons.find((icon) => icon.name === entry.name);
      expect(record?.category, entry.name).toBe(entry.category);
    }
  });

  it("gives every record a complete shape", () => {
    for (const icon of icons) {
      expect(typeof icon.name, icon.name).toBe("string");
      expect(typeof icon.component, icon.name).toBe("string");
      expect(typeof icon.category, icon.name).toBe("string");
      expect(Array.isArray(icon.tags), icon.name).toBe(true);
      expect(Array.isArray(icon.aliases), icon.name).toBe(true);
      expect(typeof icon.mirror, icon.name).toBe("boolean");
    }
  });

  it("tags every shipped icon, so search finds all of them", () => {
    const untagged = icons.filter((icon) => icon.tags.length === 0);
    expect(untagged.map((icon) => icon.name)).toEqual([]);
  });

  it("never repeats the icon name as one of its own tags or aliases", () => {
    for (const icon of icons) {
      expect(icon.tags, icon.name).not.toContain(icon.name);
      expect(icon.aliases, icon.name).not.toContain(icon.name);
    }
  });

  it("never repeats an alias as a tag", () => {
    // Search covers name, tags and aliases, so restating an alias as a tag is
    // duplicated maintenance with no benefit.
    for (const icon of icons) {
      expect(
        icon.aliases.filter((a) => icon.tags.includes(a)),
        icon.name,
      ).toEqual([]);
    }
  });

  it("has no alias that collides with a real icon name", () => {
    const names = new Set(icons.map((icon) => icon.name));
    const colliding = icons.flatMap((icon) =>
      icon.aliases.filter((a) => names.has(a)).map((a) => `${icon.name} → ${a}`),
    );
    expect(colliding).toEqual([]);
  });

  it("has no alias claimed by two different icons", () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const icon of icons) {
      for (const alias of icon.aliases) {
        const held = owner.get(alias);
        if (held) clashes.push(`"${alias}" claimed by ${held} and ${icon.name}`);
        else owner.set(alias, icon.name);
      }
    }
    expect(clashes).toEqual([]);
  });

  const mirrorOf = (name: string) => icons.find((icon) => icon.name === name)?.mirror;

  it("mirrors horizontally-directional icons", () => {
    for (const name of [
      "arrow-left",
      "arrow-right",
      "arrow-up-right",
      "arrow-down-left",
      "chevron-left",
      "chevron-right",
      "chevrons-left",
      "chevrons-right",
      "log-in",
      "log-out",
      "reply",
      "undo",
      "redo",
      "external-link",
    ]) {
      expect(mirrorOf(name), name).toBe(true);
    }
  });

  it("does not mirror vertical direction, which RTL does not flip", () => {
    for (const name of ["arrow-up", "arrow-down", "chevron-up", "chevron-down"]) {
      expect(mirrorOf(name), name).toBe(false);
    }
  });

  it("does not mirror symmetric glyphs, where flipping is a no-op", () => {
    for (const name of ["arrow-left-right", "arrow-up-down", "maximize", "minimize"]) {
      expect(mirrorOf(name), name).toBe(false);
    }
  });

  it("does not mirror media transport controls", () => {
    // Playback direction is not reading direction: `skip-forward` points right
    // in every locale. This is the one place a directional name is not mirrored.
    for (const name of ["play", "skip-forward", "skip-back", "pause"]) {
      expect(mirrorOf(name), name).toBe(false);
    }
  });

  it("does not mirror containers with no directional meaning", () => {
    for (const name of ["file", "folder", "calendar", "lock", "shield", "user", "settings"]) {
      expect(mirrorOf(name), name).toBe(false);
    }
  });

  it("keeps mirroring a minority of the set", () => {
    // If most icons were marked mirrorable the flag would carry no information.
    const mirrored = icons.filter((icon) => icon.mirror);
    expect(mirrored.length).toBeGreaterThan(10);
    expect(mirrored.length).toBeLessThan(icons.length / 3);
  });
});

describe("search behaviour the metadata is for", () => {
  const find = (query: string) =>
    icons
      .filter(
        (icon) =>
          icon.name.includes(query) ||
          icon.tags.some((tag) => tag.includes(query)) ||
          icon.aliases.some((alias) => alias.includes(query)),
      )
      .map((icon) => icon.name);

  it.each([
    ["gear", "settings"],
    ["hamburger", "menu"],
    ["notification", "bell"],
    ["padlock", "lock"],
    ["close", "x"],
    ["person", "user"],
    ["magnifying-glass", "search"],
    ["verified", "shield-check"],
  ])("resolves the alias %s to %s", (query, expected) => {
    expect(find(query)).toContain(expected);
  });

  it("finds an icon by a tag that is not in its name", () => {
    expect(find("previous")).toContain("arrow-left");
    expect(find("tick")).toContain("check");
  });
});
