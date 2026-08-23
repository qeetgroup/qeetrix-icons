/**
 * `@qeetrix/icons` — the Qeet Group icon library.
 *
 * Icon components are generated from the canonical SVG sources in `icons/` by
 * `scripts/generate.mjs`; this barrel is hand-written and re-exports the
 * generated set alongside the public types and the shared `<svg>` shell.
 *
 * Every export is side-effect free (`sideEffects: false`), so a bundler drops
 * every icon a consumer does not import.
 *
 * Icon metadata is deliberately NOT re-exported here — it lives behind
 * `@qeetrix/icons/metadata` so that importing one icon never drags the whole
 * catalogue into the bundle.
 *
 * Export order below is the one Biome's `organizeImports` assist enforces
 * (alphabetical by module specifier), not a semantic grouping.
 */

// The shared shell, plus the spec constants generated components render with.
// Exported so consumers can build a matching one-off glyph without guessing.
export {
  ICON_DEFAULT_SIZE,
  ICON_DEFAULT_STROKE_WIDTH,
  ICON_VIEW_BOX,
  IconBase,
} from "./icon-base.js";
// Every icon component. GENERATED — see src/icons/index.ts.
export * from "./icons/index.js";
// Public types.
export type { IconDeprecation, IconMetadata, QeetrixIconProps } from "./types.js";
