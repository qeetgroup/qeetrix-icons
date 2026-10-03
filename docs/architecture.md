# Architecture and phase boundaries

Phase 2A established the design contract and typed foundations. Phase 2B added SVG/source
validation. Phase 2C added the SVG-to-React generation pipeline and its shared runtime. Phase 2D
added the manifest, the generated root exports, per-icon subpaths, and the public API contract in
[api.md](api.md): one component per icon concept, with a `variant` prop typed to its drawings.
Phase 2E added the developer playground for human visual QA ([visual-qa.md](visual-qa.md)).
Phase 3A adds the first original artwork: four outline-only calibration primitives, logged in
[calibration.md](calibration.md). The visual system is not yet calibrated. The
technology direction remains Bun, strict TypeScript, React 19, and ESM, with Biome and Vitest.

## What exists now

| Surface | Responsibility |
|:--|:--|
| `icons/` | Human-authored SVG sources; currently the four Phase 3A calibration drawings |
| [config/icon-system.ts](../config/icon-system.ts) | Internal, executable design contract: architecture plus calibration candidates |
| [config/categories.ts](../config/categories.ts) | Internal category IDs, display labels, purposes, and canonical array order |
| [config/icon-metadata.ts](../config/icon-metadata.ts) | Authored exceptions to derived metadata; currently only directionality, currently empty |
| [src/types/icon.ts](../src/types/icon.ts) | Stable variant and directionality vocabulary |
| [src/types/icon-props.ts](../src/types/icon-props.ts) | Public `IconProps` |
| [src/types/icon-manifest.ts](../src/types/icon-manifest.ts) | Public manifest schema types |
| [src/runtime/resolve-icon-props.ts](../src/runtime/resolve-icon-props.ts) | Shared size and accessibility defaults for generated components |
| `src/generated/` | Generated barrel, manifest module, and one component module per concept |
| [src/index.ts](../src/index.ts) | Hand-written root: re-exports the generated barrel and the public types |
| [src/manifest.ts](../src/manifest.ts) | Hand-written `@qeetrix/icons/manifest` entry |
| `icon-manifest.json` | Generated manifest for repository tooling; not published |
| `scripts/check/` | Source validation and the `check:icons` and `check:generated` CLIs |
| `scripts/build/` | The `generate` CLI |
| `scripts/lib/` | Diagnostics, SVG-to-React conversion, rendering, planning, and safe output |
| `playground/` | Internal Vite + React visual QA tool; reads generated output, never published |
| `docs/` | Authoring, semantic, accessibility, generation, visual QA, and architectural contracts |
| [tests/repository.test.ts](../tests/repository.test.ts) | Foundation consistency, package boundary, and empty-artwork checks |
| [tests/validation.test.ts](../tests/validation.test.ts) | Synthetic in-memory cases and isolated temporary scanner fixtures |
| [tests/generation.test.ts](../tests/generation.test.ts) | Conversion, determinism, Biome/TypeScript output checks, and output safety |
| [tests/runtime.test.ts](../tests/runtime.test.ts) | Rendering, props, refs, and accessibility of generated components |
| [tests/package.test.ts](../tests/package.test.ts) | Packed-tarball resolution, type, boundary, contents, and tree-shaking checks |
| [tests/playground.test.ts](../tests/playground.test.ts) | Playground data model, URL state, boundary, and a fixture build |
| `dist/` | Compiler output; the only build directory and published payload directory |

The main TypeScript config includes `config/`, `scripts/`, `src/`, tests, and the Vitest configuration
under strict checking. The build config keeps `rootDir` and `include` limited to `src/`. Internal config
may import public types, but public source and declarations must not depend on unpublished config.
This keeps calibration values and taxonomy out of the consumer API and build output. The runtime
therefore repeats the default size of 24, and tests keep it equal to the config value.

## Public API now

[api.md](api.md) is the contract. In short:

```tsx
import { StarIcon, type IconProps } from "@qeetrix/icons"; // future icons
import { StarIcon } from "@qeetrix/icons/icons/star";
import { iconManifest } from "@qeetrix/icons/manifest";

<StarIcon />                 // outline, the default
<StarIcon variant="filled" /> // only where a filled drawing exists; otherwise a type error
```

Each concept is one `<Name>Icon` export whose `variant` prop accepts exactly the drawings that
exist; there is no category or variant in any name or path. The root exports every generated icon plus the `IconProps`,
`IconVariant`, and `IconDirectionality` types, and never imports the manifest. With zero icons it
exports only those types. Everything else in `dist/` is unreachable through the exports map.

## Pipeline

