# Calibration log

Evidence from the Phase 3 calibration batches. This log records what was drawn, how it was judged,
and what was learned. It is not the specification: normative guidance stays in
[drawing-guidelines.md](drawing-guidelines.md) and the shared values stay in
[config/icon-system.ts](../config/icon-system.ts), which change only when evidence justifies it.

Each finding is labelled **Observed** (seen in a batch, not yet a rule), **Candidate** (seen
repeatedly and likely to become guidance), **Provisional** (a working default that may still
change), or **Locked** (a decided rule). After Phase 3C, nothing visual is locked.

## Phase 3A: primitives

Four outline-only concepts chosen to expose the basics of the language: `plus` (orthogonal
proportions, centering, terminals), `x` (diagonals, footprint), `check` (asymmetry, joins, optical
centering), and `chevron-down` (paired diagonals, navigation proportions). All geometry was
constructed on the 24-unit grid from these goals; no third-party SVG was used as a source or
reference geometry.

### Method

Candidates were compared on scratch sheets, then the accepted sources were reviewed in the
playground ([visual-qa.md](visual-qa.md)): recommended sizes; 14 and 16 px one-device-pixel views;
the 24×24 construction view with center axes and safe area; 1.5, 1.75, and 2.0 stroke overrides at
16, 24, and 48 px; light and dark surfaces; the six currentColor tokens; the interface contexts; and
typography rows. Comparisons beside 13–16 px text were also rendered at 1× and 2× device pixel
ratio. **Qeet UI and Qeet Text were not installed**: every typography comparison used the system
fallback font.

### Accepted geometry

Coordinates are stroke centerlines; painted bounds add the 0.875 half-stroke and round caps or
joins. The safe area is 2 to 22.

| Concept | Construction | Centerline bounds | Painted bounds |
|:--|:--|:--|:--|
| `plus` | One path: two 14-unit arms crossing at 12,12 | 5–19 on both axes | 4.125–19.875 |
| `x` | One path: two 45° diagonals in a 12-unit box | 6–18 on both axes | 5.125–18.875 |
| `check` | Polyline, 45° arms, short to long 1:2 (4.5 and 9 units across), right-angle vertex at 9.75,16 | x 5.25–18.75, y 7–16 | x 4.375–19.625, y 6.125–16.875 |
| `chevron-down` | Polyline, 45° arms, 11 wide by 5.5 tall, apex at 12,14.75 | x 6.5–17.5, y 9.25–14.75 | x 5.625–18.375, y 8.375–15.625 |

All four use the configured stroke (1.75), round caps, and round joins, and keep the default
`preserve` directionality with no metadata override.

### Observed

1. **Strokes that cross belong in one path.** Two separate elements composite their antialiased
   edges twice, so the crossing of `plus` and `x` rendered as a visibly darker knot at 14 and
   16 px. One path rasterizes the stroke once and the knot disappears.
2. **Orthogonal and diagonal marks need different boxes.** A `plus` with 14-unit arms and an `x` in
   a 12-unit box read as the same size. An `x` in a 13-unit box already reads larger; equal stroke
   length (a box of about 9.9) reads smaller.
3. **Primitives sit well inside the safe area.** About 2 to 3 units of clearance looked calm beside
   text; filling the 20-unit live area made bare marks loud. A smaller family (13-unit plus,
   11-unit x) looked undersized beside 14 px labels.
4. **45° diagonals gave the family one rhythm.** `x`, `check`, and `chevron-down` all use them and
   none needed a different angle.
5. **A box-centered check reads low.** Its vertex carries the visual mass. Lifting it 0.5 unit (box
   center 11.5, ink centroid about 12.25) reads level with `plus` and `x`; lifting 1.0 floats.
6. **A 1:2 check at a right angle reads confidently at 14 px.** The short arm is the first part to
   fade at small sizes, so it should not get shorter.
7. **A symmetric chevron is optically centered when its box is.** Its ink centroid is the box
   center, so no correction was needed.
8. **Centered geometry renders soft, symmetrically.** Lines centered on 12 straddle the middle pixel
   boundary at every recommended size, so a 1.75 stroke draws a two-pixel band at about 51% coverage
   at 14 px and 58% at 16 px. No coordinate snapping is crisp at 14 through 32 px at once;
   symmetric softness was preferred to asymmetric sharpness.
