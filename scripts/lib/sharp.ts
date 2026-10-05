import { DOMParser, Element, onWarningStopParsing } from "@xmldom/xmldom";
import { derived } from "../../config/derived/index.js";
import { iconSystem } from "../../config/icon-system.js";

/**
 * The sharp style: the outline drawings with square caps, mitered joins, and corner roundings
 * squared off, like Material's "Sharp" family. `sharpenOutline` rewrites one outline source; the
 * stroke style itself comes from `iconSystem.design.sharp`.
 *
 * Element order and count never change, so filled recipes that refer to elements by index hold:
 *
 * - `rect`: corner radii are dropped, unless the rect is a pill or circle (radius at least half the
 *   shorter side).
 * - `circle` with r ≤ 1, which a 2-unit stroke paints as a dot: a square `rect` of side 2r on the
 *   same center, keeping its fill.
 * - `path`: each corner rounding becomes the point where the tangents at its two ends meet. A
 *   rounding is a circular arc of radius ≤ 3, or a one-way cubic or quadratic whose implied radius
 *   keeps to the same limit, turning up to 170°: corners and acute tips (a star's, a triangle's,
 *   a heart's) alike. Neighbouring roundings that carry one another on count as one if they turn
 *   90° or less in all. A rounding stays a curve when a neighbouring curve of similar curvature
 *   carries it on (two quarter arcs drawing a round end), when it meets a neighbour at an angle
 *   (a lens's sides), when it is a whole open path that no other stroke in the icon continues (a
 *   circle cut by a slash; a dashed square's corner pieces do square), and, for a tip wider than a
 *   quarter turn, when it is a wave's crest (a tilde) or ends the path (a hook). A partial rounding
 *   where a path stops ends at its corner. Where the corner's miter would leave the canvas, run
 *   into another stroke, or reach more than 3 units past the rounding (a spike), the corner is cut
 *   flat along the rounding's middle tangent instead, reaching no further than the rounding did.
 * - Every vertex where two segments meet at an angle (in paths, polylines, and polygons) is
 *   guarded the same way: a miter that would leave the canvas or run into another stroke is cut
 *   flat just inside the vertex.
 * - `line`, `ellipse`, and larger circles: unchanged.
 * - Elements listed in `keepRound` (figurative circles, organic outlines): unchanged.
 *
 * `analyzePathData` reports what happened to each rounding, for review (see `CornerDecision`).
 */

type Point = readonly [number, number];

type Segment =
  | { readonly type: "M"; readonly to: Point }
  | { readonly type: "L"; readonly from: Point; readonly to: Point }
  | {
      readonly type: "C";
      readonly from: Point;
      readonly c1: Point;
      readonly c2: Point;
      readonly to: Point;
    }
  | { readonly type: "Q"; readonly from: Point; readonly c: Point; readonly to: Point }
  | {
      readonly type: "A";
      readonly from: Point;
      readonly rx: number;
      readonly ry: number;
      readonly rotation: number;
      readonly large: boolean;
      readonly sweep: boolean;
      readonly to: Point;
    }
  /** Closes the subpath with a line from `from` back to its start, `to`. */
  | { readonly type: "Z"; readonly from: Point; readonly to: Point };

type Drawn = Exclude<Segment, { type: "M" }>;
type Ends = { readonly start: Point; readonly end: Point };

/** Largest radius, in grid units, of an arc that can be a corner rounding. */
const cornerRadius = 3;
/**
 * Widest turn of a single rounding: acute tips (a star's, a triangle's, a heart's) are roundings
 * too. A bar's round end, a half turn, stays round; its tangents never meet.
 */
const tipTurn = 170;
/** Widest total turn of a chain of roundings that carry one another on: a quarter turn. */
const cornerSweep = 91;
/** Longest chord of a cubic or quadratic rounding: the widest tip on a circle of `cornerRadius`. */
const cornerChord = 2 * cornerRadius * Math.sin((tipTurn * Math.PI) / 360) + 0.01;
/** Range of the turn, in degrees, across a cubic or quadratic corner rounding. */
const cornerTurn = [40, tipTurn] as const;
/**
 * A rounding at an open end of a path that turns less than this many degrees is partial: the
 * drawing stops partway round the corner.
 */
const partialTurn = 80;
/** Neighbouring tangents within this many degrees count as one smooth curve. */
const smoothAngle = 10;
/**
 * A smooth neighbour carries a rounding's curve on only when their radii of curvature at the join
 * differ by at most this factor: two quarter arcs drawing a round end, not the small rounding at
 * the tip of an eye or a map pin, where much flatter curves meet.
 */
const continuationRatio = 2;
/**
 * A neighbouring line within this many degrees of a rounding's end tangent is that tangent: Lucide's
 * roundings often meet their lines with a slight kink, and the corner belongs where the lines meet.
 */
const snapAngle = 20;
/** Lengths below this are zero. */
const tiny = 1e-6;
/** Roundings link into one chain only when their radii agree within this factor. */
const chainRatio = 1.15;

/**
 * Outline elements left as they are, by icon name and element index, where the general rules
 * would change the drawing's meaning. Each entry says why.
 *
 * Small circles are squared as dots, the sharp style's UI mark (an ellipsis, a grip, a bullet, a
 * tag's hole). A small circle that depicts a round thing (a head, an eye, a ball) stays a circle;
 * geometry cannot tell the two apart. Organic outlines whose roundings meet with no straight run
 * between them would square into stairs; Lucide draws the same shapes elsewhere as glyph details
 * (`quote`) or mechanical parts (`settings`), so they too are listed by hand.
 */
/** Elements kept round, by outline name: the merge of every `config/derived/<category>.ts`. */
export const keepRound: Readonly<Record<string, readonly number[]>> = derived.keepRound;

/** Elements whose acute tips are cut at the round outline's extent, by outline name. */
export const tipHeight: Readonly<Record<string, readonly number[]>> = derived.tipHeight ?? {};

const degrees = Math.PI / 180;

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];
const length = (a: Point) => Math.hypot(a[0], a[1]);
const same = (a: Point, b: Point) => length(sub(a, b)) < tiny;
/** Unsigned angle between two directions, in degrees. */
const angleBetween = (a: Point, b: Point) => Math.atan2(Math.abs(cross(a, b)), dot(a, b)) / degrees;

