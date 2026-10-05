import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { iconSystem } from "../config/icon-system.js";
import { loadCanvasKit, outlineShapes } from "../scripts/lib/filled.js";
import { analyzePathData, sharpenOutline, sharpenPathData } from "../scripts/lib/sharp.js";
import { syntheticSvg } from "./helpers.js";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const icons = (folder: string) => join(repositoryRoot, "icons", folder);

/** The geometry elements of a source, one per line. */
function elements(source: string): string[] {
  return source.split("\n").filter((line) => line.startsWith("  <"));
}

/** Sharpens a single synthetic element and returns it. */
function sharpenOne(element: string): string {
  return elements(sharpenOutline(syntheticSvg({}, element)))[0];
}

/** Round outline sources by name, with their category. */
const roundSources = new Map<string, { category: string; source: string }>();
for (const category of readdirSync(icons("round-outline"))) {
  for (const file of readdirSync(join(icons("round-outline"), category))) {
    if (!file.endsWith(".svg")) continue;
    const source = readFileSync(join(icons("round-outline"), category, file), "utf8");
    roundSources.set(file.slice(0, -4), { category, source });
  }
}

/** A repository icon sharpened, element by element. */
function sharpIcon(name: string): string[] {
  const round = roundSources.get(name);
  if (!round) throw new Error(`No outline named ${name}.`);
  return elements(sharpenOutline(round.source, name));
}

/** The path data of one element line. */
const pathData = (line: string) => (/ d="([^"]*)"/.exec(line) as RegExpExecArray)[1];

