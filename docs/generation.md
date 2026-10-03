# Generation

One command turns validated production SVG into everything the package publishes: one React 19
component per icon concept, the root export barrel, and the icon manifest. Phase 2C built the component
pipeline; Phase 2D added the barrel, manifest, and authored metadata. There are still zero
production icons, so today generation writes an empty barrel and an empty manifest. The consumer
contract is in [api.md](api.md).

```text
icons/<variant>/<category>/<name>.svg   +   config/icon-metadata.ts
        -> scan + validate (Phase 2B)         one validator, shared with check:icons
        -> group drawings by concept          outline required, filled optional
        -> one in-memory plan                 all-or-nothing
            -> src/generated/icons/<id>.tsx   one component per concept, typed variant union
            -> src/generated/index.ts         root export barrel
            -> src/generated/manifest.ts      typed manifest (@qeetrix/icons/manifest)
            -> icon-manifest.json             the same manifest, for repository tooling
```

**Design happens in `icons/`. Everything under `src/generated/`, and `icon-manifest.json`, is
generated: never edit them by hand.** Change the SVG or the metadata and regenerate. Deleting the
generated files and regenerating recreates byte-identical files.

## Commands

```bash
bun run check:icons       # validate sources and metadata only
bun run generate          # validate, then write every generated file
bun run check:generated   # prove every generated file matches source; writes nothing
```

`generate` validates every source and the metadata before writing anything. Any error aborts with
the Phase 2B diagnostics and exit status 1, and no generated file is changed:

```text
QXI-XML-001 "icons/outline/actions/example.svg"
  Malformed XML: ...
Generation aborted: icon validation failed with 1 error(s). No generated files were changed.
```

On an up-to-date tree, both commands succeed:

```text
Validated 12 production icons.
Generated 12 React icon components, the root exports, and the manifest (0 files written, 0 stale removed).
```

`check:generated` regenerates in memory and compares bytes with what is on disk. It reports a
missing, edited, or out-of-date component, barrel, manifest module, or manifest JSON, and any stale
file in `src/generated/`, then exits 1. It does not use Git, so it works in any checkout or
extracted copy. Generated files are committed, so the build compiles them like any other source;
it does not regenerate. CI and the release gate run `check:icons` and `check:generated` before
the build. Both CLIs, like `check:icons`, are anchored to this repository rather than the working
directory.

## Pipeline responsibilities

| Step | Module | Responsibility |
|:--|:--|:--|
| Scan | [validate-repository.ts](../scripts/check/validate-repository.ts) `scanIconSources` | Read `icons/` without following links; the same scanner `check:icons` uses |
| Validate | `validateSources` (Phase 2B) | The only source of SVG, naming, collision, and metadata rules |
| Transform | [svg-to-react.ts](../scripts/lib/svg-to-react.ts) | Parse validated XML into a React-named element tree |
| Render components | [component-source.ts](../scripts/lib/component-source.ts) | Print each component module, already Biome-formatted |
| Render package files | [package-sources.ts](../scripts/lib/package-sources.ts) | Print the barrel, manifest module, and manifest JSON |
| Plan | [generation-plan.ts](../scripts/lib/generation-plan.ts) | Group drawings into concepts once, and build every file from those concepts |
| Write / verify | [generated-output.ts](../scripts/lib/generated-output.ts) | Safe preflight, then write and clean, or compare without writing |

The plan holds one entry per concept: its name and public id, component name, category,
directionality, output path, and its validated source drawings in configured variant order, plus
every file's contents. It is internal tooling data; the manifest is its public projection. The
grouping happens once, so components, barrel, and manifest cannot disagree.

Diagnostics extend the Phase 2B codes:

| Rule | Meaning |
|:--|:--|
| `QXI-GEN-001` | A validated source could not be converted; nothing is written |
| `QXI-GEN-002` | Generated output is unsafe or unreadable (link, conflict, forged path, I/O failure) |
| `QXI-GEN-003` | A generated file is missing, out of date, or stale |

## Concepts, names, paths, and metadata