9. **Round caps and joins suit the primitives.** The check vertex and chevron apex stay soft without
   looking blunt, and terminals look calm. Butt and square terminals were not tried.

### Stroke comparison

Rendered widths per size: 14 px gives 0.88, 1.02, and 1.17 device pixels for 1.5, 1.75, and 2.0;
16 px gives 1.0, 1.17, and 1.33; 24 px gives 1.5, 1.75, and 2.0.

| Icon | 1.5 | 1.75 | 2.0 | Current preference | Notes |
|:--|:--|:--|:--|:--|:--|
| `plus` | Thin, gray at 14 px | Balanced | Firm, close to medium text | 1.75 | Soft two-pixel band at every candidate |
| `x` | Diagonals weaken at 14 px | Balanced | Dense center at 14 px | 1.75 | 2.0 thickens the crossing most |
| `check` | Short arm fades at 14 px | Clear | Strong, heavy at 2× | 1.75 | Most sensitive to thin strokes |
| `chevron-down` | Faint at 14 px | Clear | Apex heavy at 14 px | 1.75 | Compact shape magnifies weight changes |

**Family conclusion: 1.75 is the current preference, at low-to-moderate confidence. It is not
locked.** At 1.5 a 14 px icon is drawn with less than one device pixel and reads lighter than
regular text. 2.0 matches the stems of medium-weight text and is the real alternative, but is heavy
on these simple marks at 2× and may crowd gaps in denser icons. Deciding needs complex icons
(settings, user) and real Qeet UI and Qeet Text, neither of which Phase 3A has.

### Light, dark, and color

Light-on-dark reads slightly heavier for every candidate, the usual irradiation effect. Nothing
needed a geometry change or separate dark artwork. All six currentColor tokens rendered the marks
identically apart from color.

### Open tensions

- **Chevron scale.** At 11 by 5.5 the chevron is right in selects, rows, and buttons, but it reads
  smaller than `plus` and `x` in an isolated grid. Revisit beside `arrow-left` and a horizontal
  chevron in Phase 3B.
- **Typography.** Fallback-font comparisons are evidence, not calibration. Repeat them with Qeet UI
  and Qeet Text installed.

### Status after Phase 3A

| Topic | Status |
|:--|:--|
| One path for crossing strokes | Observed; strong candidate for the guidelines after Phase 3B |
| 45° diagonals for primitive marks | Observed |
| Primitive footprints (14-unit orthogonal, 12-unit diagonal) | Observed |
| Check lift and proportions | Observed |
| Stroke width (1.75) | Provisional, current preference |
| Round caps and joins | Provisional |
| Safe-area inset (2) | Provisional; no primitive approaches it |
| Corner system, curves, circles, rounded rectangles | Not yet tested |
| Filled grammar | Not yet tested |
| Small-size optical masters | Not needed by primitives; undecided |

## Phase 3B: circles, arrows, density, and the human form

Four more outline-only concepts, each chosen for a new problem: `search` (a circle with an
attached handle), `arrow-left` (shaft plus head, and the first `mirror` concept), `settings` (dense
radial geometry with an interior opening), and `user` (organic curves and head-to-body
proportion). All geometry was constructed from these goals on the 24-unit grid with a small
parametric generator (radii, tooth counts, arc radii) used only to compare candidates. No external
SVG was imported, no path data was copied, no screenshot was traced, and no third-party geometry
was adapted.

### Method

As in Phase 3A, plus: candidate sheets for each concept at every recommended size with 1× pixel
views; all eight concepts in one row beside 13–16 px regular and medium text at 1× and 2×; a
settings density test beside `plus`, `search`, and `user`; a chevron-versus-arrow comparison; and
the playground's RTL QA preview for `arrow-left`. **Qeet UI and Qeet Text were still not
installed: real Qeet typography calibration is still pending.**

### Accepted geometry

