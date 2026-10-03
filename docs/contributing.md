# Contributing to `@qeetrix/icons`

> [!NOTE]
> Phase 2C adds SVG-to-React generation to the Qeetrix Icons 2.0 foundations. The manifest, public
> icon exports, and visual QA are not implemented. Production icon contributions are not open yet;
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
| `bun run generate` | Validate sources, then write `src/generated/icons/`; aborts without writing on error |
| `bun run check:generated` | Fail if generated output is missing, edited, out of date, or stale |
| `bun run build` | `rm -rf dist` → `tsc` → `tsc-alias` |

## Where things live

| | |
|:--|:--|
| `icons/` | Reserved for 2.0 source artwork. Empty. |
| `config/` | Internal icon-system contract and ordered category taxonomy. Typechecked, not published. |
| `scripts/` | Repository-only validators, scanner, diagnostics, and the generation pipeline. |
| [src/types/icon.ts](../src/types/icon.ts) | Public variant and directionality types, not component props. |
| [src/types/icon-props.ts](../src/types/icon-props.ts) | `IconProps` for generated components; not a root export. |
| [src/runtime/](../src/runtime/) | The shared `resolveIconProps` helper; hand-written, published runtime only. |
| `src/generated/icons/` | Generated components. Never edit by hand. Absent while there are no icons. |
| [src/index.ts](../src/index.ts) | Type-only public entry point; no runtime or icon exports yet. |
| `docs/` | Design, naming, accessibility, RTL, and architecture contracts. |
| `tests/` | Foundation, validation, generation, and runtime checks; temporary fixtures only. |
| `dist/` | Build output, and the only thing published. Gitignored. |

Read [design-principles.md](design-principles.md), [drawing-guidelines.md](drawing-guidelines.md),
and [naming.md](naming.md) before proposing future artwork. Accessibility and RTL expectations are
in [accessibility.md](accessibility.md) and [rtl.md](rtl.md). The phase boundaries and future file
ownership map are in [architecture.md](architecture.md).

After changing an SVG, run `bun run generate` and commit the result; see
[generation.md](generation.md). Run `bun run check:icons` for the one primary source gate. It accepts the current empty production
root and never scans test fixtures. See [validation.md](validation.md) for rule codes, the exact
source contract, and what still requires visual review. Tests continue to use the canonical
`bun run test` Vitest script rather than a second test runner.

## CI

CI runs one job — see [the workflow](../.github/workflows/ci.yml):

```text
bun install -> lint -> typecheck -> test -> check:icons -> check:generated -> build
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
- **Respect phase scope.** Phase 2C adds generation and its shared runtime, not production
  artwork, a manifest, public icon exports, or a playground. Synthetic geometry belongs only to tests; temporary filesystem
  fixtures must be cleaned up. Later steps require their own implementation and verification.
- **Dependencies need a concrete purpose.** Phase 2B added a development-only XML parser, justified
  in the validation guide. Phase 2C made React 19 the peer dependency and added `react`, `react-dom`,
  and their types for development only, to typecheck and render generated output in tests. Do not
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

