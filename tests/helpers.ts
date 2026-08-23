import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Package root, resolved from this file rather than from `process.cwd()`. */
export const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Read a fixture SVG as if it had been discovered under `icons/`.
 *
 * Fixtures deliberately live in `tests/fixtures/`, outside the `icons/` tree, so
 * that the ~24 intentionally-broken files used to prove validation works cannot
 * be picked up by `bun run validate` and fail the real build.
 */
export function fixture(kind: "valid" | "invalid", name: string) {
  const file = `tests/fixtures/${kind}/${name}.svg`;
  return {
    name,
    category: "interface",
    file,
    source: readFileSync(join(PKG, file), "utf8"),
  };
}

/** Every fixture basename in one of the two fixture directories. */
export function fixtureNames(kind: "valid" | "invalid"): string[] {
  return readdirSync(join(PKG, "tests/fixtures", kind))
    .filter((entry) => entry.endsWith(".svg"))
    .map((entry) => entry.slice(0, -".svg".length))
    .sort();
}
