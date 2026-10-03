# Architecture and phase boundaries

Phase 2A established the design contract and typed foundations. Phase 2B added SVG/source
validation. Phase 2C adds the SVG-to-React generation pipeline and the small shared runtime that
generated components use. There are still no production SVG drawings or generated components, and
no manifest, public icon exports, or playground. The technology direction remains Bun, strict
TypeScript, React 19, and ESM, with Biome and Vitest.

## What exists now

| Surface | Responsibility |
|:--|:--|
| `icons/` | Human-authored SVG source location, currently only an empty-directory placeholder |
| [config/icon-system.ts](../config/icon-system.ts) | Internal, executable design contract: architecture plus calibration candidates |
| [config/categories.ts](../config/categories.ts) | Internal category IDs, display labels, purposes, and canonical array order |
| [src/types/icon.ts](../src/types/icon.ts) | Stable variant and directionality vocabulary |
| [src/types/icon-props.ts](../src/types/icon-props.ts) | `IconProps` for generated components; not a root export yet |
| [src/runtime/resolve-icon-props.ts](../src/runtime/resolve-icon-props.ts) | Shared size and accessibility defaults for generated components |
| `src/generated/icons/` | Generated components; absent while there are no production icons |
| [src/index.ts](../src/index.ts) | Type-only public entry point |
| `scripts/check/` | Source validation and the `check:icons` and `check:generated` CLIs |
| `scripts/build/` | The `generate` CLI |
| `scripts/lib/` | Diagnostics, SVG-to-React conversion, rendering, planning, and safe output |
| `docs/` | Authoring, semantic, accessibility, generation, and architectural contracts |
| [tests/repository.test.ts](../tests/repository.test.ts) | Foundation consistency, package boundary, and empty-artwork checks |
| [tests/validation.test.ts](../tests/validation.test.ts) | Synthetic in-memory cases and isolated temporary scanner fixtures |
| [tests/generation.test.ts](../tests/generation.test.ts) | Conversion, determinism, Biome/TypeScript output checks, and output safety |
| [tests/runtime.test.ts](../tests/runtime.test.ts) | Rendering, props, refs, and accessibility of generated components |
| `dist/` | Compiler output; the only build directory and published payload directory |

The main TypeScript config includes `config/`, `scripts/`, `src/`, tests, and the Vitest configuration
under strict checking. The build config keeps `rootDir` and `include` limited to `src/`. Internal config
may import public types, but public source and declarations must not depend on unpublished config.
This keeps calibration values and taxonomy out of the consumer API and build output. The runtime
therefore repeats the default size of 24, and tests keep it equal to the config value.

## Public API now

```ts
import type { IconDirectionality, IconVariant } from "@qeetrix/icons";
```

`IconVariant` is `"outline" | "filled"`; `IconDirectionality` is `"mirror" | "preserve"`.
These types establish vocabulary, not component props or a promise of filled artwork for every
concept. The root JavaScript module exports no runtime values or icons. The existing
`@qeetrix/icons/package.json` subpath remains; no other package subpaths are added.

Phase 2C did not change this surface. `IconProps` and the runtime helper compile into `dist/` but
are not reachable through the package exports. `IconProps` accepts `size?: number | string`, not an
`IconSize` union: recommended sizes are internal calibration targets, not allowed values. Exposing
components, props, and variants publicly is Phase 2D work.

## Pipeline

```text
Human-authored SVG
        -> SVG/source validation   IMPLEMENTED  Phase 2B
        -> React generation        IMPLEMENTED  Phase 2C
        -> manifest generation     FUTURE       Phase 2D
        -> public exports/API      FUTURE       Phase 2D
        -> visual playground       FUTURE
        -> Qeetrix UI / Qeet products
```

`bun run check:icons` validates production sources. `bun run generate` reuses that validation,
aborts on any error without writing, and writes components to `src/generated/icons/`.
`bun run check:generated` proves committed output matches source. All three accept zero icons and
run in CI and release quality gates. See [validation.md](validation.md) and
[generation.md](generation.md).

There is no SVG normalization or optimization step. Generation converts validated sources to JSX
without changing geometry, precision, or drawing order. SVG remains the artwork source of truth.
The manifest schema and the public icon API remain future work.

## Ownership map

| Kind | Location | Role |
|:--|:--|:--|
| SOURCE | `icons/` | Independently drawn canonical SVG masters |
| GENERATED | `src/generated/icons/` | Deterministic React output owned by the generator, never hand-edited |
| RUNTIME | `src/runtime/` | Hand-maintained behavior shared by generated components, nothing else |
| METADATA | `icon-manifest.json` | Future generated discovery and semantic metadata, including directionality |
| CONFIG | `config/` | Repository-internal contracts used by tooling and tests |
| QUALITY GATES | `scripts/check/` | Source validation and generated-output drift checks |
| BUILD TOOLING | `scripts/build/`, `scripts/lib/` | Generation; never published |

The source layout is `icons/<variant>/<category>/<name>.svg`, using configured variants and
categories. Generated output mirrors it as `src/generated/icons/<variant>/<category>/<name>.tsx`.
No empty variant/category hierarchy is created in either tree. The manifest, a playground, and
size-specific masters remain deferred.

## Determinism and dependencies

Generators are the only authors of generated files. Output contains no timestamps, absolute paths,
or machine-dependent values. Generated name ordering uses explicit codepoint comparison, and
category ordering follows the explicit taxonomy order. These are separate ordering requirements.
`check:generated` enforces drift detection without relying on Git.

React 19 is the only peer dependency, and there are no runtime dependencies. The runtime helper
imports React only for types. Development dependencies are the XML parser `@xmldom/xmldom`
(Phase 2B; see [validation.md](validation.md)) and, from Phase 2C, `react`, `react-dom`, and their
types, which typecheck generated output and render it in tests. Generation uses no transformer,
optimizer, or formatter dependency: it prints Biome-formatted code directly.

## Incremental delivery

| Phase | Scope |
|:--|:--|
| 2A, complete | Design contract, internal config, public concepts, and foundation tests |
| 2B, complete | SVG validation architecture, source identity, diagnostics, tests, and quality gates |
| 2C, current | SVG-to-React generation pipeline, shared runtime, and generated-output checks |
| 2D | Manifest, package exports, and API contracts |
| 2E | Developer playground and visual QA |
| 3 | Calibration icon set and evidence-based geometry decisions |
| 4 | Actions category |
| 5 | Navigation category |
| 6 onward | Remaining categories, one at a time |

The accessibility contract in [accessibility.md](accessibility.md) is now implemented by the
runtime helper. The RTL contract in [rtl.md](rtl.md) and the visual judgments in
[drawing-guidelines.md](drawing-guidelines.md) still await later implementation or calibration.
Validation and generation use synthetic geometry only in tests, never production artwork or copied
third-party paths. See [releases.md](releases.md) before release work: the 1.x package version and
publishing behavior remain unchanged, and these foundations must not ship as a patch.
