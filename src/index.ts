/**
 * `@qeetrix/icons` — the Qeet Group icon library.
 *
 * Every component is generated from `icons/<style>/<category>/<name>.svg` by
 * `scripts/generate.mjs`, and holds that file's SVG markup byte for byte. There
 * is no shared `<svg>` shell and no runtime: each component is a plain function
 * returning the source SVG, so what ships is what a designer exported.
 *
 * One component per icon name, with the style behind a `variant` prop:
 *
 *   import { Activity } from "@qeetrix/icons";
 *
 *   <Activity />                      // outline (the default)
 *   <Activity variant="solid" />
 *   <Activity width={20} height={20} />
 *   <Activity className="size-5" />
 *
 * Every export is side-effect free (`sideEffects: false`), so a bundler drops
 * every icon a consumer does not import.
 */

// Every icon component. GENERATED — see src/icons/index.ts.
export * from "./icons/index.js";
// Public types.
export type { IconVariant, QeetrixIconProps } from "./types.js";