/** Directions, in degrees modulo 180, of the straight segments of absolute path data. */
function lineAngles(d: string): number[] {
  const angles: number[] = [];
  let current: [number, number] = [0, 0];
  let start: [number, number] = [0, 0];
  for (const [, command, rest] of d.matchAll(/([MLHVCAZ])([^MLHVCAZ]*)/g)) {
    const n = rest
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    let next: [number, number] = current;
    if (command === "M") start = next = [n[0], n[1]];
    else if (command === "L") next = [n[0], n[1]];
    else if (command === "H") next = [n[0], current[1]];
    else if (command === "V") next = [current[0], n[0]];
    else if (command === "Z") next = start;
    else next = [n.at(-2) as number, n.at(-1) as number];
    if ("LHVZ".includes(command)) {
      const [dx, dy] = [next[0] - current[0], next[1] - current[1]];
      if (Math.hypot(dx, dy) > 1e-6) {
        angles.push(((((Math.atan2(dy, dx) * 180) / Math.PI) % 180) + 180) % 180);
      }
    }
    current = next;
  }
  return angles;
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
        '<path d="M8 20a2 2 0 0 1-2-2V8"/>',
        '<circle cx="18" cy="18" r="1"/>',
        '<rect width="6" height="6" x="14" y="4" rx="1"/>',
        '<line x1="4" x2="10" y1="4" y2="4"/>',
        '<polyline points="13 13 15 15 17 13"/>',
        '<ellipse cx="12" cy="12" rx="2" ry="1"/>',
        '<circle cx="18" cy="10" r="2"/>',
      ].join(""),
    );
    const sharp = sharpenOutline(source);
    expect(sharp.endsWith("</svg>\n")).toBe(true);
    expect(elements(sharp)).toEqual([
      '  <path d="M8 20H6V8"/>',
      '  <rect width="2" height="2" x="17" y="17"/>',
      '  <rect width="6" height="6" x="14" y="4"/>',
      '  <line x1="4" x2="10" y1="4" y2="4"/>',
      '  <polyline points="13 13 15 15 17 13"/>',
      '  <ellipse cx="12" cy="12" rx="2" ry="1"/>',
      '  <circle cx="18" cy="10" r="2"/>',
    ]);
  });

  it("square a rect's corner roundings but keep pills and circles", () => {
    expect(sharpenOne('<rect width="10" height="6" x="7" y="9" rx="2"/>')).toBe(
      '  <rect width="10" height="6" x="7" y="9"/>',
    );
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

  it("draw a dot kept round with round caps, which paint it round under the square root", () => {
    const face = syntheticSvg(
      {},
      '<circle cx="12" cy="12" r="10"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
    );
    expect(elements(sharpenOutline(face, "face", [1, 2]))).toEqual([
      '  <circle cx="12" cy="12" r="10"/>',
      '  <path d="M9 9h.01" stroke-linecap="round"/>',
      '  <path d="M15 9h.01" stroke-linecap="round"/>',
    ]);
    expect(elements(sharpenOutline(face, "face"))[1]).toBe('  <path d="M9 9h.01"/>');
  });

  it("be idempotent", () => {
    for (const source of [
      syntheticSvg({}, '<path d="M6 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8l6 6v8a2 2 0 0 1-2 2z"/>'),
      syntheticSvg({}, '<circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>'),
      syntheticSvg({}, '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
    ]) {
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
    ).toBe("M4 2H14.998L20 7.002V22H4Z");
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
      // A lone curved stroke (a mask's eye slit), a tilde's crests, and an S's hook.
      "M6 11c1.5 0 2.5.5 3 2",
      "M8 14a2.5 2.5 0 0 1 4 0 2.5 2.5 0 0 0 4 0",
      "M16 4H9a3 3 0 0 0-2.83 4",
    ]) {
      expect(sharpenPathData(d)).toBe(d);
    }
  });

  it("squares the small rounding between much flatter curves, as at an eye's corners", () => {
    const eye =
      "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0";
    expect(analyzePathData(eye).map(({ result }) => result)).toEqual(["corner", "corner"]);
  });

  it("brings acute tips to a point", () => {
    // Lucide's star: every tip comes to a point at path level.
    const star =
      "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z";
    const tips = analyzePathData(star).filter(({ turn }) => turn > 90);
    expect(tips.map(({ result }) => result)).toEqual(Array(5).fill("corner"));
    expect(sharpenPathData("m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16")).toBe(
      "M2 16L6.501 5.203L11 16",
    );
  });

  it("cuts the acute tips of elements listed in tipHeight at the round extent", () => {
    // An A's apex, which would otherwise tower over the letters beside it.
    const letter = syntheticSvg({}, '<path d="m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16"/>');
    expect(elements(sharpenOutline(letter, "letter", [], [0]))[0]).toBe(
      '  <path d="M2.313 15.25L6.167 6.002H6.834L10.687 15.25"/>',
    );
    expect(elements(sharpenOutline(letter, "letter"))[0]).toBe(
      '  <path d="M2.313 15.25L6.501 5.203L10.687 15.25"/>',
    );
  });

  it("keeps smooth curves' shapes when the segment before them is replaced", () => {
    expect(sharpenPathData("M2 2h4c1.1 0 2 .9 2 2s2 6 6 6")).toBe("M2 2H8V4C8 5.1 10 10 14 10");
    expect(sharpenPathData("M2 2h4q2 0 2 2t2 6")).toBe("M2 2H8V4Q8 6 10 10");
  });

  it("parses packed numbers, flags, exponents, and implicit commands", () => {
    expect(sharpenPathData("M3 3h4.5.5a1 1 0 0 1 1 1v1e1")).toBe("M3 3H9V14");
    expect(sharpenPathData("M1 1h4a1 1 0 011 1v4")).toBe("M1 1H6V6");
    expect(sharpenPathData("m6 6 4 0a1 1 0 0 1 1 1l0 4z")).toBe("M6 6H11V11Z");
    expect(() => sharpenPathData("M1 1a1 1 0 2 1 2 2")).toThrow(/arc flag/);
  });

  it("stops a partial rounding at the corner where the path ends", () => {
    // A back page fading out behind the front one, in Lucide's files.
    expect(sharpenPathData("M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1")).toBe(
      "M5 7H3V22H14.155",
    );
  });

  it("writes absolute commands with at most three decimals and no negative zero", () => {
    expect(sharpenPathData("M2 4h1.23456a1 1 0 0 1 1 1v1")).toBe("M2 4H4.235V6");
    expect(sharpenPathData("M-.0004 5h5a1 1 0 0 1 1 1v4")).toBe("M0 5H6V10");
  });
});