| Concept | Construction | Painted bounds |
|:--|:--|:--|
| `search` | One path: lens circle r 5.5 at 10.75,10.75 (counter 9.25) and a 45° handle from 14.75 to 19.25 | 4.375–20.125 on both axes |
| `arrow-left` | One path: shaft 5–19 on y 12; 45° head arms 5 units each (head 10 tall, 5 deep) | x 4.125–19.875, y 6.125–17.875 |
| `settings` | Path: 6 flat-tipped teeth at 90° + 60°k, tips 2.5 wide at r 8, roots 3.75 wide on a root circle r 6 (arcs between teeth); aperture circle r 2.75 | x 3.57–20.43, y 3.125–20.875 |
| `user` | Head circle r 3.75 at 12,8; shoulders one circular arc r 7 from 5.5,20 to 18.5,20 (top about 15.6) | x 4.625–19.375, y 3.375–20.875 |

The settings path is computed from those parameters, rounded symmetrically about the center to
0.01 units; it is mirror-symmetric on both axes, with corners within 0.003 units of r 6 and 8.09.
`arrow-left` is `mirror` through [config/icon-metadata.ts](../config/icon-metadata.ts); the other
three keep the default `preserve`. No Phase 3A icon changed.

### Observed

1. **Attached strokes, like crossing strokes, belong in one path.** The search handle starts inside
   the lens stroke; drawn as one path, the joint rasterizes once and shows no dark knot.
2. **The search lens wants r 5.5.** At r 6 the lens dominates the family; at r 5 search reads
   weaker than `plus` and `x`. The whole icon then matches the plus footprint (15.75 painted).
3. **Search sits 0.25 down-right of box center.** Box-centered, the heavy lens reads high and left
   beside its neighbors (ink centroid about 11.5); the shift brings it to about 11.73 and reads
   level. Like the check lift, the correction follows the ink, not the box.
4. **An attached arrow head should be slightly smaller than a standalone chevron.** A 5-unit head
   (10 tall) keeps `arrow-left` no heavier than `chevron-down`; 5.5 matched the chevron exactly but
   looked heavy on a shaft, and 6 was too big.
5. **At 1× a horizontal shaft is softer than a diagonal head.** The shaft on y 12 straddles the
   middle pixel boundary and renders as a gray two-pixel band, while the 45° head renders darker.
   It vanishes at 2× and from 20 px up. It was not corrected: moving the shaft off center would
   break the symmetric-geometry principle to suit one rasterizer.
6. **Six teeth, not eight.** At 14 px eight teeth leave gaps under one pixel and the gear blurs into
   a ring. Six stay distinct and match the hexagonal rhythm of the 60° and 45° family; five reads as
   a flower.
7. **Settings density is managed by its geometry, not the global stroke.** It remains the densest
   icon, roughly 1.8× the stroke length of search. Narrow 2.5-unit tips widen the gaps between
   teeth (about 5.8 units between tips), which made it read as a gear rather than a gray disc at
   14 px. Broader or shallower teeth read as a scalloped ring.
8. **The aperture needs r 2.75 and 1.5 units of clearance.** At r 2.25 it fills in at 14 px; the
   counter of 3.75 units (about 2 px) stays open. The clearance from aperture to root is
   6 − 2.75 − 1.75 = 1.5 units.
9. **Circular shoulders, not elliptical or rectangular.** A circular arc wider than a semicircle
   ends at a steep angle and reads as a calm symbol. A half-ellipse ends vertically and reads as a
   sculpted bust; a rounded-rectangle top reads mechanical.
10. **The head-to-shoulder gap governs user at 14 px.** About 2.1 units (head bottom 12.625,
    shoulders top 14.725) still separate as one light pixel row at 14 px and clearly at 16 px. A
    larger head (r 4) closed it.

### Circle grammar

Search lens r 5.5, user head r 3.75, settings aperture r 2.75: about 2 : 1.4 : 1. Sizes follow role,
not one radius. Shared principles (**Candidate**):

- An open counter of at least about 3.75 units (2 px at 14 px).
- At least 1.5 units of white between a circle and any neighboring stroke.
- Strokes attached to a circle join it in one path.
- Centers sit on quarter-unit coordinates and shift with the ink balance of asymmetric
  compositions.

### Diagonal grammar

45° holds for every straight diagonal so far: `x`, `check`, `chevron-down`, the search handle, and
the arrow head (**Candidate**). The settings tooth flanks are not diagonal strokes; they follow the
radial construction. No concept has needed another angle yet.

### Chevron and arrow

