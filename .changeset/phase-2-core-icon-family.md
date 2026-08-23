---
"@qeetrix/icons": minor
---

Phase 2 — the core Qeetrix icon family.

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
