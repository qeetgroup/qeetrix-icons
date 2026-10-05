import { DOMParser, Element, onWarningStopParsing } from "@xmldom/xmldom";
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
/** A neighbouring line within this many degrees of a corner's end tangent is that tangent. */
const snapAngle = 3;
/** Lengths below this are zero. */
const tiny = 1e-6;

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
export const keepRound: Readonly<Record<string, readonly number[]>> = {
  accessibility: [0], // The figure's head.
  atom: [0], // The nucleus, a ball inside round orbits.
  bike: [2], // The rider's head.
  earth: [0, 1, 2], // Continents' coastlines.
  "earth-lock": [0, 1, 2], // Continents' coastlines.
  galaxy: [4], // The galaxy's round core.
  images: [2], // The picture's sun, round in `image` too.
  "party-popper": [5, 6, 7], // Streamers' squiggles.
  "person-standing": [0], // The figure's head.
  "scan-eye": [4], // The eye's pupil.
  skull: [2, 3], // The skull's eyes.
  usb: [0, 1], // The USB symbol's round terminals, distinct from its square one.
  view: [2], // The eye's pupil.
};

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

const canvas = {
  width: iconSystem.architecture.grid.width,
  height: iconSystem.architecture.grid.height,
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

const onCanvas = ([x, y]: Point) =>
  x >= -0.001 && y >= -0.001 && x <= canvas.width + 0.001 && y <= canvas.height + 0.001;

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
};

const emptyContext: OutlineContext = { lines: [], ends: [] };

/** How far, in grid units, a dash may be from the corner piece it continues. */
const dashReach = 6;

/**
 * Whether a stroke in `context` lies along the line through `point` in `direction`, on the side
 * `side` gives (1 ahead, -1 behind), within `dashReach` of the point.
 */
