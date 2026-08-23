---
"@qeetrix/icons": minor
---

Phase 3 — the complete enterprise icon catalogue.

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