/** Formats a coordinate with at most three decimals and no negative zero. */
function coordinate(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

const roundPoint = (p: Point): Point => [
  Math.round(p[0] * 1000) / 1000 + 0,
  Math.round(p[1] * 1000) / 1000 + 0,
];

const arity: Readonly<Record<string, number>> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

const numberPattern = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;

/** Splits path data into commands with their arguments, expanding implicit repetitions. */
function tokenize(d: string): { command: string; args: number[] }[] {
  const commands: { command: string; args: number[] }[] = [];
  let index = 0;
  const skip = () => {
    while (index < d.length && /[\s,]/.test(d[index])) index += 1;
  };
  const fail = (what: string): never => {
    throw new Error(`Invalid path data (${what} at ${index}): ${d}`);
  };
  const number = (): number => {
    skip();
    numberPattern.lastIndex = index;
    const match = numberPattern.exec(d);
    if (!match) return fail("expected a number");
    index += match[0].length;
    return Number(match[0]);
  };
  const flag = (): number => {
    skip();
    const character = d[index];
    if (character !== "0" && character !== "1") return fail("expected an arc flag");
    index += 1;
    return Number(character);
  };
  let previous: string | undefined;
  for (skip(); index < d.length; skip()) {
    let command: string;
    if (/[MLHVCSQTAZ]/i.test(d[index])) {
      command = d[index];
      index += 1;
    } else {
      if (previous === undefined || previous.toUpperCase() === "Z") fail("expected a command");
      command = previous === "M" ? "L" : previous === "m" ? "l" : (previous as string);
    }
    const upper = command.toUpperCase();
    const args: number[] = [];
    for (let k = 0; k < arity[upper]; k += 1) {
      args.push(upper === "A" && (k === 3 || k === 4) ? flag() : number());
    }
    commands.push({ command, args });
    previous = command;
  }
  if (commands.length > 0 && commands[0].command.toUpperCase() !== "M") {
    throw new Error(`Path data must start with a move: ${d}`);
  }
  return commands;
}

/**
 * Parses path data into absolute segments. Horizontal and vertical lines become lines, smooth
 * curves become explicit curves with their reflected control point, so every segment stands alone
 * and a smooth curve keeps its shape whatever happens to the segment before it.
 */
function parsePath(d: string): Segment[] {
  const segments: Segment[] = [];
  let current: Point = [0, 0];
  let start: Point = [0, 0];
  /** The last cubic or quadratic control point, for reflecting into S or T. */
  let lastCubic: Point | undefined;
  let lastQuadratic: Point | undefined;
  for (const { command, args } of tokenize(d)) {
    const relative = command !== command.toUpperCase();
    const upper = command.toUpperCase();
    // Drawing on after a close starts a new subpath at the closed one's start.
    if (upper !== "M" && segments.at(-1)?.type === "Z") segments.push({ type: "M", to: start });
    const point = (x: number, y: number): Point =>
      relative ? [current[0] + x, current[1] + y] : [x, y];
    let nextCubic: Point | undefined;
    let nextQuadratic: Point | undefined;
    const from = current;
    switch (upper) {
      case "M": {
        current = point(args[0], args[1]);
        start = current;
        segments.push({ type: "M", to: current });
        break;
      }
      case "L":
      case "H":
      case "V": {
        const to: Point =
          upper === "L"
            ? point(args[0], args[1])
            : upper === "H"
              ? [relative ? from[0] + args[0] : args[0], from[1]]
              : [from[0], relative ? from[1] + args[0] : args[0]];
        segments.push({ type: "L", from, to });
        current = to;
        break;
      }
      case "C":
      case "S": {
        const c1 =
          upper === "C"
            ? point(args[0], args[1])
            : lastCubic
              ? sub(scale(from, 2), lastCubic)
              : from;
        const rest = upper === "C" ? args.slice(2) : args;
        const c2 = point(rest[0], rest[1]);
        const to = point(rest[2], rest[3]);
        segments.push({ type: "C", from, c1, c2, to });
        nextCubic = c2;
        current = to;
        break;
      }
      case "Q":
      case "T": {
        const c =
          upper === "Q"
            ? point(args[0], args[1])
            : lastQuadratic
              ? sub(scale(from, 2), lastQuadratic)
              : from;
        const to = upper === "Q" ? point(args[2], args[3]) : point(args[0], args[1]);
        segments.push({ type: "Q", from, c, to });
        nextQuadratic = c;
        current = to;
        break;
      }
      case "A": {
        const to = point(args[5], args[6]);
        segments.push({
          type: "A",
          from,
          rx: args[0],
          ry: args[1],
          rotation: args[2],
          large: args[3] === 1,
          sweep: args[4] === 1,
          to,
        });
        current = to;
        break;
      }
      case "Z": {
        segments.push({ type: "Z", from, to: start });
        current = start;
        break;
      }
    }
    lastCubic = nextCubic;
    lastQuadratic = nextQuadratic;
  }
  return segments;
}

type ArcGeometry = {
  readonly center: Point;
  readonly rx: number;
  readonly ry: number;
  readonly rotation: number;
  readonly startAngle: number;
  /** Signed sweep in radians; positive is clockwise on screen. */
  readonly sweepAngle: number;
};

/** An SVG arc's center parameterization (SVG 1.1 F.6.5), with out-of-range radii scaled up. */
function arcGeometry(arc: Extract<Segment, { type: "A" }>): ArcGeometry | undefined {
  const [x1, y1] = arc.from;
  const [x2, y2] = arc.to;
  let rx = Math.abs(arc.rx);
  let ry = Math.abs(arc.ry);
  if (same(arc.from, arc.to) || rx < tiny || ry < tiny) return undefined;
  const rotation = arc.rotation * degrees;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2;
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numerator = rx ** 2 * ry ** 2 - rx ** 2 * y1p ** 2 - ry ** 2 * x1p ** 2;
  const denominator = rx ** 2 * y1p ** 2 + ry ** 2 * x1p ** 2;
  let k = Math.sqrt(Math.max(0, numerator / denominator));
  if (arc.large === arc.sweep) k = -k;
  const cxp = (k * rx * y1p) / ry;
  const cyp = (-k * ry * x1p) / rx;
  const center: Point = [
    cos * cxp - sin * cyp + (x1 + x2) / 2,
    sin * cxp + cos * cyp + (y1 + y2) / 2,
  ];
  const signedAngle = (u: Point, v: Point) => Math.atan2(cross(u, v), dot(u, v));
  const u: Point = [(x1p - cxp) / rx, (y1p - cyp) / ry];
  const v: Point = [(-x1p - cxp) / rx, (-y1p - cyp) / ry];
  const startAngle = signedAngle([1, 0], u);
  let sweepAngle = signedAngle(u, v);
  if (!arc.sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI;
  if (arc.sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI;
  return { center, rx, ry, rotation, startAngle, sweepAngle };
}

/** Direction of travel along an arc at angle `theta`. */
function arcTangent(arc: ArcGeometry, theta: number): Point {
  const direction = Math.sign(arc.sweepAngle);
  const dx = -arc.rx * Math.sin(theta) * direction;
  const dy = arc.ry * Math.cos(theta) * direction;
  const cos = Math.cos(arc.rotation);
  const sin = Math.sin(arc.rotation);
  return [cos * dx - sin * dy, sin * dx + cos * dy];
}

/** Direction of travel at a segment's start and end, or undefined for a zero-length segment. */
function tangents(segment: Drawn): { start: Point; end: Point } | undefined {
  const firstNonZero = (...directions: Point[]) => directions.find((d) => length(d) > tiny);
  switch (segment.type) {
    case "L":
    case "Z": {
      const direction = sub(segment.to, segment.from);
      return length(direction) > tiny ? { start: direction, end: direction } : undefined;
    }
    case "C": {
      const { from, c1, c2, to } = segment;
      const start = firstNonZero(sub(c1, from), sub(c2, from), sub(to, from));
      const end = firstNonZero(sub(to, c2), sub(to, c1), sub(to, from));
      return start && end ? { start, end } : undefined;
    }
    case "Q": {
      const { from, c, to } = segment;
      const start = firstNonZero(sub(c, from), sub(to, from));
      const end = firstNonZero(sub(to, c), sub(to, from));
      return start && end ? { start, end } : undefined;
    }
    case "A": {
      const arc = arcGeometry(segment);
      if (!arc) return undefined;
      return {
        start: arcTangent(arc, arc.startAngle),
        end: arcTangent(arc, arc.startAngle + arc.sweepAngle),
      };
    }
  }
}

/** Which way a curve bends at one end: 1 clockwise on screen, -1 anticlockwise, 0 straight. */
function bendAt(segment: Drawn, end: "start" | "end"): number {
  switch (segment.type) {
    case "L":
    case "Z":
      return 0;
    case "A":
      return arcGeometry(segment) ? (segment.sweep ? 1 : -1) : 0;
    case "Q":
      return Math.sign(cross(sub(segment.c, segment.from), sub(segment.to, segment.c)));
    case "C": {
      const { from, c1, c2, to } = segment;
      const value =
        end === "start"
          ? cross(sub(c1, from), sub(c2, c1)) || cross(sub(c2, from), sub(to, c2))
          : cross(sub(c2, c1), sub(to, c2)) || cross(sub(c2, from), sub(to, c2));
      return Math.abs(value) < tiny ? 0 : Math.sign(value);
    }
  }
}

/** Radius of curvature at one end of a curve, or Infinity where it is straight. */
function radiusAt(segment: Drawn, end: "start" | "end"): number {
  const radius = (first: Point, second: Point) => {
    const k = Math.abs(cross(first, second));
    return k < tiny ? Number.POSITIVE_INFINITY : length(first) ** 3 / k;
  };
  switch (segment.type) {
    case "L":
    case "Z":
      return Number.POSITIVE_INFINITY;
    case "A": {
      const arc = arcGeometry(segment);
      if (!arc) return Number.POSITIVE_INFINITY;
      const theta = end === "start" ? arc.startAngle : arc.startAngle + arc.sweepAngle;
      const { rx, ry } = arc;
      return (rx ** 2 * Math.sin(theta) ** 2 + ry ** 2 * Math.cos(theta) ** 2) ** 1.5 / (rx * ry);
    }
    case "Q": {
      const { from, c, to } = segment;
      const second = add(sub(to, scale(c, 2)), from);
      return radius(end === "start" ? sub(c, from) : sub(to, c), second);
    }
    case "C": {
      // Derivatives at t = 0 or 1, stepping in slightly where a control point sits on its end.
      const { from, c1, c2, to } = segment;
      const at = (t: number) => {
        const u = 1 - t;
        const first = add(
          add(scale(sub(c1, from), 3 * u * u), scale(sub(c2, c1), 6 * u * t)),
          scale(sub(to, c2), 3 * t * t),
        );
        const second = add(
          scale(add(sub(c2, scale(c1, 2)), from), 6 * u),
          scale(add(sub(to, scale(c2, 2)), c1), 6 * t),
        );
        return radius(first, second);
      };
      const t = end === "start" ? 0 : 1;
      const tangent = end === "start" ? sub(c1, from) : sub(to, c2);
      return length(tangent) > tiny ? at(t) : at(end === "start" ? 0.02 : 0.98);
    }
  }
}

/** Whether a segment is a corner rounding by its own shape (neighbours are checked separately). */
function cornerShaped(segment: Drawn): boolean {
  switch (segment.type) {
    case "L":
    case "Z":
      return false;
    case "A": {
      const arc = arcGeometry(segment);
      if (!arc) return false;
      const circular = Math.abs(arc.rx - arc.ry) <= 0.01 * Math.max(arc.rx, arc.ry);
      return (
        circular &&
        Math.max(arc.rx, arc.ry) <= cornerRadius + 0.001 &&
        Math.abs(arc.sweepAngle) / degrees <= tipTurn
      );
    }
    case "C":
    case "Q": {
      const ends = tangents(segment);
      if (!ends) return false;
      const chord = sub(segment.to, segment.from);
      if (length(chord) < tiny || length(chord) > cornerChord) return false;
      const turn = angleBetween(ends.start, ends.end);
      if (turn < cornerTurn[0] || turn > cornerTurn[1]) return false;
      // The radius of a circular rounding with this chord and turn, held to the arcs' limit: the
      // chord bound alone admits flat curves of radius 5 or more when the turn is small.
      const radius = length(chord) / (2 * Math.sin((turn * degrees) / 2));
      if (radius > cornerRadius * 1.05) return false;
      // One-way bend: every control point strictly on the same side of the chord.
      const controls = segment.type === "C" ? [segment.c1, segment.c2] : [segment.c];
      const sides = controls.map((c) => cross(chord, sub(c, segment.from)));
      return sides.every((side) => side > tiny) || sides.every((side) => side < -tiny);
    }
  }
}

/** Where two lines, each through a point along a direction, meet: the parameters along each. */
function intersect(p: Point, u: Point, q: Point, v: Point): [number, number] | undefined {
  const denominator = cross(u, v);
  if (Math.abs(denominator) < tiny * length(u) * length(v)) return undefined;
  const w = sub(q, p);
  return [cross(w, v) / denominator, cross(w, u) / denominator];
}

/** What happened to one corner-shaped segment, for review. */
export type CornerDecision = {
  /** Index of the segment among the path's commands, implicit repetitions counted. */
  readonly index: number;
  readonly type: "A" | "C" | "Q";
  /**
   * `corner`: squared to a point. `chamfer`: cut flat, because a point would leave the canvas or
   * run into another stroke. `curve`: kept, as part of a longer curve, a chain turning more than a
   * corner, a wave's crest, or a lone curved stroke. `side`: kept, it meets a neighbour at an angle, so it is a
   * curved side between corners (a lens), not a rounding. `degenerate`: kept, its tangents do not
   * meet in front of it.
   */
  readonly result: "corner" | "chamfer" | "curve" | "side" | "degenerate";
  /** Turn across the segment, in degrees. */
  readonly turn: number;
  /** The points that replace the segment, ending at its end point (or at the corner, below). */
  readonly points: readonly Point[];
  /** Which ends of the rounding (or chain of roundings) end the path instead of joining it on. */
  readonly free?: "start" | "end" | "both";
  /** Where the path now starts, when a partial rounding opening it lost its leg. */
  readonly start?: Point;
};

/** Point and direction of travel halfway along a curve. */
function middle(segment: Drawn): { point: Point; tangent: Point } | undefined {
  switch (segment.type) {
    case "A": {
      const arc = arcGeometry(segment);
      if (!arc) return undefined;
      const theta = arc.startAngle + arc.sweepAngle / 2;
      const cos = Math.cos(arc.rotation);
      const sin = Math.sin(arc.rotation);
      const x = arc.rx * Math.cos(theta);
      const y = arc.ry * Math.sin(theta);
      return {
        point: add(arc.center, [cos * x - sin * y, sin * x + cos * y]),
        tangent: arcTangent(arc, theta),
      };
    }
    case "C": {
      const { from, c1, c2, to } = segment;
      return {
        point: scale(add(add(from, to), scale(add(c1, c2), 3)), 1 / 8),
        tangent: sub(add(to, c2), add(c1, from)),
      };
    }
    case "Q":
      return {
        point: scale(add(add(segment.from, segment.to), scale(segment.c, 2)), 1 / 4),
        tangent: sub(segment.to, segment.from),
      };
    default:
      return undefined;
  }
}

/** The outermost points a mitered (or, past the miter limit, beveled) join paints. */
function joinExtent(corner: Point, incoming: Point, outgoing: Point): Point[] {
  const { strokeWidth, sharp } = iconSystem.design;
  const half = strokeWidth / 2;
  const u = scale(incoming, 1 / length(incoming));
  const v = scale(outgoing, 1 / length(outgoing));
  const turn = angleBetween(u, v) * degrees;
  const outward = sub(u, v);
  if (length(outward) < tiny) return [corner];
  const bisector = scale(outward, 1 / length(outward));
  const ratio = 1 / Math.cos(turn / 2);
  if (ratio <= sharp.miterLimit) return [add(corner, scale(bisector, half * ratio))];
  // Beveled: the two outer stroke edges' ends, on the outer side of the turn.
  const side = Math.sign(cross(u, v));
  const normal = (t: Point): Point => [t[1] * side, -t[0] * side];
  return [add(corner, scale(normal(u), half)), add(corner, scale(normal(v), half))];
}

/** Splits segments into subpaths, each a move followed by drawn segments. */
function subpaths(segments: readonly Segment[]): { indices: number[]; closed: boolean }[] {
  const runs: { indices: number[]; closed: boolean }[] = [];
  segments.forEach((segment, index) => {
    if (segment.type === "M") runs.push({ indices: [], closed: false });
    else {
      const run = runs[runs.length - 1];
      run.indices.push(index);
      if (segment.type === "Z") run.closed = true;
    }
  });
  return runs;
}

/**
 * The strokes of a whole icon that can carry a lone corner piece's tangent on, as the next dash of a
 * dashed outline: straight segments, and the open ends of paths with their direction of travel.
 */
export type OutlineContext = {
  readonly lines: readonly (readonly [Point, Point])[];
  readonly ends: readonly { readonly point: Point; readonly tangent: Point }[];
  /** The other elements' strokes, flattened, which a squared corner must not run into. */
  readonly strokes?: readonly (readonly Point[])[];
  /** Whether this element's acute tips are cut at the round outline's extent (`tipHeight`). */
  readonly tipHeight?: boolean;
};

const emptyContext: OutlineContext = { lines: [], ends: [] };

/** How far, in grid units, a dash may be from the corner piece it continues. */
const dashReach = 6;

/**
 * Whether a stroke in `context` lies along the line through `point` in `direction`, on the side
 * `side` gives (1 ahead, -1 behind), within `dashReach` of the point.
 */
function continuedBy(context: OutlineContext, point: Point, direction: Point, side: 1 | -1) {
  return continuationOf(context, point, direction, side) !== undefined;
}

/** Widest angle, in degrees, between a corner piece's end tangent and the dash it continues. */
const dashAngle = 8;

/**
 * The direction of a straight stroke in `context` that continues the line through `point` in
 * `direction`, on the side `side` gives (1 ahead, -1 behind), within `dashReach` of the point and
 * `dashAngle` of the direction (Lucide's dash corners are not always quite tangent to the dashes),
 * pointing away from the point; undefined if there is none.
 */
function continuationOf(
  context: OutlineContext,
  point: Point,
  direction: Point,
  side: 1 | -1,
): Point | undefined {
  const ray = scale(direction, side / length(direction));
  const limit = Math.sin(dashAngle * degrees);
  const reach = (q: Point) => dot(ray, sub(q, point));
  // Within the cone round the ray, allowing for three-decimal coordinates near the point.
  const inCone = (q: Point) => {
    const along = reach(q);
    return (
      along >= -0.05 &&
      along <= dashReach &&
      Math.abs(cross(ray, sub(q, point))) <= 0.05 + limit * Math.max(along, 0)
    );
  };
  const aligned = (d: Point) => length(d) > tiny && Math.abs(cross(ray, d)) / length(d) <= limit;
  for (const [a, b] of context.lines) {
    if (!aligned(sub(b, a)) || !inCone(a) || !inCone(b)) continue;
    const away = reach(a) <= reach(b) ? sub(b, a) : sub(a, b);
    return scale(away, 1 / length(away));
  }
  // Another path's open end, travelling the same line: the next corner piece. (Not this one.)
  for (const end of context.ends) {
    if (!aligned(end.tangent) || !inCone(end.point) || reach(end.point) <= 0.05) continue;
    const t = scale(end.tangent, 1 / length(end.tangent));
    return dot(t, ray) >= 0 ? t : scale(t, -1);
  }
  return undefined;
}

/** Straight segments and open ends of one outline element, for `continuedBy`. */
function elementContext(tag: string, attributes: readonly Attribute[]): OutlineContext {
  const value = (name: string) => attributes.find(([key]) => key === name)?.[1];
  if (tag !== "path") return { lines: elementLines(tag, attributes), ends: [] };
  const segments = parsePath(value("d") ?? "");
  const lines = segments.flatMap((segment) =>
    (segment.type === "L" || segment.type === "Z") && !same(segment.from, segment.to)
      ? [[segment.from, segment.to] as const]
      : [],
  );
  const ends: { point: Point; tangent: Point }[] = [];
  for (const { indices, closed } of subpaths(segments)) {
    const drawn = indices
      .map((index) => segments[index] as Drawn)
      .filter((segment) => tangents(segment) !== undefined);
    if (closed || drawn.length === 0) continue;
    const first = drawn[0];
    const last = drawn.at(-1) as Drawn;
    if (same(first.from, last.to)) continue;
    ends.push(
      { point: first.from, tangent: (tangents(first) as Ends).start },
      { point: last.to, tangent: (tangents(last) as Ends).end },
    );
  }
  return { lines, ends };
}

/** Straight segments of one non-path outline element. */
function elementLines(tag: string, attributes: readonly Attribute[]): (readonly [Point, Point])[] {
  const value = (name: string) => attributes.find(([key]) => key === name)?.[1];
  const n = (name: string) => Number(value(name) ?? 0);
  switch (tag) {
    case "line":
      return [
        [
          [n("x1"), n("y1")],
          [n("x2"), n("y2")],
        ],
      ];
    case "polyline":
    case "polygon": {
      const numbers = (value("points") ?? "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      const points: Point[] = [];
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        points.push([numbers[index], numbers[index + 1]]);
      }
      if (tag === "polygon" && points.length > 2) points.push(points[0]);
      return points.slice(1).map((point, index) => [points[index], point] as const);
    }
    case "rect": {
      const [x, y, w, h] = [n("x"), n("y"), n("width"), n("height")];
      const corners: Point[] = [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ];
      return corners.map((corner, index) => [corner, corners[(index + 1) % 4]] as const);
    }
    default:
      return [];
  }
}

/** Points along a segment from its start to its end, curves sampled in `steps` pieces. */
function flatten(segment: Drawn, steps = 12): Point[] {
  const sample = (at: (t: number) => Point) =>
    Array.from({ length: steps + 1 }, (_, step) => at(step / steps));
  switch (segment.type) {
    case "L":
    case "Z":
      return [segment.from, segment.to];
    case "C": {
      const { from, c1, c2, to } = segment;
      return sample((t) => {
        const u = 1 - t;
        return add(
          add(scale(from, u ** 3), scale(c1, 3 * u * u * t)),
          add(scale(c2, 3 * u * t * t), scale(to, t ** 3)),
        );
      });
    }
    case "Q": {
      const { from, c, to } = segment;
      return sample((t) =>
        add(add(scale(from, (1 - t) ** 2), scale(c, 2 * (1 - t) * t)), scale(to, t * t)),
      );
    }
    case "A": {
      const arc = arcGeometry(segment);
      if (!arc) return [segment.from, segment.to];
      const cos = Math.cos(arc.rotation);
      const sin = Math.sin(arc.rotation);
      return sample((t) => {
        const theta = arc.startAngle + arc.sweepAngle * t;
        const x = arc.rx * Math.cos(theta);
        const y = arc.ry * Math.sin(theta);
        return add(arc.center, [cos * x - sin * y, sin * x + cos * y]);
      });
    }
  }
}

/** Flattened strokes of path data, one polyline per drawn segment. */
function pathStrokes(d: string): Point[][] {
  return parsePath(d).flatMap((segment) => (segment.type === "M" ? [] : [flatten(segment)]));
}

/** Path data drawing a non-path outline element, for flattening. */
function shapeData(tag: string, attributes: readonly Attribute[]): string {
  const value = (name: string) => attributes.find(([key]) => key === name)?.[1];
  const n = (name: string) => Number(value(name) ?? 0);
  switch (tag) {
    case "circle":
    case "ellipse": {
      const [cx, cy] = [n("cx"), n("cy")];
      const rx = tag === "circle" ? n("r") : n("rx");
      const ry = tag === "circle" ? n("r") : n("ry");
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    }
    case "rect": {
      const [x, y, w, h] = [n("x"), n("y"), n("width"), n("height")];
      const radius = value("rx") ?? value("ry");
      const rx = Math.min(Number(value("rx") ?? radius ?? 0), w / 2);
      const ry = Math.min(Number(value("ry") ?? radius ?? 0), h / 2);
      if (rx === 0 || ry === 0) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return [
        `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}`,
        `V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}`,
        `H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}`,
        `V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`,
      ].join("");
    }
    default:
      return elementLines(tag, attributes)
        .map(([a, b]) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`)
        .join("");
  }
}

/** Distance from a point to a polyline. */
function distanceTo(point: Point, polyline: readonly Point[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index + 1 < polyline.length; index += 1) {
    const a = polyline[index];
    const ab = sub(polyline[index + 1], a);
    const span = dot(ab, ab);
    const t = span < tiny ? 0 : Math.min(1, Math.max(0, dot(sub(point, a), ab) / span));
    best = Math.min(best, length(sub(point, add(a, scale(ab, t)))));
  }
  return best;
}

/** Whether segment pq properly crosses a polyline. */
function crosses(p: Point, q: Point, polyline: readonly Point[]): boolean {
  for (let index = 0; index + 1 < polyline.length; index += 1) {
    const a = polyline[index];
    const b = polyline[index + 1];
    const d1 = cross(sub(q, p), sub(a, p));
    const d2 = cross(sub(q, p), sub(b, p));
    const d3 = cross(sub(b, a), sub(p, a));
    const d4 = cross(sub(b, a), sub(q, a));
    if (d1 * d2 < 0 && d3 * d4 < 0) return true;
  }
  return false;
}

/**
 * Furthest a squared tip may paint past the rounding it replaces, in grid units along the
 * corner's bisector: a triangle's 120° tip reaches about 3. A wider turn on a larger radius (a
 * croissant's horn) would grow a spike, so it is cut flat instead.
 */
const maxTipReach = 3.05;

/** How far a corner's painted tips reach past the round stroke at the rounding's middle. */
function tipReach(tips: readonly Point[], middle: Point, incoming: Point, outgoing: Point): number {
  const u = scale(incoming, 1 / length(incoming));
  const v = scale(outgoing, 1 / length(outgoing));
  const outward = sub(u, v);
  if (length(outward) < tiny) return 0;
  const bisector = scale(outward, 1 / length(outward));
  const h = iconSystem.design.strokeWidth / 2;
  return Math.max(...tips.map((tip) => dot(sub(tip, middle), bisector))) - h;
}

/** Below this gap, in grid units, two strokes read as touching. */
const touchingGap = 0.5;

/**
 * Whether squaring a rounding off at `corner` would run into another stroke: pass through a stroke
 * the rounding only touched (as a rewind triangle's tip would through its neighbour's side), or
 * nearly close a gap the rounding kept open.
 */
function runsInto(
  /** The rounding replaced by the corner; empty for a plain vertex, which a round join rounds. */
  curve: readonly Drawn[],
  corner: Point,
  startTangent: Point,
  endTangent: Point,
  /** The middle of the rounding's centerline, or the vertex itself. */
  half: { point: Point },
  others: readonly (readonly Point[])[],
): boolean {
  if (others.length === 0) return false;
  const h = iconSystem.design.strokeWidth / 2;
  const u = scale(startTangent, 1 / length(startTangent));
  const v = scale(endTangent, 1 / length(endTangent));
  const outward = sub(u, v);
  if (length(outward) < tiny) return false;
  const b = scale(outward, 1 / length(outward));
  const outerNormal = (t: Point): Point => {
    const n: Point = [t[1], -t[0]];
    return dot(n, b) >= 0 ? n : scale(n, -1);
  };
  const gap = (points: readonly Point[]) =>
    Math.min(...points.map((p) => Math.min(...others.map((o) => distanceTo(p, o))))) - h;
  // The rounding's outer edge (a round join's arc, at a vertex), and the squared corner's outer
  // edge from the same two ends.
  const roundEdge =
    curve.length === 0
      ? Array.from({ length: 13 }, (_, step) => {
          const [a, c] = [outerNormal(u), outerNormal(v)];
          const mix = add(scale(a, 1 - step / 12), scale(c, step / 12));
          const direction = length(mix) < tiny ? b : scale(mix, 1 / length(mix));
          return add(corner, scale(direction, h));
        })
      : curve.flatMap((segment) => {
          const points = flatten(segment);
          return points.map((p, index) => {
            const t = sub(
              points[Math.min(index + 1, points.length - 1)],
              points[Math.max(index - 1, 0)],
            );
            return length(t) < tiny ? p : add(p, scale(outerNormal(scale(t, 1 / length(t))), h));
          });
        });
  const first = curve.length === 0 ? corner : curve[0].from;
  const last = curve.length === 0 ? corner : (curve.at(-1) as Drawn).to;
  const tips = joinExtent(corner, startTangent, endTangent);
  const outline = [
    add(first, scale(outerNormal(u), h)),
    ...tips,
    add(last, scale(outerNormal(v), h)),
  ];
  const sharpEdge = outline
    .slice(1)
    .flatMap((end, index) =>
      Array.from({ length: 13 }, (_, step) =>
        add(outline[index], scale(sub(end, outline[index]), step / 12)),
      ),
    );
  const roundGap = gap(roundEdge);
  const sharpGap = gap(sharpEdge);
  // A plain vertex whose round join already touches another stroke is attached to it by design
  // (Lucide often sets a vertex on another stroke). Its miter may sit inside what it touches, but
  // must not pass through and show beyond it (a scale pan's apex just under the beam).
  if (curve.length === 0 && roundGap <= 0.1) {
    return tips.some((tip) =>
      others.some((line) => crosses(corner, tip, line) && distanceTo(tip, line) > h + 0.02),
    );
  }
  if (sharpGap < touchingGap && roundGap - sharpGap > 0.25) return true;
  // From just inside the rounding's middle, the corner's painted tip must not cross a stroke that
  // the rounding itself does not reach across.
  const inside = sub(half.point, b);
  const edge = sub(half.point, scale(b, 0.05));
  return others.some(
    (other) =>
      tips.some((tip) => crosses(inside, add(tip, scale(b, 0.01)), other)) &&
      !crosses(inside, edge, other),
  );
}

/** Decides, for every corner-shaped segment, whether and how it is squared off. */
function planCorners(
  segments: readonly Segment[],
  context: OutlineContext = emptyContext,
): CornerDecision[] {
  /** Neighbouring non-zero-length segments, wrapping around closed subpaths. */
  const neighbours = new Map<number, { previous?: number; next?: number }>();
  /** Segments of closed subpaths. */
  const inClosed = new Set<number>();
  for (const { indices, closed: explicit } of subpaths(segments)) {
    const drawn = indices.filter((index) => tangents(segments[index] as Drawn) !== undefined);
    // An open path that ends where it starts (Lucide's eye and speech bubbles) loops all the same.
    const first = drawn.length > 0 ? (segments[drawn[0]] as Drawn).from : undefined;
    const last = drawn.length > 0 ? (segments[drawn.at(-1) as number] as Drawn).to : undefined;
    // Within rounding: Lucide's store awning ends 0.001 short of its start.
    const closed = explicit || (first !== undefined && length(sub(first, last as Point)) < 0.002);
    if (closed) for (const index of indices) inClosed.add(index);
    drawn.forEach((index, position) => {
      const previous = position > 0 ? drawn[position - 1] : closed ? drawn.at(-1) : undefined;
      const next =
        position < drawn.length - 1 ? drawn[position + 1] : closed ? drawn[0] : undefined;
      neighbours.set(index, {
        previous: previous === index ? undefined : previous,
        next: next === index ? undefined : next,
      });
    });
  }

  /** Whether a neighbour carries the segment's curve on smoothly, bending the same way. */
  const continues = (index: number, other: number | undefined, side: "start" | "end") => {
    if (other === undefined) return false;
    const segment = segments[index] as Drawn;
    const neighbour = segments[other] as Drawn;
    const own = tangents(segment);
    const theirs = tangents(neighbour);
    if (!own || !theirs) return false;
    const ownTangent = side === "start" ? own.start : own.end;
    const theirTangent = side === "start" ? theirs.end : theirs.start;
    if (angleBetween(ownTangent, theirTangent) > smoothAngle) return false;
    const theirSide = side === "start" ? "end" : "start";
    const bend = bendAt(neighbour, theirSide);
    if (bend === 0 || bend !== bendAt(segment, side)) return false;
    // Symmetric, so two neighbours always agree on whether they are one curve.
    const radii = [radiusAt(neighbour, theirSide), radiusAt(segment, side)];
    return Math.max(...radii) <= continuationRatio * Math.min(...radii);
  };

  /** A straight neighbour almost along an end tangent is that tangent, measured more exactly. */
  const snap = (tangent: Point, other: number | undefined) => {
    const neighbour = other === undefined ? undefined : segments[other];
    if (neighbour?.type !== "L" && neighbour?.type !== "Z") return tangent;
    const direction = sub(neighbour.to, neighbour.from);
    return angleBetween(direction, tangent) <= snapAngle ? direction : tangent;
  };

  const candidates = new Set<number>();
  segments.forEach((segment, index) => {
    if (segment.type !== "M" && cornerShaped(segment)) candidates.add(index);
  });

  // A tip, turning further than a corner, rounds the meeting of two strokes. Smoothly joined to a
  // small curve bending the other way it is a wave's crest instead (a tilde, a sign's waves), and
  // both stay curves; marking both keeps sharpening idempotent.
  const waves = new Set<number>();
  for (const index of candidates) {
    const next = neighbours.get(index)?.next;
    if (next === undefined || !candidates.has(next)) continue;
    const own = tangents(segments[index] as Drawn) as Ends;
    const theirs = tangents(segments[next] as Drawn) as Ends;
    const bend = bendAt(segments[index] as Drawn, "end");
    // Both crests wide: a tilde's. A star's tip beside its inner corner is a tip and a corner.
    const tip = Math.min(angleBetween(own.start, own.end), angleBetween(theirs.start, theirs.end));
    if (
      tip > cornerSweep &&
      angleBetween(own.end, theirs.start) <= smoothAngle &&
      bend !== 0 &&
      bend === -bendAt(segments[next] as Drawn, "start")
    ) {
      waves.add(index);
      waves.add(next);
    }
  }

  // Chains of corner-shaped segments that carry one another's curve on: two half-roundings drawn
  // as separate arcs make one corner; two quarter arcs drawing a round end make a curve.
  const decisions: CornerDecision[] = [];
  const done = new Set<number>();
  for (const seed of candidates) {
    if (done.has(seed)) continue;
    const linked = (index: number, side: "start" | "end") => {
      const other = neighbours.get(index)?.[side === "start" ? "previous" : "next"];
      if (other === undefined || !candidates.has(other) || !continues(index, other, side)) {
        return undefined;
      }
      // Roundings of one corner (or one round end) share a radius; a corner beside a wider crest
      // (a receipt's corner, then its zigzag) are two roundings.
      const theirSide = side === "start" ? "end" : "start";
      const radii = [
        radiusAt(segments[index] as Drawn, side),
        radiusAt(segments[other] as Drawn, theirSide),
      ];
      return Math.max(...radii) <= chainRatio * Math.min(...radii) ? other : undefined;
    };
    const chain = [seed];
    let wraps = false;
    for (let at = linked(seed, "start"); at !== undefined; at = linked(at, "start")) {
      if (at === seed || chain.includes(at)) {
        wraps = true;
        break;
      }
      if (at > chain[0]) wraps = true;
      chain.unshift(at);
    }
    for (let at = linked(seed, "end"); at !== undefined && !wraps; at = linked(at, "end")) {
      if (chain.includes(at)) {
        wraps = true;
        break;
      }
      if (at < (chain.at(-1) as number)) wraps = true;
      chain.push(at);
    }
    for (const index of chain) done.add(index);

    const first = segments[chain[0]] as Drawn;
    const last = segments[chain.at(-1) as number] as Drawn;
    const ends = chain.map((index) => tangents(segments[index] as Drawn) as Ends);
    const turns = ends.map(({ start, end }) => angleBetween(start, end));
    const total = turns.reduce((sum, turn) => sum + turn, 0);
    const previous = neighbours.get(chain[0])?.previous;
    const next = neighbours.get(chain.at(-1) as number)?.next;
    const free: CornerDecision["free"] =
      previous === undefined
        ? next === undefined
          ? "both"
          : "start"
        : next === undefined
          ? "end"
          : undefined;
    const decide = (
      result: CornerDecision["result"],
      points: readonly Point[] = [],
      start?: Point,
    ) => {
      chain.forEach((index, position) => {
        const type = (segments[index] as Drawn).type as CornerDecision["type"];
        const own = position === 0 ? points : [];
        const extra = { ...(free ? { free } : {}), ...(start && position === 0 ? { start } : {}) };
        decisions.push({ index, type, result, turn: turns[position], points: own, ...extra });
      });
    };
    // A chain that a flatter curve carries on, or that turns further than a corner, is a curve.
    if (
      wraps ||
      (previous !== undefined &&
        !candidates.has(previous) &&
        continues(chain[0], previous, "start")) ||
      (next !== undefined &&
        !candidates.has(next) &&
        continues(chain.at(-1) as number, next, "end")) ||
      (chain.length > 1 && total > cornerSweep)
    ) {
      decide("curve");
      continue;
    }
    if (chain.some((index) => waves.has(index))) {
      decide("curve");
      continue;
    }
    // A tip is where two strokes meet; at an open end of the path it is a hook (an S's end, a
    // signature's flourish), which stays round.
    const cornerPiece =
      free === "both" &&
      (continuedBy(context, first.from, ends[0].start, -1) ||
        continuedBy(context, last.to, (ends.at(-1) as Ends).end, 1));
    if (total > cornerSweep && free !== undefined && !cornerPiece) {
      decide("curve");
      continue;
    }
    // A rounding joins what it rounds smoothly, at each end that joins anything. (At an open end,
    // as in a dashed square's corner pieces, the squared corner simply ends in a short leg.)
    const meets = (other: number | undefined, own: Point, side: "start" | "end") => {
      if (other === undefined) return "free";
      const neighbour = segments[other] as Drawn;
      const theirs = tangents(neighbour) as Ends;
      const tangent = side === "start" ? theirs.end : theirs.start;
      // A straight neighbour may meet a rounding with a slight kink and still be what it rounds.
      const straight = neighbour.type === "L" || neighbour.type === "Z";
      return angleBetween(own, tangent) <= (straight ? snapAngle : smoothAngle) ? "smooth" : "cusp";
    };
    const joins = [
      meets(previous, ends[0].start, "start"),
      meets(next, (ends.at(-1) as Ends).end, "end"),
    ];
    if (joins.includes("cusp")) {
      decide("side");
      continue;
    }
    // A rounding that is a whole open path is a corner piece, as in a dashed square, only when a
    // straight stroke elsewhere in the icon carries one of its end tangents on. Otherwise it is a
    // curved stroke: a fragment of a circle cut by a slash, a highlight, a mask's eye slit.
    if (
      free === "both" &&
      !continuedBy(context, first.from, ends[0].start, -1) &&
      !continuedBy(context, last.to, (ends.at(-1) as Ends).end, 1)
    ) {
      decide("curve");
      continue;
    }
    // A lone corner piece's legs run along the dashes it continues (a dashed triangle's corner).
    const dashIn = cornerPiece ? continuationOf(context, first.from, ends[0].start, -1) : undefined;
    const dashOut = cornerPiece
      ? continuationOf(context, last.to, (ends.at(-1) as Ends).end, 1)
      : undefined;
    const startTangent = dashIn ? scale(dashIn, -1) : snap(ends[0].start, previous);
    const endTangent = dashOut ?? snap((ends.at(-1) as Ends).end, next);
    const hit = intersect(first.from, startTangent, last.to, endTangent);
    if (!hit || hit[0] <= tiny || hit[1] >= -tiny) {
      decide("degenerate");
      continue;
    }
    const corner = add(first.from, scale(startTangent, hit[0]));
    const curve = chain.map((index) => segments[index] as Drawn);
    const half = chainMiddle(curve, turns);
    // Every other stroke: the other elements', and this path's own beyond the corner's neighbours.
    const attached = new Set([...chain, previous, next]);
    const others = [
      ...(context.strokes ?? []),
      ...segments.flatMap((segment, index) =>
        segment.type === "M" || attached.has(index) ? [] : [flatten(segment)],
      ),
    ];
    // Where the point would cross the padding is settled for the whole icon later (`fitIcon`).
    const tips = joinExtent(corner, startTangent, endTangent);
    // An element listed in `tipHeight` has its acute tips cut at the round outline's extent.
    const heldTip = context.tipHeight === true && total > cornerSweep;
    const clear =
      !heldTip &&
      (!half || tipReach(tips, half.point, startTangent, endTangent) <= maxTipReach) &&
      !(half && runsInto(curve, corner, startTangent, endTangent, half, others));
    if (clear) {
      // A partial rounding where the path stops (a back page fading out behind the front one)
      // squares to the corner and stops there, rather than ending in a short slanted leg.
      // Where the free end sits on another stroke (a fold line ending on a page's edge), the leg is
      // hidden in that stroke and stays, so the corner shows as a corner.
      // The element's own other subpaths count too (a fold line ending on its own page's edge).
      const ownLines = subpaths(segments)
        .filter(({ indices }) => !indices.includes(chain[0]))
        .flatMap(({ indices }) => indices.map((index) => flatten(segments[index] as Drawn)));
      const onStroke = (point: Point, leg: Point) =>
        [...(context.strokes ?? []), ...ownLines].some((line) => {
          if (distanceTo(point, line) > iconSystem.design.strokeWidth / 2 + 0.05) return false;
          // The stroke's direction where it passes the free end.
          let best = 0;
          for (let index = 1; index < line.length; index += 1) {
            const d = distanceTo(point, [line[index - 1], line[index]]);
            if (d <= distanceTo(point, [line[best], line[Math.min(best + 1, line.length - 1)]])) {
              best = index - 1;
            }
          }
          const along = sub(line[Math.min(best + 1, line.length - 1)], line[best]);
          if (length(along) < tiny) return false;
          const turn = angleBetween(along, leg);
          return turn < 10 || turn > 170;
        });
      const legOut = sub(corner, last.to);
      const legIn = sub(corner, first.from);
      // A path stopping at the corner ends there heading along the incoming line; one starting
      // there leaves along the outgoing line, so its cap points back.
      const capOut = startTangent;
      const capIn = scale(endTangent, -1);
      // Stopping at the corner leaves its square cap pointing along the leg; only where that cap
      // stays inside the padding (otherwise the leg stays, ending as drawn).
      const inset = iconSystem.design.safeAreaInset;
      const capInside = (leg: Point) =>
        length(leg) < tiny ||
        capCorners(corner, unit(leg)).every(
          ([x, y]) =>
            x >= inset - 0.01 &&
            y >= inset - 0.01 &&
            x <= iconSystem.architecture.grid.width - inset + 0.01 &&
            y <= iconSystem.architecture.grid.height - inset + 0.01,
        );
      if (
        free === "end" &&
        total < partialTurn &&
        !onStroke(last.to, legOut) &&
        capInside(capOut)
      ) {
        decide("corner", [corner]);
      } else if (
        free === "start" &&
        total < partialTurn &&
        !onStroke(first.from, legIn) &&
        capInside(capIn)
      ) {
        decide("corner", [last.to], corner);
      } else decide("corner", [corner, last.to]);
      continue;
    }
    // The point would push the join past the canvas or into another stroke: cut the corner flat
    // along the tangent at the rounding's middle instead, so it reaches exactly as far as the
    // rounding did.
    const enter = half && intersect(first.from, startTangent, half.point, half.tangent);
    const leave = half && intersect(half.point, half.tangent, last.to, endTangent);
    if (!half || !enter || !leave || enter[0] <= tiny || leave[1] >= -tiny) {
      decide("degenerate");
      continue;
    }
    decide("chamfer", [
      add(first.from, scale(startTangent, enter[0])),
      add(half.point, scale(half.tangent, leave[0])),
      last.to,
    ]);
  }
  return decisions.sort((left, right) => left.index - right.index);
}

/** Point and direction where a chain of roundings has made half its turn, near enough. */
function chainMiddle(
  chain: readonly Drawn[],
  turns: readonly number[],
): { point: Point; tangent: Point } | undefined {
  const total = turns.reduce((sum, turn) => sum + turn, 0);
  let best: { point: Point; tangent: Point } | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  let before = 0;
  chain.forEach((segment, position) => {
    const options: [number, { point: Point; tangent: Point } | undefined][] = [
      [before + turns[position] / 2, middle(segment)],
    ];
    const ends = tangents(segment);
    if (position > 0 && ends) options.push([before, { point: segment.from, tangent: ends.start }]);
    for (const [turned, option] of options) {
      if (option && Math.abs(turned - total / 2) < bestDistance) {
        best = option;
        bestDistance = Math.abs(turned - total / 2);
      }
    }
    before += turns[position];
  });
  return best;
}

/**
 * Corner decisions for one path's data, for tests and review. `context` holds the strokes of the
 * rest of the icon (`outlineContext`).
 */
export function analyzePathData(
  d: string,
  context: OutlineContext = emptyContext,
): CornerDecision[] {
  return planCorners(parsePath(d), context);
}

type Item =
  /** `added`: written in place of a corner rounding, so dropped when it has no length. */
  | { type: "L"; to: Point; added?: boolean }
  | { type: "C"; c1: Point; c2: Point; to: Point }
  | { type: "Q"; c: Point; to: Point }
  | {
      type: "A";
      rx: number;
      ry: number;
      rotation: number;
      large: boolean;
      sweep: boolean;
      to: Point;
    };

type Subpath = { start: Point; items: Item[]; closed: boolean };

/**
 * Tidies one rebuilt subpath: drops zero-length lines written at corners and merges lines that run
 * straight on, including across the closing segment, so a squared corner is one clean vertex.
 */
function tidy({ start, items, closed }: Subpath): Subpath {
  const kept: Item[] = [];
  let current = start;
  let lineStart: Point | undefined;
  for (const item of items) {
    if (item.type === "L") {
      if (item.added && same(item.to, current)) continue;
      const previous = kept.at(-1);
      if (previous?.type === "L" && lineStart && straightOn(lineStart, current, item.to)) {
        previous.to = item.to;
      } else {
        kept.push({ ...item });
        lineStart = current;
      }
    } else {
      kept.push(item);
      lineStart = undefined;
    }
    current = item.to;
  }
  if (!closed || kept.length < 2) return { start, items: kept, closed };
  // The closing segment draws a line from the last point back to the start. A last line that the
  // closing line continues straight on (or that ends at the start) is redundant.
  const last = kept.at(-1) as Item;
  const beforeLast = kept.length > 1 ? (kept.at(-2) as Item).to : start;
  if (
    last.type === "L" &&
    (same(last.to, start) || straightOn(beforeLast, last.to, start)) &&
    !same(beforeLast, start)
  ) {
    kept.pop();
  }
  // A start point in the middle of a straight run moves to the run's far end.
  const first = kept[0];
  const end = (kept.at(-1) as Item).to;
  if (first.type === "L" && kept.length > 1 && straightOn(end, start, first.to)) {
    return { start: first.to, items: kept.slice(1), closed };
  }
  return { start, items: kept, closed };
}

/**
 * The part of a segment at least `reach` (in grid units, measured along it, roughly) from one end:
 * `"end"` trims its end, `"start"` its start. Returns the trimmed segment and the new end point.
 */
function trim(segment: Drawn, end: "start" | "end", reach: number, most = 0.4): Drawn {
  const total = segmentLength(segment);
  const fraction = Math.min(most, reach / Math.max(total, tiny));
  const t = end === "end" ? 1 - fraction : fraction;
  const lerp = (a: Point, b: Point, k: number): Point => add(a, scale(sub(b, a), k));
  switch (segment.type) {
    case "L":
    case "Z": {
      const cut = lerp(segment.from, segment.to, t);
      return end === "end"
        ? { type: "L", from: segment.from, to: cut }
        : { type: "L", from: cut, to: segment.to };
    }
    case "Q": {
      const { from, c, to } = segment;
      const [p01, p12] = [lerp(from, c, t), lerp(c, to, t)];
      const cut = lerp(p01, p12, t);
      return end === "end"
        ? { type: "Q", from, c: p01, to: cut }
        : { type: "Q", from: cut, c: p12, to };
    }
    case "C": {
      const { from, c1, c2, to } = segment;
      const [p01, p12, p23] = [lerp(from, c1, t), lerp(c1, c2, t), lerp(c2, to, t)];
      const [p012, p123] = [lerp(p01, p12, t), lerp(p12, p23, t)];
      const cut = lerp(p012, p123, t);
      return end === "end"
        ? { type: "C", from, c1: p01, c2: p012, to: cut }
        : { type: "C", from: cut, c1: p123, c2: p23, to };
    }
    case "A": {
      const arc = arcGeometry(segment);
      if (!arc) return segment;
      const theta = arc.startAngle + arc.sweepAngle * t;
      const cos = Math.cos(arc.rotation);
      const sin = Math.sin(arc.rotation);
      const [x, y] = [arc.rx * Math.cos(theta), arc.ry * Math.sin(theta)];
      const cut = add(arc.center, [cos * x - sin * y, sin * x + cos * y]);
      const kept = Math.abs(arc.sweepAngle) * (end === "end" ? t : 1 - t);
      // The trimmed arc keeps the radii it is drawn with, so it stays on the same circle.
      const shape = { rx: arc.rx, ry: arc.ry, rotation: segment.rotation, sweep: segment.sweep };
      const large = kept > Math.PI;
      return end === "end"
        ? { type: "A", from: segment.from, to: cut, large, ...shape }
        : { type: "A", from: cut, to: segment.to, large, ...shape };
    }
  }
}

/** A segment's length, measured along it. */
function segmentLength(segment: Drawn): number {
  if (segment.type === "L" || segment.type === "Z") return length(sub(segment.to, segment.from));
  const points = flatten(segment, 48);
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += length(sub(points[index], points[index - 1]));
  }
  return total;
}

/** A drawn segment as a subpath item. */
function itemOf(segment: Drawn): Item {
  switch (segment.type) {
    case "L":
    case "Z":
      return { type: "L", to: roundPoint(segment.to), added: true };
    case "C":
      return {
        type: "C",
        c1: roundPoint(segment.c1),
        c2: roundPoint(segment.c2),
        to: roundPoint(segment.to),
      };
    case "Q":
      return { type: "Q", c: roundPoint(segment.c), to: roundPoint(segment.to) };
    case "A": {
      const { rx, ry, rotation, large, sweep } = segment;
      return { type: "A", rx, ry, rotation, large, sweep, to: roundPoint(segment.to) };
    }
  }
}

/**
 * Rotates each closed subpath to start on a straight segment, so a rounding the path happens to
 * start or end on is planned like every other corner (a sail's apex, a wingtip before the close).
 */
function rotateClosed(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const { indices, closed } of subpaths(segments)) {
    const move = segments[(indices[0] ?? 1) - 1] as Segment;
    let drawn = indices.map((index) => segments[index] as Drawn);
    const closing = drawn.at(-1);
    if (!closed || closing?.type !== "Z") {
      out.push(move, ...drawn);
      continue;
    }
    drawn = drawn.slice(0, -1);
    if (!same(closing.from, closing.to))
      drawn.push({ type: "L", from: closing.from, to: closing.to });
    const first = drawn.findIndex(
      (segment) => segment.type === "L" && !same(segment.from, segment.to),
    );
    if (first <= 0 || drawn[0].type === "L") {
      out.push(move, ...indices.map((index) => segments[index]));
      continue;
    }
    const turned = [...drawn.slice(first), ...drawn.slice(0, first)];
    const start = turned[0].from;
    out.push({ type: "M", to: start }, ...turned, {
      type: "Z",
      from: (turned.at(-1) as Drawn).to,
      to: start,
    });
  }
  return out;
}

/**
 * Rewrites path data with its corner roundings squared off. Returns the input unchanged when the
 * path has none, otherwise absolute commands with at most three decimals. `context` holds the
 * strokes of the rest of the icon (`outlineContext`): whether a path that is a single rounding is a
 * dashed outline's corner piece, and whether a corner would run into another stroke.
 */
export function sharpenPathData(d: string, context: OutlineContext = emptyContext): string {
  const segments = rotateClosed(parsePath(d));
  const replaced = new Map<number, { points: readonly Point[]; start?: Point }>();
  for (const { index, result, points, start } of planCorners(segments, context)) {
    if (result === "corner" || result === "chamfer") replaced.set(index, { points, start });
  }
  const paths: Subpath[] = [];
  segments.forEach((segment, index) => {
    if (segment.type === "M") {
      paths.push({ start: roundPoint(segment.to), items: [], closed: false });
      return;
    }
    const path = paths[paths.length - 1];
    const replacement = replaced.get(index);
    if (replacement) {
      const { points, start } = replacement;
      // A new start applies only while nothing has been drawn; otherwise keep the leg.
      if (start && path.items.length === 0) path.start = roundPoint(start);
      else if (start) path.items.push({ type: "L", to: roundPoint(start), added: true });
      for (const point of points)
        path.items.push({ type: "L", to: roundPoint(point), added: true });
      return;
    }
    switch (segment.type) {
      case "L":
        path.items.push({ type: "L", to: roundPoint(segment.to) });
        break;
      case "C":
        path.items.push({
          type: "C",
          c1: roundPoint(segment.c1),
          c2: roundPoint(segment.c2),
          to: roundPoint(segment.to),
        });
        break;
      case "Q":
        path.items.push({ type: "Q", c: roundPoint(segment.c), to: roundPoint(segment.to) });
        break;
      case "A": {
        const { rx, ry, rotation, large, sweep } = segment;
        path.items.push({ type: "A", rx, ry, rotation, large, sweep, to: roundPoint(segment.to) });
        break;
      }
      case "Z":
        path.closed = true;
        break;
    }
  });

  if (replaced.size === 0) return d;
  return writeSubpaths(paths.map(tidy));
}

/** Path data for subpaths: absolute commands, three decimals at most. */
function writeSubpaths(paths: readonly Subpath[]): string {
  const parts: string[] = [];
  const at = (p: Point) => `${coordinate(p[0])} ${coordinate(p[1])}`;
  for (const { start, items, closed } of paths) {
    parts.push(`M${at(start)}`);
    let current = start;
    for (const item of items) {
      switch (item.type) {
        case "L":
          if (item.to[1] === current[1] && item.to[0] !== current[0]) {
            parts.push(`H${coordinate(item.to[0])}`);
          } else if (item.to[0] === current[0] && item.to[1] !== current[1]) {
            parts.push(`V${coordinate(item.to[1])}`);
          } else parts.push(`L${at(item.to)}`);
          break;
        case "C":
          parts.push(`C${at(item.c1)} ${at(item.c2)} ${at(item.to)}`);
          break;
        case "Q":
          parts.push(`Q${at(item.c)} ${at(item.to)}`);
          break;
        case "A": {
          const flags = `${item.large ? 1 : 0} ${item.sweep ? 1 : 0}`;
          parts.push(
            `A${coordinate(item.rx)} ${coordinate(item.ry)} ${coordinate(item.rotation)} ${flags} ${at(item.to)}`,
          );
          break;
        }
      }
      current = item.to;
    }
    if (closed) parts.push("Z");
  }
  return parts.join("");
}

/** Whether b lies on the straight run from a to c, within rounding. */
function straightOn(a: Point, b: Point, c: Point): boolean {
  const ab = sub(b, a);
  const bc = sub(c, b);
  if (length(ab) < tiny || length(bc) < tiny) return false;
  if (dot(ab, bc) <= 0) return false;
  const ac = sub(c, a);
  return Math.abs(cross(ac, ab)) / length(ac) < 0.002;
}

// Fitting the whole icon. Sharp caps and miters reach further than round ones: a square cap pokes
// past a stroke it ends on, and a mitered tip reaches √2 from a right-angled vertex where the round
// join reached 1. These steps settle that across all elements at once, until nothing changes.

/** One subpath as standalone segments; a closing line with length is a `Z` segment. */
type Run = { segs: Drawn[]; closed: boolean };

/** One outline element, as runs the fitting can edit. */
type Piece = {
  readonly tag: string;
  attributes: Attribute[];
  runs: Run[];
  /** Paths, lines, polylines, and polygons; rects, circles, and ellipses are only obstacles. */
  readonly editable: boolean;
  /** Kept round: only its ends may be trimmed where they sit on another stroke. */
  readonly endsOnly?: boolean;
  changed: boolean;
};

/** Below this length a subpath is a dot, drawn by its caps alone. */
const dotLength = 0.5;
/** Lengths an arm or an end segment keeps at least, whatever is trimmed from it. */
const minArm = 0.3;
/** Shortest line written to cut a vertex flat; anything shorter renders as the point it cuts. */
const minBridge = 0.2;
/** Paint may touch the padding; only crossing it by more than this counts. */
const padSlack = 0.01;
/** Slack for coordinates written with three decimals. */
const slack = 0.005;

const unit = (p: Point): Point => scale(p, 1 / length(p));

/** Splits path data into runs. */
function runsOfPath(d: string): Run[] {
  const segments = parsePath(d);
  return subpaths(segments)
    .map(({ indices, closed }) => ({
      segs: indices
        .map((index) => segments[index] as Drawn)
        .filter((segment) => !(segment.type === "Z" && same(segment.from, segment.to))),
      closed,
    }))
    .filter((run) => run.segs.length > 0);
}

function pieceOf(tag: string, attributes: Attribute[]): Piece {
  const value = (name: string) => attributes.find(([key]) => key === name)?.[1];
  const n = (name: string) => Number(value(name) ?? 0);
  const piece = (runs: Run[], editable: boolean): Piece => ({
    tag,
    attributes,
    runs,
    editable,
    changed: false,
  });
  switch (tag) {
    case "path": {
      // An open subpath that ends where it starts (Lucide's eye, a store's awning) is a loop: it is
      // closed, so its ends join instead of drawing two square caps over each other.
      let closed = false;
      const runs = runsOfPath(value("d") ?? "").map((run) => {
        const first = run.segs[0].from;
        const last = run.segs.at(-1) as Drawn;
        if (run.closed || run.segs.length < 2 || length(sub(first, last.to)) >= 0.002) return run;
        closed = true;
        const segs = [...run.segs.slice(0, -1), { ...last, to: first } as Drawn];
        // A start in the middle of a straight edge (triangle-alert's) is merged away, so the
        // corners either side keep their full arms.
        const [head, tail] = [segs[0], segs.at(-1) as Drawn];
        if (
          segs.length > 2 &&
          head.type === "L" &&
          tail.type === "L" &&
          straightOn(tail.from, head.from, head.to)
        ) {
          return {
            segs: [...segs.slice(1, -1), { type: "L", from: tail.from, to: head.to } as Drawn],
            closed: true,
          };
        }
        return { segs, closed: true };
      });
      return { ...piece(runs, true), changed: closed };
    }
    case "line":
      return piece(
        [
          {
            segs: [{ type: "L", from: [n("x1"), n("y1")], to: [n("x2"), n("y2")] }],
            closed: false,
          },
        ],
        true,
      );
    case "polyline":
    case "polygon": {
      const lines = elementLines(tag, attributes).filter(([a, b]) => !same(a, b));
      const segs: Drawn[] = lines.map(([from, to], index) =>
        tag === "polygon" && index === lines.length - 1
          ? { type: "Z", from, to }
          : { type: "L", from, to },
      );
      return piece([{ segs, closed: tag === "polygon" }], segs.length > 0);
    }
    default:
      return piece(runsOfPath(shapeData(tag, attributes)), false);
  }
}

/** Writes an edited piece's geometry back into its attributes. */
function writePiece(piece: Piece): Attribute[] {
  if (!piece.changed) return piece.attributes;
  if (piece.tag === "line" && piece.runs[0].segs.length > 1) {
    const d = writeSubpaths(
      piece.runs.map(({ segs, closed }) => ({
        start: roundPoint(segs[0].from),
        items: segs.filter((segment) => segment.type !== "Z").map(itemOf),
        closed,
      })),
    );
    const kept = piece.attributes.filter(([key]) => !["x1", "y1", "x2", "y2"].includes(key));
    return [["d", d], ...kept];
  }
  const at = (p: Point) => `${coordinate(p[0])} ${coordinate(p[1])}`;
  const set = (values: Record<string, string>) =>
    piece.attributes.map(([key, v]): Attribute => [key, values[key] ?? v]);
  switch (piece.tag) {
    case "line": {
      const { from, to } = piece.runs[0].segs[0];
      return set({
        x1: coordinate(from[0]),
        y1: coordinate(from[1]),
        x2: coordinate(to[0]),
        y2: coordinate(to[1]),
      });
    }
    case "polyline":
    case "polygon": {
      const { segs, closed } = piece.runs[0];
      const points = [segs[0].from, ...segs.map((segment) => segment.to)];
      // A polygon closes itself; its last point repeats its first.
      if (closed && points.length > 1 && same(points[0], points.at(-1) as Point)) points.pop();
      return set({ points: points.map(at).join(" ") });
    }
    default: {
      const paths = piece.runs.map(({ segs, closed }): Subpath => {
        const items = segs.filter((segment) => segment.type !== "Z").map(itemOf);
        return { start: roundPoint(segs[0].from), items, closed };
      });
      return set({ d: writeSubpaths(paths.map(tidy)) });
    }
  }
}

/** Points along a segment no further apart than about 0.2, for distances. */
function fine(segment: Drawn): Point[] {
  if (segment.type === "L" || segment.type === "Z") return [segment.from, segment.to];
  return flatten(segment, Math.min(96, Math.max(8, Math.ceil(segmentLength(segment) / 0.2))));
}

/** A run's open ends: where they are, which way the path leaves through them, and their segment. */
function runEnds(run: Run): { side: "start" | "end"; point: Point; out: Point; seg: number }[] {
  if (run.closed) return [];
  const total = run.segs.reduce((sum, segment) => sum + segmentLength(segment), 0);
  if (total < tiny) return [];
  const firstIndex = run.segs.findIndex((segment) => tangents(segment));
  const lastIndex =
    run.segs.length - 1 - [...run.segs].reverse().findIndex((segment) => tangents(segment));
  if (firstIndex < 0) return [];
  const first = tangents(run.segs[firstIndex]) as Ends;
  const last = tangents(run.segs[lastIndex]) as Ends;
  return [
    { side: "start", point: run.segs[0].from, out: unit(scale(first.start, -1)), seg: firstIndex },
    { side: "end", point: (run.segs.at(-1) as Drawn).to, out: unit(last.end), seg: lastIndex },
  ];
}

/** Corners of the square cap at an end. */
function capCorners(point: Point, out: Point): [Point, Point] {
  const h = iconSystem.design.strokeWidth / 2;
  const tip = add(point, scale(out, h));
  const across: Point = [-out[1] * h, out[0] * h];
  return [add(tip, across), sub(tip, across)];
}

/** The outermost points a join paints: the miter tip (or bevel ends) and both outer edges. */
function joinPoints(corner: Point, incoming: Point, outgoing: Point): Point[] {
  const h = iconSystem.design.strokeWidth / 2;
  const u = unit(incoming);
  const v = unit(outgoing);
  const side = Math.sign(cross(u, v));
  if (side === 0) return [];
  const normal = (t: Point): Point => [t[1] * side, -t[0] * side];
  return [
    ...joinExtent(corner, u, v),
    add(corner, scale(normal(u), h)),
    add(corner, scale(normal(v), h)),
  ];
}

/** The vertices of a run: indices of the segment pairs that meet at an angle. */
function runVertices(run: Run): [number, number][] {
  const pairs: [number, number][] = [];
  const count = run.segs.length;
  for (let index = 0; index < count; index += 1) {
    const next = index + 1 < count ? index + 1 : run.closed ? 0 : -1;
    if (next < 0 || next === index) continue;
    if (!same(run.segs[index].to, run.segs[next].from)) continue;
    const a = tangents(run.segs[index]);
    const b = tangents(run.segs[next]);
    if (!a || !b || angleBetween(a.end, b.start) <= 1) continue;
    pairs.push([index, next]);
  }
  return pairs;
}

type Bounds = { lo: Point; hi: Point };

/** How far a point lies outside the bounds; negative inside. */
const outside = ({ lo, hi }: Bounds, [x, y]: Point) =>
  Math.max(lo[0] - x, lo[1] - y, x - hi[0], y - hi[1]);

/**
 * Where the sharp drawing may paint: Lucide's padding (the safe area inside a 1-unit margin), or as
 * far as the drawing already reaches beyond it. A round source reaches its centerline plus half a
 * stroke all round; a sharp source (sharpened again) is taken at its own painted extent.
 */
function allowedBounds(pieces: readonly Piece[], sharpInput: boolean): Bounds {
  const { grid, viewBox } = iconSystem.architecture;
  const inset = iconSystem.design.safeAreaInset;
  const [x0, y0] = viewBox.split(" ").map(Number);
  const h = iconSystem.design.strokeWidth / 2;
  const points: Point[] = [];
  for (const piece of pieces) {
    for (const run of piece.runs) {
      for (const segment of run.segs) {
        const along = fine(segment);
        if (!sharpInput) {
          for (const p of along) points.push(add(p, [-h, -h]), add(p, [h, h]));
          continue;
        }
        along.forEach((p, index) => {
          const t = sub(
            along[Math.min(index + 1, along.length - 1)],
            along[Math.max(index - 1, 0)],
          );
          if (length(t) < tiny) return;
          const normal: Point = [-unit(t)[1] * h, unit(t)[0] * h];
          points.push(add(p, normal), sub(p, normal));
        });
      }
      if (sharpInput) {
        for (const [a, b] of runVertices(run)) {
          const ends = [tangents(run.segs[a]) as Ends, tangents(run.segs[b]) as Ends];
          points.push(...joinPoints(run.segs[a].to, ends[0].end, ends[1].start));
        }
        for (const end of runEnds(run)) points.push(...capCorners(end.point, end.out));
      }
    }
  }
  const lo: [number, number] = [x0 + inset, y0 + inset];
  const hi: [number, number] = [x0 + grid.width - inset, y0 + grid.height - inset];
  for (const [x, y] of points) {
    lo[0] = Math.min(lo[0], x);
    lo[1] = Math.min(lo[1], y);
    hi[0] = Math.max(hi[0], x);
    hi[1] = Math.max(hi[1], y);
  }
  return { lo, hi };
}

/**
 * The strokes an end can sit on: every other run (open ends lengthened by their square caps), and
 * the end's own run except the segment it ends and the one before that.
 */
type Cap = { readonly point: Point; readonly out: Point };
type Obstacles = { readonly lines: Point[][]; readonly caps: Cap[] };

function obstacles(pieces: readonly Piece[], run: Run, seg: number): Obstacles {
  const lines: Point[][] = [];
  const caps: Cap[] = [];
  for (const piece of pieces) {
    for (const other of piece.runs) {
      if (other === run) {
        other.segs.forEach((segment, index) => {
          if (Math.abs(index - seg) > 1) lines.push(fine(segment));
        });
        continue;
      }
      // Other subpaths of the same element count like other elements (shrink's arrowheads).
      for (const segment of other.segs) lines.push(fine(segment));
      for (const end of runEnds(other)) caps.push({ point: end.point, out: end.out });
    }
  }
  return { lines, caps };
}

/**
 * Whether a point is painted by one of the obstacles, within `limit` of a centerline or inside a
 * square cap (a cap is a rectangle: it covers nothing beyond its far edge).
 */
function covered(point: Point, { lines, caps }: Obstacles, limit: number): boolean {
  const h = iconSystem.design.strokeWidth / 2;
  const slackBeyond = limit - h;
  return (
    lines.some((line) => distanceTo(point, line) <= limit) ||
    caps.some(({ point: end, out }) => {
      const offset = sub(point, end);
      const along = dot(offset, out);
      return (
        along >= -h && along <= h + slackBeyond && Math.abs(cross(out, offset)) <= h + slackBeyond
      );
    })
  );
}

/**
 * Whether segment pq crosses a polyline, counting a crossing at one of the polyline's own vertices
 * or ends (a crossbar centred on a stem's end passes through the stem's end).
 */
function passesThrough(p: Point, q: Point, polyline: readonly Point[]): boolean {
  for (let index = 0; index + 1 < polyline.length; index += 1) {
    const a = polyline[index];
    const b = polyline[index + 1];
    const d1 = cross(sub(q, p), sub(a, p));
    const d2 = cross(sub(q, p), sub(b, p));
    const d3 = cross(sub(b, a), sub(p, a));
    const d4 = cross(sub(b, a), sub(q, a));
    if (d1 * d2 <= 0 && d3 * d4 < 0 && (Math.abs(d1) > tiny || Math.abs(d2) > tiny)) return true;
  }
  return false;
}

/**
 * Whether a run's end stops on one of `lines`: it lies within that stroke, having come in from
 * outside, and does not reach the stroke's far edge. A line that passes through a stroke (a
 * calendar's tab through the frame, a slider's knob across its bar) ends beyond it, not on it.
 */
function endsOn(
  run: Run,
  end: { side: "start" | "end"; point: Point; out: Point; seg: number },
  lines: readonly (readonly Point[])[],
): boolean {
  const h = iconSystem.design.strokeWidth / 2;
  const along = fine(run.segs[end.seg]);
  const back = end.side === "end" ? [...along].reverse() : along;
  return lines.some((line) => {
    const gap = distanceTo(end.point, line);
    if (gap > h + 0.02) return false;
    // Nearest to one of the stroke's ends, and beyond it in the direction the run leaves: the run
    // has passed that stroke's end alongside it (a plug's plate past the body's corner).
    const [first, last] = [line[0], line.at(-1) as Point];
    const tip = [first, last].find((p) => Math.abs(length(sub(end.point, p)) - gap) < 1e-6);
    if (tip && gap > 0.05 && dot(unit(sub(end.point, tip)), end.out) > 0.7) return false;
    let walked = 0;
    for (let index = 1; index < back.length && walked <= 2 * h; index += 1) {
      if (passesThrough(back[index - 1], back[index], line)) return gap < h - 0.05;
      walked += length(sub(back[index], back[index - 1]));
    }
    return true;
  });
}

/** Trims a run's end segment by `reach` along it; returns the new end and its outward tangent. */
function trimmedEnd(run: Run, side: "start" | "end", seg: number, reach: number) {
  const segment = trim(run.segs[seg], side, reach, 0.95);
  const ends = tangents(segment);
  if (!ends) return undefined;
  return side === "start"
    ? { segment, point: segment.from, out: unit(scale(ends.start, -1)) }
    : { segment, point: segment.to, out: unit(ends.end) };
}

/**
 * What corner sharpening would decide for one segment of a run: trimming a curve must not change
 * that, or sharpening the result again would treat the curve differently.
 */
function decisionOf(run: Run, seg: number, replacement: Drawn): string {
  const segs = run.segs.map((segment, index) => (index === seg ? replacement : segment));
  const segments: Segment[] = [{ type: "M", to: segs[0].from }, ...segs];
  if (run.closed && segs.at(-1)?.type !== "Z") {
    segments.push({ type: "Z", from: (segs.at(-1) as Drawn).to, to: segs[0].from });
  }
  return planCorners(segments).find(({ index }) => index === seg + 1)?.result ?? "none";
}

/**
 * A vertex cut flat by `reach` along both arms: the trimmed arms, the bridge between them, and
 * the two joins the cut makes (corner, incoming, outgoing).
 */
function cutVertex(
  inSeg: Drawn,
  outSeg: Drawn,
  reach: number,
  most: readonly [number, number] = [0.45, 0.45],
) {
  const a = trim(inSeg, "end", reach, most[0]);
  const b = trim(outSeg, "start", reach, most[1]);
  const [ea, eb] = [tangents(a), tangents(b)];
  const across = sub(b.from, a.to);
  if (!ea || !eb || length(across) < minBridge) return undefined;
  const bridge: Drawn = { type: "L", from: a.to, to: b.from };
  const joins: [Point, Point, Point][] = [
    [a.to, ea.end, across],
    [b.from, across, eb.start],
  ];
  return { a, b, bridge, joins };
}

/** One subpath of the drawing as given, as a polyline, for where its round stroke paints. */
type RoundRun = { readonly element: number; readonly points: Point[]; readonly ends: Point[] };

/** How far along each arm an inner corner (see `addJointLegs`) is bevelled. */
const innerBevel = 0.3;
/** Furthest a concave cusp's miter reaches from its vertex: the round join's reach plus a unit. */
const cuspReach = 2;
/** Below this, a gap between strokes reads as closed. */
const closedGap = 0.5;
/** The round drawing's gaps this wide or more are kept by miters. */
const keptGap = 0.8;

/**
 * Whether a join's miter harms a neighbouring element: (b) it passes through that element's
 * stroke and ends outside it, past the far side (a scale pan's apex through the beam, a ferris
 * wheel's frame from the hub ring into its hole), or (a) it nearly closes a gap the round drawing
 * kept to that element (a radical's tip reaching the frame). A miter that only sits beside another
 * stroke, pointing into open space, harms nothing: that is the sharp style. A stroke that ends on the
 * vertex (an arrow's shaft at its head's apex) is part of the joint, not a neighbour.
 */
function miterHarms(
  corner: Point,
  incoming: Point,
  outgoing: Point,
  own: readonly RoundRun[],
  others: readonly RoundRun[],
): boolean {
  const h = iconSystem.design.strokeWidth / 2;
  const u = unit(incoming);
  const v = unit(outgoing);
  const outward = sub(u, v);
  if (length(outward) < tiny) return false;
  const bisector = unit(outward);
  // Where the element's own round stroke reached along the bisector.
  const base = own.reduce<Point | undefined>((best, run) => {
    const near = nearestOn(corner, run.points);
    return !best || length(sub(near, corner)) < length(sub(best, corner)) ? near : best;
  }, undefined);
  const roundTip = add(base ?? corner, scale(bisector, h));
  const neighbours = others.filter((run) =>
    run.ends.every((end) => length(sub(end, corner)) > 0.05),
  );
  const covered = (p: Point) => others.some((run) => distanceTo(p, run.points) <= h + 0.02);
  return joinExtent(corner, u, v).some((tip) => {
    if (length(sub(tip, corner)) <= h + 0.02) return false;
    return neighbours.some((run) => {
      // Through: across the stroke, or from on it into the area it encloses (a hole or counter,
      // not the open space outside it).
      const through =
        passesThrough(corner, tip, run.points) ||
        (distanceTo(corner, run.points) <= 0.1 && enclosedBy(tip, run.points));
      if (through && distanceTo(tip, run.points) > h + 0.02 && !covered(tip)) return true;
      const roundGap = distanceTo(roundTip, run.points) - h;
      const sharpGap = distanceTo(tip, run.points) - h;
      return roundGap >= keptGap && sharpGap < closedGap;
    });
  });
}

/** Whether a point lies inside the area a polyline encloses (closed by its chord if open). */
function enclosedBy([x, y]: Point, polyline: readonly Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = polyline.length - 1; index < polyline.length; previous = index++) {
    const [xi, yi] = polyline[index];
    const [xj, yj] = polyline[previous];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The point of a polyline nearest to `point`. */
function nearestOn(point: Point, polyline: readonly Point[]): Point {
  let best = polyline[0];
  for (let index = 0; index + 1 < polyline.length; index += 1) {
    const a = polyline[index];
    const ab = sub(polyline[index + 1], a);
    const span = dot(ab, ab);
    const t = span < tiny ? 0 : Math.min(1, Math.max(0, dot(sub(point, a), ab) / span));
    const candidate = add(a, scale(ab, t));
    if (length(sub(point, candidate)) < length(sub(point, best))) best = candidate;
  }
  return best;
}

/** Unit directions of a vertex's two arms, pointing away from it. */
function vertexArms(run: Run, a: number, b: number): [Point, Point] {
  const [ea, eb] = [tangents(run.segs[a]) as Ends, tangents(run.segs[b]) as Ends];
  return [unit(scale(ea.end, -1)), unit(eb.start)];
}

/** The reflections a mirror twin may be related by: across a vertical, horizontal, or diagonal. */
const reflections: readonly ((
  p: Point,
  q: Point,
) => [(p: Point) => Point, (d: Point) => Point] | undefined)[] = [
  (p, q) =>
    Math.abs(p[1] - q[1]) < 0.02
      ? [([x, y]) => [p[0] + q[0] - x, y], ([dx, dy]) => [-dx, dy]]
      : undefined,
  (p, q) =>
    Math.abs(p[0] - q[0]) < 0.02
      ? [([x, y]) => [x, p[1] + q[1] - y], ([dx, dy]) => [dx, -dy]]
      : undefined,
  (p, q) =>
    Math.abs(p[1] - q[0] - (q[1] - p[0])) < 0.02
      ? [([x, y]) => [y - (p[1] - q[0]), x + (p[1] - q[0])], ([dx, dy]) => [dy, dx]]
      : undefined,
  (p, q) =>
    Math.abs(q[0] + p[1] - (p[0] + q[1])) < 0.02
      ? [([x, y]) => [q[0] + p[1] - y, q[0] + p[1] - x], ([dx, dy]) => [-dy, -dx]]
      : undefined,
];

const sameDirection = (u: Point, v: Point) => angleBetween(u, v) < 1;

/** Whether two sets of segments are alike: the same kinds and lengths, in either order. */
function similar(left: readonly Drawn[], right: readonly Drawn[]): boolean {
  const key = (segment: Drawn) => ({
    kind: segment.type === "Z" ? "L" : segment.type,
    size: segmentLength(segment),
  });
  const match = (a: Drawn, b: Drawn) => {
    const [x, y] = [key(a), key(b)];
    return x.kind === y.kind && Math.abs(x.size - y.size) <= 0.05 + 0.03 * Math.max(x.size, y.size);
  };
  if (left.length !== right.length) return false;
  if (left.length === 1) return match(left[0], right[0]);
  return (
    (match(left[0], right[0]) && match(left[1], right[1])) ||
    (match(left[0], right[1]) && match(left[1], right[0]))
  );
}

/** Whether vertex q, with arms `qa`, mirrors vertex p, with arms `pa`. */
function mirrored(p: Point, pa: readonly Point[], q: Point, qa: readonly Point[]): boolean {
  if (same(p, q)) return false;
  return reflections.some((reflect) => {
    const found = reflect(p, q);
    if (!found) return false;
    const [point, direction] = found;
    if (length(sub(point(p), q)) > 0.02) return false;
    const [m0, m1] = pa.map(direction);
    return (
      (sameDirection(m0, qa[0]) && sameDirection(m1, qa[1])) ||
      (sameDirection(m0, qa[1]) && sameDirection(m1, qa[0]))
    );
  });
}

/** Whether end q, leaving along `qo`, mirrors end p, leaving along `po`. */
function mirroredEnd(p: Point, po: Point, q: Point, qo: Point): boolean {
  if (same(p, q)) return false;
  return reflections.some((reflect) => {
    const found = reflect(p, q);
    if (!found) return false;
    const [point, direction] = found;
    return length(sub(point(p), q)) <= 0.02 && sameDirection(direction(po), qo);
  });
}

/**
 * Strokes meeting at a point act as one corner. Where a run's open end lands on another run's end
 * or vertex at an angle (two arrowhead arms drawn as separate strokes, a line ending on a frame's
 * corner), the end gets a short leg along the other stroke: the meeting is then drawn as a real
 * join, mitered or cut like any polyline corner, instead of two square caps overlapping. A run that
 * arrives inside the other stroke's corner (an arrow's shaft at its head's apex) is not a corner
 * of it; that end is left to the attached-end rule.
 */
function addJointLegs(pieces: readonly Piece[]): Map<Run, Set<string>> {
  /** Vertices of other runs that a leg now makes into an inner corner (see below). */
  const inner = new Map<Run, Set<string>>();
  const near = (a: Point, b: Point) => length(sub(a, b)) <= 0.05;
  // Legs are planned on the drawing as given and added at the end, so one leg never counts as
  // another stroke's corner.
  const additions: { piece: Piece; run: Run; side: "start" | "end"; leg: Drawn }[] = [];
  for (const piece of pieces) {
    if (!piece.editable || piece.endsOnly) continue;
    for (const run of piece.runs) {
      const total = run.segs.reduce((sum, segment) => sum + segmentLength(segment), 0);
      if (total < dotLength) continue;
      for (const end of runEnds(run)) {
        // Directions leaving the meeting point along every other run, with their segments.
        const leaving: { d: Point; segment: Drawn; run: Run }[] = [];
        for (const other of pieces) {
          for (const otherRun of other.runs) {
            if (otherRun === run) continue;
            for (const segment of otherRun.segs) {
              const ends = tangents(segment);
              if (!ends) continue;
              if (near(segment.from, end.point))
                leaving.push({ d: unit(ends.start), segment, run: otherRun });
              if (near(segment.to, end.point)) {
                leaving.push({ d: unit(scale(ends.end, -1)), segment, run: otherRun });
              }
            }
          }
        }
        if (leaving.length === 0) continue;
        const back = scale(end.out, -1);
        const inside = leaving.some(({ d: d1 }, i) =>
          leaving.some(({ d: d2 }, j) => {
            if (j <= i) return false;
            const span = angleBetween(d1, d2);
            if (span > 179) return false;
            const [x, y] = [angleBetween(d1, back), angleBetween(back, d2)];
            return x > 1 && y > 1 && Math.abs(x + y - span) < 0.5;
          }),
        );
        if (inside) continue;
        if (leaving.some(({ d }) => angleBetween(end.out, d) < 10)) continue;
        // A corner, not a junction: the run and everything leaving the point lie on one side of
        // some line through it (a Y or T junction spreads all round).
        const directions = [back, ...leaving.map(({ d }) => d)];
        const oneSide = directions.some((axis) =>
          [axis, scale(axis, -1)].some((normalDir) => {
            const n: Point = [-normalDir[1], normalDir[0]];
            return directions.every((d) => dot(d, n) >= -0.02);
          }),
        );
        if (!oneSide) continue;
        const candidates = leaving
          .filter(({ d, segment }) => {
            const turn = angleBetween(end.out, d);
            const straight = segment.type === "L" || segment.type === "Z";
            return turn >= 10 && turn <= 170 && straight && segmentLength(segment) >= 2;
          })
          .sort((left, right) => angleBetween(end.out, left.d) - angleBetween(end.out, right.d));
        const chosen = candidates[0];
        if (!chosen) continue;
        const leg = Math.min(1, segmentLength(chosen.segment) - 1);
        const tip = add(end.point, scale(chosen.d, leg));
        const legSegment: Drawn =
          end.side === "end"
            ? { type: "L", from: end.point, to: tip }
            : { type: "L", from: tip, to: end.point };
        additions.push({ piece, run, side: end.side, leg: legSegment });
        // Where the other stroke turns at this point (an arrow's arm into its shaft), its own
        // corner now lies inside the one the leg makes; its miter would only spike out past it.
        const turning = leaving.filter(({ run: other }) => other === chosen.run);
        if (turning.length > 1) {
          const set = inner.get(chosen.run) ?? new Set<string>();
          set.add(`${coordinate(end.point[0])},${coordinate(end.point[1])}`);
          inner.set(chosen.run, set);
        }
      }
    }
  }
  for (const { piece, run, side, leg } of additions) {
    if (side === "end") run.segs.push(leg);
    else run.segs.unshift(leg);
    piece.changed = true;
  }
  return inner;
}

/**
 * The share of each arm a vertex's cut may take: 45% where the arm's other end is another vertex,
 * which may be cut too, and all but `minArm` where the arm ends the path (a corner piece's legs).
 */
function armShares(run: Run, a: number, b: number): [number, number] {
  const share = (segment: Drawn, free: boolean) =>
    free ? Math.max(0.45, 1 - minArm / Math.max(segmentLength(segment), tiny)) : 0.45;
  const count = run.segs.length;
  return [
    share(run.segs[a], !run.closed && a === 0),
    share(run.segs[b], !run.closed && b === count - 1),
  ];
}

/** Icons whose fitting could not satisfy a rule, and why, for review. */
export const fitProblems: string[] = [];

/**
 * Fits a sharpened icon: hides square caps that end on other strokes, keeps every miter and cap
 * inside the padding, and cuts joins that would run into another stroke. Edits `pieces` in place.
 */
function fitIcon(
  pieces: Piece[],
  input: readonly Piece[],
  sharpInput: boolean,
  name: string,
): void {
  const bounds = allowedBounds(input, sharpInput);
  const h = iconSystem.design.strokeWidth / 2;
  // The drawing as given: where its strokes paint. A sharp source's open ends carry square caps,
  // so its polylines run on half a stroke past them.
  const roundRuns: RoundRun[] = input.flatMap((piece, element) =>
    piece.runs.map((run) => {
      const points = run.segs.flatMap((segment, index) => fine(segment).slice(index === 0 ? 0 : 1));
      const ends = runEnds(run).map((end) =>
        sharpInput ? add(end.point, scale(end.out, h)) : end.point,
      );
      if (sharpInput && ends.length === 2) {
        points.unshift(ends[0]);
        points.push(ends[1]);
      }
      return { element, points, ends };
    }),
  );
  const reported = new Set<string>();
  const problem = (what: string) => {
    if (!reported.has(what)) fitProblems.push(`${name}: ${what}`);
    reported.add(what);
  };
  const innerCorners = addJointLegs(pieces);
  // Vertices a cut created; they are never cut again (that would facet a tip into a polygon).
  const frozen = new Set<string>();
  const key = (p: Point) => `${coordinate(p[0])},${coordinate(p[1])}`;
  for (let round = 0; round < 8; round += 1) {
    let changed = false;
    const edit = (piece: Piece) => {
      piece.changed = true;
      changed = true;
    };

    // Vertices. A miter outside the padding, or one that runs from another stroke's paint into
    // space the round drawing leaves empty, is cut flat: perpendicular to its bisector (the same
    // reach along both arms, so neither edge changes direction), just far enough in. A vertex is
    // never moved. The cut is planned for every vertex first, given to mirror twins, then applied.
    type VertexPlan = {
      piece: Piece;
      run: Run;
      a: number;
      b: number;
      reach: number;
      /** Cut for the padding, which mirror twins share; not for running into paint. */
      bounds: boolean;
    };
    const plans: VertexPlan[] = [];
    pieces.forEach((piece, element) => {
      if (!piece.editable || piece.endsOnly) return;
      const otherRuns = roundRuns.filter((run) => run.element !== element);
      piece.runs.forEach((run) => {
        for (const [a, b] of runVertices(run)) {
          const [inSeg, outSeg] = [run.segs[a], run.segs[b]];
          const ends = [tangents(inSeg), tangents(outSeg)];
          if (!ends[0] || !ends[1]) continue;
          const vertex = inSeg.to;
          const ownRuns = roundRuns.filter((other) => other.element === element);
          const crosses = (corner: Point, incoming: Point, outgoing: Point) =>
            joinPoints(corner, incoming, outgoing).some((p) => outside(bounds, p) > padSlack);
          const harms = (corner: Point, incoming: Point, outgoing: Point) =>
            miterHarms(corner, incoming, outgoing, ownRuns, otherRuns);
          if (frozen.has(key(vertex))) continue;
          const straightArms = [inSeg, outSeg].every(
            (segment) => segment.type === "L" || segment.type === "Z",
          );
          if (innerCorners.get(run)?.has(key(vertex)) && straightArms) {
            const cut = cutVertex(inSeg, outSeg, innerBevel);
            if (cut) {
              plans.push({ piece, run, a, b, reach: innerBevel, bounds: false });
              continue;
            }
          }
          const forBounds = crosses(vertex, ends[0].end, ends[1].start);
          const forPaint = harms(vertex, ends[0].end, ends[1].start);
          // A concave cusp's miter points into its own shape; it may reach a unit past the round
          // join and no further (a cannabis leaf's inner spikes, a fan blade's root).
          const own = run.segs.flatMap((segment, k) => fine(segment).slice(k === 0 ? 0 : 1));
          const spikeTips = joinExtent(vertex, unit(ends[0].end), unit(ends[1].start));
          const forCusp =
            spikeTips.length === 1 &&
            length(sub(spikeTips[0], vertex)) > cuspReach + 0.05 &&
            enclosedBy(spikeTips[0], own);
          if (!forBounds && !forPaint && !forCusp) continue;
          // How deep a cut for a neighbour goes: to where the element's own round stroke reached
          // (a squared rounding's middle; a plain vertex's own point), keeping the round drawing's
          // gap to the neighbour.
          const depth = forPaint
            ? Math.min(...ownRuns.map((other) => distanceTo(vertex, other.points)))
            : 0;
          const bisector = unit(sub(unit(ends[0].end), unit(ends[1].start)));
          const shares = armShares(run, a, b);
          const most = Math.min(
            shares[0] * segmentLength(inSeg),
            shares[1] * segmentLength(outSeg),
            4,
          );
          let reach: number | undefined;
          let best: { reach: number; over: number } | undefined;
          for (let r = 0.02; r <= most + 1e-9; r += 0.02) {
            const cut = cutVertex(inSeg, outSeg, r, shares);
            if (!cut) continue;
            const shaped =
              piece.endsOnly ||
              (decisionOf(run, a, cut.a) === decisionOf(run, a, inSeg) &&
                decisionOf(run, b, cut.b) === decisionOf(run, b, outSeg));
            if (!shaped) break;
            const joins = cut.joins;
            const over = Math.max(
              ...joins.flatMap(([p, u, v]) => joinPoints(p, u, v).map((q) => outside(bounds, q))),
            );
            if (!best || over < best.over - 1e-6) best = { reach: r, over };
            const deep = Math.min(
              dot(sub(vertex, cut.a.to), bisector),
              dot(sub(vertex, cut.b.from), bisector),
            );
            const inBounds = joins.every(([p, u, v]) => !crosses(p, u, v));
            const clear = joins.every(([p, u, v]) => !harms(p, u, v));
            const outward = Math.max(
              ...joins.flatMap(([p, u, v]) =>
                joinPoints(p, u, v).map((q) => dot(sub(q, vertex), bisector)),
              ),
            );
            const short = !forCusp || outward <= cuspReach + 0.01;
            if (inBounds && clear && short && (!forPaint || deep >= depth - 0.005)) {
              reach = r;
              break;
            }
          }
          if (reach === undefined) {
            problem(
              `vertex at ${coordinate(vertex[0])},${coordinate(vertex[1])} cannot be fitted (${forBounds ? "padding" : ""}${forPaint ? "neighbour" : ""} ${best ? best.over.toFixed(2) : "-"})`,
            );
            // The round extent instead: a flat through where the round stroke reached.
            const own = Math.min(...ownRuns.map((other) => distanceTo(vertex, other.points)));
            for (let r = 0.02; r <= most + 1e-9 && reach === undefined; r += 0.02) {
              const cut = cutVertex(inSeg, outSeg, r, shares);
              if (!cut) continue;
              const deep = Math.min(
                dot(sub(vertex, cut.a.to), bisector),
                dot(sub(vertex, cut.b.from), bisector),
              );
              if (deep >= own - 0.005) reach = r;
            }
            if (reach === undefined) {
              if (!best) continue;
              reach = best.reach;
            }
          }
          plans.push({ piece, run, a, b, reach, bounds: forBounds });
        }
      });
    });
    // Mirror twins take the same cut, so symmetric shapes stay symmetric.
    for (const plan of plans.filter((each) => each.bounds)) {
      const vertex = plan.run.segs[plan.a].to;
      const arms = vertexArms(plan.run, plan.a, plan.b);
      // Twins within the same element only: across elements a match is a coincidence.
      for (const piece of [plan.piece]) {
        for (const run of piece.runs) {
          for (const [a, b] of runVertices(run)) {
            if (run === plan.run && a === plan.a) continue;
            const twin = run.segs[a].to;
            const turnOf = (r: Run, k: number, m: number) =>
              angleBetween((tangents(r.segs[k]) as Ends).end, (tangents(r.segs[m]) as Ends).start);
            const tip = turnOf(plan.run, plan.a, plan.b);
            if (!mirrored(vertex, arms, twin, vertexArms(run, a, b))) continue;
            // An acute tip's cut is copied (a pointed tip beside a flat twin reads as a mistake), and
            // twins that both need a cut take the same one; an obtuse corner that needs none (a
            // hexagon's other vertex) keeps its point.
            const planned = plans.some((other) => other.run === run && other.a === a);
            // Left and right twins (at the same height) always match: a scale's pans, an A's feet.
            const sideBySide = Math.abs(twin[1] - vertex[1]) < 0.02;
            if (tip <= cornerSweep && !planned && !sideBySide) continue;
            const alike = similar(
              [plan.run.segs[plan.a], plan.run.segs[plan.b]],
              [run.segs[a], run.segs[b]],
            );
            if (!alike) continue;
            const twinShares = armShares(run, a, b);
            const most = Math.min(
              twinShares[0] * segmentLength(run.segs[a]),
              twinShares[1] * segmentLength(run.segs[b]),
              4,
            );
            const existing = plans.find((other) => other.run === run && other.a === a);
            const reach = Math.min(plan.reach, most);
            if (existing) existing.reach = Math.max(existing.reach, reach);
            else plans.push({ piece, run, a, b, reach, bounds: true });
          }
        }
      }
    }
    // Apply, last vertex of each run first so earlier indices stay put.
    plans.sort((left, right) => right.a - left.a);
    for (const { piece, run, a, b, reach } of plans) {
      const cut = cutVertex(run.segs[a], run.segs[b], reach, armShares(run, a, b));
      if (!cut) continue;
      run.segs[a] = cut.a;
      run.segs[b] = cut.b;
      run.segs.splice(b === 0 ? run.segs.length : b, 0, cut.bridge);
      frozen.add(key(cut.bridge.from));
      frozen.add(key(cut.bridge.to));
      edit(piece);
    }
    if (changed) continue;

    // Ends on another stroke: a square cap whose corners would show past that stroke is drawn as a
    // butt end instead, by trimming half a stroke (or further, until both corners are hidden).
    for (const piece of pieces) {
      if (!piece.editable) continue;
      for (const run of piece.runs) {
        const total = run.segs.reduce((sum, segment) => sum + segmentLength(segment), 0);
        if (total < dotLength) continue;
        for (const end of runEnds(run)) {
          const near = obstacles(pieces, run, end.seg);
          if (!endsOn(run, end, near.lines)) continue;
          // An end that meets another end (a split stroke continuing, or two strokes meeting at a
          // corner) joins it as drawn; trimming either would leave a notch.
          const meets = near.caps.some(({ point }) => length(sub(point, end.point)) <= 0.05);
          if (meets) continue;
          // Two strokes overlapping each other's ends (a frame's side and a flap's stub on it) are
          // one shape already; trimming either opens a notch between them.
          const own = run.segs.map(fine);
          const mutual = near.caps.some(
            ({ point }) =>
              length(sub(point, end.point)) <= 2 * h &&
              own.some((line) => distanceTo(point, line) <= h + 0.05),
          );
          if (mutual) continue;
          const hidden = (point: Point, out: Point, limit: number) =>
            capCorners(point, out).every((corner) => covered(corner, near, limit));
          if (hidden(end.point, end.out, h + 0.03)) continue;
          // Never more than a cap's length: the square cap becomes a butt end, nothing shorter.
          const most = Math.min(h, segmentLength(run.segs[end.seg]) - minArm);
          let choice: ReturnType<typeof trimmedEnd>;
          // A curve trimmed so short it reads as a corner rounding would be squared if sharpened
          // again; it keeps its length (and is reported) instead.
          // (An element kept round is never sharpened, so its curves may shorten freely.)
          const before = piece.endsOnly ? "" : decisionOf(run, end.seg, run.segs[end.seg]);
          const keepsShape = (trimmed: Drawn) =>
            piece.endsOnly || decisionOf(run, end.seg, trimmed) === before;
          for (let reach = h; reach <= most + 1e-9 && !choice; reach += 0.05) {
            const trimmed = trimmedEnd(run, end.side, end.seg, reach);
            if (trimmed && !keepsShape(trimmed.segment)) break;
            if (trimmed && hidden(trimmed.point, trimmed.out, h)) choice = trimmed;
          }
          if (!choice) {
            problem(`end at ${coordinate(end.point[0])},${coordinate(end.point[1])} still shows`);
            const fallback = most >= h ? trimmedEnd(run, end.side, end.seg, h) : undefined;
            if (fallback && keepsShape(fallback.segment)) choice = fallback;
          }
          if (!choice) continue;
          run.segs[end.seg] = choice.segment;
          edit(piece);
        }
      }
    }

    // Free ends: a square cap outside the padding is shortened by its overshoot, and so is its
    // mirror twin (an A's other foot, a chevron's other arm).
    type EndPlan = { piece: Piece; run: Run; side: "start" | "end"; seg: number; need: number };
    const endPlans: EndPlan[] = [];
    const allEnds: (EndPlan & { point: Point; out: Point })[] = [];
    for (const piece of pieces) {
      if (!piece.editable || piece.endsOnly) continue;
      for (const run of piece.runs) {
        const total = run.segs.reduce((sum, segment) => sum + segmentLength(segment), 0);
        if (total < dotLength) continue;
        for (const end of runEnds(run)) {
          const entry = { piece, run, side: end.side, seg: end.seg, need: 0 };
          allEnds.push({ ...entry, point: end.point, out: end.out });
          let need = 0;
          let possible = true;
          for (const corner of capCorners(end.point, end.out)) {
            for (const axis of [0, 1] as const) {
              const over = Math.max(bounds.lo[axis] - corner[axis], corner[axis] - bounds.hi[axis]);
              if (over <= slack) continue;
              const toward = corner[axis] > bounds.hi[axis] ? end.out[axis] : -end.out[axis];
              if (toward < 0.05) possible = false;
              else need = Math.max(need, (over + slack) / toward);
            }
          }
          if (need === 0 && possible) continue;
          if (!possible) {
            problem(
              `cap at ${coordinate(end.point[0])},${coordinate(end.point[1])} crosses the padding`,
            );
            continue;
          }
          endPlans.push({ ...entry, need });
        }
      }
    }
    for (const plan of [...endPlans]) {
      const self = allEnds.find((end) => end.run === plan.run && end.side === plan.side);
      if (!self) continue;
      for (const end of allEnds.filter((each) => each.piece === plan.piece)) {
        if (end === self || !mirroredEnd(self.point, self.out, end.point, end.out)) continue;
        if (!similar([self.run.segs[self.seg]], [end.run.segs[end.seg]])) continue;
        const existing = endPlans.find((other) => other.run === end.run && other.side === end.side);
        if (existing) existing.need = Math.max(existing.need, plan.need);
        else endPlans.push({ ...end, need: plan.need });
      }
    }
    for (const plan of endPlans) {
      const { run, side, seg } = plan;
      const most = segmentLength(run.segs[seg]) - minArm;
      let need = plan.need;
      if (need > most) {
        const point = side === "start" ? run.segs[0].from : (run.segs.at(-1) as Drawn).to;
        problem(`cap at ${coordinate(point[0])},${coordinate(point[1])} crosses the padding`);
        if (most <= 0) continue;
        need = most;
      }
      const trimmed = trimmedEnd(run, side, seg, need);
      if (!trimmed) continue;
      if (decisionOf(run, seg, trimmed.segment) !== decisionOf(run, seg, run.segs[seg])) {
        problem(`cap at ${coordinate(trimmed.point[0])},${coordinate(trimmed.point[1])} kept`);
        continue;
      }
      run.segs[seg] = trimmed.segment;
      edit(plan.piece);
    }
    if (!changed) return;
  }
  problem("fitting did not settle");
}

const rootAttributes = (): string => {
  const { sharp, strokeWidth } = iconSystem.design;
  const { viewBox, color } = iconSystem.architecture;
  return [
    'xmlns="http://www.w3.org/2000/svg"',
    `viewBox="${viewBox}"`,
    'fill="none"',
    `stroke="${color}"`,
    `stroke-width="${strokeWidth}"`,
    `stroke-linecap="${sharp.linecap}"`,
    `stroke-linejoin="${sharp.linejoin}"`,
    `stroke-miterlimit="${sharp.miterLimit}"`,
  ].join(" ");
};

/** Largest radius of a circle a 2-unit stroke paints solid, which the sharp style squares. */
const dotRadius = 1;

type Attribute = readonly [string, string];

function sharpenElement(
  tag: string,
  attributes: Attribute[],
  context: OutlineContext,
): [string, Attribute[]] {
  const value = (name: string) => attributes.find(([key]) => key === name)?.[1];
  const number = (name: string) => Number(value(name) ?? 0);
  switch (tag) {
    case "rect": {
      const radius = value("rx") ?? value("ry");
      if (radius === undefined) return [tag, attributes];
      const rx = Number(value("rx") ?? radius);
      const ry = Number(value("ry") ?? radius);
      const [width, height] = [number("width"), number("height")];
      const pill = rx >= width / 2 - 1e-9 || ry >= height / 2 - 1e-9;
      if (pill) return [tag, attributes];
      return [tag, attributes.filter(([key]) => key !== "rx" && key !== "ry")];
    }
    case "circle": {
      const r = number("r");
      if (r > dotRadius || r <= 0) return [tag, attributes];
      const [cx, cy] = [number("cx"), number("cy")];
      const side = coordinate(2 * r);
      return [
        "rect",
        [
          ["width", side],
          ["height", side],
          ["x", coordinate(cx - r)],
          ["y", coordinate(cy - r)],
          ...attributes.filter(([key]) => key !== "cx" && key !== "cy" && key !== "r"),
        ],
      ];
    }
    case "path": {
      const d = value("d");
      if (d === undefined) return [tag, attributes];
      const sharpened = sharpenPathData(d, context);
      return [tag, attributes.map(([key, v]) => (key === "d" ? [key, sharpened] : [key, v]))];
    }
    default:
      return [tag, attributes];
  }
}

/**
 * A Lucide dot (a path drawn by its caps alone, such as `M9 9h.01`) that is kept round: written as
 * a tiny circle on the dot, which a stroke paints round whatever the root's caps. Undefined for any
 * other element.
 */
function roundDot(piece: Piece): string | undefined {
  if (piece.tag !== "path" || piece.runs.length !== 1) return undefined;
  const { segs } = piece.runs[0];
  const total = segs.reduce((sum, segment) => sum + segmentLength(segment), 0);
  if (total >= 0.1) return undefined;
  const from = segs[0].from;
  const to = (segs.at(-1) as Drawn).to;
  const [cx, cy] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const extra = piece.attributes.filter(([key]) => key !== "d");
  return `  <circle cx="${coordinate(cx)}" cy="${coordinate(cy)}" r="0.01"${extra.map(([key, v]) => ` ${key}="${v}"`).join("")}/>`;
}

/** Whether a source is already drawn in the sharp style (its root carries the sharp caps). */
function isSharpSource(source: string): boolean {
  const root = new DOMParser({ onError: onWarningStopParsing }).parseFromString(
    source,
    "application/xml",
  ).documentElement;
  return root?.getAttribute("stroke-linecap") === iconSystem.design.sharp.linecap;
}

function parseOutline(source: string, name: string): { tag: string; attributes: Attribute[] }[] {
  const root = new DOMParser({ onError: onWarningStopParsing }).parseFromString(
    source,
    "application/xml",
  ).documentElement;
  if (root?.tagName !== "svg") throw new Error(`${name}: no <svg> root.`);
  const elements: { tag: string; attributes: Attribute[] }[] = [];
  for (let node = root.firstChild; node; node = node.nextSibling) {
    if (!(node instanceof Element)) continue;
    if (node.firstChild) throw new Error(`${name}: nested <${node.tagName}> is not supported.`);
    elements.push({
      tag: node.tagName,
      attributes: Array.from(node.attributes, (a): Attribute => [a.name, a.value]),
    });
  }
  return elements;
}

/** Merges the strokes of every element of an icon into one context. */
function mergeContexts(contexts: readonly OutlineContext[]): OutlineContext {
  return {
    lines: contexts.flatMap((context) => context.lines),
    ends: contexts.flatMap((context) => context.ends),
  };
}

/** Flattened strokes of one outline element. */
function elementStrokes(tag: string, attributes: readonly Attribute[]): Point[][] {
  const d =
    tag === "path" ? attributes.find(([key]) => key === "d")?.[1] : shapeData(tag, attributes);
  return pathStrokes(d ?? "");
}

/**
 * The strokes of an outline source, the context `sharpenPathData` takes for the element at
 * `element` (whose own strokes are left out of `strokes`).
 */
export function outlineContext(source: string, element = -1, name = "icon"): OutlineContext {
  const elements = parseOutline(source, name);
  return {
    ...mergeContexts(elements.map(({ tag, attributes }) => elementContext(tag, attributes))),
    strokes: elements.flatMap(({ tag, attributes }, index) =>
      index === element ? [] : elementStrokes(tag, attributes),
    ),
  };
}

/**
 * Rewrites one outline source in the sharp style. Pure and deterministic; sharpening a sharp
 * source changes nothing. `name` labels errors and selects `keepRound` exceptions.
 */
export function sharpenOutline(
  source: string,
  name = "icon",
  /** Elements kept round; by default those `config/derived` lists for `name`. */
  kept: readonly number[] = keepRound[name] ?? [],
  /** Elements whose acute tips are cut at the round extent; by default from `config/derived`. */
  heldTips: readonly number[] = tipHeight[name] ?? [],
): string {
  const keep = new Set(kept);
  const elements = parseOutline(source, name);
  const fail = (index: number, error: unknown): never => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${name}: element ${index}: ${message}`);
  };
  const guarded = <T>(index: number, work: () => T): T => {
    try {
      return work();
    } catch (error) {
      return fail(index, error);
    }
  };
  const shared = mergeContexts(
    elements.map(({ tag, attributes }, index) =>
      guarded(index, () => elementContext(tag, attributes)),
    ),
  );
  const strokes = elements.map(({ tag, attributes }, index) =>
    guarded(index, () => elementStrokes(tag, attributes)),
  );
  const sharpened = elements.map(({ tag, attributes }, index) => {
    let [outTag, result] = [tag, attributes];
    if (!keep.has(index)) {
      const context = {
        ...shared,
        strokes: strokes.flatMap((own, other) => (other === index ? [] : own)),
        tipHeight: heldTips.includes(index),
      };
      try {
        [outTag, result] = sharpenElement(tag, attributes, context);
      } catch (error) {
        fail(index, error);
      }
    }
    return { tag: outTag, attributes: result };
  });
  // Elements kept round still take part as obstacles, but fitting leaves them as they are.
  const pieces = sharpened.map(({ tag, attributes }, index) => {
    const piece = guarded(index, () => pieceOf(tag, attributes));
    return keep.has(index) ? { ...piece, endsOnly: true } : piece;
  });
  // The padding's exceptions come from the drawing as given, before any corner was squared.
  const input = elements.map(({ tag, attributes }, index) =>
    guarded(index, () => pieceOf(tag, attributes)),
  );
  // Fitting measures the sharp drawing against the round one it comes from. A sharp source (being
  // sharpened again) has been fitted already and has no round drawing to measure against.
  if (!isSharpSource(source)) fitIcon(pieces, input, false, name);
  const lines = pieces.map((piece, index) => {
    const dot = keep.has(index) ? roundDot(piece) : undefined;
    if (dot) return dot;
    const written = writePiece(piece);
    // A line given a leg (see `addJointLegs`) is written as a path.
    const tag = piece.tag === "line" && written[0]?.[0] === "d" ? "path" : piece.tag;
    return `  <${tag}${written.map(([key, v]) => ` ${key}="${v}"`).join("")}/>`;
  });
  return [`<svg ${rootAttributes()}>`, ...lines, "</svg>", ""].join("\n");
}
