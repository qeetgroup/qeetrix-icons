import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Repository health for the Qeetrix Icons 2.0 reset.
 *
 * The 1.x catalogue has been removed and no 2.0 icons exist yet, so these checks
 * pin the reset state: the entry point loads, it exports nothing, and the legacy
 * catalogue has not crept back. Replace them as 2.0 icons land.
 */

const PKG = join(import.meta.dirname, "..");

describe("public entry point", () => {
  it("can be imported", async () => {
    const pkg = await import("../src/index.js");
    expect(pkg).toBeTypeOf("object");
  });

  it("exports nothing while 2.0 is being rebuilt", async () => {
    const pkg = await import("../src/index.js");
    expect(Object.keys(pkg)).toEqual([]);
  });
});

describe("package manifest", () => {
  const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
    exports: Record<string, unknown>;
    files: string[];
  };

  it("exposes only the root entry point and package.json", () => {
    // The 1.x `./icons/*` deep-import subpath pointed at the removed catalogue.
    expect(Object.keys(manifest.exports).sort()).toEqual([".", "./package.json"]);
  });

  it("publishes only dist", () => {
    expect(manifest.files).toEqual(["dist"]);
  });
});

describe("the 1.x catalogue stays removed", () => {
  it.each(["round-outline", "round-solid", "sharp-outline", "sharp-solid"])(
    "has no icons/%s directory",
    (dir) => {
      expect(existsSync(join(PKG, "icons", dir))).toBe(false);
    },
  );

  it("has no generated src/icons tree", () => {
    expect(existsSync(join(PKG, "src", "icons"))).toBe(false);
  });
});
