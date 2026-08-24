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
    // jsdom lowercases attribute names, so normalise before comparing.
    .map((a) => `${JSX_ATTRS[a.name.replace(/-/g, "")] ?? a.name}=${a.value}`)
    .sort();
  return [
    `${el.tagName.toLowerCase()}|${attrs.join(",")}`,
    ...[...el.children].flatMap((child) => shape(child)),
  ];
}

/**
 * The source file's shape, with the generator's two documented transforms
 * applied by hand.
 *
 * Modelling the transforms rather than ignoring colour is the point: if the
 * generator recoloured something inside `<defs>`, missed a visible `white`, or
 * touched any other attribute, the expected and actual shapes diverge and the
 * test names the file.
 */
function shapeOfSource(source: string): string[] {
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = doc.documentElement;

  // 1. The root gains `color="white"` as the overridable default.
  root.setAttribute("color", "white");

  // 2. Visible `fill`/`stroke` of exactly `white` become `currentColor`.
  //    Elements inside <defs> are masks and must keep their authored value.
  const recolour = (el: Element, inDefs: boolean) => {
    const isDefs = inDefs || el.tagName.toLowerCase() === "defs";
    if (!isDefs) {
      for (const attr of ["fill", "stroke"]) {
        if (el.getAttribute(attr) === "white") el.setAttribute(attr, "currentColor");
      }
    }
    for (const child of [...el.children]) recolour(child, isDefs);
  };
  for (const child of [...root.children]) recolour(child, false);

  return shape(root);
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

describe("colour is themeable, and white by default", () => {
  // These assert the *mechanism*: visible geometry paints `currentColor`, and the
  // root's `color` is what resolves it.
  //
  // A limitation worth stating plainly, so nobody "fixes" it the wrong way:
  // jsdom does not implement SVG presentation attributes in `getComputedStyle`,
  // so `getComputedStyle(svg).color` on a default icon reports black rather than
  // the `color="white"` the element carries. That is a jsdom gap, not a bug in
  // the icon — `color` is a presentation attribute (SVG 1.1 §6.4), the same class
  // of thing as the `fill` and `stroke` attributes these icons already rely on.
  //
  // So the assertions below check the attribute is present and overridable, which
  // is what this package controls. Confirming the painted pixel needs a real
  // engine; `bun run generate` output opened in a browser is the check for that.
  const sample = ["activity", "user", "search", "lock", "trash", "shield"].filter(
    (n) => typeof componentOf(n) === "function",
  );

  it("has sample icons to test with", () => {
    expect(sample.length).toBeGreaterThan(3);
  });

  it.each(sample)("%s defaults to white, matching the source artwork", (name) => {
    const Icon = componentOf(name);
    const { container } = render(<Icon />);
    expect(container.querySelector("svg")?.getAttribute("color")).toBe("white");
  });

  it.each(sample)("%s routes all visible paint through currentColor", (name) => {
    const Icon = componentOf(name);
    const { container } = render(<Icon />);
    const painted = [...container.querySelectorAll("path")];
    expect(painted.length).toBeGreaterThan(0);
    for (const el of painted) {
      for (const attr of ["fill", "stroke"]) {
        const v = el.getAttribute(attr);
        // A visible path never carries a literal colour — only currentColor,
        // `none`, or nothing at all.
        if (v !== null) expect(["currentColor", "none"], `${name} ${attr}=${v}`).toContain(v);
      }
    }
  });

  it.each(sample)("%s lets the color prop override the default", (name) => {
    const Icon = componentOf(name);
    const { container } = render(<Icon color="black" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("color")).toBe("black");
    // The geometry is unchanged — only the resolution target moved.
    expect(container.querySelector("path")?.getAttribute("fill")).toBe("currentColor");
  });

  it.each(sample)("%s accepts a dark/light class instead of a fixed colour", (name) => {
    const Icon = componentOf(name);
    const { container } = render(<Icon className="text-black dark:text-white" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toBe("text-black dark:text-white");
    // The default stays on the element; CSS outranks a presentation attribute,
    // so the class wins at paint time without needing !important.
    expect(svg?.getAttribute("color")).toBe("white");
  });

  it("never recolours a clipPath mask, which is not painted", () => {
    // All 2175 masks are <rect fill="white"> inside <defs><clipPath>. They are
    // never painted, so recolouring them would be meaningless — they must keep
    // their authored value.
    //
    // Selector is `defs rect`, not `clipPath rect`: jsdom ASCII-lowercases type
    // selectors, so the camelCase `clipPath` never matches one.
    let checked = 0;
    for (const { name, style } of ALL.values()) {
      const Icon = componentOf(name);
      const { container } = render(<Icon variant={style} />);
      for (const rect of container.querySelectorAll("defs rect")) {
        expect(rect.getAttribute("fill"), `${style}/${name}`).toBe("white");
        expect(rect.parentElement?.tagName, `${style}/${name}`).toBe("clipPath");
        checked++;
      }
    }
    // The audit counted 2175 of them; assert the floor so a regression that
    // silently drops the masks cannot pass.
    expect(checked).toBe(2175);
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
