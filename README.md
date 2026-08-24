<div align="center">

# ✨ Qeetrix Icons

### The Qeet Group icon library — one grid, two styles, every product

**1,166 icons** · **2,307 SVGs** · **20 categories** · outline + solid behind one prop

[![npm](https://img.shields.io/npm/v/@qeetrix/icons?style=flat-square&color=b45309)](https://www.npmjs.com/package/@qeetrix/icons)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)
[![react](https://img.shields.io/badge/react-%E2%89%A519-149eca?style=flat-square)](https://react.dev)

```tsx
import { ArrowLeft, ShieldTick, Trash } from "@qeetrix/icons";

<ArrowLeft />
<ShieldTick variant="solid" />
<Trash className="size-5 text-red-500" />
```

</div>

---

## ✨ What it is

Every component in this package holds its designer's SVG **byte for byte**. There is no shared
`<svg>` shell, no runtime, and no re-drawing — the markup you ship is the markup that was exported,
including `<g clip-path>`, `<defs>` and `<clipPath>`.

| | |
|:--|:--|
| **1,166 components** | One per icon name, generated from 2,307 source SVGs |
| **Two styles** | `outline` and `solid`, selected by a `variant` prop — not two exports |
| **24 × 24 grid** | Every icon shares one `viewBox`, so they align without nudging |
| **Themeable** | All visible paint routes through `currentColor` |
| **Tree-shakeable** | `sideEffects: false`, one module per icon |
| **Zero dependencies** | React ≥ 19 as the only peer |
| **Typed** | Each component narrows `variant` to the styles it actually ships |

---

## 🚀 Install

```bash
bun add @qeetrix/icons     # bun, as the rest of the workspace uses
npm  install @qeetrix/icons
pnpm add @qeetrix/icons
```

React ≥ 19 is a peer dependency and is not bundled.

---

## 🎨 Props

Every icon accepts **everything valid on an `<svg>` element**, plus `variant`:

```ts
type Props = React.SVGProps<SVGSVGElement> & { variant?: "outline" | "solid" };
```

That is the whole API. There is no custom prop surface to learn — `className`, `style`, `width`,
`height`, `color`, every `aria-*` attribute, every event handler and `ref` all work because they land
on the root `<svg>`.

### The props you will actually reach for

| Prop | Type | Default | What it does |
|:--|:--|:--|:--|
| `variant` | `"outline" \| "solid"` | `"outline"` | Which style to draw. Narrowed per icon — see [Variants](#-variants). |
| `color` | `string` | `"white"` | Retints the whole glyph. **This is the colour knob.** |
| `width` / `height` | `number \| string` | `24` | Rendered size. Set both. |
| `className` | `string` | — | Beats `color` and `width`/`height`, so utility classes win. |
| `style` | `CSSProperties` | — | Highest priority; use for one-off inline colour. |
| `aria-label` + `role="img"` | `string` | — | Makes the icon meaningful to a screen reader. |
| `aria-hidden` | `boolean` | — | Hides a decorative icon. See [Accessibility](#-accessibility). |

Props spread **last** onto the root `<svg>`, so anything you pass overrides the built-in default.

### ⚠️ Two props that do *not* work the way you would guess

**`fill` does nothing to the artwork.** Visible paths carry their own `fill="currentColor"`, and an
explicit fill on a child beats an inherited one from the root. Use `color`.

```tsx
<ArrowLeft fill="red" />      // ❌ no visible effect
<ArrowLeft color="red" />     // ✅ correct
```

**`size` is not a prop.** It was in an earlier version and is gone. Passing it emits an invalid
`size="20"` attribute and does not resize anything.

```tsx
<ArrowLeft size={20} />                 // ❌ invalid attribute, no effect
<ArrowLeft width={20} height={20} />    // ✅ correct
<ArrowLeft className="size-5" />        // ✅ also correct (Tailwind)
```

---

## 🌗 Colour, dark mode and light mode

Icons ship **white** by default, matching the source artwork. All visible geometry paints
`currentColor`, and the root carries `color="white"`:

```tsx
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" color="white" {...props}>
  <path d="M15 22.75H9C3.57…" fill="currentColor" />
</svg>
```

So one value controls the entire glyph. Four ways to set it, in increasing priority:

```tsx
<ArrowLeft />                             // 1. white — the built-in default
<ArrowLeft color="black" />               // 2. any CSS colour, via a prop
<ArrowLeft className="text-red-500" />    // 3. a class — CSS outranks the default
<ArrowLeft style={{ color: "tomato" }} /> // 4. inline style — highest priority
```

`color` is a *presentation attribute*, which CSS outranks by design. That is what makes the class
form work without `!important`.

### Automatic dark / light mode

Because the paint follows `color`, a theme class is all you need:

```tsx
// Tailwind — flips with the `dark` class or prefers-color-scheme
<ShieldTick className="text-zinc-900 dark:text-zinc-100" />

// Or inherit the surrounding text, whatever the theme set it to
<ShieldTick color="currentColor" />
```

```css
/* Plain CSS — one rule themes every icon inside */
.app        { color: #18181b; }
.app.dark   { color: #fafafa; }
```

> [!TIP]
> `color="currentColor"` makes the icon inherit from its parent instead of defaulting to white —
> usually what you want inside buttons and links, so the icon matches the label automatically.

> [!NOTE]
> A white icon on a white background is invisible. That is correct behaviour, not a bug. If icons
> "disappear", set `color` or a text class.

---

## 🔀 Variants

One component per icon name; the style is a prop, not a separate export:

```tsx
import { Activity } from "@qeetrix/icons";

<Activity />                    // outline — the default
<Activity variant="outline" />  // the same thing, explicit
<Activity variant="solid" />    // solid
```

**1,141 of 1,166** icons ship both styles. The rest ship one, and the type reflects it — so a
single-style icon rejects the variant it does not have, at compile time:

| Coverage | Count | `variant` accepts |
|:--|--:|:--|
| Both styles | 1,141 | `"outline" \| "solid"` |
| Outline only | 13 | `"outline"` |
| Solid only | 12 | `"solid"` |

```tsx
<Litecoin variant="solid" />        // ❌ TS error: outline-only icon
<PresentionChart variant="solid" /> // ✅ solid-only icon, and its default
```

The default is `outline` wherever an outline exists, otherwise the icon's only style.

---

## 📂 Categories

Category comes from the source directory, never from a metadata file, so it cannot drift.

| Category | Icons | Category | Icons |
|:--|--:|:--|--:|
| `interface` | 269 | `devices` | 48 |
| `seasonal` | 120 | `editing` | 43 |
| `media` | 83 | `security` | 27 |
| `crypto` | 71 | `travel` | 27 |
| `files` | 67 | `social` | 25 |
| `arrows` | 64 | `people` | 24 |
| `finance` | 60 | `shopping` | 21 |
| `communication` | 58 | `time` | 21 |
| `nature` | 51 | `data` | 20 |
| `design` | 49 | `location` | 18 |

---

## 📦 Import surface

| Entry point | Contents |
|:--|:--|
| `@qeetrix/icons` | Every icon, plus the `QeetrixIconProps` and `IconVariant` types |
| `@qeetrix/icons/icons/<category>/<name>` | One icon, bypassing the barrel |

```tsx
// Named import from the barrel — tree-shaking drops the rest
import { ArrowLeft, ShieldTick } from "@qeetrix/icons";

// Deep import, if your bundler is weak at tree-shaking a large barrel
import { ArrowLeft } from "@qeetrix/icons/icons/arrows/arrow-left";

// Types
import type { QeetrixIconProps, IconVariant } from "@qeetrix/icons";
```

Both forms produce the same component. `sideEffects: false` plus one module per icon means importing
one icon costs one icon.

> [!IMPORTANT]
> Deep imports take **no file extension**. The exports map is `"./icons/*" → "./dist/icons/*.js"`, so
> adding `.js` yourself resolves to `arrow-left.js.js` and fails:
>
> ```tsx
> import { ArrowLeft } from "@qeetrix/icons/icons/arrows/arrow-left.js"; // ❌ not found
> import { ArrowLeft } from "@qeetrix/icons/icons/arrows/arrow-left";    // ✅
> ```

---

## 💡 Examples

### In a button

```tsx
import { Trash } from "@qeetrix/icons";

<button type="button" className="flex items-center gap-2 text-red-600">
  <Trash width={16} height={16} color="currentColor" aria-hidden="true" />
  Delete
</button>
```

The icon inherits the button's red because of `color="currentColor"`, including on hover.

### A typed wrapper

```tsx
import type { ComponentType } from "react";
import type { QeetrixIconProps } from "@qeetrix/icons";

type ButtonProps = {
  icon: ComponentType<QeetrixIconProps>;
  label: string;
};

export function IconButton({ icon: Icon, label }: ButtonProps) {
  return (
    <button type="button" aria-label={label}>
      <Icon width={20} height={20} color="currentColor" aria-hidden="true" />
    </button>
  );
}

// <IconButton icon={ShieldTick} label="Verify" />
```

### Switching variant on state

```tsx
import { Heart } from "@qeetrix/icons";

export function Like({ liked }: { liked: boolean }) {
  return (
    <Heart
      variant={liked ? "solid" : "outline"}
      color={liked ? "#e11d48" : "currentColor"}
      aria-label={liked ? "Liked" : "Not liked"}
      role="img"
    />
  );
}
```

Solid-when-active is exactly what the two styles are for.

### Sizing with Tailwind

```tsx
<ArrowLeft className="size-4" />   {/* 16px */}
<ArrowLeft className="size-5" />   {/* 20px */}
<ArrowLeft className="size-6" />   {/* 24px */}
```

Tailwind's `size-*` sets `width`/`height` in CSS, which outranks the baked-in `24` attributes.

---

## ♿ Accessibility

An icon is either decorative or meaningful, and the two are marked differently. The package does not
guess — you say which.

**Decorative** — next to a visible text label. Hide it, so a screen reader does not read the label
twice:

```tsx
<button type="button">
  <Trash width={16} height={16} aria-hidden="true" />
  Delete
</button>
```

**Meaningful** — the icon *is* the label. Give it an accessible name and an image role:

```tsx
<button type="button">
  <Trash width={16} height={16} role="img" aria-label="Delete" />
</button>
```

> [!IMPORTANT]
> `aria-label` alone is not enough. An `<svg>` has no implicit role, so screen readers may ignore the
> label — pair it with `role="img"`.

### Right-to-left

Directional glyphs need flipping under `dir="rtl"`; symmetric ones must not be touched. Handle it in
CSS where you know the direction:

```css
[dir="rtl"] .icon-mirror { transform: scaleX(-1); }
```

```tsx
<ArrowLeft className="icon-mirror" />
```

---

## 🏗 How it works

```
icons/<style>/<category>/<name>.svg      ← source, hand-committed, never modified
        │
        │   scripts/generate.mjs         ← the only script
        ▼
src/icons/<category>/<name>.tsx          ← one component, all variants
src/icons/index.ts                       ← barrel, grouped by category
        │
        │   tsc
        ▼
dist/                                    ← what ships
```

The generator changes exactly three things and nothing else:

1. Seven kebab-case attributes take their JSX spelling (`clip-path` → `clipPath`) — JSX has no other
   way to write them.
2. `{...props}` is appended to the root `<svg>`.
3. On **visible** geometry only, `fill`/`stroke` of `white` become `currentColor`, and the root gains
   `color="white"`.

The 2,175 `<rect fill="white">` elements inside `<clipPath>` are masks — never painted — so they keep
their authored value. Path data, ids, `viewBox` and element order are untouched.

`bun run generate:check` fails if any committed component has drifted from its source SVG, and CI
runs it on every PR.

---

## 🛠 Develop

```bash
bun install

bun run generate        # rebuild src/icons from icons/**.svg
bun run generate:check  # fail if a component drifted from its source
bun run test            # 2,388 tests
bun run typecheck
bun run lint            # biome
bun run format          # biome --write
bun run build           # dist/
```

### Adding an icon

Drop the SVG at `icons/<style>/<category>/<name>.svg`, then:

```bash
bun run generate
```

The component, the barrel export and the type all follow from the filename —
`arrow-left.svg` → `ArrowLeft`. Nothing else to register.

> [!WARNING]
> An icon's component name is its public API. Renaming a source file renames an export and breaks
> every consuming build, so it is a **major** release. Get the name right when the file lands.

### Checking the icons render

```bash
cd example && bun install && bun run dev
```

Renders all 1,166 icons from `../src` — the working tree, not `dist/` — with controls for variant,
size, colour and background. This is the check unit tests cannot do: jsdom does not resolve SVG
presentation attributes, so the white default needs a real browser. See
[example/README.md](./example/README.md).

### Tests

One file, `tests/icons.test.tsx`, 2,388 assertions. The important 2,307 of them reconstruct each
source SVG from the rendered DOM and compare it tag by tag, attribute by attribute — so
"the SVG is unchanged" is enforced, not merely intended.

---

## 🚢 Releases

| Step | What happens |
|:--|:--|
| Open a PR | `version.yml` bumps the patch version on your branch — visible in the diff |
| Merge to `main` | `release.yml` publishes to npm, **then** tags `vX.Y.Z` and opens a Release |
| Bad release | `rollback.yml` points `latest` back at an older version |

Want a minor or major? Set `version` in `package.json` by hand and the bump leaves it alone. A merge
that does not change the version publishes nothing. Full detail in [docs/releases.md](./docs/releases.md).

---

## 📚 Docs

| | |
|:--|:--|
| [docs/usage.md](./docs/usage.md) | Consuming the package |
| [docs/releases.md](./docs/releases.md) | Versioning, publishing, rollback |
| [docs/contributing.md](./docs/contributing.md) | Adding and changing icons |
| [docs/naming.md](./docs/naming.md) | Why names are frozen, and how to choose one |
| [docs/icon-guidelines.md](./docs/icon-guidelines.md) | Drawing conventions |
| [example/](./example/) | Visual check for the whole set |

---

## 📄 License

MIT © Qeet Group. See [LICENSE](./LICENSE).

<div align="center">
<sub>Part of the <a href="https://github.com/qeetgroup">Qeet Group</a> suite — one philosophy, many products.</sub>
</div>
