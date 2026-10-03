# Drawing guidelines

These are authoring rules for future original artwork, not an SVG validator. Phase 2A keeps
`icons/` empty. The executable source of truth is [config/icon-system.ts](../config/icon-system.ts):
`architecture` records stable decisions and `calibration` records provisional visual values.

## Master and initial candidates

All geometry measurements below are source-grid units. Render sizes are CSS pixel recommendations.

| Property | Initial value | Status |
|:--|:--|:--|
| Canonical SVG master | 24 x 24 | Architectural decision |
| `viewBox` | `0 0 24 24` | Architectural decision |
| Default variant | `outline` | Architectural decision |
| Painted color | `currentColor` | Architectural decision |
| Default render size | 24 | CALIBRATION REQUIRED |
| Recommended UI render sizes | 14, 16, 20, 24, 32 | CALIBRATION REQUIRED |
| Outline stroke width | 1.75 | CALIBRATION REQUIRED |
| Stroke terminals | `round` | CALIBRATION REQUIRED |
| Stroke joins | `round` | CALIBRATION REQUIRED |
| Safe-area inset on each edge | 2 | CALIBRATION REQUIRED |

## Safe area and negative space

Start with painted bounds inside coordinates 2 through 22 on both axes, a 20 x 20 live area.
The inset measures the canvas edge to the visible artwork, including half the stroke width and
round caps, not merely to the path centerline. For example, with a 1.75 stroke, a straight stroke
parallel to the left edge starts with its centerline at 2.875 or farther inward to keep its painted
edge at 2. This is a construction aid, not a requirement to use that coordinate everywhere.

Do not maximize every silhouette to that box. Wide, tall, circular, open, and dense shapes need
different apparent scale. Keep counters, gaps, and separated strokes generous enough to survive
14px and 16px rendering. Round caps also consume space at the ends of gaps.

**CALIBRATION REQUIRED:** the exact inset, minimum internal gaps, and justified optical overshoots.
An overshoot needs visual review; it must not become an undocumented per-icon convention or clip
at the viewBox boundary.

## Strokes, endpoints, and joins

- Begin with the shared candidate width throughout outline artwork. Do not vary thickness to make
  one icon appear more important, or introduce per-icon weight variants.
- Use round terminals initially. Align visible endpoints, accounting for the extra half-stroke
  extension, rather than aligning only their path coordinates.
- Use round joins initially, but construct the exterior silhouette deliberately. A stroke join
  does not replace a designed corner radius.
- Avoid accidental doubled strokes, dark intersections, almost-touching endpoints, and tiny gaps.
  Shared edges should not create a heavier line than the rest of the drawing.
- Keep fractional coordinates when they improve the geometry. Integer snapping is not inherently
  crisp after a 24-unit master is scaled to 14px or 16px.

**CALIBRATION REQUIRED:** apparent stroke weight, terminal treatment, and joins across the full
size range. Do not add a non-scaling stroke or alternate stroke policy as an unreviewed workaround.

## Curves, corners, circles, and squares

Use simple curves with smooth tangent transitions. Avoid unnecessary control points, lumpy arcs,
and decorative bends. Circles and circular parts should be geometrically sound before optical
adjustment; do not force all circular concepts to share one radius regardless of density.

Squares and rectangular forms should retain their geometric structure. Choose controlled corner
radii, using softer internal details where useful. Do not turn every square into a rounded tile,
or every rectangle into a capsule. Equally, avoid sharp exterior points that make a calm form look
aggressive without semantic need.

**CALIBRATION REQUIRED:** a repeatable corner-radius vocabulary, circle-versus-square apparent
size, curve overshoot, and the exact relationship between exterior and interior corners. No
universal corner-radius number is established in this phase.

## Diagonals and alignment

Prefer disciplined angles; 45 degrees is useful for arrows, checks, and diagonal relationships
when it preserves their meaning and balance. Do not distort a recognizable symbol merely to meet
45 degrees. Align related horizontal and vertical elements and keep repeated spacing consistent.

Start symmetric concepts symmetrically, then evaluate the actual visual result. Intentional
asymmetry is valid for perspective, direction, movement, or optical correction, not as decoration.
Document why a correction is needed and judge it next to related icons.

## Optical balance and visual weight

A mathematically centered bounding box may look off-center. Consider the distribution of painted
mass, internal whitespace, and directional emphasis before shifting or resizing a drawing. Open
forms can need different apparent scale from dense forms. Circles can need optical compensation
beside squares. Do not impose universal corrections before comparing actual artwork.

Review apparent weight across the family and beside medium-weight Qeet UI and Qeet Text labels.
The icon should support the text at 13-16px, not dominate it. Check horizontal alignment and the
text/icon relationship in real controls as well as on an isolated canvas.

## Compound symbols, overlays, and badges

- Keep the base concept recognizable when adding a plus, minus, check, x, or other semantic mark.
- Use one clear secondary message. Avoid stacking several tiny state indicators into a glyph.
- Place the overlay with deliberate clearance; do not let intersecting strokes make a dark knot.
- Keep overlay geometry and placement consistent within a family, with optical corrections when
  the base silhouette changes. Do not compress the base until it loses its meaning.
- Use a badge enclosure only when it communicates something the state mark alone cannot.
- Test marks at 14px and 16px. If the distinction disappears, simplify the composition or move
  that information into surrounding UI rather than adding more detail.

**CALIBRATION REQUIRED:** overlay scale, badge placement, clearances, and shared family motifs.
There are no fixed badge radii, subpath budgets, or universal overlay coordinates yet.

## Filled drawings

Author filled artwork only for the meaningful states described in
[design-principles.md](design-principles.md). Preserve recognition, optical centering, and generous
negative space. Use `currentColor` for painted areas and keep counters open at small sizes.
Do not mechanically fill an outline, add arbitrary internal strokes, or assume a filled silhouette
needs the same mathematical occupancy to have the same apparent size. Outline and filled states
must feel related without the filled state becoming excessively heavy.

## Optical sizing

Begin with one 24 x 24 SVG master rendered at 14, 16, 20, 24, and 32. These are the initial supported
UI review targets, not a restriction on future React property values. **CALIBRATION REQUIRED:**
small-size optical adjustments, minimum gaps, and how much detail survives scaling.

Do not create separate 16, 20, or 24 source directories or size masters now. If the standard master
proves inadequate at 14px or 16px, selected compact optical masters may be considered later with
visual evidence. Such a decision must also define source selection and API behavior in its own
phase; it is not implicit in this contract.

Before artwork is accepted in a later phase, compare all recommended sizes beside buttons,
labels, inputs, menus, sidebar items, table actions, command palettes, and headings. Record the
size and context that justify changing a candidate, then update the shared config and guidance
together. A magnified preview alone is not a calibration result.
