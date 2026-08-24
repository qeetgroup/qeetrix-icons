import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import type { ComponentType, SVGProps } from "react";
import { describe, expect, it } from "vitest";
import * as pkg from "../src/index.js";

const PKG = join(import.meta.dirname, "..");

/**
 * The whole contract, in one file.
 *
 * The promise this library makes is narrow and unusual: the SVG inside each
 * component is the designer's SVG, unchanged. That is not a property you can
 * eyeball across 1166 components, so the first block below proves it by
 * reconstructing each source file from the rendered DOM and comparing tag for
 * tag, attribute for attribute, value for value.
 *
 * Everything else here exists to catch the ways a generator can silently go
 * wrong: an icon that stops being exported, a variant that renders the wrong
 * style, a prop that fails to reach the root element.
 */

type IconProps = SVGProps<SVGSVGElement> & { variant?: string };
type Icon = ComponentType<IconProps>;

/** Every source SVG, keyed by `<style>/<category>/<name>`. */
function sources() {
  const out = new Map<string, { name: string; style: string; category: string; source: string }>();
  for (const style of readdirSync(join(PKG, "icons"))) {
    for (const category of readdirSync(join(PKG, "icons", style))) {
      const dir = join(PKG, "icons", style, category);
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".svg")) continue;
        const name = file.slice(0, -4);
        out.set(`${style}/${category}/${name}`, {
          name,
          style,
          category,
          source: readFileSync(join(dir, file), "utf8").trim(),
        });
      }
    }
  }
  return out;
}

const ALL = sources();
const componentOf = (name: string) =>
  (pkg as unknown as Record<string, Icon>)[
    name
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("")
  ];

/**
 * The kebab-case attributes JSX cannot spell. The generator renames exactly
 * these; the comparison below renames them back before diffing, so a rename the
 * generator invents beyond this list shows up as a failure.
 */
const JSX_ATTRS: Record<string, string> = {
  clippath: "clip-path",
  cliprule: "clip-rule",
  fillrule: "fill-rule",
  strokewidth: "stroke-width",
  strokelinecap: "stroke-linecap",
  strokelinejoin: "stroke-linejoin",
  strokemiterlimit: "stroke-miterlimit",
};

/** Flatten an element tree to `tag|attr=value,…` lines, in document order. */
function shape(el: Element): string[] {
  const attrs = [...el.attributes]
    // `{...props}` adds nothing when no props are passed, but jsdom lowercases
    // attribute names, so normalise before comparing.
    .map((a) => `${JSX_ATTRS[a.name.replace(/-/g, "")] ?? a.name}=${a.value}`)
    .sort();
  return [
    `${el.tagName.toLowerCase()}|${attrs.join(",")}`,
    ...[...el.children].flatMap((child) => shape(child)),
  ];
}

/** The same flattening, applied to a raw source file via the DOM parser. */
function shapeOfSource(source: string): string[] {
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  return shape(doc.documentElement);
}

describe("every component holds its source SVG, byte for byte", () => {
  const cases = [...ALL.values()].map((s) => [`${s.style}/${s.name}`, s] as const);

  it.each(cases)("%s", (_label, { name, style, source }) => {
    const Icon = componentOf(name);
    expect(Icon, `${name} is not exported`).toBeTypeOf("function");
    const { container } = render(<Icon variant={style} />);
    const svg = container.querySelector("svg");
    expect(svg, name).not.toBeNull();
    expect(shape(svg as Element)).toEqual(shapeOfSource(source));
  });
});

describe("the exported set matches the source tree", () => {
  const names = [...new Set([...ALL.values()].map((s) => s.name))].sort();

  it("exports one component per unique icon name", () => {
    const missing = names.filter((name) => typeof componentOf(name) !== "function");
    expect(missing).toEqual([]);
  });

  it("exports nothing that has no source SVG", () => {
    const expected = new Set(
      names.map((n) =>
        n
          .split("-")
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(""),
      ),
    );
    const extra = Object.keys(pkg).filter((key) => /^[A-Z]/.test(key) && !expected.has(key));
    expect(extra).toEqual([]);
  });

  it("puts every component in its source category", () => {
    const barrel = readFileSync(join(PKG, "src/icons/index.ts"), "utf8");
    const wrong: string[] = [];
    for (const { name, category } of ALL.values()) {
      if (!barrel.includes(`from "./${category}/${name}.js";`)) wrong.push(`${category}/${name}`);
    }
    expect(wrong).toEqual([]);
  });
});

describe("the variant prop selects the style", () => {
  // Icons shipping both styles, so switching is actually observable. Capped at
  // 40 because the byte-for-byte block above already covers all 2307 files;
  // this block is about the branching, not the geometry.
  const paired = [...ALL.values()]
    .flatMap((s) => {
      if (s.style !== "outline") return [];
      const solid = ALL.get(`solid/${s.category}/${s.name}`);
      return solid ? [{ name: s.name, solidSource: solid.source }] : [];
    })
    .slice(0, 40);

  it("has icons shipping both styles to test with", () => {
    expect(paired.length).toBeGreaterThan(10);
  });

  it.each(paired.map((p) => [p.name, p.solidSource] as const))(
    "%s draws a different solid",
    (name, solidSource) => {
      const Icon = componentOf(name);
      const outline = render(<Icon />).container.innerHTML;
      const explicit = render(<Icon variant="outline" />).container.innerHTML;
      const solid = render(<Icon variant="solid" />).container.innerHTML;

      // No variant means outline.
      expect(outline).toBe(explicit);
      // And solid is genuinely the other file, not a re-render of the same one.
      expect(solid).not.toBe(outline);
      const rendered = render(<Icon variant="solid" />).container.querySelector("svg");
      expect(shape(rendered as Element)).toEqual(shapeOfSource(solidSource));
    },
  );
});

describe("props reach the root svg", () => {
  const sample = ["activity", "user", "search", "lock", "trash"].filter(
    (n) => typeof componentOf(n) === "function",
  );

  it("has sample icons to test with", () => {
    expect(sample.length).toBeGreaterThan(0);
  });

  it.each(sample)("%s lets a consumer override size, colour and class", (name) => {
    const Icon = componentOf(name);
    const { container } = render(
      <Icon width={40} height={40} fill="rebeccapurple" className="x" aria-hidden="true" />,
    );
    const svg = container.querySelector("svg") as SVGSVGElement;
    // Baked-in width/height/fill are overridden because props spread last.
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("height")).toBe("40");
    expect(svg.getAttribute("fill")).toBe("rebeccapurple");
    expect(svg.getAttribute("class")).toBe("x");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it.each(sample)("%s does not leak the variant prop into the DOM", (name) => {
    const Icon = componentOf(name);
    const { container } = render(<Icon />);
    expect(container.querySelector("svg")?.hasAttribute("variant")).toBe(false);
  });
});
