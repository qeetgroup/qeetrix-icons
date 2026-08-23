# Icon guidelines

The **technical** specification every Qeetrix icon follows, and every rule the build enforces.

For the **visual** language — how to make a new glyph look like it belongs to the family rather than
merely validate — see [icon-design-system.md](icon-design-system.md). This document is what the
validator checks; that one is what review checks.

## The specification

```text
Canvas        24 × 24
ViewBox       0 0 24 24
Style         outline / stroke
Stroke width  2
Line cap      round
Line join     round
Colour        currentColor
Fill          none
```

Every source file therefore looks like this, and nothing else:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 12H4" />
  <path d="M10 6 4 12l6 6" />
</svg>
```

The root attributes are **required**, even though `<IconBase>` supplies them again at render time.
Two reasons: a source file opens correctly on its own in a browser or design tool, and a contributor
who writes `stroke-width="1"` gets an error instead of having it silently discarded by the generator.

## Drawing on the grid

**Keep inside the live area.** Centrelines belong in `3 → 21`; only a stroke that must span the full
width (`menu`, `minus`, `arrow-left`) reaches the `2 → 22` bleed. A 2px stroke centred at `2` already
touches the canvas edge. The bands are defined in
[icon-design-system.md §1](icon-design-system.md#1-the-grid).

**Land on whole pixels where you can.** A vertical line at `x=12` renders crisply; at `x=12.5` a 2px
stroke straddles two pixel rows and blurs at 16px. Decimals are legal — `settings` uses them for its
45° teeth, because the alternative is a visibly lopsided gear — but reach for integers first.

**Optical balance beats mathematical centring.** A triangle centred by its bounding box looks
left-heavy; nudge it until it looks right.

**Design at 24px, then check at 16px.** Detail that survives at 24 often turns to mud at 16, which is
the size most UI actually uses. If a feature disappears, remove it rather than shipping mush.

**Match the family.** A new arrow should share the existing arrows' head angle and shaft length. Open
the neighbours before you start.

## Stroke, not fill

The set is outline-only. Use `fill="none"` and let the stroke carry the shape.

Where a shape must read as solid, still do not use a colour: `fill="currentColor"` inherits like the
stroke does. `fill="none"`, `currentColor`, `inherit` and `transparent` are the only four accepted
values — anything else is a build error.

## Colour

Never write a colour. Not a hex, not `rgb()`, not `hsl()`, not `oklch()`, not a CSS colour name.

Icons inherit from the surrounding text, which is what makes them work automatically in light mode,
dark mode, on a coloured button, and after a re-brand:

```tsx
<span className="text-red-600">
  <ShieldCheck />  {/* red, with no icon-specific styling at all */}
</span>
```

Validation enforces this with an allowlist rather than by hunting for colour syntax — which is why
`#f26d0e`, `rgb(0 0 0)`, `oklch(0.7 0.1 40)` and `rebeccapurple` are all rejected without any of them
appearing in the rule set.

## What is rejected

`bun run validate` fails the build on all of the following. Every rule exists to stop one specific
thing reaching a consumer.

| Rejected | Why |
|:--|:--|
| `viewBox` other than `0 0 24 24` | Breaks the shared grid; sizing stops being predictable. |
| `width`/`height` on the root | Size is a render-time prop. A baked-in size silently overrides `size`. |
| Root spec attributes missing or wrong | Would be silently discarded by the generator. |
| Hard-coded colours | Icon stops inheriting; breaks dark mode and re-branding. |
| `<image>`, `data:` URIs, base64 | Raster content does not scale and bloats the package. |
| `url(...)`, `href`, `xlink:href` | External references break when inlined or served cross-origin. |
| `<style>` or `style=` | Styling is the consumer's concern; inline styles cannot be overridden. |
| `<title>`, `<desc>`, `<metadata>` | Editor leftovers. Accessible names are set at render time, per usage. |
| `sodipodi:`/`inkscape:`/`xmlns:*` attributes | Editor metadata. |
| `id` attributes | Ids collide when many icons render in one document. Outline icons never need one. |
| `class` attributes | Consumers style via `className` on the component. |
| Elements outside the allowlist | Only `svg g path circle ellipse line polyline polygon rect`. |
| Attributes outside the allowlist | Blocks `onclick` and every other script vector. |
| `transform` anywhere | A transform makes source coordinates disagree with what renders, so reviewing geometry means composing matrices in your head, and two icons that look aligned can have unrelated path data. Author absolute coordinates. |
| An alias claimed by two icons | An alias asserts "this icon is also called X"; two owners make the query ambiguous. Tags may be shared. |
| An icon's own name as a tag or alias | The canonical name is always searched. |
| An alias that is also a real icon name | The query would be ambiguous between two glyphs. |
| A `priority` outside `P0`–`P3` | Would silently drop the icon from the coverage matrix. |
| Stray text content | Usually a leftover `<title>` or a copy-paste accident. |
| A `DOCTYPE` or CDATA | Entity-expansion surface, and never needed. |
| An empty icon | Draws nothing. |

Thirty rules are errors. Four things are **warnings** rather than errors, because "drop in one SVG and
it works" has to stay true: an icon with no tags, a horizontally-directional icon not marked
`mirror`, an alias restated as a tag, and a missing `priority`.

The mirror warning knows about two exceptions and stays quiet for both: symmetric names
(`arrow-left-right` — flipping it is a no-op) and the `media` category (`skip-forward` points right
in every locale, because playback direction is not reading direction).

## Exporting from a design tool

Design tools add a lot of what the list above rejects. The reliable route is to export, then hand-fix:

1. Set the frame to exactly 24 × 24.
2. Outline strokes only if you must — prefer real strokes so `strokeWidth` stays adjustable.
3. Export as SVG with "include id attributes" **off**.
4. Delete the `width`/`height`, `<title>`, `<desc>`, `<metadata>` and every `id`.
5. Replace the root attributes with the canonical block above.
6. Remove `fill`/`stroke` from children unless they are genuinely `none` or `currentColor`.
7. **Flatten every `transform`.** Design tools emit them constantly and they are rejected. Most
   tools have a "flatten"/"outline" step; otherwise apply the translation to the coordinates by hand.
8. Run `bun run validate` and fix what it names, then `bun run explorer` and look at it beside its
   siblings at 16px.

The validator is a faster reviewer than a person. Lean on it.

## RTL mirroring

Icons with a horizontal direction must flip under `dir="rtl"` — a "next" arrow points the other way
in Arabic or Hebrew. Record that in `icon-metadata.json`:

```json
"arrow-left": { "tags": ["back", "previous"], "aliases": ["arrow-back"], "mirror": true }
```

Vertical direction is **not** mirrored: `arrow-up` and `chevron-down` mean the same thing in both
directions, so they stay `false`.

The flag is metadata, not behaviour — this package does not read layout direction. A consumer applies
it, typically with `rtl:-scale-x-100` or by swapping the icon.

## Accessibility

Icons are decorative by default and carry `aria-hidden="true"`. Passing `aria-label` or
`aria-labelledby` makes an icon a named graphic (`role="img"`) and drops `aria-hidden` automatically.

Do not add a `<title>` to a source file to try to name an icon. The same glyph means different things
in different places — `x` is "Close" in a dialog and "Remove" in a chip — so the name belongs at the
usage site. See the README's accessibility section for the patterns.
