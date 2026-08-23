import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { icons } from "../../src/metadata.js";
import { PKG } from "../helpers.js";

const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
const built = existsSync(join(PKG, "dist/index.js"));

/**
 * These assert the shape of the published package. They need `bun run build` to
 * have run, so they skip rather than fail when `dist/` is absent — `bun run
 * build` precedes `bun run test` in CI, where they always execute.
 */
describe.skipIf(!built)("built package", () => {
  /** Every concrete file an `exports` entry points at. */
  const targets = () => {
    const out: string[] = [];
    for (const entry of Object.values<unknown>(pkg.exports)) {
      if (typeof entry === "string") {
        out.push(entry);
        continue;
      }
      for (const path of Object.values(entry as Record<string, string>)) out.push(path);
    }
    return [...new Set(out)];
  };

  it("resolves every non-wildcard exports target on disk", () => {
    const missing = targets()
      .filter((path) => !path.includes("*"))
      .filter((path) => !existsSync(join(PKG, path)));
    expect(missing).toEqual([]);
  });

  it("emits a component and a declaration for every icon", () => {
    const missing: string[] = [];
    for (const icon of icons) {
      for (const ext of [".js", ".d.ts"]) {
        const path = `dist/icons/${icon.name}${ext}`;
        if (!existsSync(join(PKG, path))) missing.push(path);
      }
    }
    expect(missing).toEqual([]);
  });

  it("ships the metadata subpath so a picker can avoid loading components", () => {
    expect(existsSync(join(PKG, "dist/metadata.js"))).toBe(true);
    expect(existsSync(join(PKG, "dist/metadata.d.ts"))).toBe(true);
  });

  it("emits ESM, not CommonJS", () => {
    const built = readFileSync(join(PKG, "dist/index.js"), "utf8");
    expect(built).toContain("export");
    expect(built).not.toContain("require(");
    expect(built).not.toContain("module.exports");
  });

  it("leaves react as an external import rather than bundling it", () => {
    const component = readFileSync(join(PKG, "dist/icons/arrow-left.js"), "utf8");
    expect(component).toContain('from "react/jsx-runtime"');
  });

  it("keeps one module per icon, so unused icons can be dropped", () => {
    const barrel = readFileSync(join(PKG, "dist/icons/index.js"), "utf8");
    for (const icon of icons) {
      expect(barrel, icon.name).toContain(`./${icon.name}.js`);
    }
  });
});

describe("package manifest", () => {
  it("is published under the expected name and scope", () => {
    expect(pkg.name).toBe("@qeetrix/icons");
    expect(pkg.publishConfig.access).toBe("public");
  });

  it("ships only dist/", () => {
    expect(pkg.files).toEqual(["dist"]);
  });

  it("declares itself side-effect free so bundlers can tree-shake it", () => {
    expect(pkg.sideEffects).toBe(false);
  });

  it("has no runtime dependencies", () => {
    expect(pkg.dependencies).toBeUndefined();
  });

  it("takes react as a peer rather than bundling a copy", () => {
    expect(pkg.peerDependencies).toEqual({ react: ">=19" });
  });

  it("exposes no internal paths", () => {
    for (const key of Object.keys(pkg.exports)) {
      expect(key).not.toContain("dist");
      expect(key).not.toContain("src");
      expect(key).not.toContain("packages");
    }
  });

  it("points every exports entry at dist/, never at source", () => {
    const flat = JSON.stringify(pkg.exports);
    expect(flat).not.toContain("./src/");
  });

  it("pins bun as the package manager, matching the rest of the workspace", () => {
    expect(pkg.packageManager).toMatch(/^bun@/);
  });
});
