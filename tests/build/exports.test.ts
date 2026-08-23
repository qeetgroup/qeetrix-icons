import { describe, expect, it } from "vitest";
import * as pkg from "../../src/index.js";
import { icons } from "../../src/metadata.js";

describe("public exports", () => {
  it("exports a component for every icon in the metadata", () => {
    const missing = icons.filter((icon) => !(icon.component in pkg));
    expect(missing.map((icon) => icon.component)).toEqual([]);
  });

  it("exports nothing beyond the icons and the declared support surface", () => {
    // Guards against an icon leaking in without metadata, and against the
    // support surface growing silently.
    const support = new Set([
      "IconBase",
      "ICON_VIEW_BOX",
      "ICON_DEFAULT_SIZE",
      "ICON_DEFAULT_STROKE_WIDTH",
    ]);
    const components = new Set(icons.map((icon) => icon.component));
    const unexpected = Object.keys(pkg).filter(
      (name) => !support.has(name) && !components.has(name),
    );
    expect(unexpected).toEqual([]);
  });

  it("exports exactly as many components as there are icons", () => {
    const componentExports = Object.entries(pkg).filter(
      ([name, value]) => typeof value === "function" && /^[A-Z]/.test(name) && name !== "IconBase",
    );
    expect(componentExports).toHaveLength(icons.length);
  });

  it("exports every icon as a function component", () => {
    for (const icon of icons) {
      // Introspecting the barrel dynamically is this test's entire purpose: it
      // verifies every icon in the metadata is reachable as a real export. The
      // rule guards bundle size in application code, which this is not.
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: see above.
      const component = pkg[icon.component as keyof typeof pkg];
      expect(typeof component, icon.component).toBe("function");
    }
  });

  it("exports the shared shell and its spec constants", () => {
    expect(typeof pkg.IconBase).toBe("function");
    expect(pkg.ICON_VIEW_BOX).toBe("0 0 24 24");
    expect(pkg.ICON_DEFAULT_SIZE).toBe(24);
    expect(pkg.ICON_DEFAULT_STROKE_WIDTH).toBe(2);
  });

  it("does not re-export the metadata catalogue from the root", () => {
    // Metadata lives behind `@qeetrix/icons/metadata` so that importing one
    // icon never drags the whole catalogue into the bundle.
    expect("icons" in pkg).toBe(false);
    expect("iconNames" in pkg).toBe(false);
  });
});