describe("fitting a sharp icon", () => {
  it("hides a square cap that ends on another stroke, as a butt end", () => {
    const arrow = elements(
      sharpenOutline(syntheticSvg({}, '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>')),
    );
    expect(arrow).toEqual(['  <path d="M5 12H18"/>', '  <path d="m12 5 7 7-7 7"/>']);
    const mail = syntheticSvg(
      {},
      '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
    );
    expect(elements(sharpenOutline(mail))[0]).toBe(
      '  <path d="M21.157 7.537L12.005 13.367L2.844 7.537"/>',
    );
  });

  it("cuts a miter flat where it would cross the padding, keeping both edges' directions", () => {
    expect(sharpenOne('<path d="m12 1.5 9 20H3z"/>')).toBe(
      '  <path d="M12.107 1.737L21 21.5H3L11.893 1.737Z"/>',
    );
    expect(sharpenOne('<polygon points="12 2 19 21 12 17 5 21 12 2"/>')).toBe(
      '  <polygon points="12.104 2.282 18.896 20.718 18.74 20.851 12 17 5.26 20.851 5.104 20.718 11.896 2.282"/>',
    );
    // Clear of the padding, the same vertex comes to a point.
    expect(sharpenOne('<path d="m12 6 6 14H6z"/>')).toBe('  <path d="m12 6 6 14H6z"/>');
  });

  it("gives symmetric shapes symmetric cuts", () => {
    const diamond =
      "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z";
    expect(sharpenOne(`<path d="${diamond}"/>`)).toBe(
      '  <path d="M12.999 22.001L21.991 13.009V11.001L12.999 2.009H10.991L1.999 11.001V13.009L10.991 22.001Z"/>',
    );
  });
});

describe("the repository's outlines", () => {
  it("keep lines that pass through a stroke at full length", () => {
    // Calendar tabs run through the frame; slider knobs and a crossbar run across their bars.
    expect(sharpIcon("calendar").slice(0, 2)).toEqual([
      '  <path d="M8 2v3"/>',
      '  <path d="M16 2v3"/>',
    ]);
    expect(sharpIcon("file-sliders")[3]).toBe('  <path d="M10 11v2"/>');
    expect(sharpIcon("file-type")[2]).toBe('  <path d="M11 18h2"/>');
    expect(sharpIcon("square-pilcrow")[1]).toContain("H17");
    // A slash across a frame's corner reaches as far as the padding allows.
    expect(sharpIcon("calendar-off")[1]).toBe('  <path d="M2.419 2.419L21.581 21.581"/>');
  });

  it("trim attached ends by no more than a cap, kept-round elements included", () => {
    expect(pathData(sharpIcon("mail-clock")[2]).endsWith("V8")).toBe(true);
    // earth's coastlines keep their curves but end inside the globe.
    expect(pathData(sharpIcon("earth")[0])).toBe("M20.54 15H17A2 2 0 0 0 15 17V20.54");
  });

  it("join strokes that meet at a point into one corner", () => {
    expect(sharpIcon("shrink")[0]).toBe('  <path d="M15 15L21 21M16 15H15V19.8M15 16V15H19.8"/>');
    expect(sharpIcon("square-arrow-down-left").slice(0, 2)).toEqual([
      '  <path d="M15 15H9.3L9.212 14.788L15 9"/>',
      '  <path d="M10 15H9V9"/>',
    ]);
    expect(sharpIcon("file-output")[2]).toBe(
      '  <path d="M5 11L2.113 13.887V14.113L2.707 14.707"/>',
    );
    expect(sharpIcon("image-off")[3]).toBe('  <path d="M18 12L21 15V14"/>');
  });

  it("cut a miter only where it crosses the padding or harms a neighbour", () => {
    // Clean miters: file bodies, binocular shoulders, sticky notes, a cube's free vertex.
    expect(sharpIcon("file")[0]).toBe('  <path d="M4 2H14.998L20 7.002V22H4Z"/>');
    expect(sharpIcon("sticky-note")[0]).toBe('  <path d="M16 3H3V21H21V8Z"/>');
    expect(pathData(sharpIcon("binoculars")[2])).toContain("V7H14V21");
    expect(pathData(sharpIcon("file-box")[3])).toContain("L7.005 10.69");
    // A scale pan's apex would spike through the beam; a radical's tip would close the gap to
    // its frame; a ferris wheel's frame would reach into the hub's hole.
    expect(pathData(sharpIcon("scale")[1])).toMatch(/^M19\.105 8\.281L/);
    expect(pathData(sharpIcon("square-radical")[0])).toBe(
      "M7 12H9L10.866 16.666L11.071 16.647L13 7H17",
    );
    expect(pathData(sharpIcon("ferris-wheel")[6])).toContain("L11.895 14.281H12.105");
  });

  it("keep edges' directions when cutting corners", () => {
    for (const d of sharpIcon("component").map(pathData)) {
      for (const angle of lineAngles(d)) {
        expect(Math.min(angle % 45, 45 - (angle % 45))).toBeLessThan(0.5);
      }
    }
    // land-plot's flag pole stays upright.
    expect(pathData(sharpIcon("land-plot")[0])).toMatch(/L12 [\d.]+V12$/);
  });

  it("keep mirror twins symmetric", () => {
    // An A's feet and an arrowhead's arms end at the same height; the A's apex, listed in
    // config/derived tipHeight, is cut flat at the round A's height and centred.
    const [arrow, , letter] = sharpIcon("a-arrow-down").map(pathData);
    expect(arrow).toBe("M14.419 12.419L18 16L21.581 12.419");
    expect(letter).toBe("M2.313 15.25L6.167 6.002H6.834L10.687 15.25");
    // triangle-alert, which starts mid-edge, gets identical bottom corners and a narrow apex flat.
    const triangle = pathData(sharpIcon("triangle-alert")[0]);
    expect(triangle).toBe("M11.395 1.997L2.134 18.204L3.756 21H20.224L21.846 18.204L12.585 1.997Z");
    // The scale's pans are cut alike on both sides.
    const pan = pathData(sharpIcon("scale")[1]);
    expect(pan).toContain("L21.951 15.869L21.887 16.082");
    expect(pan).toContain("16.113 16.082L16.049 15.869");
  });

  it("bring closed polygons' tips to a point, or a minimal flat at the padding", () => {
    // triangle's apex would paint past the padding: a flat about a unit wide, right at it.
    const triangle = pathData(sharpIcon("triangle")[0]);
    expect(triangle).toBe("M3.776 21H20.224L21.846 18.204L12.585 1.997H11.415L2.154 18.204Z");
    // The star's two lower tips fit inside the padding and stay pointed.
    expect(pathData(sharpIcon("star")[0])).toContain("L18.516 21.274L18.345 21.399L11.999 18.063");
    // A dashed triangle's corner pieces sharpen like the triangle.
    expect(pathData(sharpIcon("triangle-dashed")[0])).toBe(
      "M10.17 4.193L11.439 1.995H12.559L13.836 4.206",
    );
    // A receipt's corners are mitered, with the zigzag meeting them.
    const receipt = pathData(sharpIcon("receipt")[2]);
    expect(receipt).toContain("L20 2V22");
    expect(receipt).not.toMatch(/A/);
  });

  it("square every rounding of a closed shape alike, wherever the path starts", () => {
    expect(pathData(sharpIcon("user-star")[0])).not.toMatch(/[AC]/);
    expect(pathData(sharpIcon("sailboat")[2])).not.toMatch(/A/);
  });

  it("all sharpen, keeping their elements, and sharpening again changes nothing", () => {
    expect(roundSources.size).toBeGreaterThan(1000);
    const problems: string[] = [];
    for (const [name, { source }] of roundSources) {
      const sharp = sharpenOutline(source, name);
      const before = elements(source);
      if (elements(sharp).length !== before.length) problems.push(`${name}: elements changed`);
      if (sharpenOutline(sharp, name) !== sharp) problems.push(`${name}: not idempotent`);
    }
    expect(problems).toEqual([]);
    // Sharpens all ~1,900 outlines twice: several seconds on a CI runner.
  }, 60_000);
});

