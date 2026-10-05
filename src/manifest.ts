/**
 * `@qeetrix/icons/manifest` - the generated icon and logo catalogues for documentation, search, and
 * other tooling. Rendering icons or logos never needs them, and the package root never imports them.
 */

export { iconManifest } from "./generated/icon-manifest.js";
export { logoManifest } from "./generated/logo-manifest.js";
export type { IconManifest, IconManifestEntry } from "./types/icon-manifest.js";
export type {
  LogoBackground,
  LogoManifest,
  LogoManifestEntry,
  LogoManifestVariant,
} from "./types/logo.js";
