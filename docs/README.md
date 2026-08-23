# Documentation

Two audiences, and they want different things.

## Using the icons

| | |
|:--|:--|
| [usage.md](usage.md) | Install, size, colour, stroke width, accessibility, entry points, metadata |
| [api.md](api.md) | Complete prop reference. **Generated** from the shipped declarations |
| [icon-catalog.md](icon-catalog.md) | Every icon with its tags, aliases and RTL flag. **Generated** |

Start with `usage.md`. To find a specific icon, run `bun run explorer` — searching pictures beats
reading a table.

## Contributing icons

| | |
|:--|:--|
| [contributing.md](contributing.md) | The workflow, the commands, the conventions |
| [icon-design-system.md](icon-design-system.md) | The visual language: grid, stroke density, shared motifs, small-size rules |
| [icon-guidelines.md](icon-guidelines.md) | The technical spec and every validation rule |
| [naming.md](naming.md) | Naming governance, and tags vs aliases |
| [releases.md](releases.md) | Changesets, what each bump means, deprecation policy |

Read `contributing.md` first; it links to the rest at the point each becomes relevant.

## The short version

- **`icons/**/*.svg` is the only source of truth.** Everything under `src/icons/` and
  `src/metadata.ts` is generated, committed, and guarded by `bun run generate:check`.
- **Never hand-edit a generated file.** The fix is always `bun run generate`.
- **Search before adding.** `bun run explorer`, and search aliases too — `delete` finds `trash`.
- **Look at a new icon beside its siblings**, at 16px, before opening a PR. Validation proves an icon
  is legal; only looking proves it belongs.
- **Icon names are public API.** Add an alias rather than renaming.
- **Four documents are generated** — `api.md`, `icon-catalog.md`, and both review sheets. CI checks
  they are current, so they cannot drift from the icons.
