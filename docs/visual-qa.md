# Visual QA

Automated checks prove that an SVG is structurally valid and that derived and generated files
match their inputs; only a person can judge whether an icon reads well. Two things need that
judgment here:

- **Every filled drawing**, before it is listed in [config/filled.ts](../config/filled.ts) and
  again whenever it changes. Filled drawings are derived by rule, and a rule can produce a
  valid but poor drawing ([filled.md](filled.md)).
- **Every Lucide upgrade**: added and redrawn outlines, the filled drawings they change, and RTL
  decisions for new icons ([lucide.md](lucide.md#upgrading-lucide)). Outline problems are reported
  upstream to Lucide, not fixed here.

The developer playground is the tool for both. It inspects artwork; it never edits or scores it.

## Automated validation vs visual QA

| Automated validation | Visual QA |
|:--|:--|
| `bun run check:icons`, `check:filled`, `generate`, `check:generated`, tests | A reviewer in the playground |
| XML structure, allowed elements and attributes, viewBox, paint, variant contract | Semantic recognizability |
| Naming, paths, categories, collisions, outline-required, metadata | Clarity at 14 and 16 px |
| Filled drawings match their derivation; generated output matches source | A clean filled form: solid bodies, clean cuts, clear gaps |
| Deterministic, repeatable, CI-enforced | Outline and filled reading as one concept |
| | Optical balance and consistency with neighboring icons |
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
  whether Qeet UI and Qeet Text really loaded. Search matches an icon's id, name, component name,
  categories, Lucide tags, and aliases, so `trash-2` finds `trash`.
- **Sidebar:** every configured category with the number of icons listed under it, and the variant
  and directionality filters. A category filter matches every icon that lists the category, not
  only those whose source folder it is.
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
| Overview | Variant comparison | Outline and filled side by side at 24 and 48 px, when both exist |
| Construction | Construction | The 24×24 grid at 12× with unit grid, center axes, canvas edge, and the 1-unit safe area |
| Construction | Stroke width | The outline at 16, 24, and 48 px, as drawn and with each `strokeWidth` a caller might pass (1.5, 1.75, 2) |
| In context | Surfaces and currentColor | Light and dark surfaces side by side, and the icon in each semantic foreground token |
| In context | Interface contexts | Text button, icon-only control, input prefix, sidebar row, table action, inline label |
| In context | Typography | Icons beside Qeet UI and Qeet Text at 14 and 16 px |
| In context | Direction | LTR beside the RTL QA preview |
| Code | Import and metadata | The public root and direct imports, and manifest data |
| Review | Review checklist | The items below, as local checkboxes |
| Review | Design values | The shared stroke, caps and joins, safe area, and recommended sizes from config |

The 112 px showcase is for reading detail only; its stroke scales with size. Judge sizes in the
Overview tab, which renders each one as drawn.

### Actual source vs stroke overrides

Every view renders the generated component exactly as generated, except the stroke-width view.
That view applies a render-time CSS `stroke-width` to its own previews only, showing what a caller's
`strokeWidth` prop would draw, beside the actual source rendering at width 2. The widths come from
`design.strokeCandidates` in [config/icon-system.ts](../config/icon-system.ts); validation and the
filled derivation ignore them.

The safe area shown in the construction view is `design.safeAreaInset`, Lucide's 1-unit padding.
The center axes mark the mathematical center. Optical centering often differs from it, and the
guides are a reference, not a correctness test.

### Typography

The playground uses the stacks `"Qeet UI", system-ui, sans-serif` and
`"Qeet Text", system-ui, sans-serif`, and self-hosts both families from
[playground/fonts/](../playground/fonts/): Qeet UI 400, 500, and 600 and Qeet Text 400 and 500,
copied from qeet-group and byte-identical to the `@qeetrix/ui` masters. The `@font-face` rules
in `playground/src/styles.css` mirror `@qeetrix/ui`'s. Vite bundles the files into
`playground/dist` only; nothing is fetched and nothing reaches the published package.

The top bar still reports whether each family is really available: it loads each face, then
measures rendered text against generic fallbacks. When it says *unavailable — system fallback
active*, a font file failed to load, and the typography rows do not show the Qeet typefaces.

### RTL

Direction comes only from manifest `directionality`. For `preserve`, the RTL preview is identical.
For `mirror`, the playground mirrors the icon with a CSS transform and labels it **RTL QA preview**.
That mirroring exists only in the playground; `@qeetrix/icons` does not mirror at runtime. The
global "Preview direction" control applies RTL to the interface contexts; the size, pixel,
construction, and stroke views always show source geometry.

## Review workflow

For a filled drawing:

1. Add the name to [config/filled.ts](../config/filled.ts), or change its recipe.
2. Run `bun run derive:filled`, then `bun run generate`.
3. Open the playground with `bun run playground`, select the icon, and switch to `filled`.
4. Compare it with the outline at 16, 24, and 48 px: the recommended sizes, the variant comparison,
   and the custom size.
5. Inspect the 14 and 16 px pixel views: cuts and gaps must stay open, bodies must not blot.
6. Inspect light and dark surfaces, the interface contexts, and the typography rows.
7. If a role is wrong, override it in the recipe and repeat from step 2. If no recipe gives a clean
   result, remove the icon from the list.

For a Lucide upgrade, review the icons the sync added or changed in the same views, plus the RTL
QA preview for any new icon that may follow reading direction, and every filled drawing in the
diff as above. Never fix an outline locally; report it to Lucide.

## Checklist

The playground shows this list per icon. Ticks are local to the page and are not repository state;
acceptance is recorded in review, not in a database.

- **Meaning:** recognizable as its concept, not just as a shape.
- **Sizes:** 14 px still clear; 16 px clear at the most common UI size; 20 px balanced; 24 px
  canonical; 32 px neither empty nor heavy.
- **Construction:** optically centered; painted bounds inside the safe area; stroke weight
  consistent with the family; corners, curves, and diagonals clean; internal spacing that survives
  small sizes.
- **Color and theme:** reads on light and dark; follows currentColor in every token.
- **Typography:** supports Qeet UI labels without overpowering them; sits comfortably beside Qeet
  Text.
- **Direction:** the `preserve` or `mirror` decision matches the meaning; for `mirror`, the mirrored
  preview still reads correctly.
- **Variants:** when filled exists, outline and filled read as one concept and family.

The source of this list is [playground/src/qa.ts](../playground/src/qa.ts).

## Not yet

There is no screenshot or browser regression testing. The playground's layouts are deterministic,
so it can be added if review by eye stops being enough.