/**
 * Sharp drawings that still paint past the padding where the round drawing does not, with how far
 * (grid units). Each is a known, reviewed limit of the derivation; none may get worse, and no other
 * drawing may cross by more than 0.01.
 */
const knownCrossings: Readonly<Record<string, number>> = {
  "brick-wall-shield": 0.095,
  brush: 0.109,
  candy: 0.107,
  "candy-off": 0.107,
  cannabis: 0.018,
  carrot: 0.197,
  "chart-pie": 0.05,
  "circle-fading-arrow-up": 0.017,
  "circle-fading-plus": 0.017,
  clapperboard: 0.274,
  "clock-fading": 0.017,
  "cloud-moon": 0.141,
  "cloud-moon-rain": 0.141,
  cloudy: 0.111,
  cookie: 0.041,
  "cooking-pot": 0.212,
  crown: 0.081,
  eye: 0.015,
  "eye-dashed": 0.016,
  "eye-off": 0.015,
  "fish-off": 0.419,
  "fish-symbol": 0.038,
  goal: 0.015,
  hop: 0.419,
  "hop-off": 0.119,
  "land-plot": 0.015,
  leaf: 0.579,
  "map-pin": 0.064,
  "map-pin-check": 0.064,
  "map-pin-check-inside": 0.064,
  "map-pin-minus": 0.064,
  "map-pin-minus-inside": 0.064,
  "map-pin-off": 0.064,
  "map-pin-plus": 0.064,
  "map-pin-plus-inside": 0.064,
  "map-pin-search": 0.067,
  "map-pin-x": 0.064,
  "map-pin-x-inside": 0.064,
  "message-square-dashed": 0.294,
  "messages-circle": 0.271,
  mosque: 0.371,
  mountain: 0.015,
  "mountain-snow": 0.015,
  nut: 0.419,
  "package-x": 0.018,
  paintbrush: 0.331,
  "party-popper": 0.306,
  pipette: 0.217,
  pizza: 0.194,
  "plane-landing": 0.015,
  "plane-takeoff": 0.249,
  "power-off": 0.023,
  radiation: 0.057,
  shield: 0.088,
  "shield-alert": 0.088,
  "shield-ban": 0.088,
  "shield-check": 0.088,
  "shield-cog": 0.088,
  "shield-cog-corner": 0.088,
  "shield-ellipsis": 0.088,
  "shield-half": 0.088,
  "shield-keyhole": 0.088,
  "shield-lock": 0.088,
  "shield-minus": 0.088,
  "shield-off": 0.088,
  "shield-plus": 0.088,
  "shield-question-mark": 0.088,
  "shield-user": 0.088,
  "shield-x": 0.088,
  "spline-pointer": 0.02,
  "sport-shoe": 0.042,
  "square-dashed-mouse-pointer": 0.02,
  "square-mouse-pointer": 0.02,
  tags: 0.237,
  "triangle-right": 0.036,
  umbrella: 0.268,
  "umbrella-off": 0.268,
  "user-shield": 0.095,
};

