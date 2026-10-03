# Qeetrix Icons 2.0

`@qeetrix/icons` is Qeet Group's shared icon system for Qeetrix and Qeet products, including Qeet ID,
Qeet Pay, Qeet Logs, Qeet Notify, Qeet People, Qeet AI, and future products. It is being rebuilt with
original Qeetrix artwork for enterprise consoles, identity and security, payments, observability,
data-heavy interfaces, and developer tools.

> [!IMPORTANT]
> **Current development state: Phase 2C, SVG-to-React generation pipeline.**
>
> - The legacy 1.x icon artwork has been removed from this repository.
> - There are currently zero production SVG icons and zero generated React icon components.
> - Do not rely on 1.x icon names, props, types, or import paths for the upcoming major release.
> - Versions already published to the package registry are not changed by this rebuild.

## Current state

The repository now defines the icon language, category taxonomy, naming, accessibility, RTL, and
architecture contracts. [config/icon-system.ts](config/icon-system.ts) separates stable architecture
from visual calibration candidates; [config/categories.ts](config/categories.ts) defines the 20
ordered enterprise/product categories. Both are internal and are not package exports.

`icons/` contains only its empty-directory placeholder. SVG/source validation and deterministic
SVG-to-React generation are implemented, with a small shared runtime for size and accessibility
defaults; the manifest, public icon exports, and playground remain future work. No category,
variant, or size-master source folders are created yet. The removed `@qeetrix/icons/icons/*` deep
imports stay removed. See [docs/validation.md](docs/validation.md) and
[docs/generation.md](docs/generation.md).

## Public foundations

```ts
import type { IconDirectionality, IconVariant } from "@qeetrix/icons";
```

`IconVariant` is `"outline" | "filled"`. `IconDirectionality` is `"mirror" | "preserve"`.
These are concepts, not component props. The root JavaScript module exports no runtime values or
icons; the existing package-metadata subpath remains available. There is no restrictive `IconSize`
type: recommended design sizes do not settle future support for values such as `18` or `"1em"`.

## Design direction

Precise, calm, geometric, and human: simple silhouettes, controlled corners, generous negative
space, and optical balance. Icons should harmonize with Qeet UI and Qeet Text without overpowering
medium-weight labels. The system is outline-first; filled drawings are selective, meaningful state
alternatives, not a required second drawing for every icon.

The canonical master is a 24 x 24 SVG with `viewBox="0 0 24 24"` and `currentColor`. Initial
calibration candidates are a 1.75 stroke, round caps and joins, a 2-unit painted safe-area inset,
a default size of 24, and UI review sizes of 14, 16, 20, 24, and 32. These visual candidates still
need the later calibration set; no separate optical masters or font files are included.

Read [docs/design-principles.md](docs/design-principles.md),
[docs/drawing-guidelines.md](docs/drawing-guidelines.md), and the [documentation index](docs/README.md).

## Architecture direction

Human-authored SVG flows through validation and React generation, then later manifest generation
and package exports, into Qeetrix UI and Qeet products. Validation and generation are implemented.
Generated components target React 19, the package's only peer dependency, and are not exported yet.
See [docs/architecture.md](docs/architecture.md) for ownership and phase boundaries.

## Develop

Bun only, pinned to 1.3.14. Use strict TypeScript, ESM, Biome, and Vitest; do not add another package
manager, linter, or formatter.

```bash
bun install
bun run typecheck
bun run lint
bun run test
bun run check:icons      # validate production SVG sources
bun run generate         # validate, then regenerate src/generated/icons/
bun run check:generated  # prove generated output matches source
bun run build
```

SVG is the source of truth: edit `icons/`, run `bun run generate`, and never hand-edit
`src/generated/`. Details are in [docs/generation.md](docs/generation.md).

The test script runs Vitest, matching CI. Use `bun run format` for Biome fixes. Contributors must
keep phase boundaries explicit, update config and docs together, and never hand-edit generated
files. Do not add production artwork during Phase 2C or copy, trace, or slightly modify paths from Lucide,
Iconsax/Vuesax, or any other third-party icon library. Principles may be studied; geometry must be
independently drawn. See [docs/contributing.md](docs/contributing.md).

## Releases

The package version remains `1.0.4`; this phase adds quality gates, not a change to publishing policy.
The existing workflows patch-bump PRs and publish on merge to `main`. Keep foundation-only work off
`main` until the major release is prepared, or it could ship as an incompatible 1.x patch. Read
[docs/releases.md](docs/releases.md) before any release work.

## License

MIT © Qeet Group. See [LICENSE](./LICENSE).
