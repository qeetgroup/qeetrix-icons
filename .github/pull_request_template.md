## What changed

<!-- One or two sentences. If this adds icons, list them. -->

## Type

- [ ] New icon(s)
- [ ] Redrawn existing icon(s)
- [ ] Rename or removal — **breaking**, the export is public API
- [ ] Tooling / generator / validation
- [ ] Docs

## Checklist

- [ ] `bun run validate` passes
- [ ] `bun run generate` was run and the generated files under `src/` are committed
- [ ] `bun run typecheck && bun run lint && bun run test` pass
- [ ] A changeset is included (`bun run changeset`)

### For icon changes

- [ ] 24 × 24 grid, `viewBox="0 0 24 24"`, 2px stroke, round caps and joins
- [ ] `currentColor` only — no hard-coded colours anywhere
- [ ] Name is kebab-case, semantic, and follows [docs/naming.md](../docs/naming.md)
- [ ] Tags and aliases added to `icon-metadata.json`
- [ ] `mirror` set correctly if the glyph has a horizontal direction
- [ ] Checked at 16px, not just 24px
- [ ] Visually consistent with its neighbours in the same category

<!-- Renames/removals: say which consumers are affected and why the break is worth it. -->
