# Documentation

Qeetrix Icons 2.0 is in Phase 2B: design contracts, typed foundations, and SVG/source validation.
There are no production SVG drawings or React components yet. Generation, manifest, runtime, and
visual QA tooling remain future work.

| Document | Purpose |
|:--|:--|
| [design-principles.md](design-principles.md) | Original Qeetrix visual language, typography harmony, and outline-first variants |
| [drawing-guidelines.md](drawing-guidelines.md) | Grid, provisional geometry, optical balance, and later visual review |
| [naming.md](naming.md) | Semantic filenames, future component names, categories, and API stability |
| [accessibility.md](accessibility.md) | Decorative defaults, named controls, and meaningful standalone icons |
| [rtl.md](rtl.md) | Semantic directionality and intended mirror/preserve behavior |
| [architecture.md](architecture.md) | Current public boundary, future pipeline, ownership, and phase sequence |
| [validation.md](validation.md) | Implemented source rules, diagnostics, parser decision, and deferred visual checks |
| [contributing.md](contributing.md) | Bun setup, commands, conventions, and CI |
| [releases.md](releases.md) | Existing release behavior and why foundation-only work must not reach `main` yet |

The machine-readable internal contracts are [config/icon-system.ts](../config/icon-system.ts) and
[config/categories.ts](../config/categories.ts). Stable architecture is separated from values
marked **CALIBRATION REQUIRED**. Later visual evidence should update those candidates and their
documentation together; it must not silently establish a different per-icon system.
