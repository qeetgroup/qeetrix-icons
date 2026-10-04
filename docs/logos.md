# Brand logos

Besides its icons, the package ships 7,429 brand logos from [theSVG](https://thesvg.org)
([glincker/thesvg](https://github.com/glincker/thesvg)), as React components. Logos are not icons:
each is rendered exactly as its brand or upstream published it, with its own colours, proportions,
and license. Icons end in `Icon` and logos in `Logo`, so the two never collide.

```tsx
import { GithubLogo } from "@qeetrix/icons";
import { GithubLogo as Direct } from "@qeetrix/icons/logos/github";
import { logoManifest } from "@qeetrix/icons/manifest";

<GithubLogo />                          // the default file, 24px tall
<GithubLogo variant="wordmark" height={32} alt="GitHub" />
```

Before using any logo, read [Licensing and trademarks](#licensing-and-trademarks): some logos may
not be used commercially, modified, or used at all without permission.

## Sources and sync

[config/brands.json](../config/brands.json) pins one theSVG commit (`commit`; npm release
`packageVersion` 3.3.12) and records every logo and file. The files themselves are in
`icons/brand-icons/<collection>/<slug>/<variant>.svg`, byte for byte as upstream publishes them:
13,401 files for 7,429 logos.

| Collection | Logos |
|:--|--:|
| `brands` | 4,691 |
| `auth-badges` | 860 |
| `aws` | 739 |
| `azure` | 626 |
| `community` | 259 |
| `gcp` | 214 |
| `k8s` | 38 |
| `unlisted` | 2 |

```bash
bun run sync:brands            # re-sync the pinned commit
bun run sync:brands <commit>   # move to another commit
bun run check:brands           # validate config/brands.json and every logo file
bun run generate:logos         # write the logo components and catalogue
bun run check:logos            # prove they match; writes nothing
```

`sync:brands` ([sync-brands.ts](../scripts/sync/sync-brands.ts), with
[scripts/lib/brands.ts](../scripts/lib/brands.ts)) downloads the commit's tarball from GitHub
(`--archive <file>` reads a downloaded one instead), replaces `icons/brand-icons/`, and rewrites
`config/brands.json`. It prints how many logos and files it wrote, how theSVG's `light`/`dark`
names compare with the measured backgrounds, anything skipped, and what changed since the previous
commit. Like `sync:lucide`, it then runs `check:brands` and `generate:logos`, so the repository is
consistent when it finishes. How it handles
upstream's loose ends (unreferenced files kept as variants, unlisted folders kept under
`unlisted`, listed files missing upstream) is described in the script's header comment. Never edit
`icons/brand-icons/` or `config/brands.json` by hand.

## Catalogue

`logoManifest`, from `@qeetrix/icons/manifest`, lists every logo, ordered by id
(`schemaVersion` 1):

| Field | Meaning |
|:--|:--|
| `id` | The slug, such as `github`; also the direct-import subpath |
| `componentName` | The export, such as `GithubLogo` |
| `title` | Display name, such as `GitHub` |
| `collection` | One of the collections above |
| `variants` | Every file: `{ name, background }` |
| `defaultVariant` | The variant rendered without a `variant` prop |
| `hex` | Primary brand colour, six hex digits without `#`, or `null` |
| `categories`, `aliases` | Upstream's categories and alternative names, for search |
| `license` | SPDX identifier where one applies, otherwise upstream's license text |
| `website`, `guidelines`, `source` | Brand website, brand guidelines, and the theSVG page, or `null` |

`config/brands.json` holds the same data plus, per file, its path, measured colours, and upstream
keys, and per logo a coarse `licenseClass` and the raw license text. It is repository data, not a
package export.

## Components

`bun run generate:logos` ([generate-logos.ts](../scripts/build/generate-logos.ts), with
`scripts/lib/logo-*.ts`) writes one module per logo to `src/generated/logos/<slug>.ts`, the barrel
`src/generated/logo-index.ts`, and the catalogue `src/generated/logo-manifest.ts`. These are the
paths in `logoGeneratedPaths`; the icon generator never touches them and the logo generator owns
nothing else ([generation.md](generation.md#determinism-and-safety)).

Each logo renders its published file **unmodified** as an `<img>`, through the shared runtime
[render-logo.ts](../src/runtime/render-logo.ts). The file is embedded as a lossless,
percent-encoded `data:image/svg+xml` URI: only bytes a URI or a quoted string cannot carry are
escaped, which adds about 1.5% in size, and percent-decoding gives back the exact bytes. A test
checks that for all 13,401 files. Because a logo is an image, its ids and styles cannot clash with
the page or with other logos, and it needs no hooks, so it renders in React Server Components.

### Names

The component name is PascalCase of the slug's parts plus `Logo`:

| Slug | Component | Direct import |
|:--|:--|:--|
| `github` | `GithubLogo` | `@qeetrix/icons/logos/github` |
| `arch-linux` | `ArchLinuxLogo` | `@qeetrix/icons/logos/arch-linux` |
| `archlinux` | `ArchlinuxLogo` | `@qeetrix/icons/logos/archlinux` |
| `1password` | `Brand1passwordLogo` | `@qeetrix/icons/logos/1password` |

Slugs starting with a digit get a `Brand` prefix, so the name is a valid identifier. Slugs with
and without a hyphen are different upstream logos and stay distinct.

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

Logos cannot be recoloured with CSS `color` or `fill`: an image does not inherit the page's
styles, so a file drawn with `currentColor` paints black. This is deliberate; it keeps every logo
exactly as published. Pick the variant drawn for your background instead.

## Variants and backgrounds

Variant names are theSVG's keys in kebab-case: `default`, `mono`, `wordmark`, `light`, `dark`,
`color`, `wordmark-light`, `wordmark-dark`, `mono-lobe`, `line`, a few one-offs, and the AWS
architecture sizes `16`, `32`, and `64`. A logo has between one and several of them; `variants` in
the manifest, and the component's type, list exactly what exists.

theSVG's `light` and `dark` names mostly mean the opposite of what they suggest, and are
inconsistent between logos. The sync therefore measures each file's painted colours and records
the background it is actually drawn for:

| `background` | Meaning |
|:--|:--|
| `light` | Dark artwork, for light backgrounds |
| `dark` | Light artwork, for dark backgrounds |
| `any` | Colourful, mid-tone, or mixed artwork that works on both |

Choose variants by `background`, not by name. `check:brands` fails if a file's recorded
background or colours no longer match its content.

## Licensing and trademarks

Every logo keeps its own license, recorded in `logoManifest[].license` and named in each
generated module's header. All of theSVG's logos are included, whatever their license:

| License | Logos |
|:--|--:|
| CC0-1.0 | 4,263 |
| MIT | 1,334 |
| CC-BY-ND-2.0 (the AWS architecture icons) | 739 |
| Apache-2.0 | 369 |
| CC-BY, CC-BY-SA, CC-BY-NC, GPL, AGPL, LGPL, MPL, BSD, and others | about 160 |
| No real license: "brand-use", "Trademark", "Fair Use", "Proprietary", "Unknown", … | about 560 |

Some of these restrict how a logo may be used:

- **Non-commercial** (CC-BY-NC): not for commercial products.
- **No derivatives** (CC-BY-ND, including every AWS icon): use unmodified only.
- **Copyleft and share-alike** (GPL, AGPL, LGPL, MPL, CC-BY-SA): obligations can extend to your
  work.
- **No license**: no permission is granted at all beyond what trademark law and fair use allow.

Check `license` before you ship a logo, and filter on it in tooling, for example to allow only
`CC0-1.0`, `MIT`, and `Apache-2.0`. Logos are trademarks of their owners, included for
identification only; a license on the artwork grants no trademark rights, and brand guidelines,
linked in `guidelines` where known, still apply. Per-logo licenses and the required notices are
collected in [THIRD-PARTY-LOGOS.md](../THIRD-PARTY-LOGOS.md) and [LICENSE](../LICENSE);
`package.json` declares `"license": "SEE LICENSE IN LICENSE"`.

## Known upstream defects

Files are embedded as published, defects included, so these render as they do in a browser:

- `btk`, `default`: the root has no SVG namespace, so as an image it is broken.
- `logitech-g`, `default`: the `viewBox` has zero size, so it renders nothing.
- `zenmux`, `default` and `mono`: the artwork lies outside the `viewBox`, so it renders blank.

`check:brands` reports the first two as warnings (`QXB-SVG-007`, `QXB-SVG-008`), and
`generate:logos` prints a warning for each; the third is only visible by eye. Fixes belong upstream;
the next sync picks them up.

## Performance

All logo modules together are roughly 40 MB of JavaScript, almost all of it data URIs.

- **Production builds** include only the logos you import: every module is free of side effects
  (`sideEffects: false`), the barrel is static re-exports, and the catalogue is a pure
  `JSON.parse` that bundlers drop when unused.
- **Development servers** that pre-bundle a dependency's whole root, such as Vite's
  `optimizeDeps` and Next.js in development, process every logo when you import from
  `@qeetrix/icons`. In large apps, import from the direct subpaths, `@qeetrix/icons/logos/<id>`
  and `@qeetrix/icons/icons/<id>`, or, in Next.js, set
  `experimental.optimizePackageImports: ["@qeetrix/icons"]`.

## Validation

`bun run check:brands` ([validate-brands.ts](../scripts/check/validate-brands.ts)) does not judge
the drawings; it checks that `config/brands.json` and the files agree and that every file is safe
to embed. See [validation.md](validation.md#brand-logos) for the `QXB-*` codes. The icon validator
skips `icons/brand-icons/`.

The playground has a Logos page for browsing logos by collection, on light or dark backgrounds,
with each logo's license ([visual-qa.md](visual-qa.md)).
