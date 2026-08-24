import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import type { ComponentType, SVGProps } from "react";
import { describe, expect, it } from "vitest";
import type { QeetrixIcon } from "../src/index.js";
import * as pkg from "../src/index.js";
import { Activity, ArrowLeft, Litecoin, PresentionChart } from "../src/index.js";

/**
 * `QeetrixIcon` must accept every icon, whatever it narrows its axes to.
 *
 * This is a compile-time assertion with no runtime body — if the type regresses,
 * `bun run typecheck` fails here. It exists because the obvious-looking
 * `ComponentType<QeetrixIconProps>` does *not* work: props are contravariant, so
 * an icon narrowing `shape` to `"round"` is not assignable to one accepting
 * `"round" | "sharp"`. Every icon shape below is a different narrowing.
 */
const _anyIcon: QeetrixIcon[] = [
  Activity, // both variants
  Litecoin, // outline only
  PresentionChart, // solid only
  ArrowLeft,
];
void _anyIcon;

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

type IconProps = SVGProps<SVGSVGElement> & { variant?: string; shape?: string };
type Icon = ComponentType<IconProps>;

type Artwork = {
  name: string;
  /** Directory this came from, e.g. `round-outline`. */
  style: string;
  shape: string;
  variant: string;
  category: string;
  source: string;
};

/**
 * Every source SVG, keyed by `<shape>-<variant>/<category>/<name>`.
 *
 * Style lives in the directory name as `<shape>-<variant>`, and the two axes map
 * onto the two props. An empty style directory (a `sharp-*` awaiting artwork)
 * simply contributes nothing.
 */
