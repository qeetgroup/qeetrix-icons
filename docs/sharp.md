# Sharp style

Every icon comes in two shapes. `round` is Lucide's drawing, the default. `sharp` is the same
drawing with square caps, mitered joins, and corner roundings squared off, in the manner of
Material's "Sharp" family. Lucide has no sharp style; it is derived here from the round outlines,
like the filled drawings ([filled.md](filled.md)), and every icon has it in each of its variants.

```tsx
<TrashIcon shape="sharp" />
<TrashIcon shape="sharp" variant="filled" />
```

`shape` is a prop of the one component, not a separate entry point; see
[api.md](api.md#shapes-and-variants).

```bash
bun run derive:sharp   # write icons/sharp-outline/ and icons/sharp-filled/
bun run check:sharp    # fail if a sharp drawing is missing, stale, or not derived; writes nothing
```

`derive:sharp` ([derive-sharp.ts](../scripts/build/derive-sharp.ts)) sharpens every round outline
into `icons/sharp-outline/<category>/<name>.svg`, and derives a sharp filled drawing into
`icons/sharp-filled/<category>/<name>.svg` for every name in
[config/filled.ts](../config/filled.ts). It owns both folders entirely: anything else in them is
removed, and so are folders left empty. If any drawing fails, it reports every failure and writes
nothing. `bun run sync:lucide` runs it after `derive:filled`, and CI and the release gate run
`check:sharp`. After `derive:sharp`, run `bun run generate`.

## Stroke style

`design.sharp` in [config/icon-system.ts](../config/icon-system.ts):

| Property | Round | Sharp |
|:--|:--|:--|
| Stroke width | 2 | 2 |
| Caps | `round` | `square` |
| Joins | `round` | `miter` |
| Miter limit | (none) | 4 |

A miter limit of 4 lets joins down to about 29°, such as a star's or a triangle's tip, come to a
point, and bevels only sharper ones. Every sharp outline root declares the style, and validation
requires it ([validation.md](validation.md#paint-and-variants)):

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" stroke-miterlimit="4">
```

## Sharpening an outline

`sharpenOutline` in [scripts/lib/sharp.ts](../scripts/lib/sharp.ts) rewrites one round outline.
Element order and count never change, so filled recipes and their element indices hold in both
shapes. Element by element:

- **`rect`**: corner radii are dropped, unless the rect is a pill or a circle (a radius of at least
  half its shorter side).
- **Dots**: a `circle` with a radius of 1 or less, which a 2-unit stroke paints as a dot, becomes a
  square `rect` of side 2r on the same center, keeping its fill. Square dots are the sharp style's
  UI mark: an ellipsis, a grip, a bullet, the hole in `tag`.
- **`path` corner roundings**: each rounding becomes the point where the tangents at its two ends
  meet. A rounding is a circular arc of radius 3 or less, or a one-way cubic or quadratic curve
  whose implied radius keeps to the same limit, turning up to 170°. That covers corners and acute
  tips alike, such as a star's, a triangle's, or a heart's. Neighbouring roundings that carry one
  another on count as one if they turn 90° or less in all.
- **Curves that stay curves**: a rounding stays round when a neighbouring curve of similar
  curvature carries it on (two quarter arcs drawing a round end), when it meets a neighbour at an
  angle (the sides of a lens), or when it is a whole open path that no other stroke in the icon
  continues (a circle cut by a slash). For a tip wider than a quarter turn, it also stays round when
  it is a wave's crest (a tilde) or ends the path (a hook). A partial rounding where a path stops
  ends at its corner.
- **Chamfers**: where a corner's miter would leave the canvas, run into another stroke, or reach
  more than 3 units past the rounding (a spike), the corner is cut flat along the rounding's middle
  tangent instead, reaching no further than the rounding did. Every vertex where two segments meet
  at an angle, in paths, polylines, and polygons, is guarded the same way: a miter that would leave
  the canvas or run into another stroke is cut flat just inside the vertex.
- **Unchanged**: `line`, `ellipse`, and circles larger than a dot.

A mitered point can reach into Lucide's 1-unit padding; the guards keep it on the canvas and off
other strokes. Sharpening is idempotent: sharpening a sharp outline changes nothing.
`analyzePathData` reports what happened to each rounding (`corner`, `chamfer`, `curve`, `side`,
or `degenerate`), for review and tests.

### Kept round

Geometry cannot tell a dot from a small round thing, or a mechanical corner from an organic
outline. `keepRound` in [scripts/lib/sharp.ts](../scripts/lib/sharp.ts) lists, by icon name and
element index, the elements left exactly as drawn, each with a comment saying why:

- **Figurative circles**: a head (`accessibility`, `person-standing`, `bike`), an eye's pupil
  (`scan-eye`, `view`), a nucleus or core (`atom`, `galaxy`), the sun in `images`.
- **Organic outlines** whose roundings meet with no straight run between them, and would square
  into stairs: coastlines (`earth`), streamers (`party-popper`).
- **Distinctions** the symbol depends on, such as the round terminals of `usb`.

Like filled roles, these are element indices: re-check them when a Lucide upgrade redraws a listed
icon ([lucide.md](lucide.md#upgrading-lucide)).

## Sharp filled drawings

A sharp filled drawing is derived from the sharp outline by the same `deriveFilled` as the round
one, with two differences:

- Strokes are expanded with the sharp style: square caps, mitered joins, miter limit 4.
- Every element plays the role it plays in the round filled drawing, listed or inferred, so both
  shapes share one reviewed design. Inferring afresh could flip a role: square caps push a
  connector's ends further into the bodies it joins, or a dot's cap past its body.
  `sharpFilledRoles` in `config/derived/<category>.ts` adjusts a role for the sharp drawing only.
- Open bodies close, and cuts [run on through the edge](filled.md#cuts-that-reach-the-edge), from
  the round outline's line ends and run-on decisions. Sharpening may pull a line's end back off
  the stroke it meets, so its square cap stays inside, or move a corner a little; taking the ends
  from the round outline keeps a flag's pole straight and makes both shapes part the same way.

The output has the same format as a round filled drawing ([filled.md](filled.md#output)), with a
comment naming the sharp outline and `bun run derive:sharp`. A name under `filled` in
`config/derived/` therefore always yields two filled drawings, one per shape. Either can be
replaced by a reviewed override in `config/overrides/sharp-filled/`
([filled.md](filled.md#overrides)), and the sharp outline by one in
`config/overrides/sharp-outline/`.

## Changing the sharp style

Never edit a sharp SVG. To change one, change the rules in
[scripts/lib/sharp.ts](../scripts/lib/sharp.ts), or add an entry to `keepRound` with a comment
saying why, then run `bun run derive:sharp` and `bun run generate`. A rule change can touch
hundreds of drawings: review the diff of `icons/sharp-outline/` and `icons/sharp-filled/` in the
playground with the **Sharp** shape selected ([visual-qa.md](visual-qa.md#review-workflow)).
Look for corners that came out square, tips that came to a point without spiking, chamfers where a
point would have clipped or collided, square dots, and figurative circles that stayed round.

Validation keeps the shapes in step: once any sharp drawing exists, every round drawing needs its
sharp counterpart and the other way round (`QXI-STYLE-001`). Removing the sharp shape would be a
major release ([api.md](api.md#versioning)).
