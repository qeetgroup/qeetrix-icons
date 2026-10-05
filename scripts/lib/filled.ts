import { DOMParser, Element, onWarningStopParsing } from "@xmldom/xmldom";
import CanvasKitInit, { type CanvasKit, type Path } from "canvaskit-wasm";
import { iconSystem } from "../../config/icon-system.js";

/**
 * What one outline element becomes in the filled drawing.
 *
 * - `fill`: a solid body, the shape's interior plus its stroke.
 * - `stroke`: stays a line, joined to the silhouette.
 * - `cut`: a detail inside a body, knocked out as a negative line of stroke width (a dot, whole).
 * - `gap`: stays a line, with a clear gap cut around it where it crosses a body.
 * - `front`: a solid body in front of the others, with a clear gap cut around it.
 * - `hole`: knocked out entirely, interior and stroke.
 * - `skip`: left out of the filled drawing.
 */
export type FilledRole = "fill" | "stroke" | "cut" | "gap" | "front" | "hole" | "skip";

export type FilledRecipe = {
  /**
   * Roles by element index in the outline source (0-based, drawing order). Unlisted elements get
   * an inferred role; see `deriveFilled`.
   */
  readonly roles?: Readonly<Record<number, FilledRole>>;
};

/** How outline strokes are drawn: the round default, or the sharp style's caps and joins. */
export type StrokeStyle = {
  readonly linecap: "butt" | "round" | "square";
  readonly linejoin: "miter" | "round" | "bevel";
  readonly miterLimit?: number;
};

export const roundStrokeStyle: StrokeStyle = {
  linecap: iconSystem.design.linecap,
  linejoin: iconSystem.design.linejoin,
};

export type DerivedFilled = {
  /** The filled source SVG. */
  readonly svg: string;
  /** The role each outline element played, listed or inferred, for review. */
  readonly roles: readonly FilledRole[];
  /** Each outline element's open line ends, with the direction out of the line. */
  readonly ends: readonly (readonly LineEnd[])[];
  /** The ends whose cut ran on through the drawing's edge, by element. */
  readonly runOn: readonly (readonly LineEnd[])[];
  /** The drawing's painted area, as path data and its fill rule. */
  readonly paint: { readonly d: string; readonly evenOdd: boolean };
};

/** An open line end and the unit direction pointing out of the line. */
export type LineEnd = readonly [Point, Point];
type Point = [number, number];

/** Clearance on each side of a `gap` line or `front` body, in grid units. */
export const gapWidth = 1;
/**
 * Skia's stroker fits curves to a pixel-sized tolerance. Icon geometry lives on a 24-unit grid that
 * renders far larger, so stroke as if at 64× scale; otherwise small circles become rounded squares.
 */
const strokePrecision = 64;
/** Areas below this, in square grid units, are numerical noise. */
const epsilon = 0.05;

let canvasKit: Promise<CanvasKit> | undefined;

/** CanvasKit's WebAssembly path engine, loaded once. */
export function loadCanvasKit(): Promise<CanvasKit> {
  canvasKit ??= CanvasKitInit();
  return canvasKit;
}

type Shape = {
  readonly tag: string;
  readonly d: string;
  /** Whether the outline paints the shape solid (`fill="currentColor"`), like Lucide's dots. */
  readonly solid: boolean;
  /** A circle's centre and radius, for painting small ones exactly. */
  readonly circle?: { readonly cx: number; readonly cy: number; readonly r: number };
};

function numberAttribute(element: Element, name: string): number {
  return Number(element.getAttribute(name) ?? 0);
}

/** Path data for one validated outline geometry element. */
/** An ellipse as two arcs, closed. */
function ellipsePathData(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
}

