/**
 * `@qeetrix/icons` — the Qeet Group icon library.
 *
 * Every component is generated from `icons/<shape>-<variant>/<category>/<name>.svg` by
 * `scripts/generate.mjs`, and holds that file's SVG markup byte for byte. There
 * is no shared `<svg>` shell and no runtime: each component is a plain function
 * returning the source SVG, so what ships is what a designer exported.
 *
 * One component per icon name, with style on two independent props — `variant`
 * for strokes vs fills, `shape` for rounded vs squared corners:
 *
 *   import { Activity } from "@qeetrix/icons";
 *
 *   <Activity />                                 // round + outline (defaults)
 *   <Activity variant="solid" />
 *   <Activity shape="sharp" variant="solid" />   // once sharp artwork lands
 *   <Activity width={20} height={20} />
 *   <Activity className="size-5" />
 *
 * Colour is white by default, matching the source artwork, and retints from the
 * `color` prop or any CSS that sets `color` — which is what makes dark and light
 * mode work:
 *
 *   <Activity color="black" />
 *   <Activity className="text-black dark:text-white" />
 *
 * Every export is side-effect free (`sideEffects: false`), so a bundler drops
 * every icon a consumer does not import.
 */

// Every icon component. GENERATED — see src/icons/index.ts.
export * from "./icons/index.js";
// Public types.
export type { IconShape, IconVariant, QeetrixIcon, QeetrixIconProps } from "./types.js";
