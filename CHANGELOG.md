# @qeetrix/icons

## Unreleased — 2.0.0

### Major Changes

- **Qeetrix Icons 2.0 reset.** The package is being rebuilt from scratch with original
  Qeetrix-designed artwork. The reset removed the 1.x catalogue; new 2.0 icons will be recorded here
  as they land.

  **Removed**

  - The entire 1.x icon catalogue: every icon component, and the source SVGs under
    `icons/round-outline/` and `icons/round-solid/` (plus the empty `icons/sharp-outline/` and
    `icons/sharp-solid/`).
  - The `@qeetrix/icons/icons/<category>/<name>` deep-import subpath.
  - The `QeetrixIcon`, `QeetrixIconProps`, `IconVariant` and `IconShape` types, and with them the
    `variant` and `shape` props and the white default colour.
  - The `react` peer dependency — the package currently contains no React components.
  - The `generate` and `generate:check` scripts, and the example viewer app.

  **Current state.** The `@qeetrix/icons` root exports the `IconProps`, `IconVariant`, and
  `IconDirectionality` types and, once icons exist, every generated icon component. There are no
  production icons yet. The new API does not restore the removed one. Do not rely on any 1.x icon
  name, prop, type, or import path for 2.0.

### Foundations (Phase 2A)

- Added the internal icon-system contract, separating stable architecture from visual calibration
  candidates, and an ordered taxonomy of 20 enterprise/product categories.
- Documented original geometry, optical sizing, typography harmony, semantic naming, selective
  filled variants, accessibility, RTL behavior, and future pipeline ownership.
- Added type-only public concepts: `IconVariant = "outline" | "filled"` and
  `IconDirectionality = "mirror" | "preserve"`. Recommended sizes are not a runtime size restriction.
- Included internal config in strict typechecking and extended foundation tests for configuration,
  taxonomy, public boundaries, and the absence of SVG artwork.
- Added no artwork, runtime, generator, validator, manifest, playground, or dependencies. Package
  version, export paths, and publishing workflows remain unchanged.

### Source validation (Phase 2B)

- Added `bun run check:icons` for source paths, semantic filenames, variants, configured categories,
  and repository-wide canonical-name, case-insensitive, and normalized-export collisions.
- Added strict XML parsing and explicit SVG element/attribute allowlists, inherited-color and
  outline-calibration checks, minimal filled rules, and numeric/path-token checks. Visual bounds,
  optical quality, and a full path grammar remain deferred.
- Added deterministic error diagnostics, production-root-only scanning, fixture isolation, and
  positive/negative tests using synthetic in-memory geometry and temporary repositories.
- Added the development-only `@xmldom/xmldom` parser, internal tooling typechecking, and the source
  gate in CI and existing release quality checks. Publishing behavior and version are unchanged.
- Production artwork remains empty. No React icons, runtime, generator, manifest, playground, or
  public API additions are included.

### SVG to React generation (Phase 2C)

- Added `bun run generate`, which reuses Phase 2B scanning and validation, aborts without writing
  on any error, and converts validated SVG into one React 19 component per source under
  `src/generated/icons/<variant>/<category>/<name>.tsx`.
- Conversion preserves geometry text and drawing order exactly, maps attribute names through one
  explicit table, and emits already Biome-formatted, deterministic code with a generated-file
  header. No SVG optimizer, transformer, or formatter dependency is used.
- Added `bun run check:generated`, which detects missing, edited, out-of-date, and stale generated
  files without writing or using Git, and runs in CI and the release quality gate.
- Output writes are limited to `src/generated/icons/` behind a read-only preflight that rejects
  links, forged paths, and file/directory conflicts; stale files are removed only inside it.
- Added the internal `IconProps` type and the shared `resolveIconProps` runtime: `size` (number or
  CSS length, default 24), native SVG props and React 19 refs, and decorative-by-default
  accessibility that becomes `role="img"` when an accessible name is supplied.
- React 19 is now the peer dependency; `react`, `react-dom`, and their types are development
  dependencies for typechecking and rendering tests.
- Production artwork and generated components remain empty. The root package API, export paths,
  and version are unchanged; no manifest, public icon exports, or playground are included.

