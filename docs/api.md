# Public API

The contract for consuming `@qeetrix/icons` 2.0. It is implemented and tested against a packed
tarball. The package exports the 1,863 Lucide icons of the pinned release
([lucide.md](lucide.md)) as React 19 components; about 800 of them also have a filled drawing
([filled.md](filled.md)).

## Importing icons

Every icon concept is one named export from the package root:

```tsx
import { ArrowLeftIcon, BookmarkIcon, SearchIcon, StarIcon } from "@qeetrix/icons";

<SearchIcon />
<StarIcon variant="filled" />
<BookmarkIcon variant={saved ? "filled" : "outline"} />
<ArrowLeftIcon /> // outline-only: variant="filled" is a type error
```

Each icon can also be imported on its own, by its public id:

```tsx
import { StarIcon } from "@qeetrix/icons/icons/star";
```

Both forms resolve to the same module, so mixing them never duplicates an icon. Prefer the root
import; the direct import exists for toolchains that tree-shake poorly. Direct imports take no file
extension, and the path never contains a category or variant.

## One component per concept

| Source SVGs | Public id and subpath | Export | `variant` accepts |
|:--|:--|:--|:--|
| `icons/outline/arrows/arrow-left.svg` | `arrow-left` | `ArrowLeftIcon` | `"outline"` |
| `icons/outline/account/star.svg` + `icons/filled/account/star.svg` | `star` | `StarIcon` | `"outline" \| "filled"` |

- **One component owns every drawing of a concept.** `variant` selects the drawing; there is no
  `StarFilledIcon` export and no `@qeetrix/icons/icons/star-filled` subpath.
- **Outline is the default and always exists.** `<StarIcon />` is exactly
  `<StarIcon variant="outline" />`. The default is stable API; changing it would be a major
  release.
- **Filled is optional.** It exists only where the solid form is clean and meaningful, so most
  icons accept only `"outline"`.
- **TypeScript exposes only the drawings that exist.** Each generated component narrows `variant` to
  its own drawings, so `<ArrowLeftIcon variant="filled" />` is a type error, as is any value outside
  the system, such as `"solid"` or `"duotone"`. The unions are generated from the source SVGs;
  nobody maintains them by hand. Without TypeScript, an unavailable variant renders outline.
- **Each drawing is its own SVG source** in `icons/<variant>/`. Filled sources are derived from the
  outline ahead of time by `bun run derive:filled` and committed; generation only joins the drawings
  behind one component, and nothing is derived at runtime.
- **Categories never appear** in an export name or import path: `TrashIcon`, never
  `FilesTrashIcon`. Categories organize the source tree and the manifest only.

One function derives every public name, `componentNameFromFilename` in
[validate-source-path.ts](../scripts/check/validate-source-path.ts), and it depends on the Lucide
name alone; see [naming.md](naming.md).

## Props

```ts
import type { IconProps } from "@qeetrix/icons";
```

`IconProps<V>` is native `SVGProps<SVGSVGElement>` without `children`, plus `size` and `variant`.
Each component instantiates it with its own drawings, for example `IconProps<"outline">` or
`IconProps<"outline" | "filled">`; plain `IconProps` allows every `IconVariant`.

| Prop | Behavior |
|:--|:--|
| `variant` | Selects a drawing; defaults to `"outline"`. Never rendered as an attribute |
| `size` | `number` or any CSS length string; sets width and height. Default `24` |
| `width`, `height` | Override `size` on that axis |
| `strokeWidth` | Overrides the outline's stroke width, `2` by default, for the whole drawing. Filled drawings have no stroke |
| `className`, `style`, `color` | Passed to the `<svg>`; artwork paints `currentColor` |
| `ref` | Reaches the rendered `<svg>` as a React 19 prop, whichever drawing it is |
| `aria-label`, `aria-labelledby` | Expose the icon as `role="img"`; otherwise it is `aria-hidden` |
| `aria-hidden`, `role`, `focusable` | An explicit value always wins |
| Any other SVG attribute or event handler | Passed through unchanged |

Caller props are spread last onto the root `<svg>`, so any presentation attribute, such as
`strokeWidth`, `strokeLinecap`, or `fill`, overrides the drawing's own root value. Variant never
changes size, prop, ref, or accessibility behavior. The recommended sizes, 14, 16, 20, 24, and 32,
are guidance rather than a type: `18`, `28`, and `"1em"` are all valid. There are deliberately no
animation, rotation, badge, tooltip, background, or duotone props. Accessibility rules are in
[accessibility.md](accessibility.md).

