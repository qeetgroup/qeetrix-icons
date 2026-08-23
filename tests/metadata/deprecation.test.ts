import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateSet } from "../../scripts/lib/rules.mjs";
import { icons } from "../../src/metadata.js";
import { PKG } from "../helpers.js";

/**
 * The deprecation mechanism.
 *
 * No icon is deprecated today, so most of this exercises the machinery against
 * synthetic input. That is the point: the first real deprecation will happen
 * under time pressure, and the shape of it needs to already be enforced.
 */

const icon = (name: string, category = "interface") => ({
  name,
  category,
  file: `icons/${category}/${name}.svg`,
});
const base = { tags: ["thing"], aliases: [], mirror: false, priority: "P1" };
type Authored = Record<
  string,
  {
    tags?: string[];
    aliases?: string[];
    mirror?: boolean;
    priority?: string;
    deprecated?: { since: unknown; replacement: unknown; reason: unknown };
  }
>;

const errorsFor = (metadata: Authored) =>
  validateSet([icon("old-thing"), icon("new-thing")], metadata)
    .errors.filter((e: { rule: string }) => e.rule === "deprecation")
    .map((e: { message: string }) => e.message);

describe("the shipped catalogue", () => {
  it("has nothing deprecated yet", () => {
    expect(icons.filter((i) => i.deprecated)).toEqual([]);
  });

  it("omits the key entirely rather than emitting a null", () => {
    // So `if (icon.deprecated)` is the whole check on the consumer side.
    const generated = readFileSync(join(PKG, "src/metadata.ts"), "utf8");
    expect(generated).not.toContain("deprecated:");
  });

  it("exports the type consumers need to narrow with", () => {
    const types = readFileSync(join(PKG, "src/types.ts"), "utf8");
    expect(types).toContain("export interface IconDeprecation");
    expect(types).toContain("deprecated?: IconDeprecation");
    const barrel = readFileSync(join(PKG, "src/index.ts"), "utf8");
    expect(barrel).toContain("IconDeprecation");
  });
});

describe("validation", () => {
  it("accepts a well-formed deprecation", () => {
    expect(
      errorsFor({
        "old-thing": {
          ...base,
          deprecated: { since: "0.2.0", replacement: "new-thing", reason: "Renamed." },
        },
        "new-thing": base,
      }),
    ).toEqual([]);
  });

  it("accepts a null replacement, for a concept that simply went away", () => {
    expect(
      errorsFor({
        "old-thing": {
          ...base,
          deprecated: { since: "1.0.0", replacement: null, reason: "The feature was removed." },
        },
        "new-thing": base,
      }),
    ).toEqual([]);
  });

  it("rejects a replacement that is not an icon", () => {
    const errors = errorsFor({
      "old-thing": {
        ...base,
        deprecated: { since: "0.2.0", replacement: "does-not-exist", reason: "Renamed." },
      },
      "new-thing": base,
    });
    expect(errors.join(" ")).toContain("does-not-exist");
    expect(errors.join(" ")).toContain("use null if there is none");
  });

  it("rejects an icon that names itself as its replacement", () => {
    const errors = errorsFor({
      "old-thing": {
        ...base,
        deprecated: { since: "0.2.0", replacement: "old-thing", reason: "Loop." },
      },
      "new-thing": base,
    });
    expect(errors.join(" ")).toContain("names itself");
  });

  it("requires a semver since", () => {
    for (const since of ["soon", "v2", "", "0.2"]) {
      const errors = errorsFor({
        "old-thing": { ...base, deprecated: { since, replacement: null, reason: "Because." } },
        "new-thing": base,
      });
      expect(errors.join(" "), JSON.stringify(since)).toContain("semver");
    }
  });

  it("requires a reason a developer can act on", () => {
    for (const reason of ["", "   "]) {
      const errors = errorsFor({
        "old-thing": { ...base, deprecated: { since: "0.2.0", replacement: null, reason } },
        "new-thing": base,
      });
      expect(errors.join(" ")).toContain('needs a non-empty "reason"');
    }
  });
});

describe("policy documentation", () => {
  it("documents the mechanism and when not to reach for it", () => {
    const releases = readFileSync(join(PKG, "docs/releases.md"), "utf8");
    expect(releases).toContain("## Deprecation");
    expect(releases).toContain("never deleted in a minor release");
    // The table that steers people to an alias instead.
    expect(releases).toContain("Add an **alias**");
    expect(releases).toContain("in a major release");
    expect(releases).toContain("shipped as\ndeprecated in at least one release");
  });

  it("tells consumers how to filter deprecated icons out of a picker", () => {
    const usage = readFileSync(join(PKG, "docs/usage.md"), "utf8");
    expect(usage).toContain("!icon.deprecated");
  });
});
