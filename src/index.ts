/**
 * `@qeetrix/icons` - the Qeet Group icon and logo library.
 *
 * Every icon concept is one generated named export, such as `StarIcon`. Its `shape` prop selects
 * the drawing style, `"round"` by default or `"sharp"`, which every icon has; its `variant` prop
 * selects a drawing, `"outline"` by default, and is typed to the drawings that exist for that icon,
 * the same in both shapes. Each icon is also importable on its own from
 * `@qeetrix/icons/icons/<id>`.
 *
 * Qeet's own logos, `QeetLogo` and `QeetWordmarkLogo`, are generated named exports ending in
 * `Logo`. Each renders its SVG file, unmodified, as an `<img>`; its `variant` prop selects one of
 * the logo's files and is typed to the files that exist. Third-party brand logos are not included.
 *
 * Catalogue metadata is deliberately not exported here; tooling imports it from
 * `@qeetrix/icons/manifest`. See docs/api.md and docs/logos.md.
 */

export * from "./generated/icon-index.js";
export * from "./generated/logo-index.js";
export type { IconDirectionality, IconShape, IconVariant } from "./types/icon.js";
export type { IconProps } from "./types/icon-props.js";
export type { LogoBackground, LogoComponent, LogoProps } from "./types/logo.js";