To hold an arbitrary icon, for example in a button component, type it as
`ComponentType<IconProps<"outline">>`: every icon has an outline drawing, so every icon fits.

## Manifest

```ts
import { iconManifest, type IconManifest, type IconManifestEntry } from "@qeetrix/icons/manifest";
```

The manifest is catalogue metadata for documentation, search, the playground, and other tooling.
It is only available from this subpath. The package root never imports it, the manifest never
imports an icon, and rendering an icon never needs it.

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
  directionality: IconDirectionality; // "mirror" | "preserve"; see rtl.md
  tags: readonly string[]; //            Lucide's search keywords
  aliases: readonly string[]; //         ["trash-2"]: earlier names, never exported
};
```

```ts
{ id: "trash", name: "trash", componentName: "TrashIcon", category: "files",
  categories: ["files", "mail"], variants: ["outline", "filled"], directionality: "preserve",
  tags: ["garbage", "delete", "remove", "bin", …], aliases: ["trash-2"] }
```

- The manifest counts concepts, not drawings: 1,863 entries, whatever the number of filled SVGs.
- `variants` follows the configured order and always starts with `"outline"`.
- `categories`, `tags`, and `aliases` come from Lucide ([lucide.md](lucide.md)). Filter by
  `categories`; `category` is only the first of them.
- Entries are ordered by primary category in configured order, then by name.
- `schemaVersion` is independent of the package version. It changes only if an existing field is
  removed or changes meaning. `categories`, `tags`, and `aliases` were added without changing it.
- The manifest carries no source paths, timestamps, or other repository or build data. A drawing's
  source is always `icons/<variant>/<category>/<name>.svg`, and SVG sources are not shipped.
- The same data is generated as `icon-manifest.json` at the repository root, for language-neutral
  repository tooling. That file is not published; the package exposes only the typed module, which
  needs no JSON import attributes.

## Entry points

| Specifier | Contents |
|:--|:--|
| `@qeetrix/icons` | Every icon component, plus the `IconProps`, `IconVariant`, and `IconDirectionality` types |
| `@qeetrix/icons/icons/<id>` | One icon component |
| `@qeetrix/icons/manifest` | `iconManifest` and the `IconManifest` and `IconManifestEntry` types |
| `@qeetrix/icons/package.json` | Package metadata |

The exports map denies everything else. The runtime helper, generated barrel, internal types,
config, scripts, `dist/` paths, and category or variant paths cannot be imported. This is tested
against the packed tarball under Node ESM and TypeScript `bundler` and `nodenext` resolution. The
package is ESM-only.

## Tree shaking

Tree shaking works per concept:

- Importing `StarIcon` ships both of its drawings, because either can be selected at runtime. This
  is the deliberate cost of one semantic component per concept. It is a few path strings, and no
  lazy loading is added to avoid it.
- Importing `StarIcon` never ships `SearchIcon`, any other concept, or the manifest. The root
  re-exports a generated barrel of static `export { X } from "./icons/x.js"` statements, with no
  registry object, dynamic import, or side effect, and `sideEffects: false` holds for every
  published module. All icons share one tiny runtime function.
- Tests bundle the packed package and check each of these, and that root and direct imports of the
  same icon bundle its module once.

## Deliberately not provided

- No `<Icon name="search" />`, `getIcon()`, `loadIcon()`, or `icons["search"]`. Icons are
  statically imported components; dynamic resolution needs a real product requirement first.
- No category entry points such as `@qeetrix/icons/files`, and no per-icon props aliases such as
  `StarIconProps`; the component signature already carries its exact type.
- No components for aliases. `aliases` and `tags` are manifest data for search; `Trash2Icon` does
  not exist.

## Versioning

Public names and variant support are semver API: every export, direct-import subpath, manifest
`id`, and each component's accepted variants.

| Change | Release |
|:--|:--|
| New icon concept, for example from a Lucide upgrade | Minor |
| New filled drawing for an existing icon | Minor |
| Visual change with the same name and variants: a Lucide redraw or a re-derived filled drawing | Patch |
| Category, tag, or alias change | Not breaking: only manifest metadata changes, never an import |
| Directionality change | Not breaking for imports; call it out in release notes |
| Removal of a filled drawing | Major: `variant="filled"` stops compiling |
| Rename or removal of an icon concept, including a Lucide rename | Major |
| Changing the default variant from outline | Major |
| Removed or retyped `IconProps` member | Major |

Renames come from Lucide. Its former names are recorded as aliases but not exported, so a Lucide
release that renames an icon removes an export here; plan such upgrades as major releases
([lucide.md](lucide.md#upgrading-lucide)). See [releases.md](releases.md) for how releases happen.
