# Qeet logos

Besides its icons, the package ships Qeet Group's own logos as React components: `QeetLogo`, the
"q" mark, and `QeetWordmarkLogo`, **Qeet.** in a tile. Logos are not icons: each is rendered
exactly as drawn, with its own colours and proportions. Icons end in `Icon` and logos in `Logo`,
so the two never collide.

```tsx
import { QeetLogo, QeetWordmarkLogo } from "@qeetrix/icons";
import { logoManifest } from "@qeetrix/icons/manifest";

<QeetLogo />                                      // the default file, 24px tall
<QeetLogo variant="dark" height={32} alt="Qeet" />
<QeetWordmarkLogo variant="plain" />
```

Third-party brand logos (GitHub, Google, Slack, …) are not part of the package. An app that needs
one uses [theSVG](https://thesvg.org) directly, for example `@thesvg/react`, importing one logo at
a time.

## Files

Each logo's files are in `icons/brand-icons/<slug>/<variant>.svg`, and
[config/brands.json](../config/brands.json) records every logo and file:

| Logo | Folder | Variants |
|:--|:--|:--|
| `QeetLogo` | `icons/brand-icons/qeet/` | `default` (for light surfaces), `dark` (for dark surfaces) |
| `QeetWordmarkLogo` | `icons/brand-icons/qeet-wordmark/` | `default` and `dark` (in a tile), `plain` and `plain-dark` (the same letters without the tile) |

```bash
bun run check:brands           # validate config/brands.json and every logo file
bun run generate:logos         # write the logo components and catalogue
bun run check:logos            # prove they match; writes nothing
```

Every entry in `config/brands.json` is marked `"firstParty": true` with the licence class
`first-party`; the validator rejects any logo without them, so only Qeet's own artwork can ship.

To add a logo, put its files in `icons/brand-icons/<slug>/`, add an entry with
`"firstParty": true` and `"licenseClass": "first-party"`, and run `bun run generate:logos`.
`check:brands` fails if a recorded background or colour list does not match the file, and prints
the measured values to copy into the entry.

## Catalogue

`logoManifest`, from `@qeetrix/icons/manifest`, lists every logo, ordered by id
(`schemaVersion` 1):

| Field | Meaning |
|:--|:--|
| `id` | The slug, such as `qeet` |
| `componentName` | The export, such as `QeetLogo` |
| `title` | Display name, such as `Qeet` |
| `collection` | `brands` |
| `variants` | Every file: `{ name, background }` |
| `defaultVariant` | The variant rendered without a `variant` prop |
| `hex` | Primary brand colour, six hex digits without `#`, or `null` |
| `categories`, `aliases` | Categories and alternative names, for search |
| `license` | `LicenseRef-Qeet` |
| `website`, `guidelines`, `source` | Brand website, brand guidelines, and where the artwork comes from, or `null` |

`config/brands.json` holds the same data plus, per file, its path and measured colours, and per
logo the licence class and the raw licence text. It is repository data, not a package export.

## Components

`bun run generate:logos` ([generate-logos.ts](../scripts/build/generate-logos.ts), with
`scripts/lib/logo-*.ts`) writes one module per logo to `src/generated/logos/<slug>.ts`, the barrel
`src/generated/logo-index.ts`, and the catalogue `src/generated/logo-manifest.ts`. These are the
paths in `logoGeneratedPaths`; the icon generator never touches them and the logo generator owns
nothing else ([generation.md](generation.md#determinism-and-safety)).

Each logo renders its file **unmodified** as an `<img>`, through the shared runtime
[render-logo.ts](../src/runtime/render-logo.ts). The file is embedded as a lossless,
percent-encoded `data:image/svg+xml` URI: only bytes a URI or a quoted string cannot carry are
escaped, which adds about 2% in size, and percent-decoding gives back the exact bytes. A test
checks that for every file.

Rendering an image rather than inline SVG is deliberate:

- **Ids cannot clash.** The "q" mark cuts its bowl with a `<mask id>`. Inline, two marks on one
  page (a header and a footer, or a light and a dark copy with one hidden) would repeat that id,
  and a hidden copy can take the visible one's mask with it. Each image is its own document.
- **The page cannot recolour it.** An image does not inherit the page's `color` or `fill`, so the
  Qeet orange stays exact. Pick the variant drawn for your background instead.
- **It needs no hooks,** so it renders in React Server Components.

### Names

The component name is PascalCase of the slug's parts plus `Logo`: `qeet` → `QeetLogo`,
`qeet-wordmark` → `QeetWordmarkLogo`. A slug starting with a digit gets a `Brand` prefix, so the
name is a valid identifier. Logos are exported from the package root, `@qeetrix/icons`, next to
the icons; there is no separate logo entry point.

### Props

`LogoProps<V>` is the native `<img>` props without `src`, `srcSet`, and `sizes`, which the logo
owns, plus:

| Prop | Behavior |
|:--|:--|
| `variant` | Selects a file; defaults to the logo's `defaultVariant`. Typed per logo, so an unavailable variant is a type error |
| `height` | Number of pixels or CSS length; default `24` |
| `width` | Follows from the file's aspect ratio unless given; given alone, `height` follows from it |
| `alt`, `aria-label` | A non-empty value names the logo (an `aria-label` becomes the `alt` text) and drops `aria-hidden` |
| `aria-labelledby` | Non-empty: drops `aria-hidden` |
| `aria-hidden` | An explicit value always wins |
| `style`, `className`, `loading`, `decoding`, `title`, `ref`, … | Passed through to the `<img>` |

Logos are decorative by default: `alt=""` and `aria-hidden="true"`. Pixel numbers become the
`width` and `height` attributes; CSS lengths such as `"2em"` go to `style`, where a caller `style`
wins. A length that cannot be scaled, such as a percentage, leaves the other dimension to CSS. The
root also exports `LogoComponent` (the type of any logo component) and `LogoBackground`.

## Backgrounds

Each file records the background it is drawn for, measured from its painted colours:

| `background` | Meaning |
|:--|:--|
| `light` | Dark artwork, for light backgrounds |
| `dark` | Light artwork, for dark backgrounds |
| `any` | Colourful, mid-tone, or mixed artwork that works on both |

`QeetLogo`'s `default` file is `light` and its `dark` file is `dark`. The wordmark's files all
measure as `any`, because their orange mixes with dark or light letters; use `default` or `plain`
on light surfaces and `dark` or `plain-dark` on dark ones.

## Licensing and trademarks

The logos are Qeet Group's own artwork (`LicenseRef-Qeet`, proprietary), named in each generated
module's header. The Qeet name and mark are trademarks of Qeet Group.

## Validation

`bun run check:brands` ([validate-brands.ts](../scripts/check/validate-brands.ts)) does not judge
the drawings; it checks that `config/brands.json` and the files agree, that every logo is
first-party, and that every file is safe to embed. See [validation.md](validation.md#qeet-logos)
for the `QXB-*` codes. The icon validator skips `icons/brand-icons/`.

The playground has a Logos page that shows both logos on light and dark backgrounds
([visual-qa.md](visual-qa.md)).
