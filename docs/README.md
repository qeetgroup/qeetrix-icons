# Documentation

Qeetrix Icons 2.0 ships the 1,863 outline icons of Lucide 1.52.0, in Lucide's 42 categories, as
React 19 components with a manifest. Every icon also has a sharp style, and 794 have filled
variants, all derived from the Lucide outlines. The package also ships 7,429 theSVG brand logos,
each rendered exactly as published and under its own license. Validation, generation, the public
API, and the visual QA playground are complete; 2.0 is not yet released.

| Document | Purpose |
|:--|:--|
| [design.md](design.md) | Design values, Lucide's drawing rules as the outline spec, `strokeWidth`, shapes, and filled conventions |
| [lucide.md](lucide.md) | What comes from Lucide, the sync, the upgrade procedure, and licensing |
| [filled.md](filled.md) | How filled drawings are derived: roles, inference, composition, recipes, and adding one |
| [sharp.md](sharp.md) | How the sharp style is derived: stroke style, sharpening rules, kept curves, and sharp filled drawings |
| [logos.md](logos.md) | Brand logos: sources and sync, catalogue, components, backgrounds, licensing and trademarks, defects, performance |
| [naming.md](naming.md) | Lucide names, component names, direct imports, aliases, and categories |
| [api.md](api.md) | Public imports, `IconProps`, logos and `LogoProps`, the manifests, entry points, tree shaking, and semver |
| [accessibility.md](accessibility.md) | Decorative defaults, named controls, and meaningful standalone icons |
| [rtl.md](rtl.md) | Semantic directionality and which icons mirror |
| [architecture.md](architecture.md) | Pipeline, file ownership, and dependencies |
| [validation.md](validation.md) | Source rules, diagnostics, metadata checks, brand logo checks, and the parser decision |
| [generation.md](generation.md) | Icon generation, the logo generator, generated files, runtime decision, and output safety |
| [visual-qa.md](visual-qa.md) | The playground, the review workflow, and the per-icon checklist |
| [contributing.md](contributing.md) | Bun setup, commands, common changes, conventions, and CI |
| [releases.md](releases.md) | Release behavior, what each bump means, and why 2.0 must not reach `main` yet |

The machine-readable internal contracts are in `config/`, none of them package exports:
[icon-system.ts](../config/icon-system.ts) (design values),
[lucide.json](../config/lucide.json) and [categories.ts](../config/categories.ts) (synced from
Lucide), [icon-metadata.ts](../config/icon-metadata.ts) (manifest metadata and RTL),
[filled.ts](../config/filled.ts) (the filled list), and [brands.json](../config/brands.json)
(synced from theSVG).
