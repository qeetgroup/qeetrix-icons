# Architecture and phase boundaries

Phase 2A establishes the design contract and typed foundations only. There are no SVG drawings,
React components, source validators, normalizers, generators, manifest, or playground in this
checkout. The technology direction is Bun, strict TypeScript, React 19, and ESM, with Biome and
Vitest. React is not installed yet because no component or runtime code needs it.

## What exists now

| Surface | Responsibility |
|:--|:--|
| `icons/` | Human-authored SVG source location, currently only an empty-directory placeholder |
| [config/icon-system.ts](../config/icon-system.ts) | Internal, executable design contract: architecture plus calibration candidates |
| [config/categories.ts](../config/categories.ts) | Internal category IDs, display labels, purposes, and canonical array order |
| [src/types/icon.ts](../src/types/icon.ts) | Stable variant and directionality vocabulary |
| [src/index.ts](../src/index.ts) | Type-only public entry point |
| `docs/` | Authoring, semantic, accessibility, and architectural contracts |
| [tests/repository.test.ts](../tests/repository.test.ts) | Foundation consistency, package boundary, and empty-artwork checks |
| `dist/` | Compiler output; the only build directory and published payload directory |

The main TypeScript config includes `config/`, `src/`, tests, and the Vitest configuration under
strict checking. The build config keeps `rootDir` and `include` limited to `src/`. Internal config
may import public types, but public source and declarations must not depend on unpublished config.
This keeps calibration values and taxonomy out of the consumer API and build output.

## Public API now

```ts
import type { IconDirectionality, IconVariant } from "@qeetrix/icons";
```

`IconVariant` is `"outline" | "filled"`; `IconDirectionality` is `"mirror" | "preserve"`.
These types establish vocabulary, not component props or a promise of filled artwork for every
concept. The root JavaScript module exports no runtime values or icons. The existing
`@qeetrix/icons/package.json` subpath remains; no other package subpaths are added.

There is deliberately no `IconSize` union or full `IconProps` definition. The recommended sizes
are internal calibration targets, not the allowed values of a future React prop. The later API
must consider numeric sizes such as `18` and CSS lengths such as `"1em"` (for example, through a
`number | string` property) without prematurely promising its full semantics here.

## Intended future pipeline

```text
Human-authored SVG
        -> SVG validation
        -> normalization
        -> React generation
        -> manifest generation
        -> package exports
        -> tests
        -> Qeetrix UI / Qeet products
```

This is a direction, not a working build command. Validation must report source problems before
generation. Normalization must be deterministic and must not silently redesign human-authored
artwork. SVG remains the artwork source of truth; generated React is not an alternate drawing
surface. The exact SVG grammar, normalization operations, schema, and emitted API belong to their
later phases.

## Future ownership map

The following names describe intended boundaries. Only `icons/` and `config/` exist today.

| Kind | Location | Intended role |
|:--|:--|:--|
| SOURCE | `icons/` | Independently drawn canonical SVG masters |
| GENERATED | `src/generated/` | Deterministic React output owned by the generator, never hand-edited |
| RUNTIME | `src/runtime/` | Hand-maintained shared behavior only where generated components need it |
| METADATA | `icon-manifest.json` | Generated discovery and semantic metadata, including directionality |
| CONFIG | `config/` | Repository-internal contracts used by future tooling and tests |
| QUALITY GATES | `scripts/check/` | Source and generated-output checks introduced when needed |

Build tooling under `scripts/build/`, a playground, and category/variant source layout are deferred.
Do not create `icons/outline/`, `icons/filled/`, size-specific masters, or empty future infrastructure
as scaffolding in this phase. Where generated metadata's authored inputs live is also deferred.

## Determinism and dependencies

Generators will be the only authors of generated files. Future output must not contain timestamps
or depend on machine locale. Use explicit codepoint ordering for generated name lists and preserve
the explicit taxonomy order when displaying categories. These are separate ordering requirements.
Generated-file drift checks arrive with the generator, not as placeholder scripts now.

Prefer no runtime dependencies beyond React when components exist. Add React 19 dependencies and
types only when their implementation needs them. Do not add SVG tooling, another formatter, or an
abstraction without a concrete phase requirement. No dependencies are added for Phase 2A.

## Incremental delivery

| Phase | Scope |
|:--|:--|
| 2A, current | Design contract, internal config, public concepts, and foundation tests |
| 2B | SVG validation architecture |
| 2C | SVG-to-React generation pipeline |
| 2D | Manifest, package exports, and API contracts |
| 2E | Developer playground and visual QA |
| 3 | Calibration icon set and evidence-based geometry decisions |
| 4 | Actions category |
| 5 | Navigation category |
| 6 onward | Remaining categories, one at a time |

The contracts in [accessibility.md](accessibility.md), [rtl.md](rtl.md), and
[drawing-guidelines.md](drawing-guidelines.md) describe intended behavior, not implemented features.
No copied third-party artwork, fake SVG fixtures, or legacy catalogue architecture is needed to
verify these foundations. See [releases.md](releases.md) before any release work: Phase 2A does not
change the existing 1.x package version or publishing workflows and must not be shipped as a patch.
