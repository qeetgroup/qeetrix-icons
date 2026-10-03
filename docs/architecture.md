# Architecture and phase boundaries

Phase 2A established the design contract and typed foundations. Phase 2B adds SVG/source validation
only. There are still no production SVG drawings, React components, normalizers, generators,
manifest, or playground. The technology direction remains Bun, strict TypeScript, React 19, and
ESM, with Biome and Vitest. React is not installed because no component or runtime code needs it.

## What exists now

| Surface | Responsibility |
|:--|:--|
| `icons/` | Human-authored SVG source location, currently only an empty-directory placeholder |
| [config/icon-system.ts](../config/icon-system.ts) | Internal, executable design contract: architecture plus calibration candidates |
| [config/categories.ts](../config/categories.ts) | Internal category IDs, display labels, purposes, and canonical array order |
| [src/types/icon.ts](../src/types/icon.ts) | Stable variant and directionality vocabulary |
| [src/index.ts](../src/index.ts) | Type-only public entry point |
| `scripts/check/` | Internal source-path, naming, SVG, variant, and repository collision validation |
| [scripts/lib/diagnostics.ts](../scripts/lib/diagnostics.ts) | Stable error codes, sorting, and CLI formatting |
| `docs/` | Authoring, semantic, accessibility, and architectural contracts |
| [tests/repository.test.ts](../tests/repository.test.ts) | Foundation consistency, package boundary, and empty-artwork checks |
| [tests/validation.test.ts](../tests/validation.test.ts) | Synthetic in-memory cases and isolated temporary scanner fixtures |
| `dist/` | Compiler output; the only build directory and published payload directory |

The main TypeScript config includes `config/`, `scripts/`, `src/`, tests, and the Vitest configuration
under strict checking. The build config keeps `rootDir` and `include` limited to `src/`. Internal config
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
        -> SVG + source validation  IMPLEMENTED
        -> normalization           FUTURE
        -> React generation        FUTURE
        -> manifest generation     FUTURE
        -> icon package exports    FUTURE
        -> generated/runtime tests FUTURE
        -> Qeetrix UI / Qeet products
```

`bun run check:icons` now validates production sources before later generation. It accepts zero
icons, reports deterministic errors, and is included in CI and release quality gates. XML parsing
and explicit allowlists enforce structure, not visual quality; see [validation.md](validation.md)
for rules and the limited path-token checks. Normalization must later be deterministic and must
not silently redesign human-authored artwork. SVG remains the artwork source of truth. Exact
normalization operations, manifest schema, and the emitted icon API remain future work.

## Future ownership map

The following names describe ownership boundaries. `icons/`, `config/`, and the source checks
exist today; generated output, runtime, and metadata do not.

| Kind | Location | Intended role |
|:--|:--|:--|
| SOURCE | `icons/` | Independently drawn canonical SVG masters |
| GENERATED | `src/generated/` | Deterministic React output owned by the generator, never hand-edited |
| RUNTIME | `src/runtime/` | Hand-maintained shared behavior only where generated components need it |
| METADATA | `icon-manifest.json` | Generated discovery and semantic metadata, including directionality |
| CONFIG | `config/` | Repository-internal contracts used by future tooling and tests |
| QUALITY GATES | `scripts/check/` | Implemented source checks; generated-output checks remain future work |

The source layout is now `icons/<variant>/<category>/<name>.svg`, using configured variants and
categories. No empty variant/category hierarchy is created yet. Build tooling under `scripts/build/`,
a playground, size-specific masters, and generated metadata's authored inputs remain deferred.

## Determinism and dependencies

Generators will be the only authors of generated files. Future output must not contain timestamps
or depend on machine locale. Use explicit codepoint ordering for generated name lists and preserve
the explicit taxonomy order when displaying categories. These are separate ordering requirements.
Generated-file drift checks arrive with the generator, not as placeholder scripts now.

Prefer no runtime dependencies beyond React when components exist. Add React 19 dependencies and
types only when their implementation needs them. Phase 2B adds the development-only XML parser
`@xmldom/xmldom`; [validation.md](validation.md) records its maintenance, security, and size review.
Neither it nor validator/config internals enters `dist/` or the public API. No optimization or
generation dependencies are added.

## Incremental delivery

| Phase | Scope |
|:--|:--|
| 2A, complete | Design contract, internal config, public concepts, and foundation tests |
| 2B, current | SVG validation architecture, source identity, diagnostics, tests, and quality gates |
| 2C | SVG-to-React generation pipeline |
| 2D | Manifest, package exports, and API contracts |
| 2E | Developer playground and visual QA |
| 3 | Calibration icon set and evidence-based geometry decisions |
| 4 | Actions category |
| 5 | Navigation category |
| 6 onward | Remaining categories, one at a time |

The runtime contracts in [accessibility.md](accessibility.md) and [rtl.md](rtl.md), and the visual
judgments in [drawing-guidelines.md](drawing-guidelines.md), still await later implementation or
calibration. Validation uses synthetic geometry only in tests, never production artwork or copied
third-party paths. See [releases.md](releases.md) before release work: the 1.x package version and
publishing behavior remain unchanged, and these foundations must not ship as a patch.

