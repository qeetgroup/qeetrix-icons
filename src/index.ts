/**
 * `@qeetrix/icons` - the Qeet Group icon and brand logo library.
 *
 * Every icon concept is one generated named export, such as `StarIcon`. Its `shape` prop selects
 * the drawing style, `"round"` by default or `"sharp"`, which every icon has; its `variant` prop
 * selects a drawing, `"outline"` by default, and is typed to the drawings that exist for that icon,
 * the same in both shapes. Each icon is also importable on its own from
 * `@qeetrix/icons/icons/<id>`.
 *
 * Every brand logo is one generated named export ending in `Logo`, such as `GithubLogo`. It renders
 * the logo's published SVG file, unmodified, as an `<img>`; its `variant` prop selects one of the
 * logo's files and is typed to the files that exist. Each logo is also importable on its own from
 * `@qeetrix/icons/logos/<id>`.
 *
 * Catalogue metadata is deliberately not exported here; tooling imports it from
 * `@qeetrix/icons/manifest`. See docs/api.md and docs/logos.md.
 */

export * from "./generated/icon-index.js";
export * from "./generated/logo-index.js";
export type { IconDirectionality, IconShape, IconVariant } from "./types/icon.js";
export type { IconProps } from "./types/icon-props.js";
export type { LogoBackground, LogoComponent, LogoProps } from "./types/logo.js";
