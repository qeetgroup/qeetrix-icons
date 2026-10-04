import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import { categories } from "../config/categories.js";
import { filledRecipes } from "../config/filled.js";
import { iconMetadata } from "../config/icon-metadata.js";
import { type IconStyle, iconSystem } from "../config/icon-system.js";
import { brandSourceDirectory } from "../scripts/check/validate-repository.js";
import { iconExportName, validateIconName } from "../scripts/check/validate-source-path.js";
import { createGenerationPlan } from "../scripts/lib/generation-plan.js";
import type { LucideData } from "../scripts/lib/lucide.js";
import {
  ArrowLeftIcon,
  type BellIcon,
  type CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  Clock12Icon,
  type DatabaseIcon,
  type IconDirectionality,
  type IconProps,
  type IconShape,
  type IconVariant,
  type LockIcon,
  PlusIcon,
  type SearchIcon,
  type SettingsIcon,
  type StarIcon,
  type TrashIcon,
  type UserIcon,
  XIcon,
} from "../src/index.js";
import { iconManifest, logoManifest } from "../src/manifest.js";

const PKG = join(import.meta.dirname, "..");
const lucide = JSON.parse(readFileSync(join(PKG, "config/lucide.json"), "utf8")) as LucideData;

describe("public entry point", () => {
  it("can be imported", async () => {
    const pkg = await import("../src/index.js");
    expect(pkg).toBeTypeOf("object");
  });

  it("exports exactly one component per icon and per logo, and nothing else at runtime", async () => {
    const pkg = await import("../src/index.js");
    const icons = iconManifest.icons.map(({ componentName }) => componentName);
    const logos = logoManifest.logos.map(({ componentName }) => componentName);
    expect(Object.keys(pkg).sort()).toEqual([...icons, ...logos].sort());
    // Icons end in Icon and logos in Logo, so the two families can never collide.
    for (const name of icons) expect(name).toMatch(/Icon$/);
    for (const name of logos) expect(name).toMatch(/Logo$/);
  }, 60_000);

  it("exports the shape, variant, directionality, and variant-generic props types", () => {
    expectTypeOf<IconShape>().toEqualTypeOf<"round" | "sharp">();
    // The public shapes are the source styles.
    expectTypeOf<IconShape>().toEqualTypeOf<IconStyle>();
    expectTypeOf<IconProps["shape"]>().toEqualTypeOf<IconShape | undefined>();
    expectTypeOf<IconProps<"outline">["shape"]>().toEqualTypeOf<IconShape | undefined>();
    expectTypeOf<IconVariant>().toEqualTypeOf<"outline" | "filled">();
    expectTypeOf<IconDirectionality>().toEqualTypeOf<"mirror" | "preserve">();
    expectTypeOf<IconProps["size"]>().toEqualTypeOf<number | string | undefined>();
    expectTypeOf<IconProps["variant"]>().toEqualTypeOf<IconVariant | undefined>();
    expectTypeOf<IconProps<"outline">["variant"]>().toEqualTypeOf<"outline" | undefined>();
  });

  it("re-exports generated icons and logos and never imports catalogue metadata", () => {
    const root = readFileSync(join(PKG, "src/index.ts"), "utf8");
    const imports = [...root.matchAll(/from "([^"]+)"/g)].map(([, source]) => source);
    expect(imports.sort()).toEqual([
      "./generated/icon-index.js",
      "./generated/logo-index.js",
      "./types/icon-props.js",
      "./types/icon.js",
      "./types/logo.js",
    ]);
    // Catalogue modules only; a brand may itself be called Manifest (./logos/manifest.js).
    for (const barrel of ["src/generated/icon-index.ts", "src/generated/logo-index.ts"]) {
      expect(readFileSync(join(PKG, barrel), "utf8"), barrel).not.toMatch(
        /from "\.\/(?:icon|logo)-manifest\.js"|from "\.\.\/manifest\.js"/,
      );
    }
  });
});