### Manifest, package exports, and public API (Phase 2D)

- Locked the public API to one component per icon concept: `<StarIcon />` renders the outline
  drawing, and `<StarIcon variant="filled" />` selects the filled one where it exists. Each
  generated component types `variant` to its own drawings (`IconProps<"outline">` or
  `IconProps<"outline" | "filled">`), so an unavailable or unknown variant is a type error, and
  `variant` never reaches the DOM. Outline is the stable default. No export name or import path
  contains a category or variant.
- Outline and filled remain separately drawn SVGs. Every concept now requires its outline drawing
  (`QXI-VAR-001`); filled is optional and must share the outline's category (`QXI-DUP-004`). Source
  names ending in `-filled` or `-outline` are rejected.
- `bun run generate` groups drawings into concepts and writes one flat module per concept,
  `src/generated/icons/<id>.tsx`, plus a generated root barrel of static re-exports, a typed
  manifest module, and `icon-manifest.json`, all from the same validated plan. `check:generated`
  covers every generated file, and generation now owns all of `src/generated/`.
- Added the concept-level manifest schema (`schemaVersion` 1: `id`, `name`, `componentName`,
  `category`, `variants`, `directionality`) and `config/icon-metadata.ts` for authored exceptions.
  Directionality defaults to `preserve`; overrides for missing icons fail validation
  (`QXI-META-001`/`002`).
- Package exports: `@qeetrix/icons` (icons plus `IconProps`, `IconVariant`, `IconDirectionality`),
  `@qeetrix/icons/icons/<id>`, `@qeetrix/icons/manifest`, and `package.json`. Everything else is
  unreachable. `IconProps` is now public and generic over variants. The root never imports the
  manifest, and the manifest never imports an icon.
- Added packed-tarball tests for Node ESM and TypeScript `bundler`/`nodenext` resolution, typed
  variants, blocked internal paths, published contents, and per-concept bundler tree shaking, plus
  [docs/api.md](docs/api.md).
- Revised before release: an earlier local draft of this phase exposed filled drawings as separate
  `<Name>FilledIcon` exports with `-filled` subpaths and one manifest record per drawing. That
  model was replaced by the `variant` prop and concept-level manifest above and never shipped.
- Production artwork, generated components, and manifest records remain zero. Version, release
  triggers, and dependencies are unchanged; no playground or Storybook catalogue is included.

### Developer playground and visual QA (Phase 2E)

- Added the internal playground (`bun run playground`, `bun run playground:build`): a Vite + React
  19 tool that derives its catalogue from the generated manifest and modules, with search, category
  (in configured order), variant, and directionality filters, and shareable URL state.
- The inspector shows recommended sizes from config with emphasized 14 and 16 px pixel views, a
  custom size, a 24×24 construction view with unit grid, center axes, and the candidate safe area,
  a labelled stroke-calibration comparison beside the actual source rendering, outline/filled
  comparison, light/dark surfaces, currentColor tokens, representative interface contexts, Qeet UI
  and Qeet Text typography rows with real font-availability detection, an LTR/RTL QA preview, public
  imports, a review checklist, and the provisional calibration values.
- Added internal `calibration.strokeCandidates` to the icon-system config, used only by the
  playground, and [docs/visual-qa.md](docs/visual-qa.md) for the human review process.
- `playground:build` runs in CI. The playground is never published, writes no generated or source
  file, and needs no network. `vite` is declared as a development dependency (already installed
  through Vitest); no React plugin, UI kit, router, or icon library was added.
- Production artwork, generated components, and manifest records remain zero. The public package
  API, exports, and version are unchanged.

### First calibration batch (Phase 3A)

- Added the first original Qeetrix artwork, four outline-only primitives: `PlusIcon`, `XIcon`, and
  `CheckIcon` in `actions`, and `ChevronDownIcon` in `navigation`. All use the configured 1.75
  stroke, round caps and joins, and `preserve` directionality. No filled drawings.
- Geometry was constructed on the 24-unit grid and reviewed in the playground at every recommended
  size, at 1× pixels, on the construction grid, against stroke candidates, on light and dark
  surfaces, and beside text. Findings are recorded in [docs/calibration.md](docs/calibration.md).
