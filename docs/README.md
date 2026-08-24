# Documentation

Two audiences, and they want different things.

## Using the icons

| | |
|:--|:--|
| [usage.md](usage.md) | Install, size, colour, dark mode, the style axes, accessibility, entry points |
| [../README.md](../README.md) | The overview, with the full prop table and worked examples |

Start with `usage.md`. To look at the icons, run the example app — searching pictures beats reading a
table:

```bash
cd example && bun install && bun run dev
```

## Contributing icons

| | |
|:--|:--|
| [contributing.md](contributing.md) | The workflow, the commands, the conventions |
| [icon-design-system.md](icon-design-system.md) | The visual language: grid, stroke density, shared motifs, small-size rules |
| [icon-guidelines.md](icon-guidelines.md) | The technical spec for a source SVG |
| [naming.md](naming.md) | Naming governance |
| [releases.md](releases.md) | Versioning, publishing, rollback |

Read `contributing.md` first; it links to the rest at the point each becomes relevant.

## The short version

- **`icons/**/*.svg` is the only source of truth.** Everything under `src/icons/` is generated,
  committed, and guarded by `bun run generate:check`.
- **Never hand-edit a generated file.** The fix is always `bun run generate`.
- **The SVG is preserved byte for byte.** A component holds its source file's markup — `<g clip-path>`,
  `<defs>`, `<clipPath>` and all. Only two things change: kebab attributes take their JSX spelling, and
  visible `white` paint becomes `currentColor` so the icon can be themed.
- **Search before adding.** Run the example app and search by name and category.
- **Look at a new icon beside its siblings**, at 16px, before opening a PR. The test suite proves an
  icon is faithfully transcribed; only looking proves it belongs.
- **Icon names are public API.** A name comes from its filename, so renaming a file is a major release.
- **There is one script.** `scripts/generate.mjs` does all the code generation; `--check` proves the
  committed output matches its source, and CI runs it on every PR.
