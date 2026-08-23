/**
 * The kebab-case → PascalCase mapping that turns a source filename into a
 * public React export.
 *
 * This mapping IS the public API: `icons/arrows/arrow-left.svg` promises
 * `import { ArrowLeft } from "@qeetrix/icons"` forever. So the rules are
 * deliberately narrow — a name either maps to exactly one obvious identifier
 * or it is rejected. There is no normalisation pass that quietly rescues a
 * sloppy filename, because two sloppy filenames can normalise to the same
 * identifier and silently shadow each other.
 */

/** Canonical source name: lowercase alphanumeric words joined by single hyphens. */
export const ICON_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Source names that would collide with a generated *file* rather than with an
 * identifier. `index.svg` would emit `src/icons/index.tsx` on top of the
 * generated `src/icons/index.ts` barrel.
 */
export const RESERVED_ICON_NAMES = new Set(["index"]);

/**
 * Identifiers a generated component may not take.
 *
 * Only names `toComponentName` can actually produce belong here, which rules out
 * two whole classes of entry:
 *
 * - JavaScript's reserved words are all lowercase (`package`, `class`, `import`),
 *   and this function always capitalises, so `Package` and `Class` are ordinary
 *   identifiers. Listing them blocked perfectly good icon names — `package.svg`
 *   is exactly what a dev-tooling icon wants to be called.
 * - `toComponentName` never emits an underscore, so `ICON_DEFAULT_SIZE`-style
 *   constants are unreachable from any legal filename.
 *
 * The barrel's own exports are a hard error: a second `IconBase` would be a
 * duplicate export and would not compile.
 *
 * The globals are a judgement call, and the line is drawn at whether the name is
 * a plausible icon. `Object` and `Promise` are not icons, so reserving them costs
 * nothing and spares a consumer a confusing shadow. `Map`, `Set`, `Image` and
 * `Date` are all globals too, but they are also obvious icon names that every
 * icon library ships — blocking them would be the worse trade, since it would
 * force a worse public name (`atlas`, `map-folded`) on every consumer to avoid a
 * shadow that is inert inside the generated module.
 *
 * That trade has one cost worth knowing about: Biome's `noShadowRestrictedNames`
 * does flag the generated `Map` component, so `biome.json` turns that rule off
 * for `src/icons/**` specifically. If this list grows to allow another global,
 * that override already covers it.
 */
export const RESERVED_COMPONENT_NAMES = new Set([
  // This package's own barrel exports — a collision here is a compile error.
  "IconBase",
  "IconMetadata",
  "QeetrixIconProps",
  // Globals that are dangerous to shadow and are not plausible icon names.
  "Array",
  "Boolean",
  "Error",
  "Function",
  "Infinity",
  "JSON",
  "Math",
  "NaN",
  "Number",
  "Object",
  "Promise",
  "String",
  "Symbol",
]);

/**
 * Convert a canonical icon name to its component name.
 *
 * Assumes `name` already satisfies `ICON_NAME_PATTERN` — validation rejects
 * anything else before this is reached.
 */
export function toComponentName(name) {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

/**
 * Why `name` is not a usable icon name, or `null` if it is fine.
 *
 * Leading digits get their own message because the failure is non-obvious:
 * `2fa-token` is a perfectly reasonable filename but `2FaToken` is not a legal
 * JavaScript identifier.
 */
export function iconNameError(name) {
  if (name.length === 0) return "name is empty";
  if (RESERVED_ICON_NAMES.has(name)) {
    return `"${name}" is a reserved filename — it would overwrite the generated src/icons/index.ts barrel`;
  }
  if (/^[0-9]/.test(name)) {
    return `name must not start with a digit (would produce the invalid identifier "${toComponentName(name)}")`;
  }
  if (!ICON_NAME_PATTERN.test(name)) {
    return `name must be kebab-case matching ${ICON_NAME_PATTERN.source} (lowercase letters, digits and single hyphens)`;
  }
  const component = toComponentName(name);
  if (RESERVED_COMPONENT_NAMES.has(component)) {
    return `name maps to the reserved component name "${component}"`;
  }
  return null;
}
