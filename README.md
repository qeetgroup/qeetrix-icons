<div align="center">

# ✨ Qeetrix Icons

### The Qeet Group icon library — one grid, one stroke, every product

*Outline · Tree-shakeable · Accessible by default · Generated from canonical SVG*

<br>

[![CI](https://github.com/qeetgroup/qeetrix-icons/actions/workflows/ci.yml/badge.svg)](https://github.com/qeetgroup/qeetrix-icons/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=fff)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=fff)
![Bun](https://img.shields.io/badge/Bun-1.3-F69220?logo=bun&logoColor=fff)
![Biome](https://img.shields.io/badge/Biome-2-60A5FA?logo=biome&logoColor=fff)
![License](https://img.shields.io/badge/License-MIT-green)

**[🚀 Install](#-install)** · **[🎨 Usage](#-usage)** · **[🔎 Find an icon](#-finding-an-icon)** · **[♿ Accessibility](#-accessibility)** · **[🏗 How it works](#-how-it-works)** · **[🛠 Develop](#-develop)**

| | | | |
|:---:|:---:|:---:|:---:|
| 🎯 **331** icons | 📂 **22** categories | 📦 **0** runtime deps | 🌳 **586 B** for one icon |

> **Status — Phase 3.** A complete enterprise catalogue: **331 icons** across 22 categories,
> 298 of them rated essential or highly useful. One visual language, every glyph reviewed at
> 16/20/24/32px. See the [coverage matrix](docs/icon-catalog.md).

</div>

---

## ✨ What it is

A React icon library where **the SVG file is the source of truth**. Everything else — the components,
the exports, the metadata, the types — is generated from `icons/<category>/<name>.svg` and validated
on the way through.

| | |
|:--|:--|
| **One family, not a pile** | A written [visual language](docs/icon-design-system.md) — shared motifs, one badge radius, 45° diagonals — so the set coheres. |
| **Governed, not accumulated** | Enforced naming (`user-plus`, never `add-user`), unique aliases, and a [catalogue doctor](docs/contributing.md) that reports duplicate semantics. |
| **One grid** | Every icon is 24 × 24, 2px stroke, round caps. Enforced, not requested. |
| **Inherits colour** | `currentColor` throughout. Works in dark mode and after a re-brand with no icon-specific styling. |
| **Adding an icon is one file** | Drop in an SVG, run `bun run generate`. The component, export and metadata appear. |
| **Invalid icons fail the build** | 30 error rules, 4 warnings. A hard-coded colour, a `transform`, or a stray editor `<title>` cannot ship. |
| **Genuinely tree-shakeable** | One icon bundles to **586 B**; all 331 to 76 KB — 0.8%. Verified with a real bundler, not assumed. |
| **Accessible by default** | Decorative unless you name it, and it is impossible to produce a labelled-but-hidden icon. |

---

## 🚀 Install

```bash
bun add @qeetrix/icons
```

React 19 or later is a peer dependency. There are no runtime dependencies.

---

## 🎨 Usage

```tsx
import { ArrowLeft } from "@qeetrix/icons";

export function BackButton() {
  return (
    <button type="button">
      <ArrowLeft size={20} />
      Back
    </button>
  );
}
```

### Sizing

`size` sets width and height together. The default is `24`.

```tsx
<ArrowLeft size={16} />
<ArrowLeft size={20} />
<ArrowLeft size={24} />
<ArrowLeft size="1.5rem" />   {/* any CSS length */}
```

Or size it with CSS, which scales with the surrounding type:

```tsx
<ArrowLeft className="size-5" />
```

### Colour

Never set an icon's colour directly — it inherits from `currentColor`:

```tsx
<span className="text-red-600">
  <ShieldCheck />   {/* red */}
</span>

<button className="text-white bg-brand">
  <Check />         {/* white */}
</button>
```

This is why the set needs no dark-mode variant and no re-brand pass.

### Stroke weight

```tsx
<ArrowLeft strokeWidth={1.5} />   {/* lighter, for large sizes */}
```

### Everything else

Props are `React.SVGProps<SVGSVGElement>` plus `size`, so every standard SVG and React attribute
works — `className`, `style`, `onClick`, `data-*`, `ref`, all `aria-*`:

```tsx
<ArrowLeft
  size={20}
  className="shrink-0 text-muted-foreground"
  aria-label="Go back"
  onClick={goBack}
/>
```

### Types

```ts
import type { QeetrixIconProps } from "@qeetrix/icons";

type QeetrixIconProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
};
```

> Named `QeetrixIconProps`, not `IconProps`, because `@qeetrix/ui` already exports an `IconProps` for
> its `<Icon icon={…}>` wrapper. Distinct names let a consumer re-export both packages from one barrel.

### Metadata

For an icon picker, a docs search, or any catalogue UI — importable **without** pulling in a single
component:

```ts
import { icons, iconNames } from "@qeetrix/icons/metadata";

icons.find((icon) => icon.name === "search");
// {
//   name: "search",
//   component: "Search",
//   category: "interface",
//   tags: ["find", "magnifier", "lookup", "query", "filter"],
//   aliases: ["magnifying-glass"],
//   mirror: true,
// }
```

`mirror` marks glyphs that must flip under `dir="rtl"` — horizontal directions only, since `arrow-up`
means the same thing in both reading directions. It is metadata, not behaviour: this package does not
read layout direction, so apply it yourself (`rtl:-scale-x-100`, or swap the icon).

---

## 📂 Categories

The category is the source directory and is **browse metadata only** — it is never part of an icon's
export name, so moving an icon between categories is not a breaking change.

| Category | Icons |
|:--|--:|
| `accessibility` | 6 |
| `arrows` | 13 |
| `communication` | 25 |
| `data` | 14 |
| `design` | 8 |
| `development` | 12 |
| `devices` | 16 |
| `editing` | 26 |
| `files` | 34 |
| `finance` | 12 |
| `hardware` | 1 |
| `interface` | 35 |
| `maps` | 2 |
| `media` | 14 |
| `navigation` | 19 |
| `notifications` | 5 |
| `security` | 18 |
| `social` | 7 |
| `status` | 13 |
| `time` | 14 |
| `users` | 16 |
| `utilities` | 21 |

The category is the source directory and is **browse metadata only** — it is never part of an icon's
export name, so moving an icon between categories is not a breaking change.

Directional glyphs carry a `mirror` flag for RTL: 72 of 331 icons are marked. Vertical direction never
mirrors, and media transport controls deliberately do not either — playback direction is not reading
direction.

---

## 🔎 Finding an icon

At this size, searching first is the difference between a coherent catalogue and a pile.

```bash
bun run explorer && open .explorer/index.html
```

The explorer is a single static file with the whole catalogue inlined — no server, no build step.

| | |
|:--|:--|
| **Search** | Names, component names, categories, tags and aliases, with deterministic ranking: exact name → prefix → alias → component → substring → tag → category |
| **Filter** | Category, coverage priority, mirror-only |
| **Preview** | 16 / 20 / 24 / 32 / 48 / 64 px, on light or dark, grid or list |
| **Detail** | Full metadata plus copyable import, JSX and component name |
| **Linkable** | `#icon=shield-check`, `#q=lock&category=security` — every view is shareable |
| **Keyboard** | Tab and Enter throughout, arrow keys across the grid, `/` to focus search, Escape to close |

Or read the [coverage matrix](docs/icon-catalog.md), which lists every icon with its tags and
aliases. Search the **aliases** too — many words you would reach for are aliases rather than names:

| You want | It is called |
|:--|:--|
| `delete`, `bin` | `trash` |
| `add`, `new` | `plus` |
| `close`, `cancel` | `x` |
| `gear`, `cog` | `settings` |
| `stop` | `square` |
| `sign-in` / `sign-out` | `log-in` / `log-out` |
| `checkbox` | `check-square` |
| `hamburger` | `menu` |
| `spinner` | `loader` |

Programmatically, `@qeetrix/icons/metadata` carries the same data:

```ts
import { icons } from "@qeetrix/icons/metadata";

const match = (q: string) =>
  icons.filter((i) => i.name.includes(q) || i.tags.includes(q) || i.aliases.includes(q));
```

---

## ♿ Accessibility

An icon is **decorative by default** and carries `aria-hidden="true"`. Passing `aria-label` or
`aria-labelledby` automatically makes it a named graphic (`role="img"`) and drops `aria-hidden`.

That automatic flip is the design: it makes the usual silent bug — an element that is both
`aria-hidden` and labelled, so the label is never announced — impossible to write.

**Icon beside visible text** — decorative. The text is the label; do nothing.

```tsx
<button type="button">
  <ArrowLeft size={20} />
  Back
</button>
```

**Icon-only control** — name the *control*, not the icon.

```tsx
<button type="button" aria-label="Delete row">
  <Trash size={16} />
</button>
```

**Standalone meaningful icon** — nothing else conveys it, so name the icon.

```tsx
<ShieldCheck size={16} aria-label="Verified" />
```

**Opting out** — pass `aria-hidden={false}` or an explicit `role`.

The suite verifies these patterns with axe inside buttons, links, inputs, navigation, menus,
tooltips, data tables and form validation messages.

Do **not** put a `<title>` in a source SVG to name an icon. The same glyph means different things in
different places — `x` is "Close" in a dialog and "Remove" in a chip — so the name belongs at the
usage site.

---

## 🏗 How it works

The SVG source is canonical. Everything downstream is derived:

```text
icons/arrows/arrow-left.svg
  ↓  bun run generate
src/icons/arrow-left.tsx          export function ArrowLeft(props: QeetrixIconProps)
src/icons/index.ts                export { ArrowLeft } from "./arrow-left.js";
src/metadata.ts                   { name: "arrow-left", component: "ArrowLeft", … }
  ↓  bun run build
dist/icons/arrow-left.js + .d.ts
```

Generated files are **committed** — a reader sees real component source, and a diff shows exactly
what an icon change did to the public API. `bun run generate:check` proves they still match the
generator, and CI runs it before the build so a hand-edit is caught rather than overwritten.

Output is deterministic: no timestamps, and all ordering by explicit codepoint comparison rather than
`localeCompare`, so a tracked file's byte order never depends on the machine that produced it.

### Layout

```text
icons/                  ← source of truth, 22 categories
icon-metadata.json      ← tags, aliases, RTL mirror flags, coverage priority
scripts/
  validate.mjs          ← bun run validate
  generate.mjs          ← bun run generate [--check]
  explorer.mjs          ← bun run explorer
  catalog.mjs           ← bun run catalog [--check]
  api-docs.mjs          ← bun run api [--check]
  verify-package.mjs    ← bun run verify:package
  doctor.mjs            ← bun run doctor
  clean.mjs
  config/               categories · package-size baseline · consumer fixture
  lib/                  discover · svg · rules · naming · emit · io · pipeline · search
src/
  index.ts              ← public barrel (hand-written)
  types.ts              ← QeetrixIconProps, IconMetadata (hand-written)
  icon-base.tsx         ← the shared <svg> shell + a11y contract (hand-written)
  metadata.ts           ← GENERATED
  icons/                ← GENERATED, one module per icon
tests/
  fixtures/             valid + invalid SVGs, outside icons/ on purpose
  icons/ metadata/ build/ visual/ explorer/
docs/                   icon-catalog · icon-design-system · icon-guidelines · naming · contributing
```

### Import surface

| Specifier | Resolves to |
|:--|:--|
| `@qeetrix/icons` | Every icon, plus `IconBase` and the spec constants |
| `@qeetrix/icons/metadata` | The catalogue only — no components |
| `@qeetrix/icons/icons/arrow-left` | A single icon, for bundlers with weak tree-shaking |

No internal paths are exposed. There is no `@qeetrix/icons/dist/…`.

---

## ✅ Validation

`bun run validate` enforces the specification in
**[docs/icon-guidelines.md](docs/icon-guidelines.md)**. Errors fail the build; warnings do not.

Rejected: a `viewBox` other than `0 0 24 24` · `width`/`height` on the root · missing or wrong root
spec attributes · hard-coded colours · `transform` anywhere · raster or `data:` content · external
references · `<style>` or `style=` · editor metadata · `id` and `class` attributes · elements or
attributes outside the allowlist · stray text · `DOCTYPE` or CDATA · empty icons · bad filenames ·
unknown categories · duplicate names · component-name collisions · orphan metadata · aliases claimed
twice or colliding with an icon name · an invalid `priority`.

Colour is checked by **allowlist** — only `none`, `currentColor`, `inherit` and `transparent` are
accepted — so `#f26d0e`, `rgb(0 0 0)`, `oklch(…)` and all 148 CSS colour names are caught without any
of them appearing in the rule set.

`bun run doctor` adds the catalogue-scale checks: duplicate semantics, half-finished families, naming
drift, category imbalance, thin or spammy tags. It is advisory and exits 0 — those are judgement
calls, and a check that blocked a merge over a naming opinion would just get switched off.

---

## 🛠 Develop

```bash
bun install
bun run validate      # check every source SVG
bun run generate      # regenerate components, barrel and metadata
bun run explorer       # build the explorer and review sheets, then open .explorer/index.html
bun run catalog       # regenerate docs/icon-catalog.md
bun run doctor        # catalogue health report (advisory)
bun run typecheck
bun run lint          # Biome — lint and format
bun run test
bun run build         # clean → generate → tsc → tsc-alias
```

### The icon explorer

`bun run explorer` writes three artifacts to `.explorer/` (gitignored):

| | |
|:--|:--|
| `index.html` | The **icon explorer** — ranked search over names, tags and aliases; category, priority and mirror filters; grid or list; preview at 16/20/24/32/48/64; light and dark preview; copy import, JSX or component name; deep-linkable |
| `contact-sheet.svg` | The whole set on one page. The only way to catch an icon that looks wrong *beside its siblings* |
| `small-sizes.svg` | Every icon at all four sizes. 16px is where glyphs fall apart |

The last two exist because the most common icon defect is not invalidity — it is an icon that is
individually fine and collectively wrong. Every glyph in this catalogue was reviewed this way, and
that review is what caught `settings` reading as a sun, `undo`/`reply` sharing a silhouette, and the
`mail-*` badges colliding with the envelope.

Tooling: **bun**, **Biome 2**, **Vitest 4**, **Changesets**, and plain **`tsc`** for the build — no
bundler, which suits a package whose ideal output is one module per icon anyway. This mirrors
`@qeetrix/ui`; there is no ESLint and no Prettier anywhere in the workspace.

CI runs two jobs. `verify` covers
`validate → generate:check → build → typecheck → lint → test → explorer → catalog:check → api:check → doctor`.
`package` runs `verify:package` on its own, so a slow install and bundle measurement does not gate
every review.

**Docs**

| | |
|:--|:--|
| [docs/usage.md](docs/usage.md) | **Start here as a consumer** — install, sizing, colour, accessibility, entry points |
| [docs/api.md](docs/api.md) | Complete prop reference, generated from the shipped types |
| [docs/icon-catalog.md](docs/icon-catalog.md) | **The coverage matrix** — every icon, its priority, tags, aliases and RTL flag. Search this before adding one |
| [docs/releases.md](docs/releases.md) | Changesets, what each bump means, deprecation policy |
| [docs/icon-design-system.md](docs/icon-design-system.md) | The visual language — grid bands, stroke density, shared motifs, small-size rules |
| [docs/icon-guidelines.md](docs/icon-guidelines.md) | The technical spec and every validation rule |
| [docs/naming.md](docs/naming.md) | Naming governance, and tags vs aliases |
| [docs/contributing.md](docs/contributing.md) | Adding an icon, adding a rule, conventions |

---

## 🔭 What's next

Phase 3 delivered enterprise coverage. Phase 4 should build:

- **`@qeetrix/ui` migration** — replace `lucide-react` and the 10 placeholder brand glyphs. The prop
  shape is already drop-in compatible, so this is a swap plus a codemod. Land the Tailwind v4 syntax
  migration sitting uncommitted in that repo first.
- **Qeet-domain icons** — SAML, OIDC, SCIM, webhook, audit-log, tenant, GST. Deferred deliberately:
  they need product review, not just drawing.
- **Coverage audit against real screens** — walk actual Qeet product UIs and record what is still
  missing, rather than guessing at the next hundred.
- **Discovery surfaces** — an icon browser in `qeetrix-docs` and Storybook stories, both fed by
  `@qeetrix/icons/metadata`.
- **Figma library** published from the same canonical SVG, so design and code cannot drift.
- **Prove `1.0.0` against a real consumer.** The API is frozen as of 1.0.0 but has not yet
  been exercised by a product; the migration is where any awkwardness will surface.

---

## 📄 License

[MIT](LICENSE). The artwork is original to Qeet Group — nothing in this repository is derived from
lucide, Feather, Heroicons, Material Icons, Font Awesome, Phosphor, Tabler or any other icon set.

Part of the **[Qeet Group](https://github.com/qeetgroup)** workspace, alongside
[`@qeetrix/ui`](https://github.com/qeetgroup/qeetrix-ui).
# qeetrix-icons
