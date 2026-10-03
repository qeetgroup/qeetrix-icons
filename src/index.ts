/**
 * `@qeetrix/icons` - the Qeet Group icon library.
 *
 * Every icon concept is one generated named export, such as `StarIcon`. Its `variant` prop selects
 * a drawing, `"outline"` by default, and is typed to the drawings that exist for that icon. Each
 * icon is also importable on its own from `@qeetrix/icons/icons/<id>`. Catalogue metadata is
 * deliberately not exported here; tooling imports it from `@qeetrix/icons/manifest`. See
 * docs/api.md.
 */

export * from "./generated/index.js";
export type { IconDirectionality, IconVariant } from "./types/icon.js";
export type { IconProps } from "./types/icon-props.js";
