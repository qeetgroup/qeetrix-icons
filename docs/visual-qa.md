# Visual QA

Every Qeetrix icon is reviewed by a person before it is accepted. Automated checks prove that an SVG
is structurally valid; only human review can judge whether it is a good icon. The developer
playground is the tool for that review. It inspects artwork; it never edits or scores it.

## Automated validation vs visual QA

| Automated validation | Visual QA |
|:--|:--|
| `bun run check:icons`, `generate`, `check:generated`, tests | A reviewer in the playground |
| XML structure, allowed elements and attributes, viewBox, paint, variant contract | Semantic recognizability |
| Naming, paths, categories, collisions, outline-required, metadata | Clarity at 14 and 16 px |
| Generated output matches source | Optical balance and centering |
| Deterministic, repeatable, CI-enforced | Negative space and internal spacing |
| | Stroke, corner, curve, and diagonal consistency |
| | Family consistency, including outline and filled |
| | Harmony with Qeet UI and Qeet Text |
| | Light/dark and RTL behavior |

Passing automated validation is necessary but never sufficient. There is no quality score, and none
should be invented: these are judgments.

## The playground

```bash
bun run playground        # local development server
bun run playground:build  # production build; CI runs it to prove the playground compiles
```

The playground lives in [playground/](../playground/) and is repository tooling, never part of the
published package. It is local: no network, no CDN fonts, no analytics. It reads the generated
manifest and generated components, the shared category config, and the icon-system config, so
nothing in it is a second catalogue to maintain. It never writes to `icons/`, `src/generated/`,
or `icon-manifest.json`.

Inspection state is shareable in the URL, for example
`?icon=star&variant=filled&size=16&theme=dark&dir=rtl`. Invalid values fall back to defaults.

### Layout

The playground is styled with the `@qeetrix/ui` tokens (neutral canvas, Qeet orange primary), copied
into its own stylesheet because it imports no UI kit. Its chrome uses the catalogue's own icons.

- **Top bar:** search, theme (system, light, dark), preview direction (LTR, RTL QA preview), and
  whether Qeet UI and Qeet Text really loaded.
- **Sidebar:** every configured category with its count (empty categories are disabled), and the
  variant and directionality filters.
- **Catalogue:** grouped by category, or a flat list while searching or filtering, with a 16, 20,
  24, or 32 px preview-size switch. Tiles flag `mirror` concepts with **RTL**.
- **Inspector:** opens beside the catalogue (a slide-over drawer below 1240 px wide) with a 112 px
  showcase, the variant switch, and five tabs.

Keyboard: `/` focuses search, `←` and `→` step through the visible icons while one is open, and
`Esc` closes the inspector.

### What each view is for

| Tab | View | Use it to check |
|:--|:--|:--|
| Overview | Recommended sizes | 14, 16, 20, 24, and 32 px from config, plus a custom size from 12 to 64 px. Actual source rendering |
| Overview | Pixel view | 14 and 16 px rasterized at one device pixel per pixel and magnified: merged strokes, blur, crowding |
| Overview | Variant comparison | Outline and filled side by side, when both exist |
| Construction | Construction | The 24×24 grid at 12× with unit grid, center axes, canvas edge, and the candidate safe area |
| Construction | Stroke calibration | The outline drawing at each candidate width beside the actual source rendering |
| In context | Surfaces and currentColor | Light and dark surfaces side by side, and the icon in each semantic foreground token |
| In context | Interface contexts | Text button, icon-only control, input prefix, sidebar row, table action, inline label |
| In context | Typography | Icons beside Qeet UI and Qeet Text at 14 and 16 px |
| In context | Direction | LTR beside the RTL QA preview |
| Code | Import and metadata | The public root and direct imports, and manifest data |
| Review | Review checklist | The items below, as local checkboxes |
| Review | Calibration status | Which design values are still provisional |

The 112 px showcase is for reading detail only; its stroke scales with size. Judge sizes in the
Overview tab, which renders each one as authored.

### Actual source vs calibration overrides

