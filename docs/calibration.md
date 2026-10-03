# Calibration log

Evidence from the Phase 3 calibration batches. This log records what was drawn, how it was judged,
and what was learned. It is not the specification: normative guidance stays in
[drawing-guidelines.md](drawing-guidelines.md) and the shared values stay in
[config/icon-system.ts](../config/icon-system.ts), which change only when evidence justifies it.

Each finding is labelled **Observed** (seen in this batch, not yet a rule), **Provisional** (a
working default that may still change), or **Locked** (a decided rule). After Phase 3A, nothing
visual is locked.

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
