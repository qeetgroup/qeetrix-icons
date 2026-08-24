# Icon guidelines

The **technical** specification for a source SVG, and what the build actually enforces.

For the **visual** language — how to make a new glyph look like it belongs to the family rather than
merely work — see [icon-design-system.md](icon-design-system.md). This document is what the test suite
checks; that one is what review checks.

## The specification

```text
Canvas        24 × 24
ViewBox       0 0 24 24
Shape axis    round | sharp          → icons/<shape>-<variant>/
Variant axis  outline | solid
Paint         flat white             → becomes currentColor in the component
```

A source file is a designer's export, kept as exported. This is a real one, unmodified:

```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g clip-path="url(#clip0_4418_7621)">
    <path d="M15 22.75H9C3.57 22.75 1.25 20.43 1.25 15V9C1.25 3.57…" fill="white"/>
  </g>
  <defs>
    <clipPath id="clip0_4418_7621">
      <rect width="24" height="24" fill="white"/>
    </clipPath>
  </defs>
</svg>
```

> [!IMPORTANT]
> **Do not tidy a source file.** `width`/`height`, the `<g clip-path>` wrapper, the `<defs>`/`<clipPath>`
> block and the generated `id` are all kept deliberately. The component holds this markup byte for
> byte, and `tests/icons.test.tsx` compares the rendered DOM back against the file — so "cleaning up"
> an SVG is a test failure, not an improvement.

## What the generator changes

Exactly three things, and nothing else:

| Change | Why |
|:--|:--|
| Seven kebab attributes take their JSX spelling (`clip-path` → `clipPath`) | JSX has no other way to write them |
| `{...props}` appended to the root `<svg>` | Lets a consumer override anything |
| Visible `fill`/`stroke` of `white` → `currentColor`, and the root gains `color="white"` | Makes the icon themeable while rendering identically by default |

The colour swap applies **only outside `<defs>`**. The `<rect fill="white">` inside each `<clipPath>`
is a mask — never painted — so recolouring it would be meaningless. It is left as authored.

The seven renamed attributes are `clip-path`, `clip-rule`, `fill-rule`, `stroke-width`,
`stroke-linecap`, `stroke-linejoin`, `stroke-miterlimit`. **If you add artwork using a kebab-case
attribute outside that list, add it to `JSX_ATTRS` in `scripts/generate.mjs`.**

## What the build enforces

There is no separate validator. The generator preserves whatever it is given, so the guardrails live
in `bun run test`:

| Enforced | How it fails |
|:--|:--|
| `viewBox` is exactly `0 0 24 24` | Test names the file |
| Every `fill`/`stroke` is `white`, `none` or `currentColor` | Test names the file and the value |
| No rendered path carries a literal colour | Test names the file, across all 2,307 artworks |
| Each `<clipPath>` mask stays `fill="white"` | Test asserts the exact count |
| The component matches its source SVG, tag for tag | Test names the file |
| Directory is named `<shape>-<variant>` | Generator throws |
| `style="…"` attribute | **TypeScript error** — a string is not a valid JSX `style` |
| Committed output drifted from source | `bun run generate:check` fails |

Two of these are worth understanding, because they are the mistakes that would otherwise ship quietly:

**A hard-coded colour is not rejected — it is untestable to spot by eye.** The generator only rewrites
the literal value `white`. A `#f26d0e` or `rgb(0 0 0)` survives untouched, producing an icon that
ignores `color` and breaks dark mode. That is why the flat-white check exists.

**A wrong `viewBox` is not rejected either.** The byte-for-byte test would happily confirm the wrong
grid was faithfully copied. Nothing else would notice until an icon visibly failed to line up.

## Drawing on the grid

**Keep inside the live area.** Centrelines belong in `3 → 21`; only a shape that must span the full
width reaches the `2 → 22` bleed. The bands are defined in
[icon-design-system.md §1](icon-design-system.md#1-the-grid).

**Land on whole pixels where you can.** A vertical edge at `x=12` renders crisply; at `x=12.5` it
straddles two pixel rows and blurs at 16px. Decimals are legal and common in this set, but reach for
integers first.

**Optical balance beats mathematical centring.** A triangle centred by its bounding box looks
left-heavy; nudge it until it looks right.

**Design at 24px, then check at 16px.** Detail that survives at 24 often turns to mud at 16, which is
the size most UI actually uses. If a feature disappears, remove it rather than shipping mush.

**Match the family.** A new arrow should share the existing arrows' head angle and shaft length. Open
the neighbours before you start.

## Colour

Paint in flat `white`, and nothing else. Never a hex, `rgb()`, `hsl()`, `oklch()` or a CSS colour name.

White is not arbitrary: it is the value the generator rewrites to `currentColor`, which is what makes
an icon inherit from its surroundings and work in light mode, dark mode, on a coloured button, and
after a re-brand.

```tsx
<span className="text-red-600">
  <ShieldTick />  {/* red, with no icon-specific styling at all */}
</span>
```

See [usage.md](usage.md#colour-and-dark-mode) for the consumer side.

## Exporting from a design tool

1. Set the frame to exactly 24 × 24.
2. Paint every shape flat white.
3. Export as SVG. Leave `width`/`height` and any `id` alone — they are expected.
4. Drop the file at `icons/<shape>-<variant>/<category>/<name>.svg`.
5. Run `bun run generate && bun run test`.
6. Look at it beside its siblings at 16px: `cd example && bun run dev`.

The one thing to strip is a `style=""` attribute — it is invalid in JSX and will fail `bun run
typecheck` rather than render. Move whatever it did into real attributes.

## RTL mirroring

Icons with a horizontal direction should flip under `dir="rtl"` — a "next" arrow points the other way
in Arabic or Hebrew. Vertical direction is **not** mirrored: `arrow-up` means the same thing in both.

This package ships no mirror metadata and does not read layout direction; there is no
`icon-metadata.json` any more. Mirroring is the consumer's call, applied in CSS where the direction is
known:

```css
[dir="rtl"] .icon-mirror { transform: scaleX(-1); }
```

```tsx
<ArrowLeft className="icon-mirror" />
```

Media transport controls are the standing exception: `forward` points right in every locale, because
playback direction is not reading direction.

## Accessibility

Nothing is decided for you — a source file carries no accessible name, and it should not. The same
glyph means different things in different places (`close-circle` is "Close" in a dialog and "Remove"
in a chip), so the name belongs at the usage site.

Do **not** add a `<title>` to a source file to name an icon. See
[usage.md](usage.md#accessibility) for the decorative and meaningful patterns.