describe("category taxonomy", () => {
  const categoryIds = categories.map((category) => category.id);

  it("has unique stable IDs", () => {
    expect(new Set(categoryIds).size).toBe(categoryIds.length);
  });

  it("is Lucide's taxonomy, in id order", () => {
    expect(categories).toEqual(lucide.categories);
    expect(categoryIds).toEqual([...categoryIds].sort());
    expect(categoryIds).toContain("arrows");
    expect(categoryIds).toContain("account");
  });

  it("provides usable discovery metadata", () => {
    for (const category of categories) {
      expect(category.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(category.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("Lucide source", () => {
  it("pins one Lucide release", () => {
    expect(lucide.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("ships exactly the synced Lucide icons, under Lucide's names", () => {
    expect(iconManifest.icons.map(({ name }) => name).sort()).toEqual(
      Object.keys(lucide.icons).sort(),
    );
    expect(iconManifest.icons.length).toBeGreaterThan(1500);
  });

  it("files each icon under its first Lucide category and records the rest", () => {
    for (const { name, category, categories: listed, tags, aliases } of iconManifest.icons) {
      const source = lucide.icons[name];
      expect(category, name).toBe(source.categories[0]);
      expect(listed, name).toEqual(source.categories);
      expect(tags, name).toEqual(source.tags);
      expect(aliases, name).toEqual(source.aliases);
    }
  });

  it("uses valid, globally unique names and component names", () => {
    const names = Object.keys(lucide.icons);
    expect(new Set(names.map(iconExportName)).size).toBe(names.length);
    for (const name of names) expect(validateIconName(`${name}.svg`), name).toEqual([]);
  });

  it("records earlier Lucide names as aliases without exporting them", async () => {
    const pkg = await import("../src/index.js");
    expect(lucide.icons.trash.aliases).toContain("trash-2");
    expect(pkg).toHaveProperty("TrashIcon");
    expect(pkg).not.toHaveProperty("Trash2Icon");
  });
});

describe("icon-system contract", () => {
  const { architecture, design } = iconSystem;

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
    const sizes = [...design.recommendedSizes];
    expect(new Set(sizes).size).toBe(sizes.length);
    expect(sizes).toEqual([...sizes].sort((left, right) => left - right));
    expect(sizes).toContain(design.defaultSize);
    for (const size of sizes) {
      expect(Number.isInteger(size)).toBe(true);
      expect(size).toBeGreaterThan(0);
    }
  });

  it("compares ordered, unique stroke candidates that include the current width", () => {
    const candidates = [...design.strokeCandidates];
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(candidates).toEqual([...candidates].sort((left, right) => left - right));
    expect(candidates).toContain(design.strokeWidth);
    for (const candidate of candidates) expect(candidate).toBeGreaterThan(0);
  });

  it("leaves usable painted space inside the candidate safe area", () => {
    expect(Number.isFinite(design.safeAreaInset)).toBe(true);
    expect(Number.isFinite(design.strokeWidth)).toBe(true);
    expect(design.safeAreaInset).toBeGreaterThan(0);
    expect(design.strokeWidth).toBeGreaterThan(0);
    expect(design.safeAreaInset * 2 + design.strokeWidth).toBeLessThan(
      Math.min(architecture.grid.width, architecture.grid.height),
    );
    expect(["butt", "round", "square"]).toContain(design.linecap);
    expect(["miter", "round", "bevel"]).toContain(design.linejoin);
  });
});

describe("production sources and generated output", () => {
  // Brand logos have a pipeline of their own.
  const brands = `${brandSourceDirectory.slice("icons/".length)}/`;
  const drawings = readdirSync(join(PKG, "icons"), { encoding: "utf8", recursive: true })
    .filter((file) => file.endsWith(".svg") && !file.startsWith(brands))
    .sort();

  it("has one drawing per manifest shape and variant", () => {
    expect(drawings).toEqual(
      iconManifest.icons
        .flatMap(({ name, category, variants, shapes }) =>
          shapes.flatMap((shape) =>
            variants.map((variant) => `${shape}-${variant}/${category}/${name}.svg`),
          ),
        )
        .sort(),
    );
  });

  it("offers every concept in every configured style, the default first", () => {
    const { defaultStyle, styles } = iconSystem.architecture;
    const expected = [defaultStyle, ...styles.filter((style) => style !== defaultStyle)];
    for (const { id, shapes } of iconManifest.icons) expect(shapes, id).toEqual(expected);
  });

  it("generates both shapes of a concept into its one module", () => {
    const trash = readFileSync(join(PKG, "src/generated/icons/trash.tsx"), "utf8");
    expect(trash.match(/<svg\b/g)).toHaveLength(4);
    expect(trash).toContain('if (props.shape === "sharp") {');
    expect(trash).toContain(`strokeMiterlimit="${iconSystem.design.sharp.miterLimit}"`);
  });

  it("has exactly one generated module per manifest concept", () => {
    expect(readdirSync(join(PKG, "src/generated/icons")).sort()).toEqual(
      iconManifest.icons.map(({ id }) => `${id}.tsx`).sort(),
    );
  });

  it("keeps the runtime to the icon props helper and the logo renderer", () => {
    expect(readdirSync(join(PKG, "src/runtime")).sort()).toEqual([
      "render-logo.ts",
      "resolve-icon-props.ts",
    ]);
  });

  it("keeps the manifest JSON and typed module in sync", () => {
    const json = JSON.parse(readFileSync(join(PKG, "icon-manifest.json"), "utf8"));
    expect(json.schemaVersion).toBe(1);
    expect(iconManifest).toEqual(json);
  });

  it.each([
    ".storybook",
    "src/generated/icons/index.ts",
    "src/generated/categories",
    "src/generated/sharp",
    "src/generated/logos/index.ts",
    "src/generated-logos",
    "src/sharp.ts",
  ])("does not introduce Storybook, extra barrels, or per-shape entry points at %s", (path) => {
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

  it("exposes only the root, per-icon, per-logo, manifest, and package.json entry points", () => {
    expect(manifest.exports).toEqual({
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js", default: "./dist/index.js" },
      "./icons/*": {
        types: "./dist/generated/icons/*.d.ts",
        import: "./dist/generated/icons/*.js",
        default: "./dist/generated/icons/*.js",
      },
      "./logos/*": {
        types: "./dist/generated/logos/*.d.ts",
        import: "./dist/generated/logos/*.js",
        default: "./dist/generated/logos/*.js",
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

describe("source layout", () => {
  it("keeps every drawing in one icons/<style>-<variant>/ tree", () => {
    // Folders that hold drawings; dotfiles, empty work-in-progress folders, and the brand logos'
    // own tree don't count.
    const folders = readdirSync(join(PKG, "icons")).filter(
      (name) =>
        !name.startsWith(".") &&
        `icons/${name}` !== brandSourceDirectory &&
        readdirSync(join(PKG, "icons", name), { recursive: true }).some((file) =>
          String(file).endsWith(".svg"),
        ),
    );
    expect(folders.sort()).toEqual([
      "round-filled",
      "round-outline",
      "sharp-filled",
      "sharp-outline",
    ]);
  });

  it.each(["round-solid", "sharp-solid", "outline", "filled"])(
    "has no legacy icons/%s directory",
    (dir) => {
      expect(existsSync(join(PKG, "icons", dir))).toBe(false);
    },
  );

  it("has no generated src/icons tree", () => {
    expect(existsSync(join(PKG, "src", "icons"))).toBe(false);
  });
});

describe("well-known concepts", () => {
  const filled = new Set(Object.keys(filledRecipes));

  it.each([
    ["plus", "PlusIcon", "math"],
    ["x", "XIcon", "notifications"],
    ["check", "CheckIcon", "notifications"],
    ["chevron-down", "ChevronDownIcon", "arrows"],
    ["search", "SearchIcon", "text"],
    ["arrow-left", "ArrowLeftIcon", "arrows"],
    ["settings", "SettingsIcon", "account"],
    ["user", "UserIcon", "account"],
    ["bell", "BellIcon", "account"],
    ["lock", "LockIcon", "security"],
    ["calendar", "CalendarIcon", "time"],
    ["database", "DatabaseIcon", "devices"],
    ["trash", "TrashIcon", "files"],
    ["clock-12", "Clock12Icon", "time"],
  ])("ships %s as %s in %s, filled only when listed", (id, componentName, category) => {
    expect(iconManifest.icons).toContainEqual(
      expect.objectContaining({
        id,
        name: id,
        componentName,
        category,
        variants: filled.has(id) ? ["outline", "filled"] : ["outline"],
        shapes: ["round", "sharp"],
        directionality: "preserve",
      }),
    );
    expect(existsSync(join(PKG, "src/generated/icons", `${id}.tsx`))).toBe(true);
  });

  it("types each icon to the drawings it has", () => {
    for (const Icon of [PlusIcon, XIcon, CheckIcon, ChevronDownIcon, ArrowLeftIcon, Clock12Icon]) {
      expect(Icon).toBeTypeOf("function");
    }
    type Variant<T extends (props: never) => unknown> = NonNullable<Parameters<T>[0]>["variant"];
    expectTypeOf<Variant<typeof PlusIcon>>().toEqualTypeOf<"outline" | undefined>();
    expectTypeOf<Variant<typeof XIcon>>().toEqualTypeOf<"outline" | undefined>();
    expectTypeOf<Variant<typeof CheckIcon>>().toEqualTypeOf<"outline" | undefined>();
    expectTypeOf<Variant<typeof ChevronDownIcon>>().toEqualTypeOf<"outline" | undefined>();
    expectTypeOf<Variant<typeof ArrowLeftIcon>>().toEqualTypeOf<"outline" | undefined>();
    expectTypeOf<Variant<typeof SearchIcon>>().toEqualTypeOf<"outline" | "filled" | undefined>();
    expectTypeOf<Variant<typeof SettingsIcon>>().toEqualTypeOf<"outline" | "filled" | undefined>();
    expectTypeOf<Variant<typeof UserIcon>>().toEqualTypeOf<"outline" | "filled" | undefined>();
    expectTypeOf<Variant<typeof BellIcon>>().toEqualTypeOf<"outline" | "filled" | undefined>();
    expectTypeOf<Variant<typeof LockIcon>>().toEqualTypeOf<"outline" | "filled" | undefined>();
    expectTypeOf<Variant<typeof CalendarIcon>>().toEqualTypeOf<"outline" | "filled" | undefined>();
    expectTypeOf<Variant<typeof DatabaseIcon>>().toEqualTypeOf<"outline" | "filled" | undefined>();
    expectTypeOf<Variant<typeof StarIcon>>().toEqualTypeOf<"outline" | "filled" | undefined>();
    expectTypeOf<Variant<typeof TrashIcon>>().toEqualTypeOf<"outline" | "filled" | undefined>();
    // Every icon takes every shape.
    type Shape<T extends (props: never) => unknown> = NonNullable<Parameters<T>[0]>["shape"];
    expectTypeOf<Shape<typeof PlusIcon>>().toEqualTypeOf<IconShape | undefined>();
    expectTypeOf<Shape<typeof TrashIcon>>().toEqualTypeOf<IconShape | undefined>();
  });

  it("mirrors only semantic reading-direction concepts, never physical directions", () => {
    // docs/rtl.md: undo/redo, reply, forward, send, sign-in/out, indentation, and start/end
    // alignment follow reading direction; physical arrows, chevrons, and panels keep orientation.
    const semantic = new Set([
      "undo",
      "undo-2",
      "undo-dot",
      "redo",
      "redo-2",
      "redo-dot",
      "reply",
      "reply-all",
      "message-square-reply",
      "forward",
      "send",
      "send-horizontal",
      "log-in",
      "log-out",
      "list-indent-increase",
      "list-indent-decrease",
      "text-align-start",
      "text-align-end",
    ]);
    const mirrored = Object.entries(iconMetadata).filter(
      ([, { directionality }]) => directionality !== undefined,
    );
    expect(mirrored.map(([name]) => name).sort()).toEqual([...semantic].sort());
    for (const [name, { directionality }] of mirrored) expect(directionality, name).toBe("mirror");
    for (const physical of ["arrow-left", "arrow-right", "chevron-left", "chevron-right"]) {
      expect(iconMetadata[physical]?.directionality, physical).toBeUndefined();
    }
  });

  it("applies metadata only when the caller passes it", () => {
    // Library functions validate whatever they are given; the CLIs pass this repository's config.
    const file = `icons/round-outline/${lucide.icons.undo.categories[0]}/undo.svg`;
    const sources = [{ file, source: readFileSync(join(PKG, file), "utf8") }];
    const authored = { undo: iconMetadata.undo };
    expect(createGenerationPlan(sources).manifest.icons[0].directionality).toBe("preserve");
    expect(createGenerationPlan(sources, [], authored).manifest.icons[0].directionality).toBe(
      "mirror",
    );
  });

  it("has exactly the filled drawings config/filled.ts lists", () => {
    const drawings = readdirSync(join(PKG, "icons/round-filled"), {
      recursive: true,
      encoding: "utf8",
    })
      .filter((file) => file.endsWith(".svg"))
      .map((file) => file.split("/").pop()?.slice(0, -4));
    expect(drawings.sort()).toEqual([...filled].sort());
    expect(iconManifest.icons.filter(({ variants }) => variants.includes("filled")).length).toBe(
      filled.size,
    );
  });
});
