import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { iconSystem } from "../config/icon-system.js";
import {
  analyzePathData,
  outlineContext,
  sharpenOutline,
  sharpenPathData,
} from "../scripts/lib/sharp.js";
import { syntheticSvg } from "./helpers.js";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
/** Round outlines; icons/outline before the move to icons/round-outline. */
const roundOutlineRoot = ["icons/round-outline", "icons/outline"]
  .map((directory) => join(repositoryRoot, directory))
  .find((directory) => existsSync(directory)) as string;

/** The geometry elements of a sharpened source, one per line. */
function elements(source: string): string[] {
  return source.split("\n").filter((line) => line.startsWith("  <"));
}

/** Sharpens a single element and returns it. */
function sharpenOne(element: string): string {
  return elements(sharpenOutline(syntheticSvg({}, element)))[0];
}

describe("sharp outline sources", () => {
  it("write the sharp stroke style on the root, from the icon system", () => {
    const { sharp, strokeWidth } = iconSystem.design;
    const root = sharpenOutline(syntheticSvg()).split("\n")[0];
    expect(root).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconSystem.architecture.viewBox}" fill="none" stroke="${iconSystem.architecture.color}" stroke-width="${strokeWidth}" stroke-linecap="${sharp.linecap}" stroke-linejoin="${sharp.linejoin}" stroke-miterlimit="${sharp.miterLimit}">`,
    );
    // A miter limit of 4 lets acute tips (a star's, a triangle's) come to a point.
    expect(root).toContain('stroke-linecap="square" stroke-linejoin="miter" stroke-miterlimit="4"');
  });

  it("keep every element, in order, one per line", () => {
    const source = syntheticSvg(
      {},
      [
        '<path d="M6 22a2 2 0 0 1-2-2V4"/>',
        '<circle cx="12" cy="12" r="1"/>',
        '<rect width="18" height="18" x="3" y="3" rx="2"/>',
        '<line x1="2" x2="22" y1="2" y2="22"/>',
        '<polyline points="9 6 15 12 9 18"/>',
        '<ellipse cx="12" cy="5" rx="9" ry="3"/>',
        '<circle cx="12" cy="12" r="10"/>',
      ].join(""),
    );
    const sharp = sharpenOutline(source);
    expect(sharp.endsWith("</svg>\n")).toBe(true);
    expect(elements(sharp)).toEqual([
      '  <path d="M6 22H4V4"/>',
      '  <rect width="2" height="2" x="11" y="11"/>',
      '  <rect width="18" height="18" x="3" y="3"/>',
      '  <line x1="2" x2="22" y1="2" y2="22"/>',
      '  <polyline points="9 6 15 12 9 18"/>',
      '  <ellipse cx="12" cy="5" rx="9" ry="3"/>',
      '  <circle cx="12" cy="12" r="10"/>',
    ]);
  });

  it("square a rect's corner roundings but keep pills and circles", () => {
    expect(sharpenOne('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>')).toBe(
      '  <rect width="18" height="18" x="3" y="3"/>',
    );
    expect(sharpenOne('<rect width="10" height="6" x="7" y="9" rx="2"/>')).toBe(
      '  <rect width="10" height="6" x="7" y="9"/>',
    );
    // The mic capsule, toggle-left's track, a radius given as ry alone, and a circle.
    for (const pill of [
      '<rect x="9" y="2" width="6" height="13" rx="3"/>',
      '<rect width="20" height="14" x="2" y="5" rx="7"/>',
      '<rect x="15" y="4" width="4" height="6" ry="2"/>',
      '<rect width="6" height="6" x="9" y="9" rx="3"/>',
    ]) {
      expect(sharpenOne(pill)).toBe(`  ${pill}`);
    }
  });

  it("turn dots into squares on the same center, keeping their fill", () => {
    expect(sharpenOne('<circle cx="12" cy="12" r="1"/>')).toBe(
      '  <rect width="2" height="2" x="11" y="11"/>',
    );
    expect(sharpenOne('<circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>')).toBe(
      '  <rect width="1" height="1" x="7" y="7" fill="currentColor"/>',
    );
    for (const circle of [
      '<circle cx="12" cy="12" r="1.5"/>',
      '<circle cx="12" cy="12" r="10"/>',
    ]) {
      expect(sharpenOne(circle)).toBe(`  ${circle}`);
    }
    // Zero-length dots are squared by the caps alone.
    expect(sharpenOne('<path d="M12 17h.01"/>')).toBe('  <path d="M12 17h.01"/>');
  });

  it("be idempotent", () => {
    const sources = [
      syntheticSvg({}, '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2z"/>'),
      syntheticSvg({}, '<circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>'),
      syntheticSvg({}, '<rect width="6" height="13" x="9" y="2" rx="3"/>'),
    ];
    for (const source of sources) {
      const once = sharpenOutline(source);
      expect(sharpenOutline(once)).toBe(once);
    }
  });
});

