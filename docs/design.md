# Design

The round outline icons are Lucide's, unchanged ([lucide.md](lucide.md)), so the outline
specification is Lucide's design language. This repository restates the values it relies on in
[config/icon-system.ts](../config/icon-system.ts) (`design`) and adds two things of its own, both
derived from the round outlines: filled drawings ([filled.md](filled.md)) and the sharp style
([sharp.md](sharp.md)).

## Values

| Property | Value | Where it holds |
|:--|:--|:--|
| Master | 24 x 24, `viewBox="0 0 24 24"` | Validation (`QXI-SVG-002`) |
| Paint | `currentColor` | Validation (`QXI-SVG-006`) |
| Round outline stroke | width 2, round caps, round joins, `fill="none"` on the root | Validation (`QXI-SVG-007`) |
| Sharp outline stroke | width 2, square caps, miter joins, miter limit 4, `fill="none"` on the root | Validation (`QXI-SVG-007`) |
| Padding (safe-area inset) | 1 unit from each canvas edge to the painted edge, stroke included | Lucide's rule for the round outlines; shown in the playground, not validated. A sharp miter point may reach into it |
| Default render size | 24 | Runtime |
| Recommended sizes | 14, 16, 20, 24, 32 | Guidance and review targets, not a type |
| Default shape and variant | `round`, `outline` | Stable public API |

Validation reads these values from the config, so there is no second copy in the validator.

## Round outline: Lucide's rules

Lucide's [design language](https://github.com/lucide-icons/lucide/blob/1.52.0/docs/contribute/icons/design-principles.md)
for 1.52.0, in short:

- A 24 x 24 canvas, with at least 1 pixel of padding between the strokes and the edge.
- 2-pixel strokes, centered on their paths, with round caps and round joins.
- Almost every sharp corner rounded: radius 2 for shapes at least 8 pixels wide or tall, radius 1
  for smaller ones, but not where more than two lines meet.
- At least 2 pixels between distinct elements, and inside shapes where possible.
- Visual weight matching `circle` and `square`, visual rather than only geometric centering, low
  density, simple smooth curves, alignment to the pixel grid, and reuse of established shapes and
  modifiers across related icons.

These are the rules Lucide draws by. Here they describe what the artwork already is, and they are
what to judge a Lucide upgrade against. Corrections go upstream to Lucide, never into
`icons/round-outline/`, which the next sync rewrites.

Lucide draws a few small dots as solid shapes with `fill="currentColor"`, such as the hole in
`tag`. Validation allows `currentColor` fill on outline child elements for this reason; in the
sharp style those dots are squares.

## Stroke width and size

The source stroke width is 2. Caller props are spread last onto the root `<svg>`, so
`strokeWidth` overrides it for the whole outline drawing:

```tsx
<TrashIcon strokeWidth={1.5} />
```

No Lucide element sets its own stroke width, so the override applies evenly, in either shape. The
stroke scales with `size`, as in the source. Filled drawings have no stroke; they are derived at
the source width of 2, and `strokeWidth` does not change them. The playground's stroke view shows
each outline at 1.5, 1.75, and 2 (`design.strokeCandidates`) beside the source rendering, in the
selected shape.

`size` accepts any number or CSS length. The recommended sizes are where the playground reviews
icons; 14 and 16 px get a pixel view because that is where strokes merge and detail is lost.

## Shapes and variants

Two independent choices select a drawing. `shape` is the style: `round`, Lucide's, by default, or
`sharp`. `variant` is the drawing within it: `outline` by default, or `filled`. Every icon has both
shapes, each with the same variants. There are no weight, duotone, or other style axes.

### Sharp

The sharp style keeps Lucide's geometry and stroke width and changes only how strokes end, join,
and turn, all by derivation ([sharp.md](sharp.md)):

- Square caps and mitered joins, with a miter limit of 4, so tips down to about 29° come to a point.
- Corner roundings squared off where their tangents meet; a pill, a whole circle, or a curve that
  is part of a longer curve stays round.
- A corner whose point would leave the canvas, run into another stroke, or spike is cut flat.
- Dots become squares; figurative circles, such as heads and eyes, and organic outlines stay
  round.

### Filled

`outline` is the default and exists for every icon. `filled` is optional and selective: a solid
alternative for states such as selected navigation, favorite, bookmark, notification state, rating,
or active status. 794 icons have one, in both shapes; the rest are outline-only.

Filled drawings follow a few conventions, all produced by the derivation rather than drawn:

- A body is filled to the outline's painted extent, interior plus stroke, so outline and filled
  occupy the same footprint and can swap in place.
- Details inside a body are cut as negative lines of the stroke width; a dot is cut whole.
- A line that crosses a body keeps 1 unit of clearance on each side; a body drawn in front of
  another, such as the clip on `clipboard`, is solid with 1 unit of clearance around it.
- Attached curves, such as handles and shackles, and connectors between bodies stay lines.
- The drawing is one `<path>` painted with `currentColor`.
- The sharp filled drawing is derived from the sharp outline with the same roles as the round one,
  so the two shapes share one design.

An icon gets a filled drawing only when its solid form is clean and consistent. Open-line icons,
text and math marks, charts on axes, icons whose body is clipped for a badge, busy multi-part icons,
and icons whose meaning depends on being empty are left outline-only. [filled.md](filled.md) has
the roles, inference, and selection in full.

## Review

Automated checks prove structure; a person judges the result, in the playground
([visual-qa.md](visual-qa.md)):

- Is the meaning clear at 14 and 16 px, without relying on color alone?
- Does the icon belong beside its neighbors and beside medium-weight Qeet UI labels? The
  playground's typography rows set icons next to Qeet UI and Qeet Text.
- Does a filled drawing read as the same concept as its outline, with nothing lost that the
  outline relies on?
- Does the sharp drawing read as the same icon, with clean points and no spikes, clipped tips, or
  squared shapes that were meant to be round?
- Does the `preserve` or `mirror` decision match the meaning ([rtl.md](rtl.md))?