function continuedBy(context: OutlineContext, point: Point, direction: Point, side: 1 | -1) {
  const unit = scale(direction, 1 / length(direction));
  const parallel = (d: Point) => length(d) > tiny && Math.abs(cross(unit, d)) / length(d) < 0.035;
  const onLine = (q: Point) => Math.abs(cross(unit, sub(q, point))) <= 0.05;
  const reach = (q: Point) => dot(unit, sub(q, point)) * side;
  const lines = context.lines.some(([a, b]) => {
    if (!parallel(sub(b, a)) || !onLine(a) || !onLine(b)) return false;
    const nearest = Math.min(reach(a), reach(b));
    return nearest >= -0.05 && nearest <= dashReach;
  });
  // Another path's open end, travelling the same line: the next corner piece. (Not this one.)
  const ends = context.ends.some(
    (end) =>
      parallel(end.tangent) &&
      onLine(end.point) &&
      reach(end.point) > 0.05 &&
      reach(end.point) <= dashReach,
  );
  return lines || ends;
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
 * corner's bisector: a triangle's 120° tip reaches 3. A wider turn on a larger radius (a
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
  // (Lucide often sets a vertex on another stroke); its miter adds no new contact.
  if (curve.length === 0 && roundGap <= 0.1) return false;
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
  for (const { indices, closed: explicit } of subpaths(segments)) {
    const drawn = indices.filter((index) => tangents(segments[index] as Drawn) !== undefined);
    // An open path that ends where it starts (Lucide's eye and speech bubbles) loops all the same.
    const first = drawn.length > 0 ? (segments[drawn[0]] as Drawn).from : undefined;
    const last = drawn.length > 0 ? (segments[drawn.at(-1) as number] as Drawn).to : undefined;
    // Within rounding: Lucide's store awning ends 0.001 short of its start.
    const closed = explicit || (first !== undefined && length(sub(first, last as Point)) < 0.002);
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
    const tip = Math.max(angleBetween(own.start, own.end), angleBetween(theirs.start, theirs.end));
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
      return other !== undefined && candidates.has(other) && continues(index, other, side)
        ? other
        : undefined;
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
    if (total > cornerSweep && free !== undefined) {
      decide("curve");
      continue;
    }
    // A rounding joins what it rounds smoothly, at each end that joins anything. (At an open end,
    // as in a dashed square's corner pieces, the squared corner simply ends in a short leg.)
    const meets = (other: number | undefined, own: Point, side: "start" | "end") => {
      if (other === undefined) return "free";
      const theirs = tangents(segments[other] as Drawn) as Ends;
      const tangent = side === "start" ? theirs.end : theirs.start;
      return angleBetween(own, tangent) <= smoothAngle ? "smooth" : "cusp";
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
    const startTangent = snap(ends[0].start, previous);
    const endTangent = snap((ends.at(-1) as Ends).end, next);
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
    const tips = joinExtent(corner, startTangent, endTangent);
    const clear =
      tips.every(onCanvas) &&
      (!half || tipReach(tips, half.point, startTangent, endTangent) <= maxTipReach) &&
      !(half && runsInto(curve, corner, startTangent, endTangent, half, others));
    if (clear) {
      // A partial rounding where the path stops (a back page fading out behind the front one)
      // squares to the corner and stops there, rather than ending in a short slanted leg.
      if (free === "end" && total < partialTurn) decide("corner", [corner]);
      else if (free === "start" && total < partialTurn) decide("corner", [last.to], corner);
      else decide("corner", [corner, last.to]);
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

/** A subpath's items as standalone segments, the closing line included when it has length. */
function drawnItems({ start, items, closed }: Subpath): Drawn[] {
  const drawn: Drawn[] = [];
  let from = start;
  for (const item of items) {
    switch (item.type) {
      case "L":
        drawn.push({ type: "L", from, to: item.to });
        break;
      case "C":
        drawn.push({ type: "C", from, c1: item.c1, c2: item.c2, to: item.to });
        break;
      case "Q":
        drawn.push({ type: "Q", from, c: item.c, to: item.to });
        break;
      case "A":
        drawn.push({ ...item, from });
        break;
    }
    from = item.to;
  }
  if (closed && !same(from, start)) drawn.push({ type: "Z", from, to: start });
  return drawn;
}

/** How far along each line a vertex's guard cut starts, in grid units. */
const vertexCut = 0.25;

/**
 * The part of a segment at least `reach` (in grid units, measured along it, roughly) from one end:
 * `"end"` trims its end, `"start"` its start. Returns the trimmed segment and the new end point.
 */
function trim(segment: Drawn, end: "start" | "end", reach: number): Drawn {
  const points = flatten(segment, 24);
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += length(sub(points[index], points[index - 1]));
  }
  const fraction = Math.min(0.4, reach / Math.max(total, tiny));
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
 * Guards a subpath's vertices, where two segments meet at an angle: a miter that would leave the
 * canvas or run into another stroke is cut flat just inside the vertex, so the join reaches no
 * further than the round join did. (The miter limit lets Lucide's acute vertices come to a point.)
 * `strokes(skip)` gives every other stroke, leaving out this subpath's segments at `skip`.
 */
function guardJoins(
  path: Subpath,
  strokes: (skip: readonly number[]) => (readonly Point[])[],
): Subpath {
  const drawn = drawnItems(path);
  const count = drawn.length;
  if (count < 2) return path;
  // Only a closed subpath joins at its start; an open one that ends there draws two caps.
  const loop = path.closed;
  // Trimmed copies of the segments: the vertex at the end of drawn[i] meets drawn[next].
  const trimmed = drawn.slice();
  const bridges = new Map<number, true>();
  for (let index = 0; index < count; index += 1) {
    const next = index + 1 < count ? index + 1 : loop ? 0 : -1;
    if (next < 0 || next === index) continue;
    const ends = [tangents(drawn[index]), tangents(drawn[next])];
    if (!ends[0] || !ends[1]) continue;
    const u = ends[0].end;
    const v = ends[1].start;
    if (angleBetween(u, v) <= smoothAngle) continue;
    const vertex = drawn[index].to;
    // A vertex beside a bridge this guard wrote (or any line as short) is already cut.
    const short = (segment: Drawn) =>
      (segment.type === "L" || segment.type === "Z") &&
      length(sub(segment.to, segment.from)) <= 2 * vertexCut + 0.01;
    if (short(drawn[index]) || short(drawn[next])) continue;
    // This subpath's own segments next to the vertex are part of the join, not obstacles.
    const near = [index - 1, index, index + 1, index + 2]
      .map((n) => (loop ? (n + count) % count : n))
      .filter((n) => n >= 0 && n < count);
    const clear =
      joinExtent(vertex, u, v).every(onCanvas) &&
      !runsInto([], vertex, u, v, { point: vertex }, strokes(near));
    if (clear) continue;
    trimmed[index] = trim(trimmed[index], "end", vertexCut);
    trimmed[next] = trim(trimmed[next], "start", vertexCut);
    bridges.set(index, true);
  }
  if (bridges.size === 0) return path;
  // Rebuild from the trimmed segments, bridging each cut vertex with a short line. A cut where the
  // subpath closes moves its start to the far side of the cut.
  const wrap = loop && bridges.has(count - 1);
  const start = wrap ? trimmed[0].from : path.start;
  const items: Item[] = [];
  trimmed.forEach((segment, index) => {
    const isClosing = segment.type === "Z";
    if (index > 0 && bridges.has(index - 1))
      items.push({ type: "L", to: roundPoint(segment.from), added: true });
    if (!isClosing) items.push(itemOf(segment));
    else items.push({ type: "L", to: roundPoint(segment.to), added: true });
  });
  // The closing line was written out; the subpath still closes, now from the cut back to start.
  if (drawn[count - 1].type === "Z" && !wrap) items.pop();
  return { start: roundPoint(start), items, closed: path.closed };
}

/**
 * Rewrites path data with its corner roundings squared off. Returns the input unchanged when the
 * path has none, otherwise absolute commands with at most three decimals. `context` holds the
 * strokes of the rest of the icon (`outlineContext`): whether a path that is a single rounding is a
 * dashed outline's corner piece, and whether a corner would run into another stroke.
 */
export function sharpenPathData(d: string, context: OutlineContext = emptyContext): string {
  const segments = parsePath(d);
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

  const tidied = paths.map(tidy);
  // Every stroke of the icon but these two items, for the join guard.
  const strokesBesides = (path: number, skip: readonly number[]) => [
    ...(context.strokes ?? []),
    ...tidied.flatMap((other, index) =>
      drawnItems(other)
        .filter((_, item) => index !== path || !skip.includes(item))
        .map((segment) => flatten(segment)),
    ),
  ];
  let guarded = false;
  const finished = tidied.map((path, index) => {
    const result = guardJoins(path, (skip) => strokesBesides(index, skip));
    guarded ||= result !== path;
    return result;
  });
  if (replaced.size === 0 && !guarded) return d;

  const parts: string[] = [];
  const at = (p: Point) => `${coordinate(p[0])} ${coordinate(p[1])}`;
  for (const { start, items, closed } of finished) {
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
    case "polyline":
    case "polygon": {
      // No roundings to square, but the vertices get the same join guard as a path's.
      const lines = elementLines(tag, attributes).filter(([a, b]) => !same(a, b));
      if (lines.length < 2) return [tag, attributes];
      const path: Subpath = {
        start: lines[0][0],
        items: lines.map(([, to]) => ({ type: "L", to }) as Item),
        closed: tag === "polygon",
      };
      const own = (skip: readonly number[]) => [
        ...(context.strokes ?? []),
        ...lines.filter((_, index) => !skip.includes(index)).map((line) => [...line]),
      ];
      const guarded = guardJoins(path, own);
      if (guarded === path) return [tag, attributes];
      let points = [guarded.start, ...guarded.items.map((item) => item.to)];
      // A polygon closes itself; drop a last point that repeats its first.
      if (tag === "polygon" && points.length > 1 && same(points[0], points.at(-1) as Point)) {
        points = points.slice(0, -1);
      }
      const written = points.map((point) => `${coordinate(point[0])} ${coordinate(point[1])}`);
      return [
        tag,
        attributes.map(([key, v]) => (key === "points" ? [key, written.join(" ")] : [key, v])),
      ];
    }
    default:
      return [tag, attributes];
  }
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
export function sharpenOutline(source: string, name = "icon"): string {
  const keep = new Set(keepRound[name] ?? []);
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
  const lines = elements.map(({ tag, attributes }, index) => {
    let [outTag, result] = [tag, attributes];
    if (!keep.has(index)) {
      const context = {
        ...shared,
        strokes: strokes.flatMap((own, other) => (other === index ? [] : own)),
      };
      try {
        [outTag, result] = sharpenElement(tag, attributes, context);
      } catch (error) {
        fail(index, error);
      }
    }
    return `  <${outTag}${result.map(([key, v]) => ` ${key}="${v}"`).join("")}/>`;
  });
  return [`<svg ${rootAttributes()}>`, ...lines, "</svg>", ""].join("\n");
}
