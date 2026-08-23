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

Icon names are `PascalCase` versions of their canonical kebab-case names: `arrow-left` is
`ArrowLeft`, `shield-check` is `ShieldCheck`. See [naming.md](naming.md).

There is no `<Icon name="search" />` string API, deliberately. Named imports are what makes
tree-shaking work: importing one icon ships **586 bytes** rather than the 76 KB of the whole set.

## Size

`size` sets width and height together. The default is `24`.

```tsx
<Search size={16} />
<Search size={20} />
<Search size={24} />
<Search size={32} />
```

It accepts any CSS length, not just numbers:

```tsx
<Search size="1.25rem" />
```

Or size with CSS, which scales with the surrounding type:

```tsx
<Search className="size-5" />
```

An explicit `width`/`height` wins over `size`, because both are just SVG attributes and the later
spread takes precedence:

```tsx
<Search size={20} width={40} />   {/* 40 wide, 20 tall */}
```

**Pick a size, do not scale with `transform`.** The icons are drawn on a 24-unit grid with a 2px
stroke; scaling with CSS transforms scales the stroke too and breaks the visual weight against
neighbouring text.

## Colour

Icons inherit colour from their parent through `currentColor`. Never set an icon's colour directly:

```tsx
<span className="text-red-600">
  <ShieldCheck />   {/* red */}
</span>

<button className="bg-brand text-white">
  <Check />         {/* white */}
</button>
```

This is why the set needs no dark-mode variant and no re-brand pass: a colour change anywhere above
the icon is inherited automatically. Validation rejects any hard-coded colour in a source SVG, so
this holds for every icon in the catalogue without exception.

## Stroke width

The default is `2`, which is the design system's standard weight.

```tsx
<Search strokeWidth={1.5} />
```

**When changing it is appropriate:** at large sizes (32px and above) a 2px stroke can look heavy, and
`1.5` reads better. A whole surface rendering icons at 48px may legitimately choose a lighter weight.

**When it is not:** do not vary stroke width between icons that sit next to each other. Two icons in
the same toolbar at different weights looks like a bug, not a choice. If you find yourself reaching
for `strokeWidth` on one icon in a row, the problem is usually the size, not the weight.

The library ships exactly one weight on purpose. There is no light or bold family.

## Styling

`className`, `style` and every standard SVG attribute pass straight through:

```tsx
<Search
  size={20}
  className="shrink-0 text-muted-foreground"
  style={{ opacity: 0.6 }}
  onClick={handleClick}
  data-testid="search-icon"
/>
```

`shrink-0` (or `flex-shrink: 0`) is worth knowing about: inside a flex container an SVG will
otherwise compress when space is tight.

Refs forward to the `<svg>` element:

```tsx
const ref = useRef<SVGSVGElement>(null);
<Search ref={ref} />
```

## Accessibility

An icon is **decorative by default** and carries `aria-hidden="true"`. Passing `aria-label` or
`aria-labelledby` makes it a named graphic — it gains `role="img"` and *loses* `aria-hidden`
automatically.

That automatic flip is the whole design. It makes the most common icon accessibility bug — an element
that is both `aria-hidden` and labelled, so the label is never announced — impossible to write.

### Icon beside visible text — do nothing

The text is already the label. A second announcement of the same thing is noise.

```tsx
<button type="button">
  <ArrowLeft size={20} />
  Back
</button>
```

Announced as: *"Back, button"*.

### Icon-only control — name the control, not the icon

```tsx
<button type="button" aria-label="Search">
  <Search size={20} aria-hidden="true" />
</button>
```

Announced as: *"Search, button"*.

`aria-hidden="true"` here is the default anyway, so you can omit it — it is written out above because
the pattern reads more clearly with the intent visible. What matters is that the **button** carries
the name. Naming the icon instead works, but names the graphic rather than the control, which is
worse for voice control.

### Standalone meaningful icon — name the icon

When the icon is the only thing conveying the information, it needs a name:

```tsx
<td>
  <ShieldCheck size={16} aria-label="Verified" />
</td>
```

Announced as: *"Verified, image"*.

### Opting out of the default

```tsx
<Search aria-hidden={false} />      {/* exposed, unnamed — rarely what you want */}
<Search role="presentation" />      {/* explicit role wins */}
```

### Why not put a `<title>` in the SVG

