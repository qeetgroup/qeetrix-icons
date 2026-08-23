# @qeetrix/icons

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