describe("the repository's sharp drawings", () => {
  it("stay inside the padding, or inside the round drawing where it reaches further", async () => {
    const CK = await loadCanvasKit();
    const inset = iconSystem.design.safeAreaInset;
    const size = iconSystem.architecture.grid.width;
    const painted = (source: string, sharp: boolean) => {
      let box = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, -Infinity, -Infinity];
      for (const shape of outlineShapes(source)) {
        const path = CK.Path.MakeFromSVGString(shape.d);
        if (!path) continue;
        const stroke = path.makeStroked({
          width: iconSystem.design.strokeWidth,
          precision: 64,
          cap: sharp ? CK.StrokeCap.Square : CK.StrokeCap.Round,
          join: sharp ? CK.StrokeJoin.Miter : CK.StrokeJoin.Round,
          miter_limit: iconSystem.design.sharp.miterLimit,
        });
        const bounds = stroke?.computeTightBounds();
        if (bounds && !stroke?.isEmpty()) {
          box = [
            Math.min(box[0], bounds[0]),
            Math.min(box[1], bounds[1]),
            Math.max(box[2], bounds[2]),
            Math.max(box[3], bounds[3]),
          ];
        }
        stroke?.delete();
        path.delete();
      }
      return box;
    };
    const failures: string[] = [];
    for (const [name, { category, source }] of roundSources) {
      const round = painted(source, false);
      const allowed = [
        Math.min(inset, round[0]),
        Math.min(inset, round[1]),
        Math.max(size - inset, round[2]),
        Math.max(size - inset, round[3]),
      ];
      const over = (box: number[]) =>
        Math.max(
          allowed[0] - box[0],
          allowed[1] - box[1],
          box[2] - allowed[2],
          box[3] - allowed[3],
        );
      const outline = join(icons("sharp-outline"), category, `${name}.svg`);
      const limit = (knownCrossings[name] ?? 0) + 0.01;
      const outlineOver = over(painted(readFileSync(outline, "utf8"), true));
      if (outlineOver > limit) failures.push(`${name}: outline ${outlineOver.toFixed(3)}`);
      const filled = join(icons("sharp-filled"), category, `${name}.svg`);
      if (existsSync(filled)) {
        const d = / d="([^"]*)"/.exec(readFileSync(filled, "utf8"))?.[1] ?? "";
        const path = CK.Path.MakeFromSVGString(d);
        const bounds = path?.computeTightBounds();
        path?.delete();
        const filledOver = bounds ? over(Array.from(bounds)) : 0;
        if (filledOver > limit) failures.push(`${name}: filled ${filledOver.toFixed(3)}`);
      }
    }
    expect(failures).toEqual([]);
  }, 60_000);
});