- Stroke width, safe area, caps and joins, and the rest of the visual system remain provisional.
  These icons are for calibration and are not ready for product migration.
- Tests now check the calibration concepts, their outline-only typing, and per-concept
  tree-shaking of the real icons in the packed package. The version is unchanged.

---

Everything below is **historical** and describes the 1.x line only.

Releases after 1.0.0 were not recorded in this file. By 1.0.4, the icon set described under 1.0.0 had
been replaced by the catalogue that the 2.0 reset removes: 1,166 icon components with `variant` and
`shape` props, white by default.

## 1.0.0

### Major Changes

- 1.0.0 — the icon API is now stable.

  Nothing about the package changes in this release. The version number is the change: icon names,
  component names, props and entry points are now covered by semantic versioning, so a minor or patch
  upgrade can add icons and correct artwork but can never take an export away.

  **What is stable from here**

  - **Every icon's component name.** `import { ArrowLeft } from "@qeetrix/icons"` will keep resolving.
    Renaming or removing an icon now requires a major release, which is why the catalogue prefers
    adding an alias over renaming.
  - **`QeetrixIconProps`.** `React.SVGProps<SVGSVGElement>` plus `size`. Props may be added, never
    removed or retyped without a major.
  - **The rendering defaults.** 24 × 24 grid, 2px stroke, round caps and joins, `currentColor`,
    decorative by default with `aria-hidden` flipping to `role="img"` when a label is passed.
  - **The entry points.** `@qeetrix/icons`, `@qeetrix/icons/metadata` and
    `@qeetrix/icons/icons/<name>`. No internal paths are reachable.
  - **`IconMetadata`.** Fields may be added optionally; existing ones keep their meaning.

  **What still moves freely**

  New icons, new tags and aliases, visual corrections to existing glyphs, and category moves — a
  category is browse metadata and is not part of any export name.

  **What is in the box**

  331 icons across 22 categories, one outline style, zero runtime dependencies, React as a peer, ESM
  with declarations, and `sideEffects: false`. One icon bundles to 586 bytes against 76 KB for the
  whole set. Published with provenance.

  See `docs/releases.md` for what counts as a breaking change, and `docs/icon-catalog.md` for the
  catalogue.

## 0.2.0

### Minor Changes

- 317a656: Initial release — the Phase 1 foundation.

  The SVG file is the source of truth. `icons/<category>/<name>.svg` is validated against the Qeetrix
  icon specification, then a generator emits one React component per icon, the barrel that exports
  them, and a searchable metadata catalogue. Generated output is committed and guarded by a
  byte-for-byte `--check` mode, so it cannot drift from its generator.

  **Public API**

  - Every icon as a named export: `import { ArrowLeft } from "@qeetrix/icons"`
  - `QeetrixIconProps` — `React.SVGProps<SVGSVGElement> & { size?: number | string }`
  - `IconBase` plus `ICON_VIEW_BOX`, `ICON_DEFAULT_SIZE`, `ICON_DEFAULT_STROKE_WIDTH`
  - `@qeetrix/icons/metadata` — `icons` and `iconNames`, importable without loading any component
  - `@qeetrix/icons/icons/<name>` — single-icon deep import

  **Accessibility.** Icons are decorative by default (`aria-hidden="true"`) and become named graphics
  (`role="img"`) automatically when given `aria-label` or `aria-labelledby`, which makes a
  hidden-but-labelled icon impossible to write.

  **Icon set.** 20 original reference icons across 8 of the 18 declared categories. 24 × 24 grid, 2px
  stroke, round caps, `currentColor` throughout. Nothing is derived from any third-party icon library.

  **Not included, by design:** the full catalogue, Figma integration, a docs site, non-React
  framework packages, and filled or duotone families.

