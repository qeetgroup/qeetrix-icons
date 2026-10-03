import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import { categories } from "../config/categories.js";
import { iconSystem } from "../config/icon-system.js";
import {
  CheckIcon,
  ChevronDownIcon,
  type IconDirectionality,
  type IconProps,
  type IconVariant,
  PlusIcon,
  XIcon,
} from "../src/index.js";
import { iconManifest } from "../src/manifest.js";

const PKG = join(import.meta.dirname, "..");

describe("public entry point", () => {
  it("can be imported", async () => {
    const pkg = await import("../src/index.js");
    expect(pkg).toBeTypeOf("object");
  });

  it("exports exactly one component per manifest concept, and nothing else at runtime", async () => {
    const pkg = await import("../src/index.js");
    expect(Object.keys(pkg).sort()).toEqual(
      iconManifest.icons.map(({ componentName }) => componentName).sort(),
    );
  });

  it("exports the variant, directionality, and variant-generic props types", () => {
    expectTypeOf<IconVariant>().toEqualTypeOf<"outline" | "filled">();
    expectTypeOf<IconDirectionality>().toEqualTypeOf<"mirror" | "preserve">();
    expectTypeOf<IconProps["size"]>().toEqualTypeOf<number | string | undefined>();
    expectTypeOf<IconProps["variant"]>().toEqualTypeOf<IconVariant | undefined>();
    expectTypeOf<IconProps<"outline">["variant"]>().toEqualTypeOf<"outline" | undefined>();
  });

  it("re-exports generated icons and never imports catalogue metadata", () => {
    const root = readFileSync(join(PKG, "src/index.ts"), "utf8");
    const imports = [...root.matchAll(/from "([^"]+)"/g)].map(([, source]) => source);
    expect(imports.sort()).toEqual([
      "./generated/index.js",
      "./types/icon-props.js",
      "./types/icon.js",
    ]);
    expect(readFileSync(join(PKG, "src/generated/index.ts"), "utf8")).not.toContain("manifest");
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

  it("compares ordered, unique stroke candidates that include the current width", () => {
    const candidates = [...calibration.strokeCandidates];
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(candidates).toEqual([...candidates].sort((left, right) => left - right));
    expect(candidates).toContain(calibration.strokeWidth);
    for (const candidate of candidates) expect(candidate).toBeGreaterThan(0);
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

describe("production sources and generated output", () => {
  const drawings = readdirSync(join(PKG, "icons"), { encoding: "utf8", recursive: true })
    .filter((file) => file.endsWith(".svg"))
    .sort();

  it("has one drawing per manifest variant", () => {
    expect(drawings).toEqual(
      iconManifest.icons
        .flatMap(({ name, category, variants }) =>
          variants.map((variant) => `${variant}/${category}/${name}.svg`),
        )
        .sort(),
    );
  });

  it("has exactly one generated module per manifest concept", () => {
    expect(readdirSync(join(PKG, "src/generated/icons")).sort()).toEqual(
      iconManifest.icons.map(({ id }) => `${id}.tsx`).sort(),
    );
  });

  it("keeps the runtime to the single shared props helper", () => {
    expect(readdirSync(join(PKG, "src/runtime"))).toEqual(["resolve-icon-props.ts"]);
  });

  it("keeps the manifest JSON and typed module in sync", () => {
    const json = JSON.parse(readFileSync(join(PKG, "icon-manifest.json"), "utf8"));
    expect(json.schemaVersion).toBe(1);
    expect(iconManifest).toEqual(json);
  });

  it.each([".storybook", "src/generated/icons/index.ts", "src/generated/categories"])(
    "does not introduce Storybook or extra barrels at %s",
    (path) => {
      expect(existsSync(join(PKG, path))).toBe(false);
    },
  );
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

  it("exposes only the root, per-icon, manifest, and package.json entry points", () => {
    expect(manifest.exports).toEqual({
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js", default: "./dist/index.js" },
      "./icons/*": {
        types: "./dist/generated/icons/*.d.ts",
        import: "./dist/generated/icons/*.js",
        default: "./dist/generated/icons/*.js",
      },
      "./manifest": {
        types: "./dist/manifest.d.ts",
        import: "./dist/manifest.js",
        default: "./dist/manifest.js",
      },
      "./package.json": "./package.json",
    });
  });

  it("declares every published module free of side effects", () => {
    expect((manifest as { sideEffects?: unknown }).sideEffects).toBe(false);
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

describe("Phase 3A calibration concepts", () => {
  it.each([
    ["plus", "PlusIcon", "actions"],
    ["x", "XIcon", "actions"],
    ["check", "CheckIcon", "actions"],
    ["chevron-down", "ChevronDownIcon", "navigation"],
  ])("ships %s as outline-only %s in %s, preserved in RTL", (id, componentName, category) => {
    expect(iconManifest.icons).toContainEqual({
      id,
      name: id,
      componentName,
      category,
      variants: ["outline"],
      directionality: "preserve",
    });
    expect(existsSync(join(PKG, "src/generated/icons", `${id}.tsx`))).toBe(true);
  });

  it("types every calibration icon as outline-only", () => {
    for (const Icon of [PlusIcon, XIcon, CheckIcon, ChevronDownIcon]) {
      expect(Icon).toBeTypeOf("function");
    }
    expectTypeOf<Parameters<typeof PlusIcon>[0]["variant"]>().toEqualTypeOf<
      "outline" | undefined
    >();
    expectTypeOf<Parameters<typeof XIcon>[0]["variant"]>().toEqualTypeOf<"outline" | undefined>();
    expectTypeOf<Parameters<typeof CheckIcon>[0]["variant"]>().toEqualTypeOf<
      "outline" | undefined
    >();
    expectTypeOf<Parameters<typeof ChevronDownIcon>[0]["variant"]>().toEqualTypeOf<
      "outline" | undefined
    >();
  });

  it("has no filled drawings yet", () => {
    expect(existsSync(join(PKG, "icons/filled"))).toBe(false);
  });
});
