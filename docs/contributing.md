# Contributing to `@qeetrix/icons`

> [!NOTE]
> The outline icons are Lucide's, synced from one pinned release ([lucide.md](lucide.md)). Do not
> add, draw, or edit outline SVGs here: a missing or flawed icon belongs upstream in Lucide, and
> arrives here with the next upgrade. The same goes for brand logos, which come byte for byte from
> theSVG ([logos.md](logos.md)). Contributions here are filled drawings ([filled.md](filled.md)),
> RTL decisions ([rtl.md](rtl.md)), tooling, and documentation.

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
| `bun run sync:lucide [version]` | Replace `icons/round-outline/` with a Lucide release, then derive and generate ([lucide.md](lucide.md)) |
| `bun run derive:filled [--category <id>]` | Write `icons/round-filled/` from `config/derived/` and the round outlines ([filled.md](filled.md)) |
| `bun run check:filled` | Fail if any round filled drawing is missing, stale, or unlisted |
| `bun run derive:sharp [--category <id>]` | Write `icons/sharp-outline/` and `icons/sharp-filled/` from the round outlines ([sharp.md](sharp.md)) |
| `bun run stamp:override <file>` | Record the outline an override was drawn against, and its hash ([filled.md](filled.md#overrides)) |
| `bun run check:sharp` | Fail if any sharp drawing is missing, stale, or not derived from an outline or recipe |
| `bun run sync:brands [commit]` | Replace `icons/brand-icons/` and `config/brands.json` with a theSVG commit ([logos.md](logos.md)) |
| `bun run check:brands` | Validate `config/brands.json` and every logo file (`QXB-*` codes) |
| `bun run generate:logos` | Write the logo modules, logo barrel, and logo manifest |
| `bun run check:logos` | Fail if any generated logo file is stale, missing, or extra |
| `bun run check:icons` | Source paths, naming, SVG structure, variants, collisions, and metadata |
| `bun run generate` | Validate, then write icon components, icon barrel, and icon manifest; aborts without writing on error |
| `bun run check:generated` | Fail if any generated icon file is missing, edited, out of date, or stale |
| `bun run playground` | Start the internal visual QA playground |
| `bun run playground:build` | Production-build the playground to prove it compiles |
| `bun run build` | `rm -rf dist` → `tsc` |

## Where things live

| | |
|:--|:--|
| `icons/round-outline/` | Lucide's outline SVGs. Written by `sync:lucide`; never edited by hand. |
| `icons/round-filled/` | Derived filled SVGs. Written by `derive:filled`; never edited by hand. |
| `icons/sharp-outline/`, `icons/sharp-filled/` | Derived sharp SVGs. Written by `derive:sharp`; never edited by hand. |
| `icons/brand-icons/` | theSVG's logo files, byte for byte. Written by `sync:brands`; never edited by hand. |
| `config/` | Lucide data and categories and the theSVG catalogue (synced), the filled list, metadata, and the icon-system contract. Not published. |
| `scripts/` | Repository-only sync, derivation, validation, and generation tooling. |
| [src/types/](../src/types/) | Public icon and logo props, variant, shape, directionality, and manifest types. |
| [src/runtime/](../src/runtime/) | The shared `resolveIconProps` and `renderLogo` helpers; hand-written, published runtime only. |
| `src/generated/`, `icon-manifest.json` | Generated icon and logo components, barrels, and manifests. Never edit by hand. |
| [src/index.ts](../src/index.ts), [src/manifest.ts](../src/manifest.ts) | Hand-written package entries; see [api.md](api.md). |
| `docs/` | Design, naming, accessibility, RTL, pipeline, and release contracts. |
| [playground/](../playground/) | Internal visual QA tool. Reads generated output; never published. |
| `tests/` | Config, Lucide and theSVG sync, filled and sharp derivation, validation, generation, logos, runtime, package, and playground checks; temporary fixtures only. |
| `dist/` | Build output, and the only thing published. Gitignored. |

Read [design.md](design.md) and [naming.md](naming.md) first. Accessibility and RTL expectations are
in [accessibility.md](accessibility.md) and [rtl.md](rtl.md). The pipeline and file ownership are
in [architecture.md](architecture.md).

## Common changes

- **Add or fix a filled drawing.** Edit its category's file in
  [config/derived/](../config/derived/README.md), run `bun run derive:filled --category <id>`,
  `bun run derive:sharp --category <id>`, and `bun run generate`, and review it in both shapes in
  the playground ([filled.md](filled.md#adding-a-filled-drawing)). Only if roles cannot get it
  right, draw an override and stamp it ([filled.md](filled.md#overrides)).
- **Change the sharp style.** Edit the rules in [scripts/lib/sharp.ts](../scripts/lib/sharp.ts), or
  `keepRound` or `tipHeight` in `config/derived/<category>.ts`, run `bun run derive:sharp` and
  `bun run generate`, and review every changed drawing and every override in a changed category
  ([sharp.md](sharp.md#changing-the-sharp-style)).
- **Change an RTL decision.** Edit the `mirrored` list in
  [config/icon-metadata.ts](../config/icon-metadata.ts) and run `bun run generate`
  ([rtl.md](rtl.md)).
- **Upgrade Lucide.** Follow [lucide.md](lucide.md#upgrading-lucide).
- **Update the brand logos.** Run `bun run sync:brands <commit>`; it validates the new files and
  regenerates the logo components itself. Review added, removed, and relicensed logos in the diff of
  `config/brands.json`; a removed logo is a major release ([logos.md](logos.md)).

Commit the inputs together with what they produce: the config, the SVGs, and the generated files.
Public names and variant support are semver API; read [api.md](api.md#versioning) before any change
that adds, renames, or removes an icon or a filled drawing.

`bun run check:icons` is the icon source gate; it scans only the production `icons/` root, skips
`icons/brand-icons/` (validated by `check:brands`), and never reads test fixtures. See
[validation.md](validation.md) for rule codes and what still requires visual review
([visual-qa.md](visual-qa.md)).

## CI

CI runs one job — see [the workflow](../.github/workflows/ci.yml):

```text
bun install -> lint -> typecheck -> test -> check:icons -> check:filled -> check:sharp
            -> check:generated -> check:brands -> check:logos -> build -> playground:build
```

CI also runs `check:brands` (every logo file against `config/brands.json`, including content
validation) and `check:logos` (generated logo output is current), in CI and in the release gate.

Three more workflows handle releases — `version.yml` bumps the patch version on a PR, `release.yml`
publishes on merge and then tags, and `rollback.yml` moves `latest` back. See
[releases.md](releases.md).

## Conventions

- **Biome owns formatting.** There is no ESLint and no Prettier. Run `bun run format` rather than
  arguing with it. `icons/`, `config/brands.json`, and the generated logo files are excluded from
  Biome.
- **TypeScript is strict.** `verbatimModuleSyntax` is on, so type-only imports must use `import type`.
- **ESM only.**
- **Keep the public surface small.** Internal config is never a root export. Recommended sizes
  must not restrict the `size` prop.
- **Upstream artwork stays verbatim.** No hand edits to `icons/round-outline/`,
  `config/lucide.json`, `config/categories.ts`, `icons/brand-icons/`, or `config/brands.json`; the
  next sync would undo them. Restating Lucide's rules in
  [config/icon-system.ts](../config/icon-system.ts) is fine; inventing per-icon geometry is not.
  Derivations follow general rules, and their per-icon exceptions (filled `roles`, sharp
  `keepRound` and `tipHeight`, hand-drawn overrides) each say why.
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
`check:filled`, `check:sharp`, `check:generated`, and the build, plus `check:brands` after any
logo sync. Do not commit, push, publish, or
change Git history unless that is the task.
