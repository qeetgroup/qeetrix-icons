---
"@qeetrix/icons": minor
---

Phase 4 — developer experience, icon explorer, documentation and distribution quality.

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
