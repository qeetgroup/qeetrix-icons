# Documentation

Qeetrix Icons 2.0 has completed its first full catalogue pass. The foundations (contracts,
validation, generation, manifest and public API, and the visual QA playground) are complete, and
578 original outline icons exist in 19 categories, drawn against one working spec after the Phase
3A–3C calibration batches. The 20 planned Qeet ecosystem pictograms are deferred. The visual system
is still provisional until the Catalogue Review & Enhancement Pass.

| Document | Purpose |
|:--|:--|
| [design-principles.md](design-principles.md) | Original Qeetrix visual language, typography harmony, and outline-first variants |
| [drawing-guidelines.md](drawing-guidelines.md) | Grid, provisional geometry, optical balance, and later visual review |
| [naming.md](naming.md) | Semantic filenames, future component names, categories, and API stability |
| [accessibility.md](accessibility.md) | Decorative defaults, named controls, and meaningful standalone icons |
| [rtl.md](rtl.md) | Semantic directionality and intended mirror/preserve behavior |
| [architecture.md](architecture.md) | Current public boundary, future pipeline, ownership, and phase sequence |
| [validation.md](validation.md) | Implemented source rules, diagnostics, parser decision, and deferred visual checks |
| [api.md](api.md) | Public imports, names, `IconProps`, manifest, entry points, tree shaking, and semver |
| [calibration.md](calibration.md) | Calibration log: accepted geometry, observations, and what is still provisional |
| [visual-qa.md](visual-qa.md) | The playground, the human review workflow, and the per-icon checklist |
| [generation.md](generation.md) | Generation pipeline, generated files, metadata, runtime decision, and output safety |
| [contributing.md](contributing.md) | Bun setup, commands, conventions, and CI |
| [releases.md](releases.md) | Existing release behavior and why foundation-only work must not reach `main` yet |

The machine-readable internal contracts are [config/icon-system.ts](../config/icon-system.ts) and
[config/categories.ts](../config/categories.ts). Stable architecture is separated from values
marked **CALIBRATION REQUIRED**. Later visual evidence should update those candidates and their
documentation together; it must not silently establish a different per-icon system.
