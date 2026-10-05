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
bun run derive:sharp                    # write icons/sharp-outline/ and icons/sharp-filled/
bun run check:sharp                     # fail if a sharp drawing is missing, stale, or not derived; writes nothing
bun run derive:sharp --category files   # only one category: reads, writes, and removes nothing else
```

`derive:sharp` ([derive-sharp.ts](../scripts/build/derive-sharp.ts)) sharpens every round outline
into `icons/sharp-outline/<category>/<name>.svg`, and derives a sharp filled drawing into
`icons/sharp-filled/<category>/<name>.svg` for every name listed under `filled` in
[config/derived/](../config/derived/README.md). A reviewed override in `config/overrides/` takes
the place of a derived drawing ([filled.md](filled.md#overrides)). It owns both folders entirely: anything else in them is
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
  square `rect` of side 2r on the same center, keeping its fill, and a Lucide dot path (`M9 9h.01`)
  is squared by the caps alone. Square dots are the sharp style's UI mark: an ellipsis, a grip, a
  bullet, a key, a pip, the hole in `tag`. Figurative dots stay round ([Kept round](#kept-round)).
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
- **Spikes**: a tip whose point would reach more than about 3 units past the rounding is cut flat
  along the rounding's middle tangent, reaching no further than the rounding did.
- **Closed paths** are treated cyclically, starting on a straight run, so a corner where Lucide's
  path happens to start (the bottom of `triangle-alert`) is sharpened like every other.
- **Unchanged**: `line`, `ellipse`, and circles larger than a dot.

Then the whole icon is fitted, because a corner or a cap can collide with another element:

1. **Padding**: nothing paints past Lucide's 1-unit padding (by more than 0.01) unless the round
   outline itself reaches further there. A corner that would cross it is cut flat, perpendicular
   to its bisector, by the smallest cut that fits; a vertex is never moved, so both edges keep
   their direction. A free end whose square cap would cross is shortened by the overshoot.
2. **Collisions**: a miter that would pass through another element's stroke and out of its far
   side, or nearly close a gap the round drawing keeps (the tip of `square-radical`, the apex of
   `ferris-wheel`), is cut flat at the round drawing's extent. An inward miter at a concave cusp
   reaches at most 2 units.
3. **Attached ends**: a line that stops inside another stroke (an arrow shaft at its head, a mail
   flap on its frame) is trimmed by at most one cap length, so its square cap hides. A line passing
   through a stroke, or meeting another stroke's end, keeps its cap.
4. **Joined strokes**: two strokes that meet end to end at an angle (an arrowhead drawn as two
   paths, `file-output`) are joined into one mitered corner instead of overlapping caps.
5. **Symmetry**: mirror twins (an A's legs, an arrowhead's arms, a symmetric shape's corners) get
   the same cut when either needs one.

Sharpening is idempotent: sharpening a sharp outline changes nothing. The repository test proves
the padding rule with CanvasKit on every drawing; the few curved arms too short to cut that still
graze the padding are listed with their measured overshoot in `knownCrossings`
([tests/sharp.test.ts](../tests/sharp.test.ts)), and none may get worse.
`analyzePathData` reports what happened to each rounding (`corner`, `chamfer`, `curve`, `side`,
or `degenerate`), for review and tests.

### Kept round

Geometry cannot tell a dot from a small round thing, or a mechanical corner from an organic
outline. `keepRound` in each `config/derived/<category>.ts` lists, by icon name and element
index, the elements left round, each with a comment saying why:

- **Figurative circles**: a head (`accessibility`, `person-standing`, `bike`), an eye's pupil
  (`scan-eye`, `view`), a nucleus or core (`atom`, `galaxy`), the sun in `images`.
- **Organic outlines** whose roundings meet with no straight run between them, and would square
  into stairs: coastlines (`earth`), streamers (`party-popper`), animals' snouts and tails, hands,
  fruit, a signature.
- **Figurative dots**: an eye (`bird`, `rabbit`, `baby`, `piggy-bank`), a spot (`virus`, `germ`,
  `cookie`'s chips), a flame or a drop (`cake`, `shower-head`), a snowflake. A kept Lucide dot path
  is written with `stroke-linecap="round"` on that element, the one per-element cap validation
  allows in a sharp source, so it paints a round dot under the root's square caps; the sharp
  filled drawing cuts it as a round hole. UI dots stay square.
- **Distinctions** the symbol depends on, such as the round terminals of `usb`, or a letter's bowl
  (the D of `hd` and `ad`).

The sharp generator still applies the padding and attached-end rules to kept elements; only their
curves are kept.

### Letter heights

`tipHeight` in `config/derived/<category>.ts` lists letterforms whose sharp apex is cut flat at the
round outline's height instead of brought to a point, so a sharp A does not tower over the B beside
it (`case-upper`, `a-large-small`, `a-arrow-down`). Other tips are unaffected.

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
[scripts/lib/sharp.ts](../scripts/lib/sharp.ts), or add an entry to `keepRound` or `tipHeight` in
`config/derived/<category>.ts` with a comment saying why, then run `bun run derive:sharp` and
`bun run generate`. Where neither can give a clean drawing, draw an override in
`config/overrides/sharp-outline/` and stamp it ([filled.md](filled.md#overrides)). A rule change can touch
hundreds of drawings: review the diff of `icons/sharp-outline/` and `icons/sharp-filled/` in the
playground with the **Sharp** shape selected ([visual-qa.md](visual-qa.md#review-workflow)).
Look for corners that came out square, tips that came to a point without spiking, flat cuts only
where a point would have crossed the padding or collided, symmetric shapes that stayed symmetric,
square UI dots, and figurative circles and dots that stayed round. A rule change can also leave
an override behind: overrides keep their old geometry, so compare each one in a changed category
with what the generator now draws, and redraw or delete it.

Validation keeps the shapes in step: once any sharp drawing exists, every round drawing needs its
sharp counterpart and the other way round (`QXI-STYLE-001`). Removing the sharp shape would be a
major release ([api.md](api.md#versioning)).