`chevron-down` is unchanged. Rotationally, its 11-unit opening is about 10% larger than the arrow's
10-unit head, with the same 45° angle, stroke, and round joins. A standalone chevron carries the
whole sign, so it should be a little larger than a head supported by a shaft; enlarging it to the
plus footprint would make it heavier than the arrow head, which is the wrong relationship.

### Stroke comparison

| Icon | 1.5 | 1.75 | 2.0 | Preference | Notes |
|:--|:--|:--|:--|:--|:--|
| `search` | Airy; handle thin at 14 px | Balanced | Counter tightens, joint heavier at 14 px | 1.75 | |
| `arrow-left` | Shaft very faint at 1× 14 px | Balanced; shaft softer than head at 1× | Firm, close to medium text | 1.75 | 2.0 acceptable for this icon alone |
| `settings` | Crispest teeth and aperture at 14 px | Dense but legible | Aperture and teeth clog at 14–16 px at 1×; boldest in the row at 2× | 1.75 | The strongest evidence against 2.0 |
| `user` | Light; neck gap generous | Balanced | Neck gap narrows further at 14 px | 1.75 | |

**Eight-icon conclusion: 1.75 remains the preference, now at moderate confidence (up from
low-to-moderate). It is not locked.** It is the only candidate at which both the simplest marks and
the densest icon hold: at 1.5 the primitives read thin beside medium-weight labels, and at 2.0
`settings` clogs at 14 and 16 px. Still unresolved: real Qeet UI and Qeet Text, rectangles and
corner radii (calendar, lock), stacked ellipses (database), bell curves, and filled grammar.

### Safe area

The 2-unit inset still works as an outer envelope. Primitives sit 2 to 3 units inside it, the
asymmetric search 1.9 to 2.4, and the dense or tall concepts closest: `settings` and `user` about
1.1 to 1.4 units inside at their extremes. Nothing touches it and nothing needed to exceed it. Its
generosity depends on the concept, which is expected; it stays **Provisional**.

### Light, dark, and color

As in Phase 3A, light-on-dark reads slightly heavier. `settings` is the densest on dark, but its
teeth and aperture stay open. All currentColor tokens rendered the geometry identically.

### Status after Phase 3B

| Topic | Status |
|:--|:--|
| One path for strokes that cross or attach | Candidate (Phases 3A and 3B) |
| 45° for straight diagonals | Candidate |
| Circle principles (counter, clearance, attachment, ink-balanced centers) | Candidate |
| Ink-balance corrections (check lift, search shift) | Observed |
| Attached head smaller than standalone chevron | Observed |
| 6-fold radial construction for dense mechanical icons | Observed |
| Stroke width (1.75) | Provisional, moderate confidence |
| Round caps and joins | Provisional; suited circles and curves as well as primitives |
| Safe-area inset (2) | Provisional; dense icons use most of it |
| Corner system, rectangles, stacked ellipses | Not yet tested (Phase 3C) |
| Typography with Qeet UI and Qeet Text | Pending: fonts unavailable |
| Filled grammar | Not yet tested |

## Phase 3C: corners, ellipses, bell curves, and containers

Four more outline-only concepts, each chosen for a problem the first eight did not cover: `lock`
(a rounded rectangle with an attached arch and an enclosed detail), `calendar` (a larger rounded
rectangle with an internal rule and strokes crossing its edge), `database` (stacked ellipses), and
`bell` (a free curve that is not a circular arc). All geometry was constructed from these goals on
the 24-unit grid with the same kind of throwaway parametric generator (corner radii, widths, ellipse
radii, band counts, flare points) used only to compare candidates. No external SVG was imported, no
path data was copied, no screenshot was traced, and no third-party geometry was adapted.

### Method

As in Phase 3B: candidate sheets for each concept at every recommended size with 1× pixel views;
a corner-radius study at r 1.5, 2, 2.5, and 3 on both containers; vertical-balance rows against
`plus`, `check`, `search`, and `user` with a center axis; all twelve concepts in one row beside 13–16
px regular and medium text at 1× and 2×, on light and dark; 14 and 16 px pixel views of the five
densest icons at each stroke candidate; and the playground for each new concept. **Qeet UI and Qeet
Text were still not installed: real Qeet typography calibration is still pending.**

### Accepted geometry

All four are one path each.

