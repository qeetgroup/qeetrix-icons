# Generation

One command turns validated source SVG into every published icon file: one React 19 component per
icon concept, the icon export barrel, and the icon manifest. The Qeet logos have their own generator,
`generate:logos` ([below](#qeet-logos)). The icon sources are the
Lucide outlines ([lucide.md](lucide.md)) and the drawings derived from them, round filled
([filled.md](filled.md)) and sharp ([sharp.md](sharp.md)); generation treats them all alike. The
consumer contract is in [api.md](api.md).

```text
icons/<style>-<variant>/<category>/<name>.svg  +  config/icon-metadata.ts (from config/lucide.json)
        -> scan + validate                    one validator, shared with check:icons
        -> group drawings by concept          every shape; outline required, filled optional
        -> one in-memory plan                 all-or-nothing
            -> src/generated/icons/<id>.tsx   one component per concept: shapes, typed variants
            -> src/generated/icon-index.ts    icon export barrel, re-exported by src/index.ts
            -> src/generated/icon-manifest.ts typed manifest, re-exported by src/manifest.ts
            -> icon-manifest.json             the same manifest, for repository tooling
```

**Everything under `src/generated/`, and `icon-manifest.json`, is generated: never edit them by
hand.** The sources are written by tools too (`sync:lucide`, `derive:filled`, and `derive:sharp`);
change their inputs, rerun them, and regenerate. Deleting the generated icon files and
regenerating recreates byte-identical files.

## Commands

```bash
bun run check:icons       # validate sources and metadata only
bun run generate          # validate, then write every generated file
bun run check:generated   # prove every generated file matches source; writes nothing
```

`generate` validates every source and the metadata before writing anything. Any error aborts with
the validation diagnostics and exit status 1, and no generated file is changed:

```text
QXI-XML-001 "icons/round-outline/files/example.svg"
  Malformed XML: ...
Generation aborted: icon validation failed with 1 error(s). No generated files were changed.
```

On an up-to-date tree, `generate` reports the source files it validated (every drawing in every
shape) and the components it generated (one per concept), and writes nothing:

```text
Validated <sources> production icons.
Generated <concepts> React icon components, the root exports, and the manifest (0 files written, 0 stale removed).
```

`check:generated` regenerates in memory and compares bytes with what is on disk. It reports a
missing, edited, or out-of-date component, barrel, manifest module, or manifest JSON, and any stale
icon output file in `src/generated/`, then exits 1. It does not use Git, so it works in any checkout
or extracted copy. Generated files are committed, so the build compiles them like any other source;
it does not regenerate. CI and the release gate run `check:icons`, `check:filled`, `check:sharp`,
`check:generated`, `check:brands`, and `check:logos` before the build. All of these CLIs are anchored to this repository rather
than the working directory.

## Pipeline responsibilities

| Step | Module | Responsibility |
|:--|:--|:--|
| Scan | [validate-repository.ts](../scripts/check/validate-repository.ts) `scanIconSources` | Read `icons/` without following links; the same scanner `check:icons` uses |
| Validate | `validateSources` | The only source of SVG, naming, collision, and metadata rules |
| Transform | [svg-to-react.ts](../scripts/lib/svg-to-react.ts) | Parse validated XML into a React-named element tree |
| Render components | [component-source.ts](../scripts/lib/component-source.ts) | Print each component module, already Biome-formatted |
| Render package files | [package-sources.ts](../scripts/lib/package-sources.ts) | Print the barrel, manifest module, and manifest JSON |
| Plan | [generation-plan.ts](../scripts/lib/generation-plan.ts) | Group drawings into concepts once, and build every file from those concepts |
| Write / verify | [generated-output.ts](../scripts/lib/generated-output.ts) | Safe preflight, then write and clean, or compare without writing |

The plan holds one entry per concept: its name and public id, component name, category and
categories, directionality, tags, aliases, output path, and its validated source drawings grouped
by style (round first) and in configured variant order within each, plus every file's contents. It
is internal tooling data; the manifest is its public projection. The grouping happens once, so
components, barrel, and manifest cannot disagree.

Diagnostics extend the validation codes in [validation.md](validation.md#diagnostics):

| Rule | Meaning |
|:--|:--|
| `QXI-GEN-001` | A validated source could not be converted; nothing is written |
| `QXI-GEN-002` | Generated output is unsafe or unreadable (link, conflict, forged path, I/O failure) |
| `QXI-GEN-003` | A generated file is missing, out of date, or stale |

## Concepts, names, paths, and metadata

```text
icons/round-outline/account/star.svg   (required: Lucide's drawing)
icons/round-filled/account/star.svg    (optional, derived from the round outline)
icons/sharp-outline/account/star.svg   (derived, required once any sharp drawing exists)
icons/sharp-filled/account/star.svg    (derived, present exactly when round-filled is)
        -> one concept: star, category account, shapes round | sharp, variants outline | filled
        -> src/generated/icons/star.tsx  exporting StarIcon(props: IconProps<"outline" | "filled">)
```

- **Concept**: every drawing with the same name, in every style. Validation guarantees, in each
  style, one outline drawing and at most one drawing per other variant; one category for all of
  them; and the same drawings in both styles. Grouping cannot fail.
- **Shapes**: each source style is a public `shape`. The default style, round, comes first and is
  what renders without a `shape` prop.
- **Public id**: the concept name. It is the generated file name, the `@qeetrix/icons/icons/<id>`
  subpath, and the manifest `id`. Shape and variant never appear in it.
- **Component name**: PascalCase of the name plus `Icon`, from the one canonical converter,
  `componentNameFromFilename` in [validate-source-path.ts](../scripts/check/validate-source-path.ts).
  Shape and variant never affect it.
- **Variant union**: the drawings that exist, in configured order, the same in every shape, written
  into the component's signature. Contributors never maintain it; adding or removing a filled
  drawing changes it. `shape` is never narrowed: every icon has both.
- **Flat output**: one module per concept at `src/generated/icons/<id>.tsx`, so the `./icons/*`
  package export maps straight onto it without exposing layout, and a category move changes no
  generated path. Each header names its source SVGs, up to four.
- **Category** comes from the source path. The rest comes from
  [config/icon-metadata.ts](../config/icon-metadata.ts), which the CLIs pass to the plan (library
  functions default to no metadata): **categories** (default: just the source folder), **tags**
  and **aliases** (default: none), and **directionality** (default:
  `iconSystem.architecture.defaultDirectionality`, "preserve"). Directionality is never inferred
  from a filename. One entry covers every drawing of a concept, and an entry for a missing name
  fails validation.

## Conversion rules

Generation converts; it does not redraw or optimize. There is no SVGO step.

- **Geometry is verbatim.** Every value keeps its exact source text, so precision never changes,
  and child elements keep their drawing order. Nothing is merged, removed, or rewritten.
- **Comments, whitespace, and the XML declaration are dropped.** They do not render; this
  includes the `Derived from` comment at the top of each filled source.
- **Attribute names use one explicit table**, for example `stroke-width` to `strokeWidth`,
  `stroke-miterlimit` to `strokeMiterlimit`, `fill-rule` to `fillRule`, `clip-rule` to
  `clipRule`, and `class` to `className`. An attribute
  without an entry fails generation rather than leaking an invalid JSX name. The table only
  decides spelling: `clip-rule` and `class` are mapped but still rejected by validation.
- **Values are always JSX string literals**, such as `strokeWidth="2"`, never `{2}`, so the
  source text is preserved exactly. A value that a string literal cannot carry verbatim fails.
- **Attributes are sorted by React name.** Authoring-tool attribute order is not meaningful in SVG,
  so it cannot change generated output.
- **Root attributes come from the source.** Validation already guarantees they match the style and
  variant contract, so the generator invents no paint or stroke values. `currentColor` is preserved
  and no fixed color is ever introduced.

## Generated files

An outline-only concept with round drawings only, from synthetic geometry at
`icons/round-outline/arrows/fixture.svg`, renders its one drawing with no branch:

```tsx
// Generated by @qeetrix/icons from icons/round-outline/arrows/fixture.svg.
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
      strokeWidth="2"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...resolveIconProps(props)}
    >
      <path d="M 5 7 L 11 13" />
    </svg>
  );
}
```

With both shapes and a filled drawing, as every production icon with a filled drawing has, each
non-default shape is one `if` block, checked first, and round is the fall-through. Within a shape,
each non-default variant is one `if` branch and outline is the fall-through. So no props,
`shape="round"`, and `variant="outline"` all render the same round outline:

```tsx
export function FixtureIcon(props: IconProps<"outline" | "filled">) {
  if (props.shape === "sharp") {
    if (props.variant === "filled") {
      return (
        <svg fill="currentColor" ... {...resolveIconProps(props)}>
          {/* the sharp filled source's geometry */}
        </svg>
      );
    }
    return (
      <svg fill="none" strokeLinecap="square" ... {...resolveIconProps(props)}>
        {/* the sharp outline source's geometry */}
      </svg>
    );
  }
  if (props.variant === "filled") {
    return (
      <svg fill="currentColor" ... {...resolveIconProps(props)}>
        {/* the round filled source's geometry */}
      </svg>
    );
  }
  return (
    <svg fill="none" stroke="currentColor" ... {...resolveIconProps(props)}>
      {/* the round outline source's geometry */}
    </svg>
  );
}
```

The barrel, `src/generated/icon-index.ts`, here for synthetic fixtures; with zero icons it is just
`export {};`:

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
- Each drawing keeps its own source root attributes and geometry; generation shares nothing
  between drawings. Filled and sharp sources were derived earlier, by `derive:filled` and
  `derive:sharp`; by the time generation reads them they are ordinary sources.
- The barrel contains only static re-exports, one per concept, ordered by public id. The
  hand-written [src/index.ts](../src/index.ts) re-exports it alongside the public types, so humans
  keep ownership of the root while generation owns the icon list.
- The manifest module, `src/generated/icon-manifest.ts`, and `icon-manifest.json` hold identical
  data, one entry per concept; see [api.md](api.md#manifest) for the schema. Each entry is printed
  expanded, with short arrays on one line and long ones, such as many tags, one item per line,
  exactly as Biome would print them. Adding an icon is a small, readable diff.
- Directionality is metadata only. Geometry is never mirrored and no `-rtl` names exist.

## Runtime decision

Each component renders its own `<svg>` directly, with geometry compiled to JSX at generation time.
The behavior every icon shares lives in one tiny hand-written function,
[resolveIconProps](../src/runtime/resolve-icon-props.ts), spread last onto the root of whichever
drawing is selected. It consumes `size`, `shape`, and `variant`, so neither `shape` nor `variant`
reaches the DOM, and it applies the same size, prop, ref, and accessibility handling to every
drawing.

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
  name; drawings within a concept by style, round first, then by configured variant order, which
  is also the order of `variants`. Nothing depends on filesystem enumeration order.
- No timestamps, absolute paths, Git data, machine data, random values, or environment values. LF
  newlines only.
- Every file is printed directly in Biome's format, so `generate` leaves it ready. Tests prove
  Biome would change nothing, including lines at the 100-column limit and very long names.
- Writing is preceded by a read-only preflight. Generation owns `src/generated/`, except the paths
  that belong to the separate logo generator (`logoGeneratedPaths` in
  [generation-plan.ts](../scripts/lib/generation-plan.ts)), which it never reads, writes, or
  removes, and exactly one file outside it, `icon-manifest.json`. The planned files must be exactly
  one canonical module per concept, whose validated sources agree on name and category and start
  with the default style and variant, plus the three fixed package files, each once. A leftover
  module for a former name, such as a variant-specific file, is stale and is removed. Symbolic or
  hard links, special files, and file/directory conflicts abort before anything is written. Cleanup
  deletes stale files only inside its part of `src/generated/`, then emptied subdirectories.
- Components are written first and the barrel and manifest last, and an invalid source or stale
  metadata entry aborts the whole run, so the artifacts always describe one coherent plan.

Two Biome overrides apply to generated code only. `organizeImports` is off for `src/generated/**`,
because the generator defines a deterministic codepoint order that Biome's natural sort would
reorder. `noSvgWithoutTitle` is off for `src/generated/icons/**`, because accessibility is
resolved at runtime and source SVG may not contain `<title>`. Formatting and every other lint rule
still apply, and `.gitattributes` marks the generated files so GitHub collapses their diffs. The
SVG sources in `icons/` are outside Biome.

## Qeet logos

`bun run generate:logos` ([generate-logos.ts](../scripts/build/generate-logos.ts), with
`scripts/lib/logo-*.ts`) is a separate generator that shares no code with the icon pipeline. It
reads [config/brands.json](../config/brands.json) and `icons/brand-icons/` and writes:

```text
src/generated/logos/<slug>.ts     one module per logo: every file as a data URI, typed variant union
src/generated/logo-index.ts       logo export barrel, re-exported by src/index.ts
src/generated/logo-manifest.ts    logoManifest, re-exported by src/manifest.ts
```

These three paths are `logoGeneratedPaths` in
[generation-plan.ts](../scripts/lib/generation-plan.ts). The icon generator never reads, writes, or
removes them, and the logo generator owns nothing else: it removes stale files only inside
`src/generated/logos/`. A test keeps the two lists in step. `bun run check:logos` regenerates in
memory and fails on any stale, missing, or extra logo file; it runs inside the Vitest suite.

Nothing is converted. Each logo module embeds its files byte for byte as `data:image/svg+xml` URIs,
records each file's intrinsic size for the aspect ratio, and renders through the shared
[render-logo.ts](../src/runtime/render-logo.ts) runtime. Its header names the source files, marks
the artwork as first-party, and gives the logo's license. Output is deterministic and ordered by slug. Like
`config/brands.json`, it is excluded from Biome's checks. See [logos.md](logos.md#components).

## Package boundary

The generators, validators, plans, metadata config, and filesystem helpers live in `scripts/` and
`config/` and never enter `dist/`. The package exports only the root, `./icons/*`,
`./manifest`, and `./package.json`; the runtime helpers and the generated barrels compile into
`dist/` but cannot be imported directly. See [api.md](api.md#entry-points).

## Not in this pipeline

No Storybook catalogue, Qeetrix UI integration, or SVG optimization.
