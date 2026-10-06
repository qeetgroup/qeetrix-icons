# Public API

The contract for consuming `@qeetrix/icons` 2.0. It is implemented and tested against a packed
tarball. The package exports the 1,863 Lucide icons of the pinned release
([lucide.md](lucide.md)) as React 19 components. Every icon has two shapes, round (Lucide's
drawing) and sharp ([sharp.md](sharp.md)), and 794 icons also have a filled drawing in each shape
([filled.md](filled.md)). It also exports 7,429 brand logos from theSVG and the first-party `QeetLogo` and `QeetWordmarkLogo` as `…Logo` components; see
[Brand logos](#brand-logos) and [logos.md](logos.md).

## Importing icons

Every icon concept is one named export from the package root:

```tsx
import { ArrowLeftIcon, BookmarkIcon, SearchIcon, StarIcon } from "@qeetrix/icons";

<SearchIcon />
<StarIcon variant="filled" />
<StarIcon shape="sharp" variant="filled" />
<BookmarkIcon variant={saved ? "filled" : "outline"} />
<ArrowLeftIcon shape="sharp" /> // outline-only: variant="filled" is a type error
```

Each icon can also be imported on its own, by its public id:

```tsx
import { StarIcon } from "@qeetrix/icons/icons/star";
```

Both forms resolve to the same module, so mixing them never duplicates an icon. Prefer the root
import; the direct import exists for toolchains that tree-shake poorly. Direct imports take no file
extension, and the path never contains a category, shape, or variant.

## One component per concept

| Source SVGs | Public id and subpath | Export | `variant` accepts |
|:--|:--|:--|:--|
| `icons/round-outline/arrows/arrow-left.svg` + `icons/sharp-outline/arrows/arrow-left.svg` | `arrow-left` | `ArrowLeftIcon` | `"outline"` |
| `icons/{round,sharp}-{outline,filled}/account/star.svg` (four drawings) | `star` | `StarIcon` | `"outline" \| "filled"` |

- **One component owns every drawing of a concept.** `shape` and `variant` select the drawing;
  there is no `StarFilledIcon` or `StarSharpIcon` export, and no `@qeetrix/icons/icons/star-filled`
  or `@qeetrix/icons/sharp` subpath.
- **Outline is the default and always exists.** `<StarIcon />` is exactly
  `<StarIcon variant="outline" />`. The default is stable API; changing it would be a major
  release.
- **Filled is optional.** It exists only where the solid form is clean and meaningful, so most
  icons accept only `"outline"`.
- **TypeScript exposes only the drawings that exist.** Each generated component narrows `variant` to
  its own drawings, so `<ArrowLeftIcon variant="filled" />` is a type error, as is any value outside
  the system, such as `"solid"` or `"duotone"`. The unions are generated from the source SVGs;
  nobody maintains them by hand. Without TypeScript, an unavailable variant renders outline.
- **Each drawing is its own SVG source** in `icons/<shape>-<variant>/`. Only the round outlines
  come from Lucide; the round filled, sharp outline, and sharp filled sources are derived from them
  ahead of time and committed. Generation only joins the drawings behind one component, and nothing
  is derived at runtime.
- **Categories never appear** in an export name or import path: `TrashIcon`, never
  `FilesTrashIcon`. Categories organize the source tree and the manifest only.

One function derives every public name, `componentNameFromFilename` in
[validate-source-path.ts](../scripts/check/validate-source-path.ts), and it depends on the Lucide
name alone; see [naming.md](naming.md).

## Shapes and variants

`shape` selects the drawing style and `variant` the drawing within it:

| | `variant="outline"` (default) | `variant="filled"` |
|:--|:--|:--|
| `shape="round"` (default) | Lucide's outline | Filled, derived from the round outline |
| `shape="sharp"` | Square caps, mitered joins, squared corners | Filled, derived from the sharp outline |

- **Every icon has both shapes**, with the same variants in each, so `shape` is typed
  `IconShape = "round" | "sharp"` on every component and is never narrowed. Validation enforces
  the parity (`QXI-STYLE-001`).
- **Round is the default.** `<StarIcon />` is exactly `<StarIcon shape="round" />`.
- Neither prop is ever rendered as an attribute, and neither changes size, props, refs, or
  accessibility.

## Props

```ts
import type { IconProps, IconShape } from "@qeetrix/icons";
```

`IconProps<V>` is native `SVGProps<SVGSVGElement>` without `children`, plus `size`, `shape`, and
`variant`. Each component instantiates it with its own drawings, for example
`IconProps<"outline">` or `IconProps<"outline" | "filled">`; plain `IconProps` allows every
`IconVariant`.

| Prop | Behavior |
|:--|:--|
| `shape` | Selects the drawing style, `"round"` or `"sharp"`; defaults to `"round"`. Never rendered as an attribute |
| `variant` | Selects a drawing; defaults to `"outline"`. Never rendered as an attribute |
| `size` | `number` or any CSS length string; sets width and height. Default `24` |
| `width`, `height` | Override `size` on that axis |
| `strokeWidth` | Overrides the outline's stroke width, `2` by default, for the whole drawing, in either shape. Filled drawings have no stroke |
| `className`, `style`, `color` | Passed to the `<svg>`; artwork paints `currentColor` |
| `ref` | Reaches the rendered `<svg>` as a React 19 prop, whichever drawing it is |
| `aria-label`, `aria-labelledby` | Expose the icon as `role="img"`; otherwise it is `aria-hidden` |
| `aria-hidden`, `role`, `focusable` | An explicit value always wins |
| Any other SVG attribute or event handler | Passed through unchanged |

Caller props are spread last onto the root `<svg>`, so any presentation attribute, such as
`strokeWidth`, `strokeLinecap`, or `fill`, overrides the drawing's own root value. The recommended
sizes, 14, 16, 20, 24, and 32, are guidance rather than a type: `18`, `28`, and `"1em"` are all
valid. There are deliberately no animation, rotation, badge, tooltip, background, or duotone props.
Accessibility rules are in [accessibility.md](accessibility.md).

To hold an arbitrary icon, for example in a button component, type it as
`ComponentType<IconProps<"outline">>`: every icon has an outline drawing, so every icon fits.

## Brand logos

```tsx
import { GithubLogo, type LogoProps } from "@qeetrix/icons";

<GithubLogo />
<GithubLogo variant="wordmark" height={32} alt="GitHub" />
```

Each logo is one named export, PascalCase of its slug plus `Logo` (`Brand` in front when the slug
starts with a digit: `Brand1passwordLogo`), exported from the package root like every icon. It
renders its published SVG file unmodified as an `<img>`, so it
keeps its own colours and cannot be recoloured with CSS. `LogoProps<V>` is the native `<img>`
props without `src`, `srcSet`, and `sizes`, plus `variant` (typed to the logo's files, default the
logo's `defaultVariant`), `height` (default 24), and `width` (from the file's aspect ratio unless
given). Logos are decorative by default; `alt` or `aria-label` names one. Every logo keeps its own
license, and some restrict use. The full contract, variants and backgrounds, licensing, and
performance advice are in [logos.md](logos.md).

## Manifest

```ts
import { iconManifest, type IconManifest, type IconManifestEntry } from "@qeetrix/icons/manifest";
import { logoManifest, type LogoManifest, type LogoManifestEntry } from "@qeetrix/icons/manifest";
```

The manifest subpath holds two catalogues, `iconManifest` for icons and `logoManifest` for brand
logos ([logos.md](logos.md#catalogue)), as metadata for documentation, search, the playground, and
other tooling. They are only available from this subpath. The package root never imports them, a
catalogue never imports a component, and rendering an icon or logo never needs them. The rest of
this section describes `iconManifest`.

```ts
type IconManifest = {
  schemaVersion: 1;
  icons: readonly IconManifestEntry[]; // one entry per concept
};

type IconManifestEntry = {
  id: string; //                         "trash": unique key and direct-import subpath
  name: string; //                       "trash": the Lucide name
  componentName: string; //              "TrashIcon": the one export
  category: string; //                   "files": primary category, the source folder
  categories: readonly string[]; //      ["files", "mail"]: every category, primary first
  variants: readonly IconVariant[]; //   ["outline", "filled"]: what `variant` accepts
  shapes: readonly IconShape[]; //       ["round", "sharp"]: what `shape` accepts
  directionality: IconDirectionality; // "mirror" | "preserve"; see rtl.md
  tags: readonly string[]; //            Lucide's search keywords
  aliases: readonly string[]; //         ["trash-2"]: earlier names, never exported
};
```

```ts
{ id: "trash", name: "trash", componentName: "TrashIcon", category: "files",
  categories: ["files", "mail"], variants: ["outline", "filled"], shapes: ["round", "sharp"],
  directionality: "preserve", tags: ["garbage", "delete", "remove", "bin", …],
  aliases: ["trash-2"] }
```

- The manifest counts concepts, not drawings: 1,863 entries, whatever the number of SVGs.
- `variants` follows the configured order and always starts with `"outline"`. Every shape has
  exactly those variants.
- `shapes` starts with the default, `"round"`; every entry here lists both.
- `categories`, `tags`, and `aliases` come from Lucide ([lucide.md](lucide.md)). Filter by
  `categories`; `category` is only the first of them.
- Entries are ordered by primary category in configured order, then by name.
- `schemaVersion` is independent of the package version. It changes only if an existing field is
  removed or changes meaning. `categories`, `shapes`, `tags`, and `aliases` were added without
  changing it.
- The manifest carries no source paths, timestamps, or other repository or build data. A drawing's
  source is always `icons/<shape>-<variant>/<category>/<name>.svg`, and SVG sources are not shipped.
- The same data is generated as `icon-manifest.json` at the repository root, for language-neutral
  repository tooling. That file is not published; the package exposes only the typed module, which
  needs no JSON import attributes.

## Entry points

| Specifier | Contents |
|:--|:--|
| `@qeetrix/icons` | Every icon and logo component, plus the `IconProps`, `IconShape`, `IconVariant`, `IconDirectionality`, `LogoProps`, `LogoComponent`, and `LogoBackground` types |
| `@qeetrix/icons/icons/<id>` | One icon component |
| `@qeetrix/icons/manifest` | `iconManifest` and `logoManifest`, with the `IconManifest`, `IconManifestEntry`, `LogoManifest`, `LogoManifestEntry`, `LogoManifestVariant`, and `LogoBackground` types |
| `@qeetrix/icons/package.json` | Package metadata |

The exports map denies everything else. The runtime helpers, generated barrels, internal types,
config, scripts, `dist/` paths, and category, collection, shape, or variant paths cannot be
imported. This is
tested against the packed tarball under Node ESM and TypeScript `bundler` and `nodenext`
resolution. The package is ESM-only.

## Tree shaking

Tree shaking works per concept:

- Importing `StarIcon` ships all four of its drawings, round and sharp, outline and filled, because
  any of them can be selected at runtime. This is the deliberate cost of one semantic component per
  concept. It is a few path strings, and no lazy loading is added to avoid it.
- Importing `StarIcon` never ships `SearchIcon`, any other concept, or the manifest. The root
  re-exports a generated barrel of static `export { X } from "./icons/x.js"` statements, with no
  registry object, dynamic import, or side effect, and `sideEffects: false` holds for every
  published module. All icons share one tiny runtime function.
- Tests bundle the packed package and check each of these, and that root and direct imports of the
  same icon bundle its module once.
- Logos tree-shake the same way, one module per logo. Together they are large, so development
  servers that pre-bundle the whole root are slower; see
  [logos.md](logos.md#performance) for direct imports and `optimizePackageImports`.

## Deliberately not provided

- No `<Icon name="search" />`, `getIcon()`, `loadIcon()`, or `icons["search"]`. Icons are
  statically imported components; dynamic resolution needs a real product requirement first.
- No category or shape entry points such as `@qeetrix/icons/files` or `@qeetrix/icons/sharp`, and
  no per-icon props aliases such as `StarIconProps`; the component signature already carries its
  exact type.
- No components for aliases. `aliases` and `tags` are manifest data for search; `Trash2Icon` does
  not exist.

## Versioning

Public names and drawing support are semver API: every export, direct-import subpath, manifest
`id`, each component's accepted variants, and the shapes every icon offers.

| Change | Release |
|:--|:--|
| New icon concept, for example from a Lucide upgrade | Minor |
| New filled drawing for an existing icon (in both shapes) | Minor |
| Visual change with the same name, shapes, and variants: a Lucide redraw, or a re-derived filled or sharp drawing | Patch |
| Category, tag, or alias change | Not breaking: only manifest metadata changes, never an import |
| Directionality change | Not breaking for imports; call it out in release notes |
| Removal of a filled drawing | Major: `variant="filled"` stops compiling |
| Removal of the sharp shape | Major: `shape="sharp"` stops working for every icon |
| Rename or removal of an icon concept, including a Lucide rename | Major |
| Changing the default shape from round or the default variant from outline | Major |
| Removed or retyped `IconProps` member | Major |
| New logo, or new file for a logo, from a theSVG sync | Minor |
| Changed logo file, title, background, or license | Patch; call out license changes in release notes |
| Removal or rename of a logo or one of its variants, or a removed or retyped `LogoProps` member | Major |

Renames come from Lucide. Its former names are recorded as aliases but not exported, so a Lucide
release that renames an icon removes an export here; plan such upgrades as major releases
([lucide.md](lucide.md#upgrading-lucide)). See [releases.md](releases.md) for how releases happen.
