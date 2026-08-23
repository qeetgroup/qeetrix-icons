/**
 * Filesystem helpers shared by the generator scripts.
 *
 * The important one is `applyOrCheck`. Generated files under src/ are tracked
 * artifacts — committed to git — so there are two failure modes worth catching:
 * a generated file that drifted from its generator, and a generated file left
 * behind after its source SVG was renamed or deleted. `--check` catches both,
 * and a write run fixes both.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/**
 * Deterministic string comparator.
 *
 * Not `localeCompare`: that is locale-sensitive, and the byte order of a
 * tracked artifact must not depend on the machine that generated it.
 */
export const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Read a UTF-8 file, or return `null` if it does not exist. */
export function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/**
 * Reconcile a set of generated files against disk.
 *
 * @param {object} options
 * @param {string} options.root Package root; all paths are relative to it.
 * @param {Map<string, string>} options.files Relative path → exact file contents.
 * @param {string[]} options.managedDirs Directories this generator owns entirely.
 *   Any file found in one that is not in `files` is stale.
 * @param {boolean} options.check Compare only; never write.
 * @returns {{ written: string[], stale: string[], removed: string[], ok: boolean }}
 */
export function applyOrCheck({ root, files, managedDirs, check }) {
  const written = [];
  const stale = [];
  const removed = [];

  for (const [rel, contents] of [...files.entries()].sort((a, b) => byString(a[0], b[0]))) {
    const abs = join(root, rel);
    if (readIfExists(abs) === contents) continue;
    if (check) {
      stale.push(rel);
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
    written.push(rel);
  }

  // A source SVG that was renamed or deleted leaves an orphan behind. The
  // generator owns these directories outright, so anything unaccounted for goes.
  for (const dir of managedDirs) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const rel = relative(root, join(abs, entry.name));
      if (files.has(rel)) continue;
      if (check) {
        stale.push(rel);
        continue;
      }
      rmSync(join(abs, entry.name));
      removed.push(rel);
    }
  }

  return { written, stale: stale.sort(byString), removed, ok: stale.length === 0 };
}

/** Report the outcome of a generator run and return the process exit code. */
export function report({ label, command, written, stale, removed, check }) {
  if (check) {
    if (stale.length === 0) {
      console.log(`✓ ${label} is up to date.`);
      return 0;
    }
    console.error(`✗ ${label} is stale (${stale.length} file(s)):`);
    for (const rel of stale) console.error(`    ${rel}`);
    console.error(`\n  Run \`${command}\` and commit the result.`);
    return 1;
  }

  for (const rel of written) console.log(`✔ generated ${rel}`);
  for (const rel of removed) console.log(`✔ removed stale ${rel}`);
  if (written.length === 0 && removed.length === 0) {
    console.log(`✓ ${label} already up to date — nothing to do.`);
  }
  return 0;
}