function sources() {
  const out = new Map<string, Artwork>();
  for (const style of readdirSync(join(PKG, "icons"))) {
    const [shape, variant] = style.split("-");
    for (const category of readdirSync(join(PKG, "icons", style))) {
      const dir = join(PKG, "icons", style, category);
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".svg")) continue;
        const name = file.slice(0, -4);
        out.set(`${style}/${category}/${name}`, {
          name,
          style,
          shape,
          variant,
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
function flatten(el: Element): string[] {
  const attrs = [...el.attributes]
    // jsdom lowercases attribute names, so normalise before comparing.
    .map((a) => `${JSX_ATTRS[a.name.replace(/-/g, "")] ?? a.name}=${a.value}`)
    .sort();
  return [
    `${el.tagName.toLowerCase()}|${attrs.join(",")}`,
    ...[...el.children].flatMap((child) => flatten(child)),
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
function flattenSource(source: string): string[] {
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

  return flatten(root);
}

describe("every component holds its source SVG, byte for byte", () => {
  const cases = [...ALL.values()].map((a) => [`${a.style}/${a.name}`, a] as const);

  it.each(cases)("%s", (_label, { name, shape, variant, source }) => {
    const Icon = componentOf(name);
    expect(Icon, `${name} is not exported`).toBeTypeOf("function");
    // Ask for this exact artwork by its two axes.
    const { container } = render(<Icon shape={shape} variant={variant} />);
    const svg = container.querySelector("svg");
    expect(svg, name).not.toBeNull();
    expect(flatten(svg as Element)).toEqual(flattenSource(source));
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
    for (const { name, style, shape, variant } of ALL.values()) {
      const Icon = componentOf(name);
      const { container } = render(<Icon shape={shape} variant={variant} />);
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

describe("the source set holds its invariants", () => {
  // There is no separate validator — the generator preserves whatever it is
  // given. These two checks are therefore the whole guardrail against the two
  // mistakes that would otherwise pass silently: artwork that cannot be themed,
  // and artwork that does not sit on the shared grid.

  it("draws every icon on the 24×24 grid", () => {
    // A different viewBox is not rejected by the generator, and the byte-for-byte
    // test would happily confirm the wrong grid was faithfully copied. Nothing
    // else would notice until an icon visibly failed to line up.
    const wrong: string[] = [];
    for (const { style, name, source } of ALL.values()) {
      const viewBox = source.match(/viewBox="([^"]*)"/)?.[1];
      if (viewBox !== "0 0 24 24") wrong.push(`${style}/${name}: viewBox="${viewBox}"`);
    }
    expect(wrong).toEqual([]);
  });

  it("paints every icon in flat white, so the colour swap can reach all of it", () => {
    // The generator only rewrites the exact value `white`. A hex, rgb() or named
    // colour survives untouched and silently produces an unthemeable icon, so
    // catch it at the source rather than in review.
    const offenders: string[] = [];
    for (const { style, name, source } of ALL.values()) {
      for (const m of source.matchAll(/(fill|stroke)="([^"]*)"/g)) {
        const [, attr, value] = m;
        if (!["white", "none", "currentColor"].includes(value)) {
          offenders.push(`${style}/${name}: ${attr}="${value}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("routes every rendered icon's paint through currentColor", () => {
    // The sampled version above covers six icons; this covers all 2307 artworks,
    // which is what actually catches a stray colour in a newly added file.
    const offenders: string[] = [];
    for (const { style, name, shape, variant } of ALL.values()) {
      const Icon = componentOf(name);
      const { container } = render(<Icon shape={shape} variant={variant} />);
      for (const el of container.querySelectorAll("path, g")) {
        for (const attr of ["fill", "stroke"]) {
          const v = el.getAttribute(attr);
          if (v !== null && !["currentColor", "none"].includes(v)) {
            offenders.push(`${style}/${name}: ${attr}="${v}"`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
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
  // Icons shipping both variants of the same shape, so switching is observable.
  // Capped at 40 because the byte-for-byte block above already covers all 2307
  // files; this block is about the branching, not the geometry.
  const paired = [...ALL.values()]
    .flatMap((a) => {
      if (a.variant !== "outline") return [];
      const solid = ALL.get(`${a.shape}-solid/${a.category}/${a.name}`);
      return solid ? [{ name: a.name, solidSource: solid.source }] : [];
    })
    .slice(0, 40);

  it("has icons shipping both variants to test with", () => {
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
      expect(flatten(rendered as Element)).toEqual(flattenSource(solidSource));
    },
  );
});

describe("the shape axis", () => {
  const shapes = [...new Set([...ALL.values()].map((a) => a.shape))].sort();
  const variants = [...new Set([...ALL.values()].map((a) => a.variant))].sort();

  it("only exposes shapes that have artwork on disk", () => {
    // `sharp-outline/` and `sharp-solid/` exist but are empty until the sharp
    // artwork lands, so `sharp` must not be reachable yet. When those directories
    // are populated this assertion is the one that will fail, which is the point:
    // it forces the docs and the example to be updated alongside.
    const styleDirs = readdirSync(join(PKG, "icons")).sort();
    const populated = styleDirs.filter((d) => [...ALL.values()].some((a) => a.style === d));
    expect(styleDirs).toEqual(["round-outline", "round-solid", "sharp-outline", "sharp-solid"]);
    expect(populated).toEqual(["round-outline", "round-solid"]);
    expect(shapes).toEqual(["round"]);
    expect(variants).toEqual(["outline", "solid"]);
  });

  it("accepts the shape prop without it reaching the DOM", () => {
    // While only one shape exists the prop is inert, but it must still be
    // accepted so generic call sites compile, and must never leak as an attribute.
    for (const name of ["activity", "user", "search"]) {
      const Icon = componentOf(name);
      if (typeof Icon !== "function") continue;
      const { container } = render(<Icon shape="round" />);
      const svg = container.querySelector("svg");
      expect(svg?.hasAttribute("shape"), name).toBe(false);
      // And it renders the same thing as omitting it.
      expect(container.innerHTML).toBe(render(<Icon />).container.innerHTML);
    }
  });

  it("names every source directory as <shape>-<variant>", () => {
    for (const dir of readdirSync(join(PKG, "icons"))) {
      const parts = dir.split("-");
      expect(parts.length, dir).toBe(2);
      expect(["round", "sharp"], dir).toContain(parts[0]);
      expect(["outline", "solid"], dir).toContain(parts[1]);
    }
  });
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
