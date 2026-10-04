# Qeetrix Icons 2.0

`@qeetrix/icons` is Qeet Group's shared icon library for Qeetrix and Qeet products, including Qeet
ID, Qeet Pay, Qeet Logs, Qeet Notify, Qeet People, Qeet AI, and future products. It ships the
[Lucide](https://lucide.dev) icon set as tree-shakeable React 19 components, with filled variants
derived from the outlines.

> [!IMPORTANT]
> **2.0 is unreleased.** It removes the 1.x catalogue: do not rely on any 1.x icon name, prop,
> type, or import path. Versions already published to the package registry are not changed.

## What is in it

- **1,863 outline icons** from Lucide 1.52.0, the release pinned in
  [config/lucide.json](config/lucide.json). The artwork is Lucide's, unchanged, and so are the names
  and the 42 categories ([docs/lucide.md](docs/lucide.md)).
- **Filled variants** for about 800 icons, derived from the outline with Skia path operations and
  reviewed one by one. The list is [config/filled.ts](config/filled.ts); see
  [docs/filled.md](docs/filled.md).
- A **manifest** with each icon's categories, Lucide tags, and former names, for search and tooling.
- An internal **playground** for visual review, not published.

## Usage

The contract is in [docs/api.md](docs/api.md):

```tsx
import { SearchIcon, StarIcon, TrashIcon, type IconProps } from "@qeetrix/icons";
import { iconManifest } from "@qeetrix/icons/manifest";

<SearchIcon size={20} aria-label="Search" />
<StarIcon variant="filled" />
<TrashIcon strokeWidth={1.5} />
```

Each icon is one component named after its Lucide name in PascalCase plus `Icon` (`clock-12` →
`Clock12Icon`), also importable as `@qeetrix/icons/icons/<name>`. `variant` defaults to `"outline"`
and is typed to the drawings that exist, so `<ArrowLeftIcon variant="filled" />` is a type error:
`arrow-left` has no filled drawing. Categories never appear in names or import paths. `size` takes
any number or CSS length; 14, 16, 20, 24, and 32 are recommendations, not limits. The stroke width
is 2, and `strokeWidth` overrides it. Lucide's former names, such as `trash-2` for `trash`, are in
the manifest for search but are not exported. The 1.x `@qeetrix/icons/icons/<category>/<name>`
paths are gone.

## Design

Outline icons follow Lucide's drawing rules: a 24 x 24 grid, `viewBox="0 0 24 24"`, a 2-unit
stroke with round caps and joins, 1 unit of padding, and `currentColor`. The system is outline
first; filled drawings are a selective alternative for states such as selected, favorite, or
active, and exist only where the solid form is clean. See [docs/design.md](docs/design.md) and the
[documentation index](docs/README.md).

## Architecture

A pinned Lucide release flows through sync, filled derivation, validation, React generation,
manifest generation, and package exports into Qeetrix UI and Qeet products. Generated components
target React 19, the package's only peer dependency, and there are no runtime dependencies. See
[docs/architecture.md](docs/architecture.md).

## Develop

Bun only, pinned to 1.3.14. Use strict TypeScript, ESM, Biome, and Vitest; do not add another
package manager, linter, or formatter.

```bash
bun install
bun run typecheck
bun run lint
bun run test
bun run sync:lucide      # re-sync the pinned Lucide release (pass a version to upgrade)
bun run derive:filled    # derive icons/filled/ from the outlines and config/filled.ts
bun run check:filled     # prove the filled drawings are up to date
bun run check:icons      # validate production SVG sources
bun run generate         # validate, then regenerate src/generated/ and the manifest
bun run check:generated  # prove generated output matches source
bun run build
bun run playground       # internal visual QA playground (not published)
bun run playground:build # prove the playground builds
```

Every file under `icons/` is written by a tool: `icons/outline/` by `sync:lucide`, `icons/filled/`
by `derive:filled`. Never hand-edit them, `src/generated/`, or `icon-manifest.json`; change the
inputs and rerun. A missing or flawed outline belongs upstream in Lucide. The upgrade procedure is
in [docs/lucide.md](docs/lucide.md), the review process in [docs/visual-qa.md](docs/visual-qa.md),
and conventions in [docs/contributing.md](docs/contributing.md).

## Releases

The package version remains `1.0.4`. The existing workflows patch-bump PRs and publish on merge to
`main`. Keep 2.0 off `main` until the major release is prepared, or it could ship as an
incompatible 1.x patch. Read [docs/releases.md](docs/releases.md) before any release work.

## License

The package code is MIT © Qeet Group. The icon artwork, the derived filled drawings, and the
generated components are based on [Lucide](https://lucide.dev), ISC © Lucide Icons and
Contributors; some Lucide icons derive from Feather, MIT © Cole Bemis. Both licenses are in
[LICENSE](./LICENSE).
