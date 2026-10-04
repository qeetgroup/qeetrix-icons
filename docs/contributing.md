# Contributing to `@qeetrix/icons`

> [!NOTE]
> The outline icons are Lucide's, synced from one pinned release ([lucide.md](lucide.md)). Do not
> add, draw, or edit outline SVGs here: a missing or flawed icon belongs upstream in Lucide, and
> arrives here with the next upgrade. Contributions here are filled drawings
> ([filled.md](filled.md)), RTL decisions ([rtl.md](rtl.md)), tooling, and documentation.

## Setup

```bash
bun install
```

Bun only — never npm, pnpm or yarn. The version is pinned in `packageManager`, and the whole Qeet
workspace uses it.

## Commands

| Command | Does |
|:--|:--|
| `bun run typecheck` | `tsc --noEmit` over `config/`, `scripts/`, `src/`, `tests/`, `vitest.config.ts`, and the playground |
| `bun run lint` | Biome — lint *and* format check |
| `bun run format` | Biome, applying fixes |
| `bun run test` | Vitest |
| `bun run test:watch` | Same, watching |
| `bun run sync:lucide [version]` | Replace `icons/outline/` with a Lucide release, then derive and generate ([lucide.md](lucide.md)) |
| `bun run derive:filled` | Write `icons/filled/` from `config/filled.ts` and the outlines ([filled.md](filled.md)) |
| `bun run check:filled` | Fail if any filled drawing is missing, stale, or unlisted |
| `bun run check:icons` | Source paths, naming, SVG structure, variants, collisions, and metadata |
| `bun run generate` | Validate, then write components, root barrel, and manifest; aborts without writing on error |
| `bun run check:generated` | Fail if any generated file is missing, edited, out of date, or stale |
| `bun run playground` | Start the internal visual QA playground |
| `bun run playground:build` | Production-build the playground to prove it compiles |
| `bun run build` | `rm -rf dist` → `tsc` → `tsc-alias` |

## Where things live

| | |
|:--|:--|
| `icons/outline/` | Lucide's outline SVGs. Written by `sync:lucide`; never edited by hand. |
| `icons/filled/` | Derived filled SVGs. Written by `derive:filled`; never edited by hand. |
| `config/` | Lucide data and categories (synced), the filled list, metadata, and the icon-system contract. Not published. |
| `scripts/` | Repository-only sync, derivation, validation, and generation tooling. |
| [src/types/](../src/types/) | Public `IconProps`, variant, directionality, and manifest types. |
| [src/runtime/](../src/runtime/) | The shared `resolveIconProps` helper; hand-written, published runtime only. |
| `src/generated/`, `icon-manifest.json` | Generated components, root barrel, and manifest. Never edit by hand. |
| [src/index.ts](../src/index.ts), [src/manifest.ts](../src/manifest.ts) | Hand-written package entries; see [api.md](api.md). |
| `docs/` | Design, naming, accessibility, RTL, pipeline, and release contracts. |
| [playground/](../playground/) | Internal visual QA tool. Reads generated output; never published. |
| `tests/` | Config, Lucide sync, filled derivation, validation, generation, runtime, package, and playground checks; temporary fixtures only. |
| `dist/` | Build output, and the only thing published. Gitignored. |

Read [design.md](design.md) and [naming.md](naming.md) first. Accessibility and RTL expectations are
in [accessibility.md](accessibility.md) and [rtl.md](rtl.md). The pipeline and file ownership are
in [architecture.md](architecture.md).

## Common changes

- **Add or fix a filled drawing.** Edit [config/filled.ts](../config/filled.ts), run
  `bun run derive:filled` and `bun run generate`, and review it in the playground
  ([filled.md](filled.md#adding-a-filled-drawing)).
- **Change an RTL decision.** Edit the `mirrored` list in
  [config/icon-metadata.ts](../config/icon-metadata.ts) and run `bun run generate`
  ([rtl.md](rtl.md)).
- **Upgrade Lucide.** Follow [lucide.md](lucide.md#upgrading-lucide).

Commit the inputs together with what they produce: the config, the SVGs, and the generated files.
Public names and variant support are semver API; read [api.md](api.md#versioning) before any change
that adds, renames, or removes an icon or a filled drawing.

`bun run check:icons` is the source gate; it scans only the production `icons/` root and never
test fixtures. See [validation.md](validation.md) for rule codes and what still requires visual
review ([visual-qa.md](visual-qa.md)).

## CI

CI runs one job — see [the workflow](../.github/workflows/ci.yml):

```text
bun install -> lint -> typecheck -> test -> check:icons -> check:filled -> check:generated
            -> build -> playground:build
```

Three more workflows handle releases — `version.yml` bumps the patch version on a PR, `release.yml`
publishes on merge and then tags, and `rollback.yml` moves `latest` back. See
[releases.md](releases.md).

## Conventions

- **Biome owns formatting.** There is no ESLint and no Prettier. Run `bun run format` rather than
  arguing with it. `icons/` is excluded from Biome.
- **TypeScript is strict.** `verbatimModuleSyntax` is on, so type-only imports must use `import type`.
- **ESM only.**
- **Keep the public surface small.** Internal config is never a root export. Recommended sizes
  must not restrict the `size` prop.
- **Lucide artwork stays verbatim.** No hand edits to `icons/outline/`, `config/lucide.json`, or
  `config/categories.ts`; the next sync would undo them. Restating Lucide's rules in
  [config/icon-system.ts](../config/icon-system.ts) is fine; inventing per-icon geometry is not.
- **Tool-written files are never edited by hand.** That covers `icons/`, `src/generated/`, and
  `icon-manifest.json`. Their writers must be deterministic: no timestamps, and sort with an
  explicit codepoint comparator rather than `localeCompare`, so a file's bytes never depend on the
  machine that produced it. Category order follows
  [config/categories.ts](../config/categories.ts).
- **Dependencies need a concrete purpose.** Development dependencies are the XML parser, React and
  its types for typechecking and rendering tests, Vite for the playground, and `canvaskit-wasm` for
  the filled derivation; see [architecture.md](architecture.md#determinism-and-dependencies). Do
  not add runtime dependencies or install tools speculatively.
- **Build tooling stays in `scripts/`.** `src/runtime/` holds only code that generated components
  execute; nothing in `src/` may import from `scripts/` or `config/`.
- **Synthetic geometry only in tests.** Temporary filesystem fixtures must be cleaned up.

Before opening a PR, run installation, typechecking, linting, the Vitest suite, `check:icons`,
`check:filled`, `check:generated`, and the build. Do not commit, push, publish, or change Git
history unless that is the task.
