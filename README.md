<div align="center">

# 🎨 Qeetrix Icons

**The icon and brand logo library for Qeet Group products.**

1,863 Lucide icons in **round** and **sharp** shapes, **775 filled** variants, and **7,429 brand
logos**, as tree-shakeable, fully typed React 19 components, all from one import.

[![npm](https://img.shields.io/npm/v/@qeetrix/icons?style=flat-square&color=111111&label=npm)](https://www.npmjs.com/package/@qeetrix/icons)
[![CI](https://img.shields.io/github/actions/workflow/status/qeetgroup/qeetrix-icons/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/qeetgroup/qeetrix-icons/actions/workflows/ci.yml)
![Icons](https://img.shields.io/badge/icons-1%2C863-111111?style=flat-square)
![Filled](https://img.shields.io/badge/filled-775-111111?style=flat-square)
![Shapes](https://img.shields.io/badge/shapes-round%20%C2%B7%20sharp-111111?style=flat-square)
![Logos](https://img.shields.io/badge/brand%20logos-7%2C429-111111?style=flat-square)
![React](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tree-shakeable](https://img.shields.io/badge/tree--shakeable-yes-2E7D32?style=flat-square)

</div>

```tsx
import { TrashIcon, StarIcon, GithubLogo } from "@qeetrix/icons";

<TrashIcon />                                  // round outline
<StarIcon variant="filled" />                  // round filled
<TrashIcon shape="sharp" />                    // sharp outline
<StarIcon shape="sharp" variant="filled" />    // sharp filled
<GithubLogo height={32} aria-label="GitHub" /> // brand logo, exactly as published
```

> [!IMPORTANT]
> **Versions 1.0.5 and later are a new library.** They replace the 1.0.0–1.0.4 catalogue entirely
> with Lucide-based icons and brand logos. No earlier icon name, prop, type, or import path carries
> over. If you depend on the old set, pin `@qeetrix/icons@1.0.4` until you migrate.

---

## 📑 Contents

- [✨ Why Qeetrix Icons](#-why-qeetrix-icons)
- [📊 At a glance](#-at-a-glance)
- [📦 Installation](#-installation)
- [🚀 Quick start](#-quick-start)
- [🎨 Icons](#-icons)
- [🏷️ Brand logos](#️-brand-logos)
- [🔎 Catalogue and search](#-catalogue-and-search)
- [🔁 Coming from lucide-react](#-coming-from-lucide-react)
- [📐 Design rules](#-design-rules)
- [🧪 Playground](#-playground)
- [⚡ Performance and package size](#-performance-and-package-size)
- [🏗️ How it is built](#️-how-it-is-built)
- [✅ Quality](#-quality)
- [🛠️ Development](#️-development)
- [📚 Documentation](#-documentation)
- [🚢 Releases](#-releases)
- [⚖️ License](#️-license)

## ✨ Why Qeetrix Icons

[Lucide](https://lucide.dev) is a superb outline icon set, and [theSVG](https://thesvg.org)
collects thousands of brand logos. Qeetrix Icons turns them into one consistent, typed library for
every Qeet product (Qeet ID, Qeet Pay, Qeet Logs, Qeet Notify, Qeet People, Qeet AI) and adds what
neither provides:

- 🌓 **Filled variants.** Lucide is outline-only. 775 icons gain a filled drawing for selected,
  active, and favourite states, derived from the outline with Skia path operations and reviewed
  one by one, category by category.
- 🔷 **A complete sharp style.** Every icon, outline and filled, also comes with square caps,
  mitered joins, and squared corners, behind a single `shape` prop.
- 🧩 **One API for everything.** Icons and logos share naming, sizing, accessibility defaults, and
  typing. A `variant` the icon or logo doesn't have is a compile-time error.
- 🛡️ **Logos you can trust.** Every logo is embedded byte for byte as published, validated for
  safety, labelled with the background it is drawn for, and carries its own license metadata.
- 🔎 **Searchable catalogues.** Tags, categories, Lucide's former names, RTL behaviour, logo
  collections, colours, and licenses, published as data for docs sites and pickers.
- 🌲 **Zero runtime cost you didn't ask for.** No runtime dependencies, no hooks, no side
  effects: bundlers keep only the icons and logos you import.

## 📊 At a glance

| | |
|:--|:--|
| 🎨 **Icons** | 1,863 from Lucide 1.52.0, in Lucide's 42 categories, with Lucide's names and tags |
| 🔷 **Shapes** | `round` (Lucide's drawing, the default) and `sharp`, for every icon |
| 🌓 **Variants** | `outline` for every icon; `filled` for 775, in both shapes |
| 🏷️ **Brand logos** | 7,429 from theSVG 3.3.12: brands, community, auth badges, AWS, Azure, Google Cloud, Kubernetes |
| 🗂️ **Logo files** | 13,401 variants (default, mono, wordmark, light, dark, colour, …), embedded unmodified |
| 📐 **Grid** | 24 × 24, 2-unit stroke, 1-unit padding, `currentColor` |
| ⚛️ **Runtime** | React 19 peer dependency only; no runtime dependencies; no hooks |
| 📦 **Module format** | ESM with TypeScript declarations; every module free of side effects |
| ↔️ **RTL** | 18 reading-direction concepts flagged `mirror` in the catalogue |
| ✅ **Tests** | 638 tests in 11 suites, including a packed-tarball consumer test |

## 📦 Installation

```bash
bun add @qeetrix/icons
# or: npm install @qeetrix/icons
```

React 19 is the only peer dependency. The package ships compiled ESM with type declarations, so
it works in Vite, Next.js, TanStack Start, and React Server Components without extra setup.

## 🚀 Quick start

```tsx
import { BellIcon, SearchIcon, SettingsIcon, StarIcon } from "@qeetrix/icons";

export function Toolbar({ starred }: { starred: boolean }) {
  return (
    <nav className="flex items-center gap-3 text-zinc-700">
      <SearchIcon size={20} />
      <BellIcon variant="filled" aria-label="Notifications" />
      <StarIcon variant={starred ? "filled" : "outline"} className="text-amber-500" />
      <SettingsIcon shape="sharp" strokeWidth={1.5} />
    </nav>
  );
}
```

- 🎨 Icons draw in `currentColor`: they follow the text colour around them.
- 📏 `size` takes pixels or any CSS length; the default is 24.
- 🔷 Switch a whole UI to the sharp style by passing `shape="sharp"`, for example from your own
  wrapper or theme.

## 🎨 Icons

### 🔷 Shapes and variants

Every icon has two shapes, and some icons have two variants. Pick one with two props:

| | `variant="outline"` (default) | `variant="filled"` |
|:--|:--|:--|
| **`shape="round"`** (default) | `<StarIcon />` | `<StarIcon variant="filled" />` |
| **`shape="sharp"`** | `<StarIcon shape="sharp" />` | `<StarIcon shape="sharp" variant="filled" />` |

Filled drawings exist only where the solid form is clean and meaningful: badges, toggles, nav
items, devices, media, files, people, and many more. Open-line icons such as arrows, chevrons,
and text marks, and icons whose outline is clipped open around a badge, are outline-only by
design.

### 🎛️ Props

Every icon accepts the native `<svg>` props (including `ref`, `className`, `style`, and event
handlers) plus:

| Prop | Type | Default | |
|:--|:--|:--|:--|
| `size` | `number \| string` | `24` | Pixels or any CSS length. 14, 16, 20, 24, and 32 are recommended. |
| `variant` | `"outline" \| "filled"` | `"outline"` | Typed per icon to the drawings that exist. |
| `shape` | `"round" \| "sharp"` | `"round"` | Every icon has both. |
| `strokeWidth` | `number \| string` | `2` | Overrides the outline stroke (try 1.5 for dense UIs). |
| `aria-label` | `string` | | Names the icon for assistive technology. |

```tsx
<SearchIcon size={20} className="text-muted" />
<BellIcon variant="filled" aria-label="Notifications" />
<SettingsIcon shape="sharp" strokeWidth={1.5} />
<HeartIcon size="1.25em" style={{ color: "crimson" }} />
```

### 🔤 Naming

Each icon is one named export: its Lucide name in PascalCase plus `Icon`. Categories never appear
in names or import paths.

| Lucide name | Component |
|:--|:--|
| `trash` | `TrashIcon` |
| `circle-check` | `CircleCheckIcon` |
| `clock-12` | `Clock12Icon` |

Lucide's former names (`trash-2` for `trash`, for example) are listed in the catalogue for search
and migration, but are not exported.

### 🧷 Type safety

`variant` is narrowed per icon, so asking for a drawing that doesn't exist fails at compile time:

```tsx
<StarIcon variant="filled" />       // ✅ star has a filled drawing
<ArrowLeftIcon variant="filled" />  // ❌ type error: arrow-left is outline-only
```

To accept any icon, for example in a button component, type the prop as
`ComponentType<IconProps<"outline">>`: every icon has an outline drawing, so every icon fits.

```tsx
import type { ComponentType } from "react";
import type { IconProps } from "@qeetrix/icons";

function ToolbarButton({ icon: Icon, label }: { icon: ComponentType<IconProps<"outline">>; label: string }) {
  return (
    <button type="button" aria-label={label}>
      <Icon size={16} />
    </button>
  );
}
```

### ♿ Accessibility and RTL

- Icons are **decorative by default**: `aria-hidden="true"` and `focusable="false"`. A non-empty
  `aria-label` or `aria-labelledby` turns an icon into `role="img"`. Explicit props always win.
- Each icon's **directionality** is in the catalogue: `mirror` for reading-direction concepts
  such as undo, reply, send, log-in, and indentation, and `preserve` for everything else.
  Physical arrows and chevrons never mirror. The library never flips an icon itself; your RTL
  layer decides. See [docs/rtl.md](docs/rtl.md).

## 🏷️ Brand logos

```tsx
import { GithubLogo, SlackLogo, StripeLogo } from "@qeetrix/icons";

<GithubLogo />                                   // the default file, 24 px tall
<GithubLogo variant="wordmark" height={32} />     // any file the logo has
<SlackLogo height="2em" aria-label="Slack" />     // CSS lengths work too
<StripeLogo variant="mono" loading="lazy" />      // native <img> props pass through
```

Each logo renders its **published SVG file, unmodified**, as an `<img>`. Nothing in the artwork is
converted or recoloured; a test proves all 13,401 files are embedded byte for byte. Because each
logo is its own image, logos never clash with each other's styles or ids, and they work in Server
Components.

| Prop | Type | Default | |
|:--|:--|:--|:--|
| `variant` | per logo | the logo's default | `"default"`, `"mono"`, `"wordmark"`, `"light"`, `"dark"`, … Typed to the files that exist. |
| `height` | `number \| string` | `24` | Width follows the logo's own aspect ratio. |
| `width` | `number \| string` | from `height` | Give only `width` to derive `height` instead. |
| `alt` / `aria-label` | `string` | | Names the logo; otherwise it is decorative. |

Other native `<img>` props (`className`, `style`, `loading`, `decoding`, …) pass through. Logos
keep their brand colours by design, so CSS cannot recolour them.

### 🗂️ Names and collections

A logo's name is its slug in PascalCase plus `Logo`: `GithubLogo`, `GoogleCloudLogo`. Slugs that
start with a digit get a `Brand` prefix (`Brand1passwordLogo`). Icons always end in `Icon` and
logos in `Logo`, so the two families never collide.

| Collection | Logos |
|:--|--:|
| 🏢 Brands | 4,691 |
| 🔐 Auth badges | 860 |
| ☁️ AWS architecture | 739 |
| ☁️ Azure architecture | 626 |
| 👥 Community | 259 |
| ☁️ Google Cloud architecture | 214 |
| ☸️ Kubernetes architecture | 38 |
| 🗃️ Unlisted | 2 |

theSVG's own `light` and `dark` labels are inverted for most logos, so the catalogue records the
background each file is actually drawn for (`light`, `dark`, or `any`), measured from its colours.

> [!WARNING]
> **Every logo keeps its own license, and some restrict use.** Most are public domain (CC0) or
> permissive (MIT, Apache 2.0), but some are no-derivatives (all AWS icons), non-commercial,
> copyleft (GPL and similar), or have no copyright license at all. Logos are trademarks of their
> owners and are provided for identification only. Check a logo's license before shipping it:
> see [licenses/third-party-logos.md](licenses/third-party-logos.md) and
> [docs/logos.md](docs/logos.md#licensing-and-trademarks).

## 🔎 Catalogue and search

Machine-readable catalogues for docs sites, icon pickers, and tooling. They are never needed to
render, and the package root never imports them.

```ts
import { iconManifest, logoManifest } from "@qeetrix/icons/manifest";

// Icons tagged "delete", including Lucide's former names
const deleteIcons = iconManifest.icons.filter(
  ({ tags, aliases }) => tags.includes("delete") || aliases.includes("trash-2"),
);

// Icons with a filled drawing in the "account" category
const filledAccount = iconManifest.icons.filter(
  ({ categories, variants }) => categories.includes("account") && variants.includes("filled"),
);

// Public-domain brand logos with a wordmark
const wordmarks = logoManifest.logos.filter(
  ({ license, collection, variants }) =>
    license === "CC0-1.0" && collection === "brands" && variants.some(({ name }) => name === "wordmark"),
);
```

| Icon entry | Logo entry |
|:--|:--|
| `id`, `name`, `componentName` | `id`, `componentName`, `title` |
| `category`, `categories` | `collection`, `categories` |
| `variants`, `shapes` | `variants` (with `background`), `defaultVariant` |
| `tags`, `aliases` | `aliases`, `hex` (brand colour) |
| `directionality` | `license`, `website`, `guidelines`, `source` |

## 🔁 Coming from lucide-react

The artwork is Lucide's, so most screens move over with an import change:

| `lucide-react` | `@qeetrix/icons` |
|:--|:--|
| `import { Star } from "lucide-react"` | `import { StarIcon } from "@qeetrix/icons"` |
| `<Star size={20} strokeWidth={1.5} />` | `<StarIcon size={20} strokeWidth={1.5} />` (same props) |
| `<Star className="text-amber-500" />` | `<StarIcon className="text-amber-500" />` (same `currentColor`) |
| Outline only | Add `variant="filled"` where a filled drawing exists |
| Round only | Add `shape="sharp"` for the sharp style |
| Logos not included | `GithubLogo`, `SlackLogo`, … from the same package |

Names follow Lucide 1.52.0, so a few older lucide-react names differ (`Trash2` is `TrashIcon`
here); the catalogue's `aliases` field maps them. `absoluteStrokeWidth` is not supported.

## 📐 Design rules

Every derived drawing follows the same rules, so families look alike and nothing surprises you at
16 px.

| | Round filled | Sharp (outline and filled) |
|:--|:--|:--|
| 📏 **Footprint** | Same painted extent as the outline | Same drawing, square caps, mitered joins (miter limit 4) |
| 🧱 **Bodies and details** | Bodies solid; details cut as 2-unit negative lines | Small corner roundings become sharp corners; acute tips come to a point |
| ✂️ **Cuts that reach an edge** | Run straight through, so parts separate cleanly (calendar header, file dog-ear, mail flap) | Identical to round: both shapes part the same way |
| 🔗 **Attached parts** | Legs, handles, stands, cords stay joined | Line ends that stop on another stroke are trimmed so no cap pokes out |
| 🪟 **Layers** | Front parts sit in a 1-unit gap (clipboard clip, copy's front sheet, wheels) | Same roles as round, part for part |
| 🔲 **Border** | Inside Lucide's 1-unit padding | Never crosses it: a corner that would is cut flat, minimally, symmetrically |
| ⚪ **Dots** | Round holes | UI dots square (ellipsis, bullets, keys, pips); figurative dots round (eyes, spots, drops) |
| 🌿 **Organic shapes** | As the outline | Circles, faces, animals, fruit, hands, and coastlines stay round |
| 🔤 **Letters** | As the outline | An A's apex stays level with the letters beside it |

Where no rule gives a clean result, a reviewed, hand-drawn override takes the derivation's place.
Full detail: [docs/filled.md](docs/filled.md), [docs/sharp.md](docs/sharp.md), and
[docs/design.md](docs/design.md).

## 🧪 Playground

An internal, unpublished playground for browsing and visual review, with separate **Icons** and
**Logos** pages:

```bash
bun run playground
```

- 🎨 **Icons:** category sidebar, search across names, tags, and former names, Round/Sharp and
  variant switches, size, stroke, and colour controls, and an inspector with every shape and
  variant, real-size previews, construction grid, light/dark surfaces, RTL preview, and copyable
  JSX.
- 🏷️ **Logos:** collections, license and variant filters, a light/dark/transparent background
  switch, cards at each logo's true aspect ratio, and an inspector with every file on the
  background it's drawn for, license warnings, and brand links.
- ⌨️ **Everywhere:** a ⌘K command palette across icons and logos, shareable URLs, keyboard
  navigation, and light and dark themes.

## ⚡ Performance and package size

- 🌲 **Production builds include only what you import.** Every module is free of side effects and
  the root is a list of static re-exports, so bundlers drop every unused icon and logo. Tests
  bundle real consumers to prove it.
- 📥 **One import, everything included.** Importing `@qeetrix/icons` gives you all icons and logos.
  In Node (server rendering, test runners) the first import therefore loads every module:
  measured cold on a development laptop, about 20 s and 360 MB with the logos, against about
  1.8 s for icons alone. It is paid once per process.
- 🔥 **Dev servers** that pre-bundle a dependency's root, such as Vite and Next.js, process the whole
  package on the first start after installing or upgrading, then reuse their cache.
- 🪶 **Per-icon imports** are available when you need the leanest possible module graph:
  `import { TrashIcon } from "@qeetrix/icons/icons/trash"`.
- 📦 **Package:** about 10.7 MB packed and 50.7 MB unpacked, almost all of it logo data. Only
  compiled code and licenses ship; no source SVGs.

## 🏗️ How it is built

Every source file is written by a tool from a pinned upstream release, and everything generated
is committed, validated in CI, and reproducible.

```mermaid
flowchart LR
  L["Lucide 1.52.0"] -->|sync:lucide| RO["icons/round-outline"]
  RO -->|derive:filled| RF["icons/round-filled"]
  RO -->|derive:sharp| SO["icons/sharp-outline"]
  SO -->|derive:sharp| SF["icons/sharp-filled"]
  C["config/derived · config/overrides"] -.-> RF & SO & SF
  RO & RF & SO & SF -->|check:icons · generate| GI["src/generated/icons"]
  T["theSVG 3.3.12"] -->|sync:brands| B["icons/brand-icons"]
  B -->|check:brands · generate:logos| GL["src/generated/logos"]
  GI --> P["@qeetrix/icons"]
  GL --> P
```

- 🌓 **Filled drawings** are derived with CanvasKit (Skia) path operations from per-category recipes
  in [config/derived/](config/derived/README.md): bodies filled to the outline's painted extent,
  details cut as negative lines, crossing lines cleared by a gap. See
  [docs/filled.md](docs/filled.md).
- 🔷 **Sharp drawings** square corner roundings at their tangent intersections, point acute tips,
  and then fit the whole icon: nothing crosses the padding, no cap pokes past the stroke it ends
  on, joined strokes form one corner, and mirror twins get the same cut. See
  [docs/sharp.md](docs/sharp.md).
- ✍️ **Overrides:** 78 hand-drawn replacements in `config/overrides/` cover the few drawings rules
  cannot get right. Each is stamped with the SHA-256 of the outline it was drawn against, so a
  Lucide upgrade flags it for review instead of silently drifting.
- 🏷️ **Logos** are copied byte for byte from a pinned theSVG commit, validated (no scripts, event
  handlers, or external references), and embedded as lossless `data:` URIs. See
  [docs/logos.md](docs/logos.md).

### 🗃️ Repository layout

```text
config/
  derived/            Per-category tables: filled recipes and roles, keepRound, tipHeight
  overrides/          Hand-drawn, hash-stamped replacements for derived drawings
  lucide.json, brands.json, categories.ts, icon-system.ts, icon-metadata.ts, …
icons/
  round-outline/      Lucide outlines, unchanged
  round-filled/       Derived filled drawings
  sharp-outline/      Derived sharp outlines
  sharp-filled/       Derived sharp filled drawings
  brand-icons/        theSVG logo files, byte for byte
licenses/             Per-logo licenses and the Apache 2.0 text (shipped in the package)
scripts/              Sync, derivation, validation, and generation tools
src/
  index.ts            The package entry: every icon and logo
  manifest.ts         The catalogue entry: iconManifest and logoManifest
  generated/          Generated icon and logo modules, export lists, and catalogues
  runtime/, types/    The shared props helper, logo renderer, and public types
playground/           Internal visual QA app (not published)
tests/                Vitest suites, including a packed-tarball consumer test
docs/                 Design, API, pipeline, and process documentation
```

## ✅ Quality

- 🧾 **Validation:** every source SVG is checked against 24 rules (`QXI-*` codes): structure,
  allowed elements and attributes, paint, the grid, naming, categories, duplicates, and that every
  icon has all its drawings in both shapes. See [docs/validation.md](docs/validation.md).
- 🔲 **Border proof:** a test measures every sharp drawing with CanvasKit and fails if anything
  paints past the padding where the round drawing doesn't. The few curved ends too short to trim
  are listed with their measured overshoot, and none may get worse.
- 🔁 **Reproducibility:** `check:filled`, `check:sharp`, `check:generated`, and `check:logos` fail
  if any derived or generated file differs from what the tools produce.
- 📦 **Real consumers:** the package test packs the tarball, installs it in a fresh project,
  typechecks strict consumers under `bundler` and `nodenext` resolution, renders icons in both
  shapes, and bundles them to prove tree-shaking.
- 👀 **Visual review:** every filled and sharp drawing was reviewed by eye at 64, 24, and 16 px,
  category by category. See [docs/visual-qa.md](docs/visual-qa.md).

## 🛠️ Development

Bun only (1.3.14), strict TypeScript, ESM, Biome, and Vitest.

```bash
bun install
bun run lint && bun run typecheck && bun run test
```

| Area | Commands |
|:--|:--|
| ✅ Quality | `lint`, `typecheck`, `test`, `build` |
| 🎨 Icons | `sync:lucide [version]`, `derive:filled`, `derive:sharp`, `generate` |
| 🎯 One category | `derive:filled --category <id>`, `derive:sharp --category <id>` |
| ✍️ Overrides | `stamp:override <file>` |
| 🔍 Icon checks | `check:icons`, `check:filled`, `check:sharp`, `check:generated` |
| 🏷️ Logos | `sync:brands [commit]`, `generate:logos` |
| 🔍 Logo checks | `check:brands`, `check:logos` |
| 🧪 Playground | `playground`, `playground:build` |

Ground rules:

- 🚫 **Never hand-edit tool-written files**: `icons/`, `config/lucide.json`, `config/brands.json`,
  `config/categories.ts`, `src/generated/`, `icon-manifest.json`, or `licenses/third-party-logos.md`.
  Change the inputs and rerun the tool.
- 🔄 **`sync:lucide` and `sync:brands` leave the repository consistent**: they re-derive and
  regenerate everything downstream.
- ⬆️ **A missing or flawed outline belongs upstream** in Lucide; a filled or sharp result is changed
  through its category's file in [config/derived/](config/derived/README.md), an override, or the
  sharp rules.
- 🤖 **CI and the release gate run** lint, typecheck, tests, every `check:*` command, the build, and
  the playground build.

## 📚 Documentation

| Guide | |
|:--|:--|
| 🧩 [API](docs/api.md) | Entry points, props, types, the catalogue schema, and versioning |
| 📐 [Design](docs/design.md) | Grid, stroke, padding, and how filled and sharp drawings are formed |
| 🌓 [Filled drawings](docs/filled.md) | Roles, inference, recipes, overrides, and how to add a filled icon |
| 🔷 [Sharp style](docs/sharp.md) | Sharpening rules, fitting, kept-round elements, letter heights |
| 🏷️ [Brand logos](docs/logos.md) | Sync, catalogue, components, licensing, and performance |
| 🪶 [Lucide](docs/lucide.md) | What comes from Lucide, syncing, and upgrading |
| 🔤 [Naming](docs/naming.md) · ♿ [Accessibility](docs/accessibility.md) · ↔️ [RTL](docs/rtl.md) | Conventions |
| 🏗️ [Architecture](docs/architecture.md) · ⚙️ [Generation](docs/generation.md) · 🧾 [Validation](docs/validation.md) | How the pipeline works |
| 👀 [Visual QA](docs/visual-qa.md) · 🤝 [Contributing](docs/contributing.md) · 🚢 [Releases](docs/releases.md) | Process |

The full index is [docs/README.md](docs/README.md).

## 🚢 Releases

- 🏷️ **Published on npm** as [`@qeetrix/icons`](https://www.npmjs.com/package/@qeetrix/icons),
  with signed provenance from GitHub Actions, and as a GitHub Release for each version.
- 🔢 **Versioning:** the Version workflow raises the patch version on every pull request unless
  it is already raised; merging to `main` publishes that version, tags it, and opens the GitHub
  Release. A Rollback workflow moves the `latest` tag back to an earlier version.
- 📝 **Changes** are recorded in [CHANGELOG.md](CHANGELOG.md). Read
  [docs/releases.md](docs/releases.md) before any release work.

## ⚖️ License

- 💻 **Package code:** MIT © Qeet Group.
- 🎨 **Icons:** the artwork, the derived filled and sharp drawings, and the generated icon components
  are based on [Lucide](https://lucide.dev), ISC © Lucide Icons and Contributors. Some Lucide icons
  derive from Feather, MIT © Cole Bemis.
- 🏷️ **Brand logos:** each logo keeps its own license (public domain, permissive, attribution,
  share-alike, no-derivatives, non-commercial, copyleft, or none), listed in
  [licenses/third-party-logos.md](licenses/third-party-logos.md). theSVG's own code is MIT ©
  thesvg.org. Logos are trademarks of their owners, shown for identification only.

`package.json` declares `"license": "SEE LICENSE IN LICENSE"`; the full notices are in
[LICENSE](LICENSE).

### 🙏 Acknowledgements

Built on [Lucide](https://lucide.dev) and [Feather](https://feathericons.com) for the icons,
[theSVG](https://thesvg.org), [Simple Icons](https://simpleicons.org),
[svgl](https://svgl.app), and [Lobe Icons](https://github.com/lobehub/lobe-icons) for the logos,
and [Skia](https://skia.org)'s CanvasKit for the filled and sharp geometry.
