import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, createRef, type ReactElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { iconSystem } from "../config/icon-system.js";
import { createGenerationPlan, type GeneratedIcon } from "../scripts/lib/generation-plan.js";
import * as runtime from "../src/runtime/resolve-icon-props.js";
import type { IconProps } from "../src/types/icon-props.js";
import { syntheticSvg } from "./helpers.js";

const PKG = join(import.meta.dirname, "..");
type Icon = (props: IconProps) => ReactElement;

/**
 * Executes a generated module exactly as emitted: TypeScript compiles its JSX with the automatic
 * runtime, and its only two imports resolve to React and the real shared runtime.
 */
function load(icon: GeneratedIcon): Icon {
  const { outputText } = ts.transpileModule(icon.code, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const modules = new Map<string, unknown>([
    ["react/jsx-runtime", jsxRuntime],
    ["../../../../runtime/resolve-icon-props.js", runtime],
  ]);
  const exports: Record<string, unknown> = {};
  const require = (id: string) => {
    if (!modules.has(id)) throw new Error(`Unexpected import ${JSON.stringify(id)}.`);
    return modules.get(id);
  };
  new Function("require", "exports", outputText)(require, exports);
  return exports[icon.componentName] as Icon;
}

function component(attributes = {}, variant = "outline"): Icon {
  const plan = createGenerationPlan([
    {
      file: `icons/${variant}/actions/fixture.svg`,
      source: syntheticSvg(attributes, '<path d="M 5 7 L 11 13"/>'),
    },
  ]);
  expect(plan.diagnostics).toEqual([]);
  return load(plan.files[0]);
}

const FixtureIcon = component();
const render = (props: IconProps = {}) => renderToStaticMarkup(createElement(FixtureIcon, props));
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

  it("does not leak the size prop or invent extra props", () => {
    expect(Object.keys(runtime.resolveIconProps({ size: 20 })).sort()).toEqual([
      "aria-hidden",
      "focusable",
      "height",
      "role",
      "width",
    ]);
  });
});

describe("generated component rendering", () => {
  it("renders the authored artwork with inherited currentColor paint", () => {
    expect(render()).toBe(
      '<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" focusable="false" aria-hidden="true"><path d="M 5 7 L 11 13"></path></svg>',
    );
    const filled = component(
      {
        fill: "currentColor",
        stroke: undefined,
        "stroke-width": undefined,
        "stroke-linecap": undefined,
        "stroke-linejoin": undefined,
      },
      "filled",
    );
    const markup = renderToStaticMarkup(createElement(filled));
    expect(markup).toContain('fill="currentColor"');
    for (const output of [render(), markup]) {
      expect(output).not.toMatch(/white|black|#[0-9a-f]{3}|rgb|hsl|color=/i);
    }
  });

  it.each([
    [{}, "24", "24"],
    [{ size: 16 }, "16", "16"],
    [{ size: 20.5 }, "20.5", "20.5"],
    [{ size: "1.25em" }, "1.25em", "1.25em"],
    [{ size: 20, width: 32 }, "32", "20"],
    [{ height: "2rem" }, "24", "2rem"],
  ] as const)("sizes %o as %s x %s without leaking size", (props, width, height) => {
    expect(rootAttributes(props)).toMatchObject({ width, height });
    expect(rootAttributes(props)).not.toHaveProperty("size");
  });

  it("forwards className, style, and arbitrary safe SVG props", () => {
    const attributes = rootAttributes({
      className: "text-muted size-4",
      style: { color: "tomato", opacity: 0.5 },
      id: "fixture-icon",
      "data-testid": "fixture",
      opacity: 0.8,
    } as IconProps);
    expect(attributes).toMatchObject({
      class: "text-muted size-4",
      style: "color:tomato;opacity:0.5",
      id: "fixture-icon",
      "data-testid": "fixture",
      opacity: "0.8",
    });
  });

  it("lets caller presentation props override the authored root defaults", () => {
    expect(rootAttributes({ strokeWidth: 2, fill: "none" })).toMatchObject({
      "stroke-width": "2",
    });
  });

  it("passes refs straight to the svg element as a React 19 prop", () => {
    const ref = createRef<SVGSVGElement>();
    const element = FixtureIcon({ ref }) as ReactElement<{ ref?: unknown }>;
    expect(element.type).toBe("svg");
    expect(element.props.ref).toBe(ref);
  });
});

describe("accessibility defaults", () => {
  it.each<[string, IconProps, Record<string, string | undefined>]>([
    ["unnamed icons as decorative", {}, { "aria-hidden": "true", role: undefined }],
    [
      "aria-label as a meaningful image",
      { "aria-label": "Search" },
      { "aria-hidden": undefined, role: "img", "aria-label": "Search" },
    ],
    [
      "aria-labelledby as a meaningful image",
      { "aria-labelledby": "search-label" },
      { "aria-hidden": undefined, role: "img", "aria-labelledby": "search-label" },
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
      { "aria-label": "Search", "aria-hidden": true },
      { "aria-hidden": "true", role: "img" },
    ],
    [
      "an explicit role",
      { "aria-label": "Search", role: "presentation" },
      { "aria-hidden": undefined, role: "presentation" },
    ],
    [
      "an undefined aria-hidden as not provided",
      { "aria-hidden": undefined },
      { "aria-hidden": "true", role: undefined },
    ],
  ])("treats %s", (_label, props, expected) => {
    const attributes = rootAttributes(props);
    expect(attributes.focusable).toBe("false");
    for (const [name, value] of Object.entries(expected)) expect(attributes[name]).toBe(value);
  });

  it("is never focusable by default but honors an explicit focusable", () => {
    expect(rootAttributes().focusable).toBe("false");
    expect(rootAttributes({ focusable: true }).focusable).toBe("true");
    expect(rootAttributes()).not.toHaveProperty("tabindex");
  });

  it("never injects a title", () => {
    expect(render({ "aria-label": "Search" })).not.toContain("<title");
  });
});
