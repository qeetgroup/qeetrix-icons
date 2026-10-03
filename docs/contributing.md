# Contributing to `@qeetrix/icons`

> [!NOTE]
> Phase 2B adds SVG/source validation to the Qeetrix Icons 2.0 foundations. Generation and visual
> QA are not implemented. Production icon contributions are not open yet; synthetic geometry is
> allowed only in isolated validation tests. Do not add production SVGs or future-phase scaffolding.

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
| `bun run build` | `rm -rf dist` → `tsc` → `tsc-alias` |

## Where things live

| | |
|:--|:--|
| `icons/` | Reserved for 2.0 source artwork. Empty. |
| `config/` | Internal icon-system contract and ordered category taxonomy. Typechecked, not published. |
| `scripts/` | Repository-only source validators, scanner, and deterministic diagnostics. |
| [src/types/icon.ts](../src/types/icon.ts) | Public variant and directionality types, not component props. |
| [src/index.ts](../src/index.ts) | Type-only public entry point; no runtime or icon exports yet. |
| `docs/` | Design, naming, accessibility, RTL, and architecture contracts. |
| `tests/` | Foundation checks and synthetic validation cases, with temporary scanner fixtures. |
| `dist/` | Build output, and the only thing published. Gitignored. |

Read [design-principles.md](design-principles.md), [drawing-guidelines.md](drawing-guidelines.md),
and [naming.md](naming.md) before proposing future artwork. Accessibility and RTL expectations are
in [accessibility.md](accessibility.md) and [rtl.md](rtl.md). The phase boundaries and future file
ownership map are in [architecture.md](architecture.md).

Run `bun run check:icons` for the one primary source gate. It accepts the current empty production
root and never scans test fixtures. See [validation.md](validation.md) for rule codes, the exact
source contract, and what still requires visual review. Tests continue to use the canonical
`bun run test` Vitest script rather than a second test runner.

## CI

CI runs one job — see [the workflow](../.github/workflows/ci.yml):

```text
bun install -> lint -> typecheck -> test -> check:icons -> build
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
- **Respect phase scope.** Phase 2B adds source validation, not production artwork, generators,
  manifest, runtime, or playground. Synthetic geometry belongs only to tests; temporary filesystem
  fixtures must be cleaned up. Later steps require their own implementation and verification.
- **Dependencies need a concrete purpose.** The only Phase 2B addition is a development-only XML
  parser, justified in the validation guide. React 19 remains the future component target. Do not
  install runtime, optimization, or generation tools speculatively.
- **Generated files are never edited by hand.** The generator is their only author, and its output
  must be deterministic: no timestamps, and sort with an explicit codepoint comparator rather than
  `localeCompare`, so a file's byte order never depends on the machine that produced it.
  Category display order instead follows the explicit array in [config/categories.ts](../config/categories.ts).
- **Original artwork only.** Do not contribute a glyph copied or derived from another icon library.

Run installation, typechecking, linting, the canonical Vitest test script, `check:icons`, and the
build before reporting a phase complete. Do not commit, push, publish, or change Git history as
part of a phase unless explicitly requested. Phase 2B adds the source gate to CI and release
checks without changing publishing triggers, credentials, tags, or versioning.