```text
icons/outline/status/star.svg   (required)
icons/filled/status/star.svg    (optional, separately drawn)
        -> one concept: star, category status, variants outline | filled
        -> src/generated/icons/star.tsx  exporting StarIcon(props: IconProps<"outline" | "filled">)
```

- **Concept**: every drawing with the same name. Validation guarantees one outline drawing, at most
  one drawing per other variant, and one category, so grouping cannot fail.
- **Public id**: the concept name. It is the generated file name, the `@qeetrix/icons/icons/<id>`
  subpath, and the manifest `id`. Variant never appears in it.
- **Component name**: PascalCase of the name plus `Icon`, from the one canonical converter,
  `componentNameFromFilename` in [validate-source-path.ts](../scripts/check/validate-source-path.ts).
  Variant never affects it.
- **Variant union**: the drawings that exist, in configured order, written into the component's
  signature. Contributors never maintain it; adding or removing a filled SVG changes it.
- **Flat output**: one module per concept at `src/generated/icons/<id>.tsx`, so the `./icons/*`
  package export maps straight onto it without exposing layout, and a category move changes no
  generated path. Each header names its source SVGs.
- **Category** comes from the source path. **Directionality** defaults to
  `iconSystem.architecture.defaultDirectionality` ("preserve") and can be overridden per concept
  in [config/icon-metadata.ts](../config/icon-metadata.ts), which the CLIs pass to the plan (library
  functions default to no metadata). It is never inferred from a filename.
  One entry covers every drawing of a concept, and an entry for a missing name fails validation.

## Conversion rules

Generation converts; it does not redraw or optimize. There is no SVGO step.

- **Geometry is verbatim.** Every value keeps its exact source text, so precision never changes,
  and child elements keep their drawing order. Nothing is merged, removed, or rewritten.
- **Comments, whitespace, and the XML declaration are dropped.** They do not render.
- **Attribute names use one explicit table**, for example `stroke-width` to `strokeWidth`,
  `fill-rule` to `fillRule`, `clip-rule` to `clipRule`, and `class` to `className`. An attribute
  without an entry fails generation rather than leaking an invalid JSX name. The table only
  decides spelling: `clip-rule` and `class` are mapped but still rejected by validation.
- **Values are always JSX string literals**, such as `strokeWidth="1.75"`, never `{1.75}`, so the
  source text is preserved exactly. A value that a string literal cannot carry verbatim fails.
- **Attributes are sorted by React name.** Authoring-tool attribute order is not meaningful in SVG,
  so it cannot change generated output.
- **Root attributes come from the source.** Validation already guarantees they match the variant
  contract, so the generator invents no paint or stroke values. `currentColor` is preserved and
  no fixed color is ever introduced.

## Generated files

An outline-only concept, from synthetic geometry at `icons/outline/actions/fixture.svg`, renders its
one drawing with no branch:

```tsx
// Generated by @qeetrix/icons from icons/outline/actions/fixture.svg.
// Do not edit this file directly. Edit the source SVG and run `bun run generate`.

import { resolveIconProps } from "../../runtime/resolve-icon-props.js";
import type { IconProps } from "../../types/icon-props.js";

export function FixtureIcon(props: IconProps<"outline">) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...resolveIconProps(props)}
    >
      <path d="M 5 7 L 11 13" />
    </svg>
  );
}
```

With a filled drawing as well, each non-default drawing is one `if` branch and outline is the
fall-through, so no `variant` and `variant="outline"` render the same thing:

```tsx
export function FixtureIcon(props: IconProps<"outline" | "filled">) {
  if (props.variant === "filled") {
    return (
      <svg fill="currentColor" ... {...resolveIconProps(props)}>
        {/* the filled source's geometry */}
      </svg>
    );
  }
  return (
    <svg fill="none" stroke="currentColor" ... {...resolveIconProps(props)}>
      {/* the outline source's geometry */}
    </svg>
  );
}
```

The barrel, here for synthetic fixtures; with zero icons it is just `export {};`:

