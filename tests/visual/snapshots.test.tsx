import { render } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import * as pkg from "../../src/index.js";
import { icons } from "../../src/metadata.js";
import type { QeetrixIconProps } from "../../src/types.js";

/**
 * Visual regression, via rendered markup rather than pixels.
 *
 * A pixel-diffing setup (Playwright, a headless browser, per-icon PNGs) would
 * cost a browser download in CI and a binary artifact per icon, and would flag
 * font and anti-aliasing drift as icon changes. Snapshotting the rendered SVG
 * catches every change that could alter the drawing — geometry, attributes,
 * element order, the size and stroke defaults — with a text diff a reviewer can
 * actually read, and it scales to 500+ icons at no cost.
 *
 * What it deliberately does not catch is whether a glyph *looks* right. That is
 * a human judgement, and `bun run gallery` is the tool for it.
 *
 * When an icon is intentionally redrawn, `bun run test -- -u` re-records the
 * snapshot, and the diff in the PR shows exactly what changed about the shape.
 */

const componentOf = (name: string) =>
  (pkg as unknown as Record<string, ComponentType<QeetrixIconProps>>)[name];

const cases = icons.map((icon) => [icon.name, icon.component] as const);

describe("every icon renders stable markup", () => {
  it.each(cases)("%s", (_name, component) => {
    const Icon = componentOf(component);
    const { container } = render(<Icon />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe("every icon renders at the four review sizes", () => {
  // Guards the size prop across the whole set, not just one sample icon: a
  // component that hard-coded width/height would only show up here.
  it.each([16, 20, 24, 32])("all icons honour size=%i", (size) => {
    const wrong: string[] = [];
    for (const icon of icons) {
      const Icon = componentOf(icon.component);
      const { container } = render(<Icon size={size} />);
      const svg = container.querySelector("svg");
      if (svg?.getAttribute("width") !== String(size)) wrong.push(icon.name);
      if (svg?.getAttribute("height") !== String(size)) wrong.push(icon.name);
    }
    expect(wrong).toEqual([]);
  });
});

describe("the whole set holds the visual contract", () => {
  const rendered = icons.map((icon) => {
    const Icon = componentOf(icon.component);
    const { container } = render(<Icon />);
    return { icon, svg: container.querySelector("svg") as SVGSVGElement };
  });

  it("every icon uses the 24×24 grid", () => {
    const wrong = rendered.filter(({ svg }) => svg.getAttribute("viewBox") !== "0 0 24 24");
    expect(wrong.map(({ icon }) => icon.name)).toEqual([]);
  });

  it("every icon strokes in currentColor and fills nothing", () => {
    const wrong = rendered.filter(
      ({ svg }) =>
        svg.getAttribute("stroke") !== "currentColor" || svg.getAttribute("fill") !== "none",
    );
    expect(wrong.map(({ icon }) => icon.name)).toEqual([]);
  });

  it("every icon uses stroke width 2 with round caps and joins", () => {
    const wrong = rendered.filter(
      ({ svg }) =>
        svg.getAttribute("stroke-width") !== "2" ||
        svg.getAttribute("stroke-linecap") !== "round" ||
        svg.getAttribute("stroke-linejoin") !== "round",
    );
    expect(wrong.map(({ icon }) => icon.name)).toEqual([]);
  });

  it("no icon hard-codes a colour anywhere in its geometry", () => {
    const offenders: string[] = [];
    for (const { icon, svg } of rendered) {
      for (const el of svg.querySelectorAll("*")) {
        for (const attr of ["fill", "stroke", "style"]) {
          const value = el.getAttribute(attr);
          if (value && !["none", "currentColor", "inherit", "transparent"].includes(value)) {
            offenders.push(`${icon.name}: ${attr}="${value}"`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no icon carries an id, which would collide across a page", () => {
    const offenders = rendered.filter(({ svg }) => svg.querySelector("[id]") !== null);
    expect(offenders.map(({ icon }) => icon.name)).toEqual([]);
  });

  it("every icon draws something", () => {
    const empty = rendered.filter(({ svg }) => svg.children.length === 0);
    expect(empty.map(({ icon }) => icon.name)).toEqual([]);
  });

  it("no icon exceeds the complexity budget", () => {
    // docs/icon-design-system.md §2: more than 6 subpaths does not survive 16px.
    const tooComplex = rendered
      .map(({ icon, svg }) => ({ name: icon.name, count: svg.querySelectorAll("*").length }))
      .filter(({ count }) => count > 6);
    expect(tooComplex).toEqual([]);
  });
});
