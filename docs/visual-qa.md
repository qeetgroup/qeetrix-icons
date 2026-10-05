# Visual QA

Automated checks prove that an SVG is structurally valid and that derived and generated files
match their inputs; only a person can judge whether an icon reads well. Three things need that
judgment here:

- **Every filled drawing**, before it is listed in [config/derived/](../config/derived/README.md) and
  again whenever it changes. Filled drawings are derived by rule, and a rule can produce a
  valid but poor drawing ([filled.md](filled.md)).
- **Every change to the sharp style**: a rule in `scripts/lib/sharp.ts` or a `keepRound` or `tipHeight` entry
  can change hundreds of sharp drawings at once ([sharp.md](sharp.md)).
- **Every Lucide upgrade**: added and redrawn outlines, the filled and sharp drawings they change,
  and RTL decisions for new icons ([lucide.md](lucide.md#upgrading-lucide)). Outline problems are
  reported upstream to Lucide, not fixed here.

The developer playground is the tool for all three. It inspects artwork; it never edits or scores
it. Brand logos are embedded exactly as published and are not redrawn here; after a logo sync,
review what was added, removed, or relicensed ([logos.md](logos.md)).

## Automated validation vs visual QA

| Automated validation | Visual QA |
|:--|:--|
| `bun run check:icons`, `check:filled`, `check:sharp`, `generate`, `check:generated`, tests | A reviewer in the playground |
| XML structure, allowed elements and attributes, viewBox, paint, variant contract | Semantic recognizability |
| Naming, paths, categories, collisions, outline-required, metadata | Clarity at 14 and 16 px |
| Filled and sharp drawings match their derivation; generated output matches source | A clean filled form: solid bodies, clean cuts, clear gaps |
| Shapes in parity, sharp stroke style on every sharp source | Clean sharp corners: points without spikes, chamfers where needed |
| Deterministic, repeatable, CI-enforced | Outline and filled, round and sharp, reading as one concept |
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
manifests and components, the shared config, and small build-time summaries of the Lucide and
theSVG catalogues, so nothing in it is a second catalogue to maintain. It never writes to
`icons/`, `src/generated/`, or `icon-manifest.json`. Its state, such as the selected icon, shape,
and variant (`?icon=star&shape=sharp&variant=filled`), is shareable in the URL, and invalid values
fall back to defaults.

It has two pages. The playground is being redesigned, so what follows describes what each page is
for rather than its layout.

### Icons

The Icons page shows the catalogue with search over each icon's id, name, component name,
categories, Lucide tags, and aliases (so `trash-2` finds `trash`), a category filter that matches
every icon listed under a category, variant and directionality filters, and a Round/Sharp shape
switch that applies to every rendered icon. Selecting an icon opens an inspector with these views:

| View | Use it to check |
|:--|:--|
| Sizes | The recommended sizes from config, plus a custom size. Actual source rendering |
| Pixel view | 14 and 16 px rasterized at one device pixel per pixel and magnified: merged strokes, blur, crowding |
| Shapes and variants | Every drawing of the concept side by side: round and sharp, outline and filled |
| Construction | The 24×24 grid with unit grid, center axes, canvas edge, and the 1-unit safe area |
| Stroke width | The outline in the selected shape as drawn and with each `strokeWidth` a caller might pass (1.5, 1.75, 2) |
| Surfaces and currentColor | Light and dark surfaces, and the icon in each semantic foreground token |
| Interface contexts | The icon in buttons, inputs, rows, table actions, and inline labels |
| Typography | Icons beside Qeet UI and Qeet Text |
| Direction | LTR beside the RTL QA preview |
| Import, usage, and details | The public imports, a usage snippet, and manifest data |
| Review checklist and design values | The items below, as local checkboxes, and the selected shape's design values from config |

Every view renders the generated component exactly as generated, except the stroke-width view.
That view applies a render-time CSS `stroke-width` to its own previews only, showing what a
caller's `strokeWidth` prop would draw, beside the actual source rendering at width 2. The widths
come from `design.strokeCandidates` in [config/icon-system.ts](../config/icon-system.ts);
validation and the filled derivation ignore them. The safe area shown in the construction view is
`design.safeAreaInset`, Lucide's 1-unit padding. The center axes mark the mathematical center;
optical centering often differs, and the guides are a reference, not a correctness test.

### Logos

The Logos page browses the brand logos ([logos.md](logos.md)) by collection, with search, shows them
on a light, dark, or transparent background, and shows each logo's files with the background each is
drawn for and its license, flagging licenses that restrict use. Logos are rendered exactly as
published; there is nothing to review in their drawing, only whether they are the right ones to use.

### Typography

The playground uses the stacks `"Qeet UI", system-ui, sans-serif` and
`"Qeet Text", system-ui, sans-serif`, and self-hosts both families from
[playground/fonts/](../playground/fonts/): Qeet UI 400, 500, and 600 and Qeet Text 400 and 500,
copied from qeet-group and byte-identical to the `@qeetrix/ui` masters. The `@font-face` rules
in `playground/src/styles.css` mirror `@qeetrix/ui`'s. Vite bundles the files into
`playground/dist` only; nothing is fetched and nothing reaches the published package.

The playground still checks whether each family is really available: it loads each face, then
measures rendered text against generic fallbacks. If it reports a system fallback, a font file
failed to load, and the typography rows do not show the Qeet typefaces.

### RTL

Direction comes only from manifest `directionality`. For `preserve`, the RTL preview is identical.
For `mirror`, the playground mirrors the icon with a CSS transform and labels it **RTL QA preview**.
That mirroring exists only in the playground; `@qeetrix/icons` does not mirror at runtime. The
preview direction applies RTL to the interface contexts; the size, pixel, construction, and stroke
views always show source geometry.

## Review workflow

For a filled drawing:

1. Add the name to its category's file in [config/derived/](../config/derived/README.md), or change its recipe.
2. Run `bun run derive:filled`, `bun run derive:sharp`, and `bun run generate`.
3. Open the playground with `bun run playground`, select the icon, and switch to `filled`.
4. Compare it with the outline at 16, 24, and 48 px, using the sizes view and the shapes and
   variants view.
5. Inspect the 14 and 16 px pixel views: cuts and gaps must stay open, bodies must not blot.
6. Inspect light and dark surfaces, the interface contexts, and the typography rows.
7. If a role is wrong, override it in the recipe and repeat from step 2. If no recipe gives a clean
   result, remove the icon from the list.

Review the sharp filled drawing too: switch the shape to Sharp and repeat steps 4 to 6.

For a change to the sharp style, run `bun run derive:sharp` and `bun run generate`, switch the
shape to Sharp, and review every icon in the diff in the same views: corners square, tips pointed
but not spiking, chamfers where a point would clip or collide, dots square, figurative circles
round. Compare with Round when in doubt; the two must read as the same icon.

For a Lucide upgrade, review the icons the sync added or changed in the same views, in both
shapes, plus the RTL QA preview for any new icon that may follow reading direction, and every
filled drawing in the diff as above. Never fix an outline locally; report it to Lucide.

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

Run through it in each shape.

The source of this list is [playground/src/qa.ts](../playground/src/qa.ts).

## Not yet

There is no screenshot or browser regression testing. The playground's layouts are deterministic,
so it can be added if review by eye stops being enough.