- 317a656: Phase 2 — the core Qeetrix icon family.

  The catalogue grows from the 20 Phase 1 reference icons to **146 production icons across 22
  categories**, and gains the written visual language that makes them one family rather than 146
  separate drawings.

  **New: a documented visual system.** `docs/icon-design-system.md` defines the grid bands (live area
  `3 → 21`, bleed `2 → 22`), the stroke-density rule that keeps parallel strokes legible at 16px, the
  fixed radii (badge rings are always `r="9"`, heads `r="4"`), 45°-only diagonals, and the shared
  motifs — the badge ring, the overlay badge, the document body, the folder, the `-off` slash — that
  every relevant icon reuses verbatim.

  **Icon families.** Navigation, actions, interface, users and identity, security, files and documents,
  communication, notifications and status, calendar and time, media, data, devices, finance,
  development, design, maps and accessibility. Every glyph was reviewed at 16/20/24/32px.

  **Metadata.** Every icon carries tags, aliases and an RTL `mirror` flag; 30 of 146 mirror. Tags may
  be shared between icons, aliases may not — an alias asserts "this icon is also called X", so the
  validator now rejects an alias claimed twice, an alias that collides with a real icon name, and an
  icon that lists its own name.

  **Stricter geometry.** `transform` is now rejected outright: it makes source coordinates disagree
  with what renders, so absolute coordinates are required. The reserved-name list was also corrected —
  it wrongly blocked `package`, `import` and similar, because JavaScript's reserved words are lowercase
  while generated component names never are.

  **Verification.** Visual-regression snapshots of the rendered markup for all 146 icons, whole-set
  contract checks (grid, colour, stroke, no ids, complexity budget), and tree-shaking proved with a
  real bundler against the built package: one icon bundles to **579 bytes** against **32 KB** for the
  whole set.

  **Tooling.** `bun run gallery` builds a local review gallery — a searchable browser plus a contact
  sheet and a small-size sheet, because the most common icon defect is a glyph that is individually
  fine and collectively wrong.

  Two Phase 1 icons moved category: `calendar` to `time` and `bell` to `notifications`. Category is
  browse metadata and is not part of an icon's export name, so neither is a breaking change.

  **Not included, by design:** the `@qeetrix/ui` migration, Qeet-domain icons (SAML/OIDC/SCIM), a Figma
  plugin, a documentation site, non-React packages, and filled or duotone families.

- 317a656: Phase 3 — the complete enterprise icon catalogue.

  The catalogue grows from 146 to **331 icons across 22 categories**, sized so that Qeet product teams
  can build the overwhelming majority of standard enterprise interfaces without reaching for an
  external icon library.

  **Coverage.** 185 new icons, planned from a coverage matrix rather than accumulated: navigation and
  pagination, CRUD actions, data-table controls (sort direction, columns, rows, filter and search
  clearing), users and identity, authentication and security, files and cloud storage, mail and
  messaging, calendar and time, notifications and status, payments, analytics, development, devices,
  media, text formatting, design tools, accessibility, and utilities. 88 icons are rated P0 (essential)
  and 210 P1 — 90% of the set is weighted to what products actually reach for.

  **Families.** 39 bases now carry three or more variants, all using one fixed modifier vocabulary
  (`-plus`, `-minus`, `-check`, `-x`, `-lock`, `-search`, `-edit`, `-off`, `-open`). A consumer who has
  met `user-plus` can guess `folder-plus` without looking.

  **A generated coverage matrix.** `docs/icon-catalog.md` lists every icon with its priority, tags,
  aliases and RTL flag, plus the deliberate non-duplicates and the concepts checked and rejected. It is
  generated from the icons and metadata, so it cannot disagree with what ships, and `bun run
catalog:check` proves the committed copy is current.

  **Catalogue governance.** `bun run doctor` reports duplicate semantics, half-finished families,
  naming drift, category imbalance and thin or spammy tags — advisory, because those are judgement
  calls. The hard rules moved into tests: no name may lead with a verb, `-add`/`-remove`/`-delete` are
  never modifiers, every variant must have its base in the same category, counterpart pairs must agree
  on `mirror`, and P0 + P1 must stay above 80% of the set.

  **Metadata.** Every icon has tags, aliases and `mirror`. Aliases are now unique catalogue-wide — an
  alias asserts "this icon is also called X", so two owners are rejected. A new authoring-only
  `priority` field (P0–P3) drives the coverage matrix and is deliberately not published.

  **Stricter validation.** 30 error rules, up from 26: `transform` is rejected outright, as are an
  alias claimed twice, an alias colliding with an icon name, and an invalid priority.

  **Verification.** 542 tests. Visual-regression snapshots for all 331 icons plus whole-set contract
  checks (grid, colour, stroke, no ids, ≤6-subpath complexity budget). Accessibility verified with axe
  inside buttons, links, inputs, navigation, menus, tooltips, data tables and form validation.
  Tree-shaking proved with a real bundler against the built package: one icon bundles to **586 bytes**
  against **76 KB** for all 331 — 0.8%.

  Two renames, both of icons introduced earlier in this same phase and never published: `card-*` →
  `credit-card-*` and `message-*` → `message-square-*`, so every variant has its real base. `bell` and
  `calendar` keep the categories they moved to in Phase 2. No previously released icon was renamed or
  removed.

  **Not included, by design:** the `@qeetrix/ui` migration, Qeet-domain icons (SAML/OIDC/SCIM/GST), a
  Figma plugin, a documentation website, non-React packages, and filled or duotone families.