```ts
// Generated by @qeetrix/icons from icons/. Do not edit this file directly.
// Run `bun run generate` to update it.

export { FixtureArrowIcon } from "./icons/fixture-arrow.js";
export { FixtureSearchIcon } from "./icons/fixture-search.js";
export { FixtureStarIcon } from "./icons/fixture-star.js";
```

- One named function export per concept; no default export, no `forwardRef`, no `displayName`
  (the function name already identifies it), and no `"use client"`. Icons are pure and work in
  Server Components, Client Components, and SSR.
- Each drawing keeps its own authored root attributes and geometry; nothing is shared or derived
  between outline and filled.
- The barrel contains only static re-exports, one per concept, ordered by public id. The
  hand-written [src/index.ts](../src/index.ts) re-exports it alongside the public types, so humans
  keep ownership of the root while generation owns the icon list.
- The manifest module and JSON hold identical data, one entry per concept; see
  [api.md](api.md#manifest) for the schema. Each entry is printed expanded, so adding an icon is a
  small, readable diff.
- Directionality is metadata only. Geometry is never mirrored and no `-rtl` names exist.

## Runtime decision

Each component renders its own `<svg>` directly, with geometry compiled to JSX at generation time.
The behavior every icon shares lives in one tiny hand-written function,
[resolveIconProps](../src/runtime/resolve-icon-props.ts), spread last onto the root of whichever
drawing is selected. It consumes `size` and `variant`, so `variant` never reaches the DOM, and it
applies the same size, prop, ref, and accessibility handling to every drawing.

Alternatives considered:

- **Inline logic in every file** repeats the size and accessibility code in each icon, enlarging
  every bundle that imports several icons and making the behavior testable only through
  generated fixtures.
- **A `createIcon` factory or a shared `<Icon>` wrapper** turns geometry into runtime data or adds
  a component layer to every render. Neither is needed for a fixed, validated SVG subset.

The helper is a pure function with no React import at runtime, no context, registry, hooks, or
SVG parsing. A bundler includes it once however many icons are imported. Props and accessibility
behavior are documented in [api.md](api.md#props) and [accessibility.md](accessibility.md).

## Determinism and safety

- The barrel is ordered by public id in codepoint order; the manifest by configured category, then
  name; drawings within a concept, and its `variants`, by configured variant order. Nothing depends on filesystem enumeration order.
- No timestamps, absolute paths, Git data, machine data, random values, or environment values. LF
  newlines only.
- Every file is printed directly in Biome's format, so `generate` leaves it ready. Tests prove
  Biome would change nothing, including lines at the 100-column limit and very long names.
- Writing is preceded by a read-only preflight. Generation owns all of `src/generated/` and exactly
  one file outside it, `icon-manifest.json`. The planned files must be exactly one canonical
  module per concept, whose validated sources agree on name and category and start with the
  default variant, plus the three fixed package files, each once. A leftover module for a former
  name, such as a variant-specific file, is stale and is removed.
  Symbolic or hard links, special files, and file/directory conflicts abort before anything is
  written. Cleanup deletes stale files only inside `src/generated/`, then emptied subdirectories.
- Components are written first and the barrel and manifest last, and an invalid source or stale
  metadata entry aborts the whole run, so the artifacts always describe one coherent plan.

Two Biome overrides apply to generated code only. `organizeImports` is off for `src/generated/**`,
because the generator defines a deterministic codepoint order that Biome's natural sort would
reorder. `noSvgWithoutTitle` is off for `src/generated/icons/**`, because accessibility is
resolved at runtime and source SVG may not contain `<title>`. Formatting and every other lint rule
still apply, and `.gitattributes` marks the generated files so GitHub collapses their diffs.

## Package boundary

The generator, validator, plan, metadata config, and filesystem helpers live in `scripts/` and
`config/` and never enter `dist/`. The package exports only the root, `./icons/*`, `./manifest`,
and `./package.json`; the runtime helper and the generated barrel compile into `dist/` but cannot
be imported directly. See [api.md](api.md#entry-points).

## Not in this pipeline yet

No Storybook catalogue, search aliases or keywords, Qeetrix UI integration, or SVG optimization.
