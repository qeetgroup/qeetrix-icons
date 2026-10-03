import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, createRef, type ReactElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { iconSystem } from "../config/icon-system.js";
import { createGenerationPlan } from "../scripts/lib/generation-plan.js";
import * as runtime from "../src/runtime/resolve-icon-props.js";
import type { IconProps } from "../src/types/icon-props.js";
import { apiFixtures } from "./helpers.js";

const PKG = join(import.meta.dirname, "..");
type Icon = (props: IconProps) => ReactElement<{ ref?: unknown }>;

/**
 * Executes a generated module exactly as emitted: TypeScript compiles its JSX with the automatic
 * runtime, and its only two imports resolve to React and the real shared runtime.
 */
function load(code: string, componentName: string): Icon {
  const { outputText } = ts.transpileModule(code, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const modules = new Map<string, unknown>([
    ["react/jsx-runtime", jsxRuntime],
    ["../../runtime/resolve-icon-props.js", runtime],
  ]);
  const exports: Record<string, unknown> = {};
  const require = (id: string) => {
    if (!modules.has(id)) throw new Error(`Unexpected import ${JSON.stringify(id)}.`);
    return modules.get(id);
  };
  new Function("require", "exports", outputText)(require, exports);
  return exports[componentName] as Icon;
}

/** Generates one concept from sources and loads its component. */
function concept(sources: readonly { file: string; source: string }[]): Icon {
  const plan = createGenerationPlan(sources);
  expect(plan.diagnostics).toEqual([]);
  const [icon] = plan.concepts;
  const file = plan.files.find(({ path }) => path === icon.outputPath);
  if (!file) throw new Error("The plan has no component file.");
  return load(file.contents, icon.componentName);
}

/** Outline radius 6.25, filled radius 7.5: deliberately distinguishable drawings. */
const FixtureStarIcon = concept(apiFixtures.filter(({ file }) => file.includes("fixture-star")));
const FixtureSearchIcon = concept(
  apiFixtures.filter(({ file }) => file.includes("fixture-search")),
);
const outlineGeometry = '<circle cx="12" cy="12" r="6.25"></circle>';
const filledGeometry = '<circle cx="12" cy="12" r="7.5"></circle>';

const render = (props: IconProps = {}, Icon: Icon = FixtureStarIcon) =>
  renderToStaticMarkup(createElement(Icon, props));
const rootAttributes = (props: IconProps = {}) => {
  const svg = render(props).match(/^<svg([^>]*)>/)?.[1] ?? "";
  return Object.fromEntries([...svg.matchAll(/ ([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
};

describe("shared runtime contract", () => {
  it("matches the internal icon-system defaults it cannot import", () => {
    expect(runtime.defaultIconSize).toBe(iconSystem.calibration.defaultSize);
    const decorative = runtime.resolveIconProps({});
    expect(decorative["aria-hidden"]).toBe(
      iconSystem.architecture.accessibility.decorativeByDefault,
    );
    expect(decorative.focusable).toBe(iconSystem.architecture.accessibility.focusable);
  });

  it("is pure, server-safe module code with no client-only behavior", () => {
    const sources = ["src/runtime", "src/types"].flatMap((directory) =>
      readdirSync(join(PKG, directory)).map((file) =>
        readFileSync(join(PKG, directory, file), "utf8"),
      ),
    );
    for (const source of sources) {
      expect(source).not.toMatch(
        /use client|useState|useEffect|useContext|createContext|window|document\.|forwardRef/,
      );
    }
  });

  it("consumes size and variant, so neither reaches the DOM, and invents no props", () => {
    expect(Object.keys(runtime.resolveIconProps({ size: 20, variant: "filled" })).sort()).toEqual([
      "aria-hidden",
      "focusable",
      "height",
      "role",
      "width",
    ]);
  });
});

describe("variant selection", () => {
  it("renders outline by default and identically for an explicit outline", () => {
    expect(render()).toBe(
      `<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" focusable="false" aria-hidden="true">${outlineGeometry}</svg>`,
    );
    expect(render({ variant: "outline" })).toBe(render());
  });

  it("renders the separately authored filled drawing", () => {
    expect(render({ variant: "filled" })).toBe(
      `<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" focusable="false" aria-hidden="true">${filledGeometry}</svg>`,
    );
  });

  it("never forwards variant to the DOM", () => {
    for (const markup of [
      render(),
      render({ variant: "outline" }),
      render({ variant: "filled" }),
      render({ variant: "outline" }, FixtureSearchIcon),
    ]) {
      expect(markup).not.toContain("variant");
    }
  });

  it("falls back to outline at runtime for a variant the icon lacks (a type error in TypeScript)", () => {
    expect(render({ variant: "filled" }, FixtureSearchIcon)).toBe(render({}, FixtureSearchIcon));
  });

  it("paints only currentColor in every drawing", () => {
    for (const variant of ["outline", "filled"] as const) {
      expect(render({ variant })).not.toMatch(/white|black|#[0-9a-f]{3}|rgb|hsl|color=/i);
    }
  });
});

describe.each(["outline", "filled"] as const)("%s drawing props", (variant) => {
  const attributes = (props: IconProps = {}) => rootAttributes({ ...props, variant });

  it.each([
    [{}, "24", "24"],
    [{ size: 16 }, "16", "16"],
    [{ size: 20.5 }, "20.5", "20.5"],
    [{ size: "1.25em" }, "1.25em", "1.25em"],
    [{ size: 20, width: 32 }, "32", "20"],
    [{ height: "2rem" }, "24", "2rem"],
  ] as const)("sizes %o as %s x %s without leaking size", (props, width, height) => {
    expect(attributes(props)).toMatchObject({ width, height });
    expect(attributes(props)).not.toHaveProperty("size");
  });

  it("forwards className, style, color, and arbitrary safe SVG props", () => {
    expect(
      attributes({
        className: "text-muted size-4",
        style: { opacity: 0.5 },
        color: "tomato",
        id: "fixture-icon",
        "data-testid": "fixture",
        opacity: 0.8,
      } as IconProps),
    ).toMatchObject({
      class: "text-muted size-4",
      style: "opacity:0.5",
      color: "tomato",
      id: "fixture-icon",
      "data-testid": "fixture",
      opacity: "0.8",
    });
  });

  it("lets caller presentation props override the authored root defaults", () => {
    expect(attributes({ strokeWidth: 2 })).toMatchObject({ "stroke-width": "2" });
  });

  it("passes the ref to the selected svg element as a React 19 prop", () => {
    const ref = createRef<SVGSVGElement>();
    const element = FixtureStarIcon({ ref, variant });
    expect(element.type).toBe("svg");
    expect(element.props.ref).toBe(ref);
    expect(renderToStaticMarkup(element)).toContain(
      variant === "filled" ? filledGeometry : outlineGeometry,
    );
  });

  it.each<[string, IconProps, Record<string, string | undefined>]>([
    ["unnamed icons as decorative", {}, { "aria-hidden": "true", role: undefined }],
    [
      "aria-label as a meaningful image",
      { "aria-label": "Starred" },
      { "aria-hidden": undefined, role: "img", "aria-label": "Starred" },
    ],
    [
      "aria-labelledby as a meaningful image",
      { "aria-labelledby": "star-label" },
      { "aria-hidden": undefined, role: "img", "aria-labelledby": "star-label" },
    ],
    [
      "a blank label as decorative",
      { "aria-label": "  " },
      { "aria-hidden": "true", role: undefined },
    ],
    [
      "a description alone as decorative",
      { "aria-describedby": "hint" },
      { "aria-hidden": "true", role: undefined },
    ],
    [
      "an explicit aria-hidden over the label",
      { "aria-label": "Starred", "aria-hidden": true },
      { "aria-hidden": "true", role: "img" },
    ],
    [
      "an explicit role",
      { "aria-label": "Starred", role: "presentation" },
      { "aria-hidden": undefined, role: "presentation" },
    ],
    [
      "an undefined aria-hidden as not provided",
      { "aria-hidden": undefined },
      { "aria-hidden": "true", role: undefined },
    ],
  ])("treats %s identically", (_label, props, expected) => {
    const result = attributes(props);
    expect(result.focusable).toBe("false");
    for (const [name, value] of Object.entries(expected)) expect(result[name]).toBe(value);
  });

  it("is never focusable by default but honors an explicit focusable", () => {
    expect(attributes().focusable).toBe("false");
    expect(attributes({ focusable: true }).focusable).toBe("true");
    expect(attributes()).not.toHaveProperty("tabindex");
  });

  it("never injects a title", () => {
    expect(render({ "aria-label": "Starred", variant })).not.toContain("<title");
  });
});
