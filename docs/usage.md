# Using `@qeetrix/icons`

Everything a consuming application needs. For contributing icons, see
[contributing.md](contributing.md).

## Install

```bash
bun add @qeetrix/icons
```

npm, pnpm and yarn work identically:

```bash
npm install @qeetrix/icons
pnpm add @qeetrix/icons
yarn add @qeetrix/icons
```

**React 19 or later is a peer dependency.** There are no runtime dependencies — installing this
package adds nothing to your tree but the icons themselves.

The package is ESM only. If you are on a CommonJS-only toolchain, `require()` will not work; that is
deliberate rather than an oversight, and it matches the rest of the Qeet workspace.

## Basic usage

Every icon is a named export from the package root:

```tsx
import { Search } from "@qeetrix/icons";

export function Example() {
  return <Search />;
}
```

Icon names are `PascalCase` versions of their kebab-case filenames: `arrow-left` is `ArrowLeft`,
`shield-tick` is `ShieldTick`. See [naming.md](naming.md).

There is no `<Icon name="search" />` string API, deliberately. Named imports are what makes
tree-shaking work — see [Bundle size](#bundle-size).

## Props

```ts
type Props = React.SVGProps<SVGSVGElement> & {
  variant?: "outline" | "solid"; // strokes or filled shapes
  shape?: "round" | "sharp"; // rounded or squared corners
};
```

Anything valid on an `<svg>` element is valid here. Props spread onto the root **last**, so anything
you pass overrides the component's own defaults.

## Style axes

Style is two independent props, each narrowed per icon to the artwork that exists:

```tsx
<Search />                                  // round + outline (both defaults)
<Search variant="solid" />                  // round + solid
<Search shape="sharp" variant="solid" />    // sharp + solid, once it lands
```

1,141 of 1,166 icons ship both variants; 13 are outline-only and 12 are solid-only. The type reflects
it, so a single-variant icon rejects the one it does not have:

```tsx
<Litecoin variant="solid" />   // ✗ TS error — outline-only icon
```

> [!NOTE]
> `shape="sharp"` is a type error today. The `sharp-outline/` and `sharp-solid/` source directories
> exist but hold no artwork yet, so every icon currently narrows `shape` to `"round"`.

## Size

There is **no `size` prop**. Set `width` and `height`, or size in CSS:

```tsx
<Search width={16} height={16} />
<Search width="1.25rem" height="1.25rem" />
<Search className="size-5" />              {/* Tailwind — CSS beats the attributes */}
```

The components carry `width="24" height="24"` from the source artwork. A CSS rule outranks a
presentation attribute, so `className="size-5"` resizes correctly without `!important`.

> [!WARNING]
> `<Search size={20} />` does nothing. It emits an invalid `size="20"` attribute and leaves the icon
> at 24px. An earlier version had this prop; it is gone.

**Pick a size, do not scale with `transform`.** The icons are drawn on a 24-unit grid; a CSS transform
scales the whole glyph including its optical weight against neighbouring text.

## Colour and dark mode

Icons ship **white**, matching the source artwork. All visible geometry paints `currentColor`, and the
root carries `color="white"` as an overridable default.

Four ways to set it, in increasing priority:

```tsx
<Search />                              // 1. white — the built-in default
<Search color="black" />                // 2. any CSS colour, via a prop
<Search className="text-red-500" />     // 3. a class — CSS outranks the default
<Search style={{ color: "tomato" }} />  // 4. inline style — highest priority
```

For automatic dark/light, use a theme class or inherit the surrounding text:

```tsx
<ShieldTick className="text-zinc-900 dark:text-zinc-100" />
<ShieldTick color="currentColor" />   {/* inherits from the parent */}
```

```css
/* Or theme every icon inside one container */
.app      { color: #18181b; }
.app.dark { color: #fafafa; }
```

> [!IMPORTANT]
> **`fill` does not work.** Visible paths carry their own `fill="currentColor"`, and an explicit fill on
> a child beats an inherited one from the root — so `<Search fill="red" />` changes nothing you can see.
> Use `color`.

A white icon on a white background is invisible. That is correct, not a bug: set `color` or a text
class.

## Stroke width

`strokeWidth` passes through to the root, but on this set it is **effectively inert**. Only 33 of
8,460 painted elements use a stroke at all, and each carries its own `stroke-width="1.5"`, which beats
the inherited value. The set is drawn as filled shapes, not strokes.

There is one weight, and no light or bold family.

## Styling

`className`, `style` and every standard SVG attribute pass straight through:

```tsx
<Search
  width={20}
  height={20}
  className="shrink-0 text-muted-foreground"
  style={{ opacity: 0.6 }}
  onClick={handleClick}
  data-testid="search-icon"
/>
```

`shrink-0` (or `flex-shrink: 0`) is worth knowing about: inside a flex container an SVG will otherwise
compress when space is tight.

Refs forward to the `<svg>` element:

```tsx
const ref = useRef<SVGSVGElement>(null);
<Search ref={ref} />;
```

## Accessibility

> [!IMPORTANT]
> **Nothing is automatic.** A component renders its source SVG and adds no ARIA at all — no default
> `aria-hidden`, no automatic `role`. Every icon is unlabelled and exposed until you say otherwise.
> An earlier version flipped these for you through a shared wrapper; that wrapper is gone.

An icon is either decorative or meaningful, and you mark which.

### Icon beside visible text — hide it

The text is already the label, so a second announcement is noise:

```tsx
<button type="button">
  <ArrowLeft width={20} height={20} aria-hidden="true" />
  Back
</button>
```

Announced as: *"Back, button"*.

### Icon-only control — name the control

```tsx
<button type="button" aria-label="Search">
  <Search width={20} height={20} aria-hidden="true" />
</button>
```

Announced as: *"Search, button"*. Naming the **button** rather than the icon is what makes voice
control work.

### Standalone meaningful icon — name the icon

When the icon is the only thing carrying the information:

```tsx
<td>
  <ShieldTick width={16} height={16} role="img" aria-label="Verified" />
</td>
```

Announced as: *"Verified, image"*.

> [!WARNING]
> `aria-label` alone is not enough. An `<svg>` has no implicit role, so some screen readers ignore the
> label entirely — always pair it with `role="img"`.

### Why not put a `<title>` in the SVG

Because the same glyph means different things in different places. `close-circle` is "Close" in a
dialog and "Remove" in a chip; `trash` is "Delete" in one row and "Move to bin" in another. A baked-in
title would be wrong most of the time, so the accessible name belongs at the usage site.

## Right-to-left

Icons with a **horizontal** direction should be mirrored under `dir="rtl"` — a "next" arrow points the
other way in Arabic or Hebrew. Vertical direction is not mirrored: `arrow-up` means the same thing
everywhere. Media transport is the standing exception — `forward` points right in every locale,
because playback direction is not reading direction.

This package ships **no mirror metadata** and does not read layout direction; a component library
cannot know whether a given instance sits in an RTL subtree. Apply it in CSS, where you do know:

```css
[dir="rtl"] .icon-mirror { transform: scaleX(-1); }
```

```tsx
<ArrowLeft className="icon-mirror" />
```

Tailwind users can use `rtl:-scale-x-100` instead of a custom class.

## Entry points

| Specifier | Contents |
|:--|:--|
| `@qeetrix/icons` | Every icon, plus the public types. **Use this.** |
| `@qeetrix/icons/icons/<category>/<name>` | A single icon module |

No internal paths are exposed. There is no `@qeetrix/icons/dist/…`, and there is no `/metadata`
subpath — the searchable catalogue was removed along with `icon-metadata.json`.

### Types

```ts
import type {
  QeetrixIcon, // any icon component — for wrappers and registries
  QeetrixIconProps, // the full prop surface, as a reference
  IconVariant, // "outline" | "solid"
  IconShape, // "round" | "sharp"
} from "@qeetrix/icons";
```

To hold an arbitrary icon, use `QeetrixIcon`:

```tsx
import type { QeetrixIcon } from "@qeetrix/icons";
import { ShieldTick, Trash } from "@qeetrix/icons";

const registry: Record<string, QeetrixIcon> = { verify: ShieldTick, delete: Trash };
```

> [!WARNING]
> Do **not** use `ComponentType<QeetrixIconProps>` for this — no icon is assignable to it. Props are
> contravariant, and every icon narrows both style axes, so a component accepting only `shape="round"`
> cannot stand in for one accepting `"round" | "sharp"`. `QeetrixIcon` omits the axes for exactly this
> reason.

### When to use the deep import

Almost never. `import { Search } from "@qeetrix/icons"` tree-shakes correctly in every modern bundler
— measured, not assumed. The deep import is an escape hatch for a toolchain that cannot shake ESM
barrels:

```tsx
import { Search } from "@qeetrix/icons/icons/interface/search";
```

Both forms produce a **byte-identical** bundle, so prefer the root import for readability.

> [!IMPORTANT]
> Deep imports take **no file extension**. The exports map is `"./icons/*" → "./dist/icons/*.js"`, so
> writing `.js` yourself resolves to `search.js.js` and fails to resolve.

## Bundle size

Measured with `bun build --minify`, React external:

| Import | Bundle |
|:--|--:|
| One icon, from the barrel | **1,544 bytes** |
| One icon, deep import | 1,544 bytes |
| The entire set (`import * as`) | 4.4 MB |

`sideEffects: false` plus one module per icon is what makes the first row possible. Importing one icon
costs one icon.

## Finding an icon

Run the example app — it renders all 1,166 from source with search, category, variant, size, colour
and background controls:

```bash
cd example && bun install && bun run dev
```

Names come from the source filenames, which follow the upstream artwork rather than a house style, so
search by concept and by category. A few worth knowing:

| You might look for | It is called |
|:--|:--|
| `delete`, `bin` | `trash` |
| `plus`, `new` | `add` |
| `x`, `cancel` | `close-circle`, `close-square` |
| `gear`, `cog` | `settings` |
| `shield-check`, `verified` | `shield-tick` |
| `checkbox` | `tick-square` |
| `hamburger` | `menu` |
| `sign-out`, `log-out` | `logout` |
| `unlock`, `lock-open` | `unlock` |
| `passkey`, `webauthn` | `finger-scan` |
