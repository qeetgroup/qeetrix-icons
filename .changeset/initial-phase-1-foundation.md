---
"@qeetrix/icons": minor
---

Initial release — the Phase 1 foundation.

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