| Concept | Construction | Painted bounds |
|:--|:--|:--|
| `bell` | Semicircular dome r 5.5 centered 12,10 on parallel sides at x 6.5 and 17.5; each side flares from y 14 through a quadratic curve tangent to the side into a 15-unit rim on y 17 that closes the outline; clapper a half-disc arc r 1.75 hung from the rim center | x 3.625–20.375, y 3.625–19.625 |
| `lock` | Body 5–19 by 10–19.5 with corner radius 2.5; shackle a semicircle r 4 centered 12,7.5 on legs at x 8 and 16 that attach to the body top; keyhole a 2-unit vertical stroke from 13.75 to 15.75 | x 4.125–19.875, y 2.625–20.375 |
| `calendar` | Body 5–19 by 6–20 with corner radius 2.5; header rule on y 11 joining both sides; binding tabs at x 8.5 and 15.5 from y 4 to 7.75, crossing the top edge | x 4.125–19.875, y 3.125–20.875 |
| `database` | Top ellipse rx 7, ry 2.75 centered 12,6.75; straight sides at x 5 and 19 down to a lower half-ellipse at y 17.25; one band, a lower half-ellipse at y 12, midway | x 4.125–19.875, y 3.125–20.875 |

All four keep the default `preserve` directionality; no metadata entry was added. No Phase 3A or
3B icon changed.

### Observed

1. **One container corner radius: 2.5.** At 14 and 16 px, radii 1.5 to 2.5 are nearly
   indistinguishable. From 32 px up, r 3 reads as an app tile and r 1.5 looks sharp beside the
   round caps. r 2 is the close alternative and reads slightly more rigid. At r 2.5 the inner
   corner (radius 1.625) stays visibly round from 24 px. One radius on both containers (the
   14 by 9.5 lock body and the 14 by 14 calendar) made them read as one family.
2. **Closed containers want the plus footprint, not more.** A 15-unit calendar (16.75 painted)
   dominated the twelve-icon row; 14 units (15.75 painted, the plus footprint) sits with `lock`
   and `database`. A closed form fills its box, so it reads larger than an open mark of the same
   painted width. This extends the Phase 3A finding that different shapes need different boxes.
3. **The lock lifts 0.5.** Box-centered, the closed body carries the weight and the lock reads
   low (ink centroid 12.79). Lifting it 0.5 (centroid 12.29) reads level, like the check lift;
   0.25 was between. The shackle wants r 4 on legs 8 apart: r 3.5 looked pinched and r 4.5 slack.
4. **The bell's ink centroid misleads.** The clapper and rim put ink low (centroid 12.78), but the
   eye weighs the dome. The constructed bell, with its painted box centered at 11.6, reads level;
   lifting it 0.5 made it float. An ink centroid is a guide to check, not a rule to apply.
5. **A flared skirt makes it a bell.** Straight sides on a flat rim read as a dome or helmet. A short
   quadratic flare, tangent to each side, reads as a bell at every size. Closing the outline along
   the rim keeps skirt and rim in one stroke.
6. **An enclosed counter must either clear or close; nothing in between.** A cup clapper of r 2 left
   a white sliver about 0.25 units deep between its inner edge and the rim, visible in the 10×
   construction view and at 32 px. At r 1.75 its counter lies entirely under the rim stroke and
   the clapper renders as one solid bump. A detached bar clapper would need 1.5 units of clearance
   and merged into a gray underline at 14 px.
7. **The keyhole is a short stroke.** A 2-unit vertical stroke with 2 units of white above and below
   renders as a small gray block at 14 px and a clear slot from 20 px up. A zero-length dot faded to
   pale gray at 14 px. Without a keyhole the lock reads as a bag.
8. **Calendar tabs cross the top edge.** Tabs drawn only above the edge read as stubs at 14 px; tabs
   crossing it, in the same path, read as binding rings. Their lower ends stop 1.5 units clear of
   the header rule. The rule on y 11 renders crisply on a pixel row at 14 px and leaves two white
   rows in the header band. The tabs divide the width 1:2:1.
9. **One database band.** Two bands clog into a dark block at 14 px, and no band reads as a can. At
   ry 2.75 the top ellipse keeps a 3.75-unit counter, the circle-grammar minimum, which renders as a
   light pixel row at 14 px; ry 2.5 closed it and ry 3 read as a barrel. Arcs are spaced 5.25 units
   apart at the center.