Because the same glyph means different things in different places. `x` is "Close" in a dialog and
"Remove" in a chip; `trash` is "Delete" in one row and "Move to bin" in another. A baked-in title
would be wrong most of the time, so the accessible name belongs at the usage site. Validation rejects
`<title>` in source SVGs for this reason.

### Verified patterns

The suite renders icons with axe inside buttons, links, labelled inputs, navigation lists, menus,
tooltip triggers, data-table cells and form validation messages. See `tests/icons/render.test.tsx`.

## Right-to-left

Icons with a **horizontal** direction should be mirrored under `dir="rtl"`. 72 of 331 icons are
marked; the flag is in the metadata:

```ts
import { icons } from "@qeetrix/icons/metadata";

const mirrors = new Set(icons.filter((i) => i.mirror).map((i) => i.component));
```

The package does **not** read layout direction or mirror anything itself — a component library cannot
know whether a given instance is inside an RTL subtree. Apply it in your own styling:

```tsx
<ChevronRight className="rtl:-scale-x-100" />
```

Two rules decide the flag, and the catalogue is validated against both:

- **Horizontal direction mirrors.** `arrow-left`, `chevron-right`, `log-out`, `reply`.
- **Vertical direction does not.** `arrow-up` means the same thing in every locale.
- **Media transport does not.** `skip-forward` points right everywhere; playback direction is not
  reading direction.

## Entry points

| Specifier | Contents |
|:--|:--|
| `@qeetrix/icons` | Every icon, plus `IconBase` and the spec constants. **Use this.** |
| `@qeetrix/icons/metadata` | The catalogue only — no components |
| `@qeetrix/icons/icons/<name>` | A single icon module |

No internal paths are exposed. There is no `@qeetrix/icons/dist/…`.

### When to use the deep import

Almost never. `import { Search } from "@qeetrix/icons"` tree-shakes correctly in every modern
bundler — verified, not assumed. The deep import exists as an escape hatch for a toolchain that does
not shake ESM barrels:

```tsx
import { Search } from "@qeetrix/icons/icons/search";
```

Both forms produce an identical 586-byte bundle, so prefer the root import for readability.

## The metadata entry point

`@qeetrix/icons/metadata` exists so that tooling can read the catalogue **without loading any icon
components**. Importing it costs 3.7 KB and pulls in no geometry.

```ts
import { icons, iconNames } from "@qeetrix/icons/metadata";
import type { IconMetadata } from "@qeetrix/icons";

// A picker, a docs search, a codemod's allowlist.
const security = icons.filter((icon) => icon.category === "security");
const supported = icons.filter((icon) => !icon.deprecated);
```

It is intended for icon pickers, documentation search, design tooling and codemods.

**It is not the runtime API for product UI.** Do not do this:

```tsx
// ✗ defeats tree-shaking and is not type-safe
const Icon = allIcons[someName];
```

Reaching for metadata to look up a component by string means the bundler can no longer tell which
icons you use, and you lose the compile-time guarantee that the name exists. Import the icons you
need by name.

### Shape

```ts
interface IconMetadata {
  name: string;          // canonical kebab-case name
  component: string;     // PascalCase export name
  category: string;      // browse metadata only
  tags: string[];        // search keywords
  aliases: string[];     // alternative names, unique across the catalogue
  mirror: boolean;       // flip under dir="rtl"
  deprecated?: {         // present only on icons scheduled for removal
    since: string;
    replacement: string | null;
    reason: string;
  };
}
```

`priority` is **not** in the published metadata. It exists only in this repository's authoring file to
drive the [coverage matrix](icon-catalog.md), because it describes our backlog rather than the icon.

## Finding an icon

```bash
bun run explorer && open .explorer/index.html
```

Search covers names, component names, categories, tags and aliases. Many words you would reach for
are aliases rather than names:

| You want | It is called |
|:--|:--|
| `delete`, `bin` | `trash` |
| `add`, `new` | `plus` |
| `close`, `cancel` | `x` |
| `gear`, `cog` | `settings` |
| `stop` | `square` |
| `checkbox` | `check-square` |
| `spinner` | `loader` |
| `hamburger` | `menu` |
| `sign-in` / `sign-out` | `log-in` / `log-out` |

The full list is in [icon-catalog.md](icon-catalog.md).

## Component API

See [api.md](api.md) for the complete prop reference, generated from the shipped types.