Every view renders the generated component exactly as authored, except the stroke-calibration view.
That view applies a render-time CSS `stroke-width` to its own previews only and labels each one
**visual calibration override**. The source rendering sits beside the overrides, labelled **actual
source rendering**. The candidate widths come from `calibration.strokeCandidates` in
[config/icon-system.ts](../config/icon-system.ts); validation and generation ignore them.

The safe area shown in the construction view is `calibration.safeAreaInset`, labelled as a
calibration candidate. The center axes mark the mathematical center. Optical centering often differs
from it, and the guides are a reference, not a correctness test.

### Typography

The playground uses the stacks `"Qeet UI", system-ui, sans-serif` and
`"Qeet Text", system-ui, sans-serif`, and self-hosts both families from
[playground/fonts/](../playground/fonts/): Qeet UI 400, 500, and 600 and Qeet Text 400 and 500,
copied from qeet-group and byte-identical to the `@qeetrix/ui` masters. The `@font-face` rules
in `playground/src/styles.css` mirror `@qeetrix/ui`'s. Vite bundles the files into
`playground/dist` only; nothing is fetched and nothing reaches the published package.

The top bar still reports whether each family is really available: it loads each face, then
measures rendered text against generic fallbacks. When it says *unavailable — system fallback
active*, a font file failed to load, and the typography rows are not a Qeet calibration.

### RTL

Direction comes only from manifest `directionality`. For `preserve`, the RTL preview is identical.
For `mirror`, the playground mirrors the icon with a CSS transform and labels it **RTL QA preview**.
That mirroring exists only in the playground; `@qeetrix/icons` does not mirror at runtime. The
global "Preview direction" control applies RTL to the interface contexts; the size, pixel,
construction, and stroke views always show source geometry.

## Review workflow

1. Author or update the SVG in `icons/<variant>/<category>/<name>.svg`.
2. Run `bun run check:icons`.
3. Run `bun run generate`.
4. Open the playground with `bun run playground` and select the icon.
5. Inspect the recommended sizes and the 14 and 16 px pixel views.
6. Inspect the construction grid, center axes, and safe area.
7. For outline drawings, compare the stroke candidates when calibration is in question.
8. Inspect light and dark surfaces and the currentColor tokens.
9. Inspect the interface contexts and typography rows.
10. If the concept is `mirror`, inspect the RTL QA preview.
11. If a filled drawing exists, compare it with the outline.
12. Fix the SVG source, not the generated code.
13. Repeat until every checklist item holds.

## Checklist

The playground shows this list per icon. Ticks are local to the page and are not repository state;
acceptance is recorded in review, not in a database.

- **Meaning:** recognizable as its concept, not just as a shape.
- **Sizes:** 14 px still clear; 16 px clear at the most common UI size; 20 px balanced; 24 px
  canonical; 32 px neither empty nor heavy.
- **Construction:** optically centered; generous negative space within the safe area; stroke weight
  consistent with the family; deliberate corners, curves, and diagonals; internal spacing that
  survives small sizes.
- **Color and theme:** reads on light and dark; follows currentColor in every token.
- **Typography:** supports Qeet UI labels without overpowering them; sits comfortably beside Qeet
  Text.
- **Direction:** the `preserve` or `mirror` decision matches the meaning; for `mirror`, the mirrored
  preview still reads correctly.
- **Variants:** when filled exists, outline and filled read as one concept and family.

The source of this list is [playground/src/qa.ts](../playground/src/qa.ts).

## Recording findings

Record what a calibration batch teaches in [calibration.md](calibration.md), marking each finding
Observed, Provisional, or Locked. Promote a finding into [drawing-guidelines.md](drawing-guidelines.md)
or the shared config only when later batches confirm it.

## Still provisional

Stroke width, stroke caps and joins, the safe-area inset, the recommended sizes, corner treatment,
and small-size optical corrections remain calibration candidates until the Phase 3 calibration set
has been reviewed this way. The playground's Calibration status panel lists them. The default
`outline` variant is stable API, not calibration. See [drawing-guidelines.md](drawing-guidelines.md).

## Not yet

There is no screenshot or browser regression testing. The playground's layouts are deterministic, so
it can be added once there is enough real artwork to justify it.