function shapePathData(element: Element): string {
  const n = (name: string) => numberAttribute(element, name);
  switch (element.tagName) {
    case "path":
      return element.getAttribute("d") ?? "";
    case "circle":
    case "ellipse": {
      const [cx, cy] = [n("cx"), n("cy")];
      const rx = element.tagName === "circle" ? n("r") : n("rx");
      const ry = element.tagName === "circle" ? n("r") : n("ry");
      return ellipsePathData(cx, cy, rx, ry);
    }
    case "rect": {
      const [x, y, w, h] = [n("x"), n("y"), n("width"), n("height")];
      const rxSource = element.getAttribute("rx") ?? element.getAttribute("ry");
      const rySource = element.getAttribute("ry") ?? element.getAttribute("rx");
      const rx = Math.min(Number(rxSource ?? 0), w / 2);
      const ry = Math.min(Number(rySource ?? 0), h / 2);
      if (rx === 0 || ry === 0) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return [
        `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}`,
        `V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}`,
        `H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}`,
        `V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`,
      ].join("");
    }
    case "line":
      return `M${n("x1")} ${n("y1")}L${n("x2")} ${n("y2")}`;
    case "polyline":
    case "polygon": {
      const points = (element.getAttribute("points") ?? "").trim().split(/[\s,]+/);
      const pairs = [];
      for (let index = 0; index + 1 < points.length; index += 2) {
        pairs.push(`${points[index]} ${points[index + 1]}`);
      }
      return `M${pairs.join("L")}${element.tagName === "polygon" ? "Z" : ""}`;
    }
    default:
      throw new Error(`Cannot derive a filled drawing from <${element.tagName}>.`);
  }
}

/** The geometry elements of an outline source, in drawing order. */
export function outlineShapes(source: string): Shape[] {
  const root = new DOMParser({ onError: onWarningStopParsing }).parseFromString(
    source,
    "application/xml",
  ).documentElement;
  if (root?.tagName !== "svg") throw new Error("Outline source has no <svg> root.");
  const shapes: Shape[] = [];
  const pending: Element[] = [root];
  while (pending.length > 0) {
    const element = pending.shift() as Element;
    for (let node = element.firstChild; node; node = node.nextSibling) {
      if (!(node instanceof Element)) continue;
      if (node.tagName === "g") pending.push(node);
      else {
        const solid = node.getAttribute("fill") === iconSystem.architecture.color;
        const circle =
          node.tagName === "circle"
            ? {
                cx: numberAttribute(node, "cx"),
                cy: numberAttribute(node, "cy"),
                r: numberAttribute(node, "r"),
              }
            : undefined;
        shapes.push({ tag: node.tagName, d: shapePathData(node), solid, circle });
      }
    }
  }
  return shapes;
}