describe("sharp path data", () => {
  it("replaces a corner arc with the point where its end tangents meet", () => {
    expect(sharpenPathData("M6 22a2 2 0 0 1-2-2V4")).toBe("M6 22H4V4");
    // Lucide's file: 90° corners and the two 45° chamfer arcs of the folded corner.
    expect(
      sharpenPathData(
        "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
      ),
    ).toBe("M4 22V2H14.998L20 7.002V22Z");
  });

  it("replaces small cubic and quadratic corners", () => {
    expect(sharpenPathData("M4 16c-1.1 0-2-.9-2-2V4")).toBe("M4 16H2V4");
    expect(sharpenPathData("M2 2h4q2 0 2 2v6")).toBe("M2 2H8V10");
  });

  it("keeps genuine curves", () => {
    for (const d of [
      // A shackle (radius 5) and a bar's round end drawn as one 180° arc.
      "M7 11V7a5 5 0 0 1 10 0v4",
      "M4 12h10a2 2 0 0 1 0 4H4",
      // A round end drawn as two quarter arcs that carry each other on.
      "M4 4h6a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4",
      // An S-curve: its control points lie on both sides of the chord.
      "M0 12h2c1 0 2 3 2 2v-4",
      // A lens: two curves meeting at angles are its sides, not roundings.
      "M6 11c1.5 0 3 .5 3 2-2 0-3 0-3-2z",
      // A lone curved stroke (a mask's eye slit).
      "M6 11c1.5 0 2.5.5 3 2",
    ]) {
      expect(sharpenPathData(d)).toBe(d);
    }
  });

  it("squares the small rounding between much flatter curves, as at an eye's corners", () => {
    const eye =
      "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0";
    expect(analyzePathData(eye).map(({ result }) => result)).toEqual(["corner", "corner"]);
    expect(sharpenPathData(eye)).toBe(
      "M2.062 12.348L1.933 12L2.062 11.652A10.75 10.75 0 0 1 21.938 11.652L22.067 12L21.938 12.348A10.75 10.75 0 0 1 2.062 12.348",
    );
  });

  it("brings acute tips to a point", () => {
    expect(sharpenPathData("M8 16 12 8a1 1 0 0 1 1.789 0L18 16")).toBe("M8 16L12.872 6.257L18 16");
    // Lucide's star: tips of 128° come to points, unless the point would leave the canvas.
    const star =
      "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z";
    const tips = analyzePathData(star).filter(({ turn }) => turn > 90);
    expect(tips.map(({ result }) => result)).toEqual([
      "chamfer",
      "chamfer",
      "corner",
      "corner",
      "chamfer",
    ]);
  });

  it("keeps wave crests, hooks, and tips that would grow a spike round", () => {
    // A tilde: two wide roundings bending opposite ways carry each other on.
    const tilde = "M8 14a2.5 2.5 0 0 1 4 0 2.5 2.5 0 0 0 4 0";
    expect(sharpenPathData(tilde)).toBe(tilde);
    // An S's end: a wide rounding where the path stops is a hook.
    const hook = "M16 4H9a3 3 0 0 0-2.83 4";
    expect(sharpenPathData(hook)).toBe(hook);
    // A croissant's 148° horn on a radius of 2 would reach far past the round drawing: cut flat.
    const croissant =
      "M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676";
    const horn = analyzePathData(croissant).find(({ turn }) => turn > 140);
    expect(horn?.result).toBe("chamfer");
  });

  it("cuts a plain vertex flat where its miter would leave the canvas", () => {
    expect(sharpenPathData("m12 1.5 9 20H3z")).toBe("M12.103 1.728L21 21.5H3L11.897 1.728Z");
    expect(sharpenOne('<polygon points="12 2 19 21 12 17 5 21 12 2"/>')).toBe(
      '  <polygon points="12.086 2.235 19 21 12 17 5 21 11.914 2.235"/>',
    );
    // Clear of the edges, the same vertex comes to a point.
    expect(sharpenPathData("m12 6 6 14H6z")).toBe("m12 6 6 14H6z");
  });

  it("keeps listed figurative circles round, such as a figure's head", () => {
    const figure = syntheticSvg({}, '<circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/>');
    expect(elements(sharpenOutline(figure, "person-standing"))[0]).toBe(
      '  <circle cx="12" cy="5" r="1"/>',
    );
    expect(elements(sharpenOutline(figure, "some-other-icon"))[0]).toBe(
      '  <rect width="2" height="2" x="11" y="4"/>',
    );
  });

  it("keeps smooth curves' shapes when the segment before them is replaced", () => {
    // The S reflects the replaced cubic's control point (8 2.9), not the new corner.
    expect(sharpenPathData("M2 2h4c1.1 0 2 .9 2 2s2 6 6 6")).toBe("M2 2H8V4C8 5.1 10 10 14 10");
    // Likewise T reflects the replaced quadratic's control point (8 2).
    expect(sharpenPathData("M2 2h4q2 0 2 2t2 6")).toBe("M2 2H8V4Q8 6 10 10");
  });

  it("parses packed numbers, flags, exponents, and implicit commands", () => {
    expect(sharpenPathData("M3 3h4.5.5a1 1 0 0 1 1 1v1e1")).toBe("M3 3H9V14");
    expect(sharpenPathData("M1 1h4a1 1 0 011 1v4")).toBe("M1 1H6V6");
    expect(sharpenPathData("m6 6 4 0a1 1 0 0 1 1 1l0 4z")).toBe("M6 6H11V11Z");
    expect(sharpenPathData("M10 2a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h4")).toBe("M10 2H9V7H14");
    expect(() => sharpenPathData("M1 1a1 1 0 2 1 2 2")).toThrow(/arc flag/);
  });

  it("stops a partial rounding at the corner where the path ends", () => {
    // A back page fading out behind the front one, in Lucide's files.
    expect(sharpenPathData("M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1")).toBe(
      "M5 7H3V22H14.155",
    );
  });

  it("cuts a corner flat where a point would leave the canvas", () => {
    const diamond =
      "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z";
    expect(analyzePathData(diamond).map(({ result }) => result)).toEqual([
      "chamfer",
      "chamfer",
      "chamfer",
      "chamfer",
    ]);
    // Each tip is cut along the tangent at the rounding's middle, where the round stroke reached.
    expect(sharpenPathData(diamond)).toBe(
      "M1.993 11.007V13.003L10.997 22.007H12.993L21.997 13.003V11.007L12.993 2.003H10.997Z",
    );
  });

  it("cuts a corner flat where a point would run through another stroke", () => {
    const back = "M22 6a2 2 0 0 0-3.414-1.414l-6 6a2 2 0 0 0 0 2.828l6 6A2 2 0 0 0 22 18z";
    const rewind = syntheticSvg(
      {},
      `<path d="M12 6a2 2 0 0 0-3.414-1.414l-6 6a2 2 0 0 0 0 2.828l6 6A2 2 0 0 0 12 18z"/><path d="${back}"/>`,
    );
    // Alone, the back triangle's left tip squares; beside the front triangle it would pierce its
    // side. (Its two 135° corners at the right edge would leave the canvas either way.)
    const results = (context?: ReturnType<typeof outlineContext>) =>
      analyzePathData(back, context).map(({ result }) => result);
    expect(results()).toEqual(["chamfer", "corner", "chamfer"]);
    expect(results(outlineContext(rewind, 1))).toEqual(["chamfer", "chamfer", "chamfer"]);
    expect(elements(sharpenOutline(rewind))[1]).toBe(
      '  <path d="M22 4.664L19.531 3.641L12 11.172V12.828L19.531 20.359L22 19.336Z"/>',
    );
  });

  it("squares a lone corner piece only where another stroke carries its tangent on", () => {
    const dashed = syntheticSvg({}, '<path d="M5 3a2 2 0 0 0-2 2"/><path d="M9 3h1"/>');
    expect(elements(sharpenOutline(dashed))[0]).toBe('  <path d="M5 3H3V5"/>');
    // A highlight inside a balloon is a curve.
    const highlight = syntheticSvg(
      {},
      '<path d="M12 6a2 2 0 0 1 2 2"/><circle cx="12" cy="8" r="6"/>',
    );
    expect(elements(sharpenOutline(highlight))[0]).toBe('  <path d="M12 6a2 2 0 0 1 2 2"/>');
  });

  it("writes absolute commands with at most three decimals and no negative zero", () => {
    expect(sharpenPathData("M2 4h1.23456a1 1 0 0 1 1 1v1")).toBe("M2 4H4.235V6");
    expect(sharpenPathData("M-.0004 5h5a1 1 0 0 1 1 1v4")).toBe("M0 5H6V10");
  });
});

describe("the repository's outlines", () => {
  const sources = readdirSync(roundOutlineRoot).flatMap((category) =>
    readdirSync(join(roundOutlineRoot, category))
      .filter((file) => file.endsWith(".svg"))
      .map((file) => ({
        name: file.slice(0, -4),
        source: readFileSync(join(roundOutlineRoot, category, file), "utf8"),
      })),
  );

  it("all sharpen, keeping their elements, and sharpening again changes nothing", () => {
    expect(sources.length).toBeGreaterThan(1000);
    const problems: string[] = [];
    for (const { name, source } of sources) {
      const sharp = sharpenOutline(source, name);
      const tags = (svg: string) =>
        elements(svg).map((line) => (/^ {2}<(\w+)/.exec(line) as RegExpExecArray)[1]);
      const before = tags(source);
      const after = tags(sharp);
      // Only dots change element, from circle to rect.
      const kept =
        before.length === after.length &&
        before.every(
          (tag, index) => tag === after[index] || (tag === "circle" && after[index] === "rect"),
        );
      if (!kept) problems.push(`${name}: elements changed`);
      if (sharpenOutline(sharp, name) !== sharp) problems.push(`${name}: not idempotent`);
    }
    expect(problems).toEqual([]);
  });
});
