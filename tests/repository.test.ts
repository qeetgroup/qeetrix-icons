import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import { categories } from "../config/categories.js";
import { iconSystem } from "../config/icon-system.js";
import type { IconDirectionality, IconVariant } from "../src/index.js";

const PKG = join(import.meta.dirname, "..");

describe("public entry point", () => {
  it("can be imported", async () => {
    const pkg = await import("../src/index.js");
    expect(pkg).toBeTypeOf("object");
  });

  it("exports no runtime values during foundational development", async () => {
    const pkg = await import("../src/index.js");
    expect(Object.keys(pkg)).toEqual([]);
  });

  it("exports only the foundational variant and directionality concepts", () => {
    expectTypeOf<IconVariant>().toEqualTypeOf<"outline" | "filled">();
    expectTypeOf<IconDirectionality>().toEqualTypeOf<"mirror" | "preserve">();
  });
});

describe("category taxonomy", () => {
  const categoryIds = categories.map((category) => category.id);

  it("has unique stable IDs", () => {
    expect(new Set(categoryIds).size).toBe(categoryIds.length);
  });

  it("uses the explicit enterprise taxonomy in canonical display order", () => {
    expect(categoryIds).toEqual([
      "actions",
      "navigation",
      "status",
      "identity",
      "security",
      "files",
      "communication",
      "data",
      "time",
      "devices",
      "development",
      "infrastructure",
      "finance",
      "commerce",
      "location",
      "media",
      "ai",
      "observability",
      "organization",
      "qeet",
    ]);
  });

  it("provides usable discovery metadata", () => {
    for (const category of categories) {
      expect(category.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(category.label.trim().length).toBeGreaterThan(0);
      expect(category.description.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("icon-system contract", () => {
  const { architecture, calibration } = iconSystem;

  it("uses an SVG master whose viewBox matches the canonical grid", () => {
    expect(architecture.sourceFormat).toBe("svg");
    expect(architecture.grid).toEqual({ width: 24, height: 24 });
    expect(architecture.viewBox.split(" ").map(Number)).toEqual([
      0,
      0,
      architecture.grid.width,
      architecture.grid.height,
    ]);
  });

  it("is outline-first with inherited color and the public variant vocabulary", () => {
    expect(architecture.color).toBe("currentColor");
    expect(architecture.defaultVariant).toBe("outline");
    expect(architecture.variants).toEqual(["outline", "filled"]);
    expect(architecture.variants).toContain(architecture.defaultVariant);
    expectTypeOf<(typeof architecture.variants)[number]>().toEqualTypeOf<IconVariant>();
  });

  it("is decorative and unfocusable by default", () => {
    expect(architecture.accessibility).toEqual({
      decorativeByDefault: true,
      focusable: false,
    });
  });

  it("recommends ordered, unique, positive UI sizes including the default", () => {
    const sizes = [...calibration.recommendedSizes];
    expect(new Set(sizes).size).toBe(sizes.length);
    expect(sizes).toEqual([...sizes].sort((left, right) => left - right));
    expect(sizes).toContain(calibration.defaultSize);
    for (const size of sizes) {
      expect(Number.isInteger(size)).toBe(true);
      expect(size).toBeGreaterThan(0);
    }
  });

  it("leaves usable painted space inside the candidate safe area", () => {
    expect(Number.isFinite(calibration.safeAreaInset)).toBe(true);
    expect(Number.isFinite(calibration.strokeWidth)).toBe(true);
    expect(calibration.safeAreaInset).toBeGreaterThan(0);
    expect(calibration.strokeWidth).toBeGreaterThan(0);
    expect(calibration.safeAreaInset * 2 + calibration.strokeWidth).toBeLessThan(
      Math.min(architecture.grid.width, architecture.grid.height),
    );
    expect(["butt", "round", "square"]).toContain(calibration.linecap);
    expect(["miter", "round", "bevel"]).toContain(calibration.linejoin);
  });
});

describe("Phase 2C source and output boundary", () => {
  it("contains no SVG artwork", () => {
    const artwork = readdirSync(join(PKG, "icons"), {
      encoding: "utf8",
      recursive: true,
    }).filter((filename) => filename.toLowerCase().endsWith(".svg"));
    expect(artwork).toEqual([]);
  });

  it("contains no generated production components", () => {
    const output = join(PKG, "src/generated/icons");
    const files = existsSync(output)
      ? readdirSync(output, { encoding: "utf8", recursive: true, withFileTypes: true }).filter(
          (entry) => !entry.isDirectory(),
        )
      : [];
    expect(files).toEqual([]);
  });

  it("keeps the runtime to the single shared props helper", () => {
    expect(readdirSync(join(PKG, "src/runtime"))).toEqual(["resolve-icon-props.ts"]);
  });

  it.each([
    "icon-manifest.json",
    "playground",
    "src/generated/index.ts",
    "src/generated/icons/index.ts",
  ])("does not introduce Phase 2D or later infrastructure at %s", (path) => {
    expect(existsSync(join(PKG, path))).toBe(false);
  });
});

describe("package manifest", () => {
  const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
    exports: Record<string, unknown>;
    files: string[];
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  it("has no runtime dependencies and only React 19 as a peer", () => {
    expect(manifest.dependencies).toBeUndefined();
    expect(manifest.peerDependencies).toEqual({ react: "^19.0.0" });
  });

  it("exposes only the root entry point and package.json", () => {
    // The 1.x `./icons/*` deep-import subpath pointed at the removed catalogue.
    expect(Object.keys(manifest.exports).sort()).toEqual([".", "./package.json"]);
  });

  it("publishes only dist", () => {
    expect(manifest.files).toEqual(["dist"]);
  });

  it("keeps config, validators, and fixtures outside the production build", () => {
    const build = JSON.parse(readFileSync(join(PKG, "tsconfig.build.json"), "utf8")) as {
      include: string[];
      compilerOptions: { rootDir: string };
    };
    expect(build.include).toEqual(["src"]);
    expect(build.compilerOptions.rootDir).toBe("src");
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