10. **Tangent junctions thicken slightly.** Where the band and the bottom arc leave the straight
    sides vertically, the strokes overlap for a short run and the joint looks marginally heavier
    from 32 px. Drawing it as one path stops it doubling. The thickening is inherent to the
    cylinder and was accepted.
11. **Containers are the new density ceiling.** Stroke lengths: `database` 85, `settings` 75,
    `calendar` 73, `lock` 62, `bell` 53, against `search` 41 and `plus` 28 units. At 1.75 all stay open at
    14 px.

### Corner grammar

Corners are drawn as explicit arcs in path data, not `<rect rx>`, so crossing and attached strokes
can share the path. The container radius is 2.5 on the centerline, which paints an outer radius of
3.375 and an inner radius of 1.625 (**Observed**: one batch, two containers about 14 units wide).
Smaller enclosures such as badges and keys, and corners on wider or narrower boxes, are untested;
no universal radius is established. Round joins remain the joins inside strokes, not a substitute
for a designed corner.

### Ellipse and curve grammar

The database ellipse follows the circle principles: a counter of at least 3.75 units, and attached
strokes in the same path. Every curve so far is a circular or elliptical arc except the bell flare,
a quadratic curve tangent to the straight side it continues. Curves meet straight segments
tangentially, with no corner (**Observed**).

### Stroke comparison

| Icon | 1.5 | 1.75 | 2.0 | Preference | Notes |
|:--|:--|:--|:--|:--|:--|
| `bell` | Light but clear | Balanced; clapper a 1–2 px bump at 14 px | Firm; the open shape holds | 1.75 | The most tolerant of 2.0 among the four |
| `lock` | Keyhole fades to a pale block | Keyhole a gray block; shackle counter open | Body and keyhole darken; shackle still open | 1.75 | |
| `calendar` | Airy; tabs faint at 14 px | Header band open, two white rows at 14 px | Header band fills in to gray at 14 px at 1× | 1.75 | |
| `database` | Clear stack | Dense, but three bars stay distinct | Clogs into a dark block at 14 px at 1× | 1.75 | The densest icon |

**Twelve-icon conclusion: 1.75 remains the preference, now at moderate-to-high confidence (up from
moderate). It is not locked.** Three dense icons, `settings`, `calendar`, and `database`, now fill in
at 2.0 at 14 px, so 2.0 is unlikely. At 1.5 the primitives, keyhole, and tabs read thin beside
medium-weight labels. Still unresolved: real Qeet UI and Qeet Text, which bear on 1.5 versus
1.75; filled grammar; and rasterizers other than Chrome.

### Safe area

The 2-unit inset still holds as an outer envelope. The lock shackle comes closest of any icon so far
(painted top 2.625, 0.625 inside). The calendar tabs, `database`, and `settings` reach 3.125; the
bell rim tips reach 3.625. Nothing touches it and nothing needed to exceed it; it stays
**Provisional**.

### Light, dark, and color

As before, light-on-dark reads slightly heavier. `database` is now the densest icon on dark, but its
bands and top counter stay open at 14 px. All currentColor tokens rendered the geometry identically.

### Status after Phase 3C

| Topic | Status |
|:--|:--|
| One path for strokes that cross or attach | Candidate (Phases 3A–3C; every 3C icon is one path) |
| 45° for straight diagonals | Candidate (no new diagonals in 3C) |
| Circle principles (counter, clearance, attachment, ink-balanced centers) | Candidate; ellipses follow the same counter minimum |
| Ink-balance corrections (check lift, search shift, lock lift) | Observed; the ink centroid is a check, not a rule (bell) |
| Container corner radius 2.5 | Observed |
| Closed containers at the plus footprint | Observed |
| Enclosed counters clear by 1.5 or close fully | Observed |
| Stroke width (1.75) | Provisional, moderate-to-high confidence |
| Round caps and joins | Provisional; suited corners and curves as well |
| Safe-area inset (2) | Provisional; the lock shackle comes within 0.625 |
| Typography with Qeet UI and Qeet Text | Pending: the playground now self-hosts both; not yet compared |
| Filled grammar | Not yet tested |
| Small-size optical masters | Not needed so far |
