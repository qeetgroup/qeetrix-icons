# Contributing to `@qeetrix/icons`

> [!NOTE]
> The package is being rebuilt as Qeetrix Icons 2.0. The source format, naming rules, categories and
> generation pipeline for 2.0 icons have not been designed yet, so icon contributions are not open.
> Do not add SVGs to `icons/` until that work lands.

## Setup

```bash
bun install
```

Bun only — never npm, pnpm or yarn. The version is pinned in `packageManager`, and the whole Qeet
workspace uses it.

## Commands

| Command | Does |
|:--|:--|
| `bun run typecheck` | `tsc --noEmit` over `src/`, `tests/` and `vitest.config.ts` |
| `bun run lint` | Biome — lint *and* format check |
| `bun run format` | Biome, applying fixes |
| `bun run test` | Vitest |
| `bun run test:watch` | Same, watching |
| `bun run build` | `rm -rf dist` → `tsc` → `tsc-alias` |

## Where things live

| | |
|:--|:--|
| `icons/` | Reserved for 2.0 source artwork. Empty. |
| `src/index.ts` | The public entry point. Exports nothing during the reset. |
| `tests/` | Repository-health checks for the reset state. |
| `dist/` | Build output, and the only thing published. Gitignored. |

## CI

CI runs one job — see [the workflow](../.github/workflows/ci.yml):

```text
bun install → lint → typecheck → test → build
```

Three more workflows handle releases — `version.yml` bumps the patch version on a PR, `release.yml`
publishes on merge and then tags, and `rollback.yml` moves `latest` back. See
[releases.md](releases.md).

## Conventions

- **Biome owns formatting.** There is no ESLint and no Prettier. Run `bun run format` rather than
  arguing with it. `icons/` is excluded from Biome.
- **TypeScript is strict.** `verbatimModuleSyntax` is on, so type-only imports must use `import type`.
- **ESM only.**
- **Generated files are never edited by hand.** The generator is their only author, and its output
  must be deterministic: no timestamps, and sort with an explicit codepoint comparator rather than
  `localeCompare`, so a file's byte order never depends on the machine that produced it.
- **Original artwork only.** Do not contribute a glyph copied or derived from another icon library.
