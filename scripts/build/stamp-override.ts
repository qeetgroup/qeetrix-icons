import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type OverrideFolder,
  outlinePath,
  overrideFolders,
  overrideRoot,
  sha256,
  stampOverride,
} from "../lib/overrides.js";

/**
 * `bun run stamp:override <config/overrides/<folder>/<category>/<name>.svg> …` writes each
 * override's header: the Lucide outline it is drawn against and that outline's current SHA-256.
 * Run it after drawing an override, and after reviewing one that a Lucide upgrade made stale.
 */

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: bun run stamp:override config/overrides/<folder>/<category>/<name>.svg …");
  process.exit(1);
}
for (const file of files) {
  const parts = file.replace(/^\.\//, "").split("/");
  const [root, overrides, folder, category, name] = parts;
  if (
    parts.length !== 5 ||
    `${root}/${overrides}` !== overrideRoot ||
    !overrideFolders.includes(folder as OverrideFolder) ||
    !name.endsWith(".svg")
  ) {
    console.error(
      `${file}: expected ${overrideRoot}/<${overrideFolders.join("|")}>/<category>/<name>.svg.`,
    );
    process.exit(1);
  }
  const outline = outlinePath(category, name.slice(0, -4));
  const hash = sha256(readFileSync(join(repositoryRoot, outline)));
  const absolute = join(repositoryRoot, file);
  writeFileSync(absolute, stampOverride(readFileSync(absolute, "utf8"), outline, hash));
  console.log(`${file}: stamped against ${outline}.`);
}
