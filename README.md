# Qeetrix Icons 2.0

`@qeetrix/icons` is Qeet Group's shared icon system for Qeetrix and Qeet products, including Qeet ID,
Qeet Pay, Qeet Logs, Qeet Notify, Qeet People, Qeet AI, and future products. It is being rebuilt with
original Qeetrix artwork for enterprise consoles, identity and security, payments, observability,
data-heavy interfaces, and developer tools.

> [!IMPORTANT]
> **Current development state: Phase 3C, third calibration batch.**
>
> - The legacy 1.x icon artwork has been removed from this repository.
> - Twelve original icons exist for calibration only: `PlusIcon`, `XIcon`, `CheckIcon`,
>   `ChevronDownIcon`, `SearchIcon`, `ArrowLeftIcon`, `SettingsIcon`, `UserIcon`, `BellIcon`,
>   `LockIcon`, `CalendarIcon`, and `DatabaseIcon`. The visual system is not calibrated yet; do not
>   migrate products to them.
> - Do not rely on 1.x icon names, props, types, or import paths for the upcoming major release.
> - Versions already published to the package registry are not changed by this rebuild.

## Current state

The repository now defines the icon language, category taxonomy, naming, accessibility, RTL, and
architecture contracts. [config/icon-system.ts](config/icon-system.ts) separates stable architecture
from visual calibration candidates; [config/categories.ts](config/categories.ts) defines the 20
ordered enterprise/product categories. Both are internal and are not package exports.

Validation, SVG-to-React generation, the generated root exports, the manifest, and the visual QA
playground are implemented. `icons/` holds the Phase 3A, 3B, and 3C calibration batches: twelve
outline-only concepts in `actions`, `navigation`, `identity`, `security`, `communication`, `data`,
and `time`. Stroke width, safe area, corners, and the rest of the visual system remain provisional;
findings are logged in [docs/calibration.md](docs/calibration.md). See also
[docs/validation.md](docs/validation.md) and [docs/generation.md](docs/generation.md).

## Public API

The contract is in [docs/api.md](docs/api.md). The twelve calibration icons listed above exist
today; `StarIcon` below illustrates a future icon with a filled drawing:

```tsx
import { SearchIcon, StarIcon, type IconProps } from "@qeetrix/icons";
import { iconManifest } from "@qeetrix/icons/manifest";

<SearchIcon size={20} aria-label="Search" />
<StarIcon />
<StarIcon variant="filled" />
```

Each icon concept is one component, also importable as `@qeetrix/icons/icons/<id>`. `variant`
defaults to `"outline"` and is typed to the drawings that exist, so `<SearchIcon variant="filled" />`
is a type error unless a filled search drawing is added. Outline and filled stay separately drawn
SVGs. Categories never appear in names or import paths. `size` takes any number or CSS
length; 14, 16, 20, 24, and 32 are recommendations, not limits. Today the root exports only the
`IconProps`, `IconVariant`, and `IconDirectionality` types, and the manifest is empty. The 1.x
`@qeetrix/icons/icons/<category>/<name>` paths are gone; 2.0 subpaths are category-free.

## Design direction

Precise, calm, geometric, and human: simple silhouettes, controlled corners, generous negative
space, and optical balance. Icons should harmonize with Qeet UI and Qeet Text without overpowering
medium-weight labels. The system is outline-first; filled drawings are selective, meaningful state
alternatives, not a required second drawing for every icon.

The canonical master is a 24 x 24 SVG with `viewBox="0 0 24 24"` and `currentColor`. Initial
calibration candidates are a 1.75 stroke, round caps and joins, a 2-unit painted safe-area inset,
a default size of 24, and UI review sizes of 14, 16, 20, 24, and 32. These visual candidates still
need the later calibration set; no separate optical masters are included, and the package ships no
font files (the playground self-hosts Qeet UI and Qeet Text for typography review).

Read [docs/design-principles.md](docs/design-principles.md),
[docs/drawing-guidelines.md](docs/drawing-guidelines.md), and the [documentation index](docs/README.md).

## Architecture direction

Human-authored SVG flows through validation, React generation, manifest generation, and package
exports into Qeetrix UI and Qeet products; all four are implemented. Generated components target
React 19, the package's only peer dependency.
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
bun run playground       # internal visual QA playground (not published)
bun run playground:build # prove the playground builds
```

SVG is the source of truth: edit `icons/`, run `bun run generate`, and never hand-edit
`src/generated/` or `icon-manifest.json`. Details are in [docs/generation.md](docs/generation.md);
the human review process is in [docs/visual-qa.md](docs/visual-qa.md).

The test script runs Vitest, matching CI. Use `bun run format` for Biome fixes. Contributors must
keep phase boundaries explicit, update config and docs together, and never hand-edit generated
files. Add artwork only through the calibration phases, and never copy, trace, or slightly modify paths from Lucide,
Iconsax/Vuesax, or any other third-party icon library. Principles may be studied; geometry must be
independently drawn. See [docs/contributing.md](docs/contributing.md).

## Releases

The package version remains `1.0.4`; this phase adds quality gates, not a change to publishing policy.
The existing workflows patch-bump PRs and publish on merge to `main`. Keep foundation-only work off
`main` until the major release is prepared, or it could ship as an incompatible 1.x patch. Read
[docs/releases.md](docs/releases.md) before any release work.

## License

MIT © Qeet Group. See [LICENSE](./LICENSE).
