# @qeetrix/icons

## Unreleased — 2.0.0

### Major Changes

- **Qeetrix Icons 2.0: Lucide icons, in round and sharp, with derived filled variants, plus
  the Qeet logos.** 2.0 replaces the 1.x catalogue with the outline icons of
  [Lucide](https://lucide.dev) 1.52.0, as React 19 components, plus a sharp style and filled
  variants derived from those outlines, and adds Qeet's own logo and wordmark. It does not restore
  any part of the 1.x API.

  **Icons**

  - 1,863 outline icons from Lucide 1.52.0, the release pinned in `config/lucide.json`. The
    artwork is Lucide's, unchanged; names and the 42 categories are Lucide's too. Deprecated
    upstream icons (the three Swiss-franc icons) are left out. `bun run sync:lucide [version]`
    re-syncs the pinned release or upgrades it ([docs/lucide.md](docs/lucide.md)).
  - A sharp style for every icon: the same geometry with square caps, mitered joins (miter limit
    4), and corner roundings squared off, acute tips included. Corners whose point would leave the
    canvas or hit another stroke are cut flat, dots become squares, and figurative circles and
    organic outlines stay round. `bun run derive:sharp` derives it from the round outlines
    ([docs/sharp.md](docs/sharp.md)).
  - Filled variants for 794 icons, in both shapes, listed in `config/filled.ts`.
    `bun run derive:filled` derives each from its outline with Skia path operations
    (`canvaskit-wasm` 0.42.0, a development dependency): bodies filled to the outline's painted
    extent, details cut as negative lines, crossing lines cleared by a 1-unit gap. The sharp filled
    drawing is derived from the sharp outline with the same roles. Every listed icon was reviewed
    visually; open-line, text, chart, badge-clipped, busy, and empty-state icons stay outline-only
    ([docs/filled.md](docs/filled.md)).
  - Sources live in four folders, `icons/round-outline/` (Lucide), `icons/round-filled/`,
    `icons/sharp-outline/`, and `icons/sharp-filled/` (derived), each by Lucide category.
  - Lucide's rendering defaults: a 24 × 24 grid, stroke width 2, round caps and joins, 1 unit of
    padding, and `currentColor`.

  **Qeet logos** ([docs/logos.md](docs/logos.md))

  - `QeetLogo` (the "q" mark) and `QeetWordmarkLogo` (**Qeet.** in a tile, and without it), Qeet
    Group's own artwork, in `icons/brand-icons/<slug>/<variant>.svg`. `config/brands.json`
    records each logo's metadata and each file's measured background (`light`, `dark`, or `any`).
    Every logo must be first-party (`"firstParty": true`); the validator rejects any other.
  - One component per logo, `<PascalCase slug>Logo`, exported from the package root next to the
    icons. Each renders its file unmodified as an `<img>` with a lossless `data:image/svg+xml`
    URI: no recolouring, no style or id clashes, no hooks. `LogoProps`: native `<img>` props except
    `src`, `srcSet`, and `sizes`, plus `variant` (typed per logo), `height` (default 24), and
    `width` (from the file's aspect ratio). Decorative by default; `alt` or `aria-label` names it.
  - `logoManifest` in `@qeetrix/icons/manifest`: id, component name, title, collection, variants
    with their backgrounds, default variant, brand colour, categories, aliases, license, website,
    guidelines, and source.

  **API**

  - One component per icon, named `<PascalCase>Icon` after the Lucide name (`trash` → `TrashIcon`,
    `clock-12` → `Clock12Icon`), exported from the root and from `@qeetrix/icons/icons/<name>`.
  - `shape` is `"round"` (the default) or `"sharp"`; every icon has both, so it is never narrowed.
    `variant` is `"outline"` (the default) or `"filled"`, typed per component to the drawings that
    exist, the same in both shapes, so an unavailable variant is a type error. Neither prop reaches
    the DOM.
  - `IconProps`: native SVG props plus `size` (number or CSS length, default 24), `shape`, and
    `variant`. Caller props are spread last, so `strokeWidth` and other presentation attributes
    override the drawing's; a prop passed as `undefined` counts as not passed, so
    `strokeWidth={undefined}` keeps the default 2 instead of erasing it to SVG's 1. Icons are
    decorative by default; `aria-label` or `aria-labelledby`
    makes them `role="img"`. The root also exports the `IconShape`, `IconVariant`, and
    `IconDirectionality` types.
  - `@qeetrix/icons/manifest`: `iconManifest` (`schemaVersion` 1), one entry per icon with `id`,
    `name`, `componentName`, `category` (the primary category and source folder), `categories`
    (every Lucide category, primary first), `variants`, `shapes` (`["round", "sharp"]`),
    `directionality`, `tags` (Lucide's keywords), and `aliases` (Lucide's former names, such as
    `trash-2` for `trash`, which are not exported).
  - RTL: 18 reading-direction icons, such as `undo`, `reply`, `send`, and `log-in`, are `mirror` in
    the manifest; every other icon is `preserve`. There is no runtime mirroring.
  - Entry points are the root, `./icons/*`, `./manifest`, and `./package.json`; there is no
    shape or category subpath. The root also exports the `LogoProps`, `LogoComponent`, and
    `LogoBackground` types. ESM-only, `sideEffects: false`, per-icon and per-logo tree shaking,
    and React 19 as the only peer dependency.

  **Tooling** (repository only, never published)

  - Source validation (`check:icons`), generation (`generate`, `check:generated`), filled
    derivation (`derive:filled`, `check:filled`), sharp derivation (`derive:sharp`, `check:sharp`),
    the Lucide sync (`sync:lucide`), and the logo pipeline (`check:brands` with `QXB-*` codes,
    `generate:logos`, `check:logos`). CI and the release gate run `check:icons`,
    `check:filled`, `check:sharp`, and `check:generated`; `check:logos` runs in the test suite.
    The build is plain `tsc`; `tsc-alias`, which did nothing, is gone.
  - Validation checks the sharp stroke style (square caps, miter joins, and a `stroke-miterlimit`
    equal to the configured 4, which round sources may not carry) and adds `QXI-STYLE-001` (every
    drawing needs its counterpart in the other style) and `QXI-META-003` (an icon's metadata
    categories must be configured ids, the first being its source folder).
  - An internal visual QA playground (`bun run playground`) with an Icons page (Round/Sharp shape
    switch, `?shape=sharp`; search over tags and aliases; category filter over every category an
    icon is listed under) and a Logos page (both Qeet logos on light, dark, and transparent
    backgrounds).

  **License**

  - `LICENSE` keeps the MIT License for the package code and adds Lucide's license verbatim (ISC,
    with the Feather MIT notice it includes) for the icon artwork, the derived drawings, and the
    generated icon components. The Qeet logos are Qeet Group's proprietary artwork
    (`LicenseRef-Qeet`). `package.json` declares `SEE LICENSE IN LICENSE`.

  **Removed**

  - The entire 1.x icon catalogue: every icon component, and the 1.x source SVGs under
    `icons/round-outline/` and `icons/round-solid/` (the `icons/sharp-outline/` and
    `icons/sharp-solid/` folders were empty). 2.0 reuses the `round-outline` and `sharp-outline`
    folder names for its own sources.
  - The `@qeetrix/icons/icons/<category>/<name>` deep-import subpath.
  - The `QeetrixIcon` and `QeetrixIconProps` types, the 1.x `variant` values
    (`"outline" | "solid"`), and the white default colour. 2.0 reuses the names `IconVariant` and
    `variant` for `"outline" | "filled"`, and `IconShape` and `shape` for `"round" | "sharp"`, which
    in 1.x reserved `"sharp"` without any artwork.
  - The 7,429 third-party brand logos from [theSVG](https://thesvg.org) that the 1.0.5–1.0.10
    builds shipped, with the `sync:brands` command, `licenses/third-party-logos.md`, and
    `licenses/Apache-2.0.txt`. The package drops from about 100 MB to 16 MB installed, and a cold
    root import in Node from about 77 s to under 2 s. An app that needs a third-party logo uses
    theSVG directly, for example `@thesvg/react`, one logo per import.
  - The 1.x generator and its `generate:check` script (2.0 has its own `generate` and
    `check:generated`), and the example viewer app.
  - Never released: an earlier 2.0 draft of 578 original Qeetrix outline drawings, its planned
    598-concept catalogue (`config/catalogue.ts`), and its 20-category taxonomy. Lucide's artwork,
    names, and categories replace all three.

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