/** Formats a coordinate with at most three decimals and no negative zero. */
function coordinate(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

type Contour = { readonly points: [number, number][]; readonly closed: boolean };

/**
 * Walks CanvasKit path commands, flattening curves for measurement and writing SVG path data.
 * Conics, which SVG lacks, become cubics with the standard degree-elevation weights.
 */
function walk(CK: CanvasKit, path: Path): { d: string; contours: Contour[] } {
  const cmds = path.toCmds();
  const parts: string[] = [];
  const contours: Contour[] = [];
  let current: [number, number][] = [];
  let closed = false;
  let last: [number, number] = [0, 0];
  const pt = (x: number, y: number) => `${coordinate(x)} ${coordinate(y)}`;
  const flush = () => {
    if (current.length > 0) contours.push({ points: current, closed });
    current = [];
    closed = false;
  };
  const sample = (fn: (t: number) => [number, number]) => {
    for (let step = 1; step <= 8; step += 1) current.push(fn(step / 8));
  };
  let index = 0;
  while (index < cmds.length) {
    const verb = cmds[index];
    index += 1;
    if (verb === CK.MOVE_VERB) {
      flush();
      last = [cmds[index], cmds[index + 1]];
      current.push(last);
      parts.push(`M${pt(...last)}`);
      index += 2;
    } else if (verb === CK.LINE_VERB) {
      last = [cmds[index], cmds[index + 1]];
      current.push(last);
      parts.push(`L${pt(...last)}`);
      index += 2;
    } else if (verb === CK.QUAD_VERB) {
      const [x0, y0] = last;
      const [x1, y1, x2, y2] = Array.from(cmds.subarray(index, index + 4));
      sample((t) => [
        (1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t ** 2 * x2,
        (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t ** 2 * y2,
      ]);
      parts.push(`Q${pt(x1, y1)} ${pt(x2, y2)}`);
      last = [x2, y2];
      index += 4;
    } else if (verb === CK.CONIC_VERB) {
      const [x0, y0] = last;
      const [x1, y1, x2, y2, w] = Array.from(cmds.subarray(index, index + 5));
      const k = (4 * w) / (3 * (1 + w));
      const c1: [number, number] = [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
      const c2: [number, number] = [x2 + (x1 - x2) * k, y2 + (y1 - y2) * k];
      sample((t) => {
        const a = (1 - t) ** 2;
        const b = 2 * w * (1 - t) * t;
        const c = t ** 2;
        const denominator = a + b + c;
        return [(a * x0 + b * x1 + c * x2) / denominator, (a * y0 + b * y1 + c * y2) / denominator];
      });
      parts.push(`C${pt(...c1)} ${pt(...c2)} ${pt(x2, y2)}`);
      last = [x2, y2];
      index += 5;
    } else if (verb === CK.CUBIC_VERB) {
      const [x0, y0] = last;
      const [x1, y1, x2, y2, x3, y3] = Array.from(cmds.subarray(index, index + 6));
      sample((t) => [
        (1 - t) ** 3 * x0 + 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3 * x3,
        (1 - t) ** 3 * y0 + 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3 * y3,
      ]);
      parts.push(`C${pt(x1, y1)} ${pt(x2, y2)} ${pt(x3, y3)}`);
      last = [x3, y3];
      index += 6;
    } else if (verb === CK.CLOSE_VERB) {
      closed = true;
      parts.push("Z");
      flush();
    } else {
      throw new Error(`Unknown path verb ${verb}.`);
    }
  }
  flush();
  return { d: parts.join(""), contours };
}

function polygonArea(points: readonly [number, number][]): number {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x0, y0] = points[index];
    const [x1, y1] = points[(index + 1) % points.length];
    total += x0 * y1 - x1 * y0;
  }
  return Math.abs(total / 2);
}

function insidePolygon([x, y]: [number, number], points: readonly [number, number][]): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const [xi, yi] = points[index];
    const [xj, yj] = points[previous];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Whether one non-crossing contour lies inside another. Contours may touch at points, so a
 * single vertex can sit on the other boundary; every vertex votes and the majority decides.
 */
function insideContour(
  points: readonly [number, number][],
  other: readonly [number, number][],
): boolean {
  let votes = 0;
  for (const point of points) votes += insidePolygon(point, other) ? 1 : -1;
  return votes > 0;
}

/**
 * Filled area in square grid units. Union with itself resolves overlaps into nested,
 * non-crossing contours, so each contour adds or subtracts its area by nesting depth.
 */
function area(CK: CanvasKit, path: Path, owned: Path[]): number {
  const simple = CK.Path.MakeFromOp(path, path, CK.PathOp.Union);
  if (!simple) return 0;
  owned.push(simple);
  const contours = walk(CK, simple).contours.filter(({ points }) => points.length > 2);
  let total = 0;
  contours.forEach(({ points }, index) => {
    const depth = contours.filter(
      (other, otherIndex) => otherIndex !== index && insideContour(points, other.points),
    ).length;
    total += polygonArea(points) * (depth % 2 === 0 ? 1 : -1);
  });
  return Math.max(0, total);
}

/** Area in square grid units of SVG path data under the given fill rule. For tests and review. */
export async function pathDataArea(
  d: string,
  fillRule: "nonzero" | "evenodd" = "nonzero",
): Promise<number> {
  const CK = await loadCanvasKit();
  const owned: Path[] = [];
  try {
    const path = CK.Path.MakeFromSVGString(d);
    if (!path) throw new Error("Invalid path data.");
    owned.push(path);
    path.setFillType(fillRule === "evenodd" ? CK.FillType.EvenOdd : CK.FillType.Winding);
    return area(CK, path, owned);
  } finally {
    for (const path of owned) path.delete();
  }
}

/**
 * A copy of `path` with every open contour that encloses an area closed, so stroking it also
 * strokes the closing edge. Contours without an area (a dot like `h.01`, a straight line) stay
 * open: closed, they double back on themselves, and a mitered stroke of that collapses to a sliver.
 *
 * `ends`, the round outline's line ends, restores ends that sharpening pulled back along the line
 * (off a stroke they meet) before closing, so the closing edge runs where the round one does
 * instead of on a slant (a flag's pole).
 */
function closeContours(CK: CanvasKit, path: Path, ends: readonly LineEnd[] = []): Path {
  const cmds = Array.from(path.toCmds());
  const out: number[] = [];
  const pointCounts = new Map([
    [CK.MOVE_VERB, 1],
    [CK.LINE_VERB, 1],
    [CK.QUAD_VERB, 2],
    [CK.CONIC_VERB, 2],
    [CK.CUBIC_VERB, 3],
    [CK.CLOSE_VERB, 0],
  ]);
  /** The round end this contour end was pulled back from: just beyond it, along the line. */
  const restored = (x: number, y: number): Point | undefined => {
    for (const [end, toward] of ends) {
      const [dx, dy] = [end[0] - x, end[1] - y];
      const distance = Math.hypot(dx, dy);
      if (distance > 1e-3 && distance < 2 && (dx * toward[0] + dy * toward[1]) / distance > 0.99) {
        return end;
      }
    }
    return undefined;
  };
  // The current open contour's commands and points (control points included: enough to tell a
  // flat contour).
  let contour: number[] = [];
  let points: number[] = [];
  const flush = (closedAlready: boolean) => {
    if (contour.length === 0) return;
    let twiceArea = 0;
    for (let i = 0; i < points.length; i += 2) {
      const j = (i + 2) % points.length;
      twiceArea += points[i] * points[j + 1] - points[j] * points[i + 1];
    }
    if (closedAlready || Math.abs(twiceArea) <= 1e-3) {
      out.push(...contour);
    } else {
      const start = restored(points[0], points[1]);
      const finish = restored(points[points.length - 2], points[points.length - 1]);
      if (start) out.push(CK.MOVE_VERB, ...start, CK.LINE_VERB, points[0], points[1]);
      else out.push(CK.MOVE_VERB, points[0], points[1]);
      out.push(...contour.slice(3));
      if (finish) out.push(CK.LINE_VERB, ...finish);
      out.push(CK.CLOSE_VERB);
    }
    contour = [];
    points = [];
  };
  let index = 0;
  while (index < cmds.length) {
    const verb = cmds[index];
    if (verb === CK.MOVE_VERB) flush(false);
    const length = 1 + 2 * (pointCounts.get(verb) ?? 0) + (verb === CK.CONIC_VERB ? 1 : 0);
    contour.push(...cmds.slice(index, index + length));
    // Conic weights are not points.
    points.push(...cmds.slice(index + 1, index + 1 + 2 * (pointCounts.get(verb) ?? 0)));
    index += length;
    if (verb === CK.CLOSE_VERB) flush(true);
  }
  flush(false);
  const closed = CK.Path.MakeFromCmds(out);
  if (!closed) throw new Error("Could not close a path's contours.");
  closed.setFillType(path.getFillType());
  return closed;
}

/** Open ends of a path's unclosed contours, which filling would join with a straight chord. */
function openEnds(CK: CanvasKit, path: Path): [number, number][] {
  const ends: [number, number][] = [];
  for (const { points, closed } of walk(CK, path).contours) {
    const first = points[0];
    const last = points[points.length - 1];
    if (!closed && Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.5) ends.push(first, last);
  }
  return ends;
}

/** Each open end of a path's unclosed contours, with the unit direction pointing out of the line. */
function endTangents(CK: CanvasKit, path: Path): LineEnd[] {
  const tangents: LineEnd[] = [];
  for (const { points, closed } of walk(CK, path).contours) {
    if (closed) continue;
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= 0.5) continue;
    for (const [end, rest] of [
      [first, points.slice(1)],
      [last, points.slice(0, -1).reverse()],
    ] as const) {
      // The nearest point a little way along the line, so a flattened curve gives its end tangent.
      const from = rest.find((point) => Math.hypot(point[0] - end[0], point[1] - end[1]) > 1e-3);
      if (!from) continue;
      const length = Math.hypot(end[0] - from[0], end[1] - from[1]);
      tangents.push([end, [(end[0] - from[0]) / length, (end[1] - from[1]) / length]]);
    }
  }
  return tangents;
}

/**
 * How far a line of half-width `half` must run on from `end` along `toward` before it is wholly
 * outside `path`: its centre and both sides. Undefined when that takes more than `limit` units
 * (the line runs along the edge, or ends nowhere near one).
 */
function clearingReach(
  path: Path,
  end: Point,
  toward: Point,
  half: number,
  limit: number,
): number | undefined {
  const side: Point = [-toward[1] * half, toward[0] * half];
  for (let reach = 0.25; reach <= limit; reach += 0.125) {
    const centre: Point = [end[0] + toward[0] * reach, end[1] + toward[1] * reach];
    const clear = [
      centre,
      [centre[0] + side[0], centre[1] + side[1]],
      [centre[0] - side[0], centre[1] - side[1]],
    ].every(([x, y]) => !path.contains(x, y));
    // A quarter unit past the edge, so the parts separate without a hairline.
    if (clear) return reach + 0.25;
  }
  return undefined;
}

/** A copy of `path` moved by (dx, dy). */
function translated(CK: CanvasKit, path: Path, dx: number, dy: number): Path | null {
  const cmds = Array.from(path.toCmds());
  const pointCounts = new Map([
    [CK.MOVE_VERB, 1],
    [CK.LINE_VERB, 1],
    [CK.QUAD_VERB, 2],
    [CK.CONIC_VERB, 2],
    [CK.CUBIC_VERB, 3],
    [CK.CLOSE_VERB, 0],
  ]);
  let index = 0;
  while (index < cmds.length) {
    const verb = cmds[index];
    index += 1;
    const points = pointCounts.get(verb) ?? 0;
    for (let point = 0; point < points; point += 1) {
      cmds[index] += dx;
      cmds[index + 1] += dy;
      index += 2;
    }
    if (verb === CK.CONIC_VERB) index += 1;
  }
  const moved = CK.Path.MakeFromCmds(cmds);
  moved?.setFillType(path.getFillType());
  return moved;
}

/** Tiny offsets that break the exact coincidences Skia's boolean operations can trip over. */
const nudges: readonly (readonly [number, number])[] = [
  [0, 0],
  [1e-4, 7e-5],
  [-7e-5, 1e-4],
  [1.3e-4, -1.1e-4],
];

type Operation = "union" | "difference" | "intersect";

/**
 * Derives a filled drawing from an outline source.
 *
 * Elements are considered from largest to smallest solid area. Unless the recipe lists a role, an
 * element becomes `cut` when its stroke lies inside the bodies found so far, `stroke` when it is
 * an open path whose ends are attached to bodies (a lock shackle or bag handle, whose chord should
 * not be filled, or a connector between nodes), `fill` when it encloses area, `gap` when it is a
 * line crossing a body, and `stroke` otherwise. The result is one path: bodies and lines, then gaps and front bodies, then
 * cuts and holes, written with `fill="currentColor"` so it matches the outline's painted extent.
 */
export async function deriveFilled(
  source: string,
  recipe: FilledRecipe = {},
  outlinePath = "the outline",
  style: StrokeStyle = roundStrokeStyle,
  /**
   * The round drawing, when deriving the sharp one: its line ends and run-on decisions are used,
   * because sharpening may pull a line's end back off the edge it meets (so its square cap stays
   * inside) or move a corner, and both styles must close and part the same way.
   */
  round?: Pick<DerivedFilled, "ends" | "runOn" | "paint">,
): Promise<DerivedFilled> {
  const CK = await loadCanvasKit();
  const owned: Path[] = [];
  const track = (path: Path | null, what: string): Path => {
    if (!path) throw new Error(`${outlinePath}: could not compute ${what}.`);
    owned.push(path);
    return path;
  };
  const areaOf = (path: Path) => area(CK, path, owned);
  const kinds = {
    union: CK.PathOp.Union,
    difference: CK.PathOp.Difference,
    intersect: CK.PathOp.Intersect,
  };
  /**
   * A boolean operation whose result is checked against the operands' areas. Skia can return an
   * empty or partial path when edges coincide exactly (a cap ending on another stroke's edge);
   * such a result is retried with the second operand nudged by an invisible fraction of a unit.
   */
  const combine = (left: Path, right: Path, operation: Operation, what: string): Path => {
    const leftArea = areaOf(left);
    const rightArea = areaOf(right);
    // Curve flattening makes measured areas approximate, so allow 1% of the larger operand.
    const tolerance = 0.1 + 0.01 * Math.max(leftArea, rightArea);
    const attempts: number[] = [];
    for (const [dx, dy] of nudges) {
      const operand = dx === 0 && dy === 0 ? right : translated(CK, right, dx, dy);
      if (!operand) continue;
      if (operand !== right) owned.push(operand);
      const result = CK.Path.MakeFromOp(left, operand, kinds[operation]);
      if (!result) continue;
      owned.push(result);
      const resultArea = areaOf(result);
      attempts.push(Math.round(resultArea * 100) / 100);
      const plausible =
        operation === "union"
          ? resultArea >= Math.max(leftArea, rightArea) - tolerance &&
            resultArea <= leftArea + rightArea + tolerance
          : operation === "difference"
            ? resultArea >= leftArea - rightArea - tolerance && resultArea <= leftArea + tolerance
            : resultArea <= Math.min(leftArea, rightArea) + tolerance;
      if (plausible) return result;
    }
    const areas = `${operation} of areas ${leftArea.toFixed(2)} and ${rightArea.toFixed(2)} gave ${attempts.join(", ") || "nothing"}`;
    throw new Error(`${outlinePath}: could not compute ${what} (${areas}).`);
  };
  try {
    const { strokeWidth } = iconSystem.design;
    const caps = {
      butt: CK.StrokeCap.Butt,
      round: CK.StrokeCap.Round,
      square: CK.StrokeCap.Square,
    };
    const joins = {
      miter: CK.StrokeJoin.Miter,
      round: CK.StrokeJoin.Round,
      bevel: CK.StrokeJoin.Bevel,
    };
    const strokeOptions = (width: number) => ({
      width,
      precision: strokePrecision,
      cap: caps[style.linecap],
      join: joins[style.linejoin],
      ...(style.miterLimit === undefined ? {} : { miter_limit: style.miterLimit }),
    });
    const shapes = outlineShapes(source);
    for (const index of Object.keys(recipe.roles ?? {}).map(Number)) {
      if (!Number.isInteger(index) || index < 0 || index >= shapes.length) {
        throw new Error(`${outlinePath}: recipe role for element ${index} out of range.`);
      }
    }
    const items = shapes.map((shape, index) => {
      const fill = track(CK.Path.MakeFromSVGString(shape.d), `element ${index}`);
      // A circle narrower than the stroke (Lucide's r=.5 dots) paints a disc of radius r plus half
      // the stroke. Stroking it would turn the inner offset inside out and leave specks in a hole.
      const disc =
        shape.circle && shape.circle.r < strokeWidth / 2
          ? track(
              CK.Path.MakeFromSVGString(
                ellipsePathData(
                  shape.circle.cx,
                  shape.circle.cy,
                  shape.circle.r + strokeWidth / 2,
                  shape.circle.r + strokeWidth / 2,
                ),
              ),
              `element ${index} disc`,
            )
          : undefined;
      const stroke =
        disc ?? track(fill.makeStroked(strokeOptions(strokeWidth)), `element ${index} stroke`);
      // A body is thickened around its closed shape: filling joins an open path's ends with a
      // straight edge, and that edge needs the stroke too, or the body sits half a stroke short
      // there (the "feet" under user's torso). Sharp drawings close from the round outline's ends.
      const closed = track(closeContours(CK, fill, round?.ends[index]), `element ${index} closed`);
      const closedStroke = track(
        closed.makeStroked(strokeOptions(strokeWidth)),
        `element ${index} closed stroke`,
      );
      const solid = disc ?? combine(closed, closedStroke, "union", `element ${index}`);
      const fillArea = areaOf(fill);
      const ends = openEnds(CK, fill);
      // What a `cut` removes. A shape the outline paints solid, or a closed one so small its stroke
      // covers its interior (a dot), is cut whole; a larger shape is cut as a ring around its
      // interior. An open line is always cut as a line: whole, its chord would turn a short hook
      // (a "1", a clock hand, a smile) into a wedge.
      const dot =
        shape.solid || (ends.length === 0 && fillArea <= Math.PI * (strokeWidth / 2) ** 2 * 1.01);
      return {
        fill,
        stroke,
        solid,
        cut: dot ? solid : stroke,
        fillArea,
        solidArea: areaOf(solid),
        ends,
        endTangents: endTangents(CK, fill),
      };
    });

    const order = items.map((_, index) => index);
    order.sort((left, right) => items[right].solidArea - items[left].solidArea || left - right);
    const roles: FilledRole[] = new Array(items.length);
    let bodies = track(new CK.Path(), "bodies");
    // The bodies' own outline strokes, without the chords that close open bodies.
    let bodyLines = track(new CK.Path(), "body lines");
    for (const index of order) {
      const item = items[index];
      const listed = recipe.roles?.[index];
      let role: FilledRole;
      if (listed) {
        role = listed;
      } else if (
        !bodies.isEmpty() &&
        // A cap may graze a body's edge, so allow a sliver of 2% of the stroke outside it.
        areaOf(combine(item.stroke, bodies, "difference", "a cut")) <
          Math.max(epsilon, 0.02 * areaOf(item.stroke))
      ) {
        role = "cut";
      } else if (
        item.ends.length > 0 &&
        item.ends.every(([x, y]) => bodies.contains(x, y)) &&
        // A curve attached at both ends (a handle) or a connector that runs mostly between bodies
        // (the lines of share-2). A line lying mostly inside a body is a slash, cut or gapped.
        (item.fillArea > epsilon ||
          areaOf(combine(item.stroke, bodies, "intersect", "a connector")) <
            0.5 * areaOf(item.stroke))
      ) {
        role = "stroke";
      } else if (item.fillArea > epsilon) {
        role = "fill";
      } else if (
        !bodies.isEmpty() &&
        areaOf(combine(item.stroke, bodies, "intersect", "a gap")) > epsilon
      ) {
        // A line hanging off a body (a leg, cord, pole, or stem: it ends on the body's edge, on
        // the body's drawn line rather than a chord closing it, no end lies deeper inside, and
        // most of it is outside) stays joined, since a gap would notch the body around it. A line
        // crossing a body, ending deep in it like a calendar's tab, or only meeting a chord (rain
        // under a cloud, a badge beside a clipped envelope) is gapped.
        const edge = track(
          bodies.makeStroked({
            width: strokeWidth + 0.5,
            precision: strokePrecision,
            cap: CK.StrokeCap.Round,
            join: CK.StrokeJoin.Round,
          }),
          "the bodies' edge",
        );
        const inside = item.ends.filter(([x, y]) => bodies.contains(x, y));
        const hanging =
          inside.length > 0 &&
          inside.every(([x, y]) => edge.contains(x, y) && bodyLines.contains(x, y)) &&
          areaOf(combine(item.stroke, bodies, "intersect", "a hanging line")) <
            0.5 * areaOf(item.stroke);
        role = hanging ? "stroke" : "gap";
      } else {
        role = "stroke";
      }
      roles[index] = role;
      if (role === "fill" || role === "front") {
        bodies = combine(bodies, item.solid, "union", "bodies");
        bodyLines = combine(bodyLines, item.stroke, "union", "body lines");
      }
    }

    let result = track(new CK.Path(), "the drawing");
    const apply = (path: Path, operation: Operation) => {
      result = combine(result, path, operation, "the drawing");
    };
    const clearanceOf = (item: (typeof items)[number], index: number) =>
      track(
        item.fill.makeStroked(strokeOptions(strokeWidth + 2 * gapWidth)),
        `element ${index} gap`,
      );
    // 1. Bodies.
    items.forEach((item, index) => {
      if (roles[index] === "fill") apply(item.solid, "union");
    });
    // 2. A gap line clears the bodies it crosses, and only the bodies: lines attached to it (a
    //    trash lid's handle) stay joined. A front body clears and replaces what is behind it.
    items.forEach((item, index) => {
      const role = roles[index];
      if (role !== "gap" && role !== "front") return;
      apply(clearanceOf(item, index), "difference");
      if (role === "front") apply(item.solid, "union");
    });
    // 3. Lines.
    items.forEach((item, index) => {
      if (roles[index] === "stroke" || roles[index] === "gap") apply(item.stroke, "union");
    });
    // 4. Lines passing behind a front body (copy's back sheet) are cleared around it too.
    items.forEach((item, index) => {
      if (roles[index] !== "front") return;
      apply(clearanceOf(item, index), "difference");
      apply(item.solid, "union");
    });
    // Cuts and holes come last, so a detail inside a front body (the check on copy-check) stays cut.
    //
    // A cut line that ends on the drawing's edge (a calendar's divider, a file's fold, a mail flap,
    // a table's rules) runs on through it, so the parts it separates part cleanly and alike in
    // both styles: a round cap would pinch the edge to a point, a square cap leave a hairline.
    const silhouette = result;
    const edgeBand =
      roles.includes("cut") && !round
        ? track(
            silhouette.makeStroked({
              width: 2 * (strokeWidth / 2 + 0.25),
              precision: strokePrecision,
              cap: CK.StrokeCap.Round,
              join: CK.StrokeJoin.Round,
            }),
            "the drawing's edge",
          )
        : undefined;
    // The sharp drawing runs on exactly the ends the round one did (its own corners may sit a
    // little further out), only measuring how far it takes to clear its own edge.
    const runOn: LineEnd[][] = items.map(() => []);
    items.forEach((item, index) => {
      if (roles[index] !== "cut") return;
      let cut = item.cut;
      for (const [end, toward] of round ? (round.runOn[index] ?? []) : item.endTangents) {
        if (edgeBand && (!silhouette.contains(...end) || !edgeBand.contains(...end))) continue;
        const reach = clearingReach(silhouette, end, toward, strokeWidth / 2, round ? 4 : 2.5);
        if (reach === undefined) continue;
        runOn[index].push([end, toward]);
        const tip = [end[0] + toward[0] * reach, end[1] + toward[1] * reach];
        // In the sharp drawing the line's own end may sit back from the round end (pulled off the
        // edge along a curve); bridge from it, so the cut and its run-on meet without slivers.
        const own = round
          ? item.endTangents
              .map(([point]) => point)
              .find((point) => Math.hypot(point[0] - end[0], point[1] - end[1]) < 2)
          : undefined;
        const from =
          own && Math.hypot(own[0] - end[0], own[1] - end[1]) > 1e-3
            ? `M${own[0]} ${own[1]}L`
            : "M";
        const channel = track(
          track(
            CK.Path.MakeFromSVGString(`${from}${end[0]} ${end[1]}L${tip[0]} ${tip[1]}`),
            `element ${index} run-on`,
          ).makeStroked({
            width: strokeWidth,
            precision: strokePrecision,
            cap: CK.StrokeCap.Butt,
            join: CK.StrokeJoin.Round,
          }),
          `element ${index} run-on stroke`,
        );
        cut = combine(cut, channel, "union", `element ${index} cut`);
      }
      apply(cut, "difference");
    });
    items.forEach((item, index) => {
      if (roles[index] === "hole") apply(item.solid, "difference");
    });
    // Nothing the sharp drawing paints may cross the safe area's padding unless the round drawing
    // paints there too (sharpening keeps the outline inside it, but a mitered corner where an open
    // body closes, as on speech's neck, could still cross it).
    if (round) {
      const { safeAreaInset } = iconSystem.design;
      const [, , width, height] = iconSystem.architecture.viewBox.split(" ").map(Number);
      const safeArea = track(
        CK.Path.MakeFromSVGString(
          `M${safeAreaInset} ${safeAreaInset}H${width - safeAreaInset}V${height - safeAreaInset}H${safeAreaInset}Z`,
        ),
        "the safe area",
      );
      const roundPaint = track(CK.Path.MakeFromSVGString(round.paint.d), "the round drawing");
      if (round.paint.evenOdd) roundPaint.setFillType(CK.FillType.EvenOdd);
      const allowed = combine(safeArea, roundPaint, "union", "the allowed area");
      if (areaOf(combine(result, allowed, "difference", "paint outside the safe area")) > 1e-3) {
        result = combine(result, allowed, "intersect", "the drawing within the safe area");
      }
    }
    if (result.isEmpty()) throw new Error(`${outlinePath}: the filled drawing is empty.`);

    // Boolean results are nested, non-crossing contours, which even-odd fills exactly. Skia's
    // makeAsWinding() is not used: it can orient a hole like its outer contour.
    const walked = walk(CK, result);
    // Boolean operations can leave contours with no area (a stray point or a doubled-back line);
    // they paint nothing, so they are dropped.
    const subpaths = walked.d.split(/(?=M)/);
    const d =
      subpaths.length === walked.contours.length
        ? subpaths.filter((_, index) => polygonArea(walked.contours[index].points) > 1e-4).join("")
        : walked.d;
    const fillRule = result.getFillType() === CK.FillType.EvenOdd ? ' fill-rule="evenodd"' : "";
    return {
      svg: [
        `<!-- Derived from ${outlinePath} by \`bun run derive:filled\`. Do not edit this file directly. -->`,
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconSystem.architecture.viewBox}" fill="${iconSystem.architecture.color}">`,
        `  <path d="${d}"${fillRule}/>`,
        "</svg>",
        "",
      ].join("\n"),
      roles,
      ends: items.map((item) => item.endTangents),
      runOn,
      paint: { d, evenOdd: fillRule !== "" },
    };
  } finally {
    for (const path of owned) path.delete();
  }
}
