/**
 * Remove build output.
 *
 *   bun run clean
 *
 * Uses `node:fs` rather than `rm -rf` so it behaves identically wherever
 * `engines.node >= 20` holds — that is the only portability claim this package
 * makes, and shelling out to a POSIX utility would quietly exceed it.
 *
 * Only `dist/` is removed. `src/icons/` and `src/metadata.ts` are generated but
 * committed, and `generate.mjs` reconciles them itself, so deleting them here
 * would turn every build into a spurious diff.
 */

import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const target of ["dist", "node_modules/.cache/qeetrix-icons"]) {
  rmSync(join(PKG, target), { recursive: true, force: true });
}

console.log("✔ cleaned dist/");