```text
Human-authored variant SVGs
        -> SVG/source validation   IMPLEMENTED  Phase 2B
        -> group by concept        IMPLEMENTED  Phase 2D
        -> React generation        IMPLEMENTED  Phase 2C, one component and variant union per concept
        -> manifest generation     IMPLEMENTED  Phase 2D
        -> public exports          IMPLEMENTED  Phase 2D
        -> developer playground    IMPLEMENTED  Phase 2E
        -> human visual QA         READY        docs/visual-qa.md
        -> calibration artwork     IN PROGRESS  Phase 3A: plus, x, check, chevron-down
        -> Qeetrix UI / Qeet products
```

`bun run check:icons` validates production sources and authored metadata. `bun run generate`
reuses that validation, groups outline and optional filled drawings into concepts, aborts on any
error without writing, and writes the components, root barrel, and manifest from one plan. `bun run check:generated` proves every generated file matches
source. All three accept zero icons and
run in CI and release quality gates. See [validation.md](validation.md) and
[generation.md](generation.md).

There is no SVG normalization or optimization step. Generation converts validated sources to JSX
without changing geometry, precision, or drawing order. SVG remains the artwork source of truth.

## Ownership map

| Kind | Location | Role |
|:--|:--|:--|
| SOURCE | `icons/` | Independently drawn canonical SVG masters |
| GENERATED | `src/generated/`, `icon-manifest.json` | Components, root barrel, and manifest owned by the generator, never hand-edited |
| RUNTIME | `src/runtime/` | Hand-maintained behavior shared by generated components, nothing else |
| PUBLIC ENTRIES | `src/index.ts`, `src/manifest.ts`, `src/types/` | Hand-maintained package surface |
| CONFIG | `config/` | Repository-internal contracts and authored metadata exceptions |
| QUALITY GATES | `scripts/check/` | Source validation and generated-output drift checks |
| BUILD TOOLING | `scripts/build/`, `scripts/lib/` | Generation; never published |

The source layout is `icons/<variant>/<category>/<name>.svg`, using configured variants and
categories. Generated components are flat, `src/generated/icons/<id>.tsx`, one per concept and
keyed by public id, so neither category, variant, nor source layout leaks into package paths. No empty variant/category
hierarchy is created. A playground and size-specific masters remain deferred.

## Determinism and dependencies

Generators are the only authors of generated files. Output contains no timestamps, absolute paths,
or machine-dependent values. Generated name ordering uses explicit codepoint comparison, and
category ordering follows the explicit taxonomy order. These are separate ordering requirements.
`check:generated` enforces drift detection without relying on Git.

React 19 is the only peer dependency, and there are no runtime dependencies. The runtime helper
imports React only for types. Development dependencies are the XML parser `@xmldom/xmldom`
(Phase 2B; see [validation.md](validation.md)) and, from Phase 2C, `react`, `react-dom`, and their
types, which typecheck generated output and render it in tests. Generation uses no transformer,
optimizer, or formatter dependency: it prints Biome-formatted code directly. Phase 2E declares
`vite`, already installed as Vitest's dependency, to run and build the playground. There is no
React plugin, UI kit, router, or icon library; the playground uses React, native controls, and
local CSS tokens.

The playground enumerates generated modules with Vite's `import.meta.glob`, inside `playground/`
only. The package still has no registry and no `<Icon name>` API, and nothing in the playground is
exported or published: `files` ships only `dist/`, and the playground builds to `playground/dist/`.

## Incremental delivery

| Phase | Scope |
|:--|:--|
| 2A, complete | Design contract, internal config, public concepts, and foundation tests |
| 2B, complete | SVG validation architecture, source identity, diagnostics, tests, and quality gates |
| 2C, complete | SVG-to-React generation pipeline, shared runtime, and generated-output checks |
| 2D, complete | Manifest, package exports, and API contracts |
| 2E, complete | Developer playground and visual QA foundation |
| 3A, current | First calibration batch: plus, x, check, chevron-down |
| 3 | Calibration icon set and evidence-based geometry decisions |
| 4 | Actions category |
| 5 | Navigation category |
| 6 onward | Remaining categories, one at a time |

The accessibility contract in [accessibility.md](accessibility.md) is now implemented by the
runtime helper. Directionality is recorded in the manifest and previewed in the playground; RTL
runtime behavior in [rtl.md](rtl.md) and the visual judgments in
[drawing-guidelines.md](drawing-guidelines.md) still await later implementation or calibration.
Validation and generation use synthetic geometry only in tests, never production artwork or copied
third-party paths. See [releases.md](releases.md) before release work: the 1.x package version and
publishing behavior remain unchanged, and these foundations must not ship as a patch.