- 317a656: Phase 4 — developer experience, icon explorer, documentation and distribution quality.

  No icon artwork changed and no existing API moved. This phase is about the four questions a consumer
  actually has: how do I find the right icon, how do I use it, how do I import it, and how do I know the
  package is safe to ship.

  **Icon explorer.** `bun run explorer` builds a single self-contained static file with the whole
  catalogue inlined. Ranked search over names, component names, categories, tags and aliases; category,
  priority and mirror filters; grid or list; preview at 16/20/24/32/48/64 on light or dark; a detail
  view with full metadata and copyable import, JSX and component name. Every view is deep-linkable
  (`#icon=shield-check`, `#q=lock&category=security`), so a link in a review comment opens the same
  screen. Keyboard throughout — Tab and Enter, arrow keys across the grid, slash to focus search,
  Escape to close. It stays responsive by using `content-visibility: auto` rather than a JS virtualiser.

  **Deterministic search.** The ranking algorithm lives in one module that the explorer inlines and the
  tests import, so the ordering a developer sees is the ordering the suite pins: exact name → name
  prefix → exact alias → component prefix → name substring → alias substring → exact tag → tag
  substring → category. Multi-word queries are AND. Ties break by length then codepoint, so the order
  is total — `localeCompare` is deliberately avoided so two developers see the same list.

  **Deprecation, as a real mechanism.** `IconMetadata` gains an optional `deprecated` field
  (`{ since, replacement, reason }`) with a new exported `IconDeprecation` type. Validation enforces the
  shape: semver `since`, non-empty `reason`, and a `replacement` that names a real icon or is `null`. The
  key is omitted entirely when absent, so `if (icon.deprecated)` is the whole check. Nothing is
  deprecated yet; the machinery and the policy exist so the first one is not improvised.

  **Package verification, automated.** `bun run verify:package` packs the real tarball and asserts its
  contents against an allowlist, installs it into a throwaway consumer outside the source tree,
  typechecks that consumer against the shipped declarations with `skipLibCheck: false` and
  `noUncheckedIndexedAccess: true`, server-renders with `react-dom/server` to prove runtime rather than
  just types, then measures tree-shaking and size against a committed baseline. Every earlier phase did
  this by hand; now it runs in CI.

  **Documentation.** New `docs/usage.md` (install, sizing, colour, stroke width, accessibility patterns,
  entry points, metadata), `docs/api.md` (**generated** from `dist/*.d.ts`, so it cannot document a prop
  that does not exist), `docs/releases.md` (changesets, what each bump means for an icon library,
  deprecation policy) and `docs/README.md` as an index. Four documents are now generated and
  CI-checked: the API reference, the coverage matrix and both review sheets.

  **CI** splits into two jobs so the fast signal is not gated on a slow one: `verify` runs validation,
  generation drift, build, typecheck, lint, tests, explorer, catalogue and API freshness, and the health
  report; `package` runs the full tarball verification on its own.

  **Renamed script:** `bun run gallery` is now `bun run explorer`, and its output moved from `.gallery/`
  to `.explorer/`. Both are gitignored local artifacts, so this affects contributors only — no package
  behaviour changed.
