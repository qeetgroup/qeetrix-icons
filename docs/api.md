# Public API

The contract for consuming `@qeetrix/icons` 2.0. It is implemented and tested against a packed
tarball. The only icons today are twelve outline-only calibration concepts: `PlusIcon`, `XIcon`,
`CheckIcon`, `ChevronDownIcon`, `SearchIcon`, `ArrowLeftIcon`, `SettingsIcon`, `UserIcon`,
`BellIcon`, `LockIcon`, `CalendarIcon`, and `DatabaseIcon`.
Names such as `StarIcon` and `BookmarkIcon` below illustrate the contract and do not exist yet.

## Importing icons

Every icon concept is one named export from the package root:

```tsx
import { BookmarkIcon, SearchIcon, StarIcon } from "@qeetrix/icons";

<SearchIcon />
<StarIcon />
<StarIcon variant="filled" />
<BookmarkIcon variant={saved ? "filled" : "outline"} />
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
| `icons/outline/actions/search.svg` | `search` | `SearchIcon` | `"outline"` |
| `icons/outline/status/star.svg` + `icons/filled/status/star.svg` | `star` | `StarIcon` | `"outline" \| "filled"` |

- **One component owns every drawing of a concept.** `variant` selects the drawing; there is no
  `StarFilledIcon` export and no `@qeetrix/icons/icons/star-filled` subpath.
- **Outline is the default and always exists.** `<StarIcon />` is exactly
  `<StarIcon variant="outline" />`. The default is a stable API decision, not a calibration value;
  changing it would be a major release.
- **Filled is optional.** It exists only where the semantics justify it, so most icons accept only
  `"outline"`.
- **TypeScript exposes only the drawings that exist.** Each generated component narrows `variant` to
  its own artwork, so `<SearchIcon variant="filled" />` is a type error, as is any value outside the
  system, such as `"solid"`, `"round"`, or `"sharp"`. The unions are generated from the source
  SVGs; nobody maintains them by hand. Without TypeScript, an unavailable variant renders outline.
- **The drawings remain separate artwork.** Each variant is its own independently drawn SVG master
  in `icons/<variant>/`. Filled art is never derived from outline art; generation only joins them
  behind one component.
- **Categories never appear** in an export name or import path: `SearchIcon`, never
  `ActionsSearchIcon`. Categories organize the source tree and the manifest only.

One function derives every public name, `componentNameFromFilename` in
[validate-source-path.ts](../scripts/check/validate-source-path.ts), and it depends on the concept
name alone. Source names may not end in `-filled` or `-outline`, because variants live in
directories; see [naming.md](naming.md).

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
| `className`, `style`, `color` | Passed to the `<svg>`; artwork paints `currentColor` |
| `ref` | Reaches the rendered `<svg>` as a React 19 prop, whichever drawing it is |
| `aria-label`, `aria-labelledby` | Expose the icon as `role="img"`; otherwise it is `aria-hidden` |
| `aria-hidden`, `role`, `focusable` | An explicit value always wins |
| Any other SVG attribute or event handler | Passed through unchanged |

Variant never changes size, prop, ref, or accessibility behavior. The recommended design sizes, 14,
16, 20, 24, and 32, are guidance rather than a type: `18`, `28`, and `"1em"` are all valid. There
are deliberately no animation, rotation, badge, tooltip, background, weight, or duotone props.
Accessibility rules are in [accessibility.md](accessibility.md).

To hold an arbitrary icon, for example in a button component, type it as
`ComponentType<IconProps<"outline">>`: every icon has an outline drawing, so every icon fits.

## Manifest

```ts
import { iconManifest, type IconManifest, type IconManifestEntry } from "@qeetrix/icons/manifest";
```

The manifest is catalogue metadata for documentation, search, the future playground, and other
tooling. It is only available from this subpath. The package root never imports it, the manifest
never imports an icon, and rendering an icon never needs it.

```ts
type IconManifest = {
  schemaVersion: 1;
  icons: readonly IconManifestEntry[]; // one entry per concept
};

type IconManifestEntry = {
  id: string; //                         "star": unique key and direct-import subpath
  name: string; //                       "star": canonical concept name
  componentName: string; //              "StarIcon": the one export
  category: string; //                   "status": organization only
  variants: readonly IconVariant[]; //   ["outline", "filled"]: what `variant` accepts
  directionality: IconDirectionality; // "mirror" | "preserve"; see rtl.md
};
```

```ts
{ id: "star", name: "star", componentName: "StarIcon", category: "status",
  variants: ["outline", "filled"], directionality: "preserve" }
```

- The manifest counts concepts, not drawings: 100 outline and 20 filled SVGs are 100 entries.
- `variants` follows the configured order and always starts with `"outline"`.
- Entries are ordered by configured category, then name.
- `schemaVersion` is independent of the package version. It changes only if an existing field is
  removed or changes meaning; an added optional field does not change it.
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
- No category entry points such as `@qeetrix/icons/actions`, and no per-icon props aliases such as
  `StarIconProps`; the component signature already carries its exact type.
- No aliases, keywords, or search synonyms yet; they belong with the playground and catalogue work.

## Versioning

Public names and variant support are semver API: every export, direct-import subpath, manifest
`id`, and each component's accepted variants.

| Change | Release |
|:--|:--|
| New icon concept | Minor |
| New filled drawing for an existing outline icon | Minor |
| Visual correction with the same name and variants | Patch |
| Category move | Not breaking: only manifest metadata changes, never an import |
| Directionality change | Not breaking for imports; call it out in release notes |
| Removal of a filled drawing | Major: `variant="filled"` stops compiling |
| Rename or removal of an icon concept | Major |
| Changing the default variant from outline | Major |
| Removed or retyped `IconProps` member | Major |

A rename should add the new name first and keep the old one until the next major, with the change
documented. No alias or deprecation machinery exists yet; it will be designed when the first rename
is needed. See [releases.md](releases.md) for how releases happen.
