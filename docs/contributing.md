# Contributing to `@qeetrix/icons`

> [!NOTE]
> Phases 3A to 3C add the first calibration icons. New artwork arrives only in planned calibration
> batches; every icon passes [visual-qa.md](visual-qa.md) review and findings go to
> [calibration.md](calibration.md). Production icon contributions are not open yet;
> synthetic geometry is allowed only in isolated tests. Do not add production SVGs or future-phase
> scaffolding.

## Setup

```bash
bun install
```

Bun only — never npm, pnpm or yarn. The version is pinned in `packageManager`, and the whole Qeet
workspace uses it.

## Commands

| Command | Does |
|:--|:--|
| `bun run typecheck` | `tsc --noEmit` over `config/`, `scripts/`, `src/`, `tests/`, and `vitest.config.ts` |
| `bun run lint` | Biome — lint *and* format check |
| `bun run format` | Biome, applying fixes |
| `bun run test` | Vitest |
| `bun run test:watch` | Same, watching |
| `bun run check:icons` | Production source paths, naming, SVG structure, variants, and collisions |
| `bun run generate` | Validate, then write components, root barrel, and manifest; aborts without writing on error |
| `bun run check:generated` | Fail if any generated file is missing, edited, out of date, or stale |
| `bun run playground` | Start the internal visual QA playground |
| `bun run playground:build` | Production-build the playground to prove it compiles |
| `bun run build` | `rm -rf dist` → `tsc` → `tsc-alias` |

## Where things live

| | |
|:--|:--|
| `icons/` | Reserved for 2.0 source artwork. Empty. |
| `config/` | Internal icon-system contract, ordered category taxonomy, and authored metadata exceptions. Not published. |
| `scripts/` | Repository-only validators, scanner, diagnostics, and the generation pipeline. |
| [src/types/icon.ts](../src/types/icon.ts) | Public variant and directionality types, not component props. |
| [src/types/](../src/types/) | Public `IconProps`, variant, directionality, and manifest types. |
| [src/runtime/](../src/runtime/) | The shared `resolveIconProps` helper; hand-written, published runtime only. |
| `src/generated/`, `icon-manifest.json` | Generated components, root barrel, and manifest. Never edit by hand. |
| [src/index.ts](../src/index.ts), [src/manifest.ts](../src/manifest.ts) | Hand-written package entries; see [api.md](api.md). |
| `docs/` | Design, naming, accessibility, RTL, and architecture contracts. |
| [playground/](../playground/) | Internal visual QA tool. Reads generated output; never published. |
| `tests/` | Foundation, validation, generation, and runtime checks; temporary fixtures only. |
| `dist/` | Build output, and the only thing published. Gitignored. |

Read [design-principles.md](design-principles.md), [drawing-guidelines.md](drawing-guidelines.md),
and [naming.md](naming.md) before proposing future artwork. Accessibility and RTL expectations are
in [accessibility.md](accessibility.md) and [rtl.md](rtl.md). The phase boundaries and future file
ownership map are in [architecture.md](architecture.md).

After changing an SVG or [config/icon-metadata.ts](../config/icon-metadata.ts), run
`bun run generate` and commit the result; see [generation.md](generation.md). Public names are
semver API; read [api.md](api.md) before adding, renaming, or removing an icon.

Run `bun run check:icons` for the one primary source gate. It scans only the production `icons/`
root and never test fixtures. See [validation.md](validation.md) for rule codes, the exact source
contract, and what still requires visual review. Tests continue to use the canonical
`bun run test` Vitest script rather than a second test runner.

## CI

CI runs one job — see [the workflow](../.github/workflows/ci.yml):

```text
bun install -> lint -> typecheck -> test -> check:icons -> check:generated -> build
            -> playground:build
```

Three more workflows handle releases — `version.yml` bumps the patch version on a PR, `release.yml`
publishes on merge and then tags, and `rollback.yml` moves `latest` back. See
[releases.md](releases.md).

## Conventions

- **Biome owns formatting.** There is no ESLint and no Prettier. Run `bun run format` rather than
  arguing with it. `icons/` is excluded from Biome.
- **TypeScript is strict.** `verbatimModuleSyntax` is on, so type-only imports must use `import type`.
- **ESM only.**
- **Keep the public surface small.** Internal calibration and category config are not root exports.
  Recommended design sizes must not accidentally restrict a later runtime size property.
- **Calibrate explicitly.** Change provisional values in the shared config and documentation
  together, explaining the visual evidence. Do not silently introduce a per-icon geometry system.
- **Respect phase scope.** Calibration batches add only their planned concepts (3C: `bell`,
  `lock`, `calendar`, `database`). No other icons, filled drawings, Storybook, Figma
  integration, screenshot testing, or product migration. Review every new icon in the playground as
  described in [visual-qa.md](visual-qa.md). Synthetic geometry belongs only to tests; temporary
  filesystem
  fixtures must be cleaned up. Later steps require their own implementation and verification.
- **Dependencies need a concrete purpose.** Phase 2B added a development-only XML parser, justified
  in the validation guide. Phase 2C made React 19 the peer dependency and added `react`, `react-dom`,
  and their types for development only, to typecheck and render generated output in tests. Phase
  2E declares `vite`, already present through Vitest, for the playground. Do not
  install runtime, optimization, or generation tools speculatively.
- **Build tooling stays in `scripts/`.** `src/runtime/` holds only code that generated components
  execute; nothing in `src/` may import from `scripts/` or `config/`.
- **Generated files are never edited by hand.** The generator is their only author, and its output
  must be deterministic: no timestamps, and sort with an explicit codepoint comparator rather than
  `localeCompare`, so a file's byte order never depends on the machine that produced it.
  Category display order instead follows the explicit array in [config/categories.ts](../config/categories.ts).
- **Original artwork only.** Do not contribute a glyph copied or derived from another icon library.

Run installation, typechecking, linting, the canonical Vitest test script, `check:icons`,
`generate`, `check:generated`, and the build before reporting a phase complete. Do not commit, push, publish, or change Git history as
part of a phase unless explicitly requested. Phases 2B and 2C add the source and generated-output
gates to CI and release checks without changing publishing triggers, credentials, tags, or
versioning.

