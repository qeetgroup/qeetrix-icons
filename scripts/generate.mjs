/**
 * Generate the React package from the canonical SVG sources.
 *
 * Reads:   icons/<category>/<name>.svg, icon-metadata.json
 * Writes:  src/icons/<name>.tsx      one component per icon
 *          src/icons/index.ts        the generated barrel
 *          src/metadata.ts           the searchable catalogue
 *
 *   bun run generate            regenerate and write
 *   bun run generate:check      verify the committed output matches (CI)
 *
 * The written files are tracked artifacts — they are committed, so that a
 * consumer reading the repo sees the real component source, and so that a diff
 * shows what an icon change actually did to the public API. Tracked generated
 * files drift, which is what `--check` is for: CI runs it before `build`, so a
 * hand-edited component is caught rather than silently overwritten by the
 * build's own generate step.
 *
 * Determinism is a hard requirement. Two runs over unchanged sources must
 * produce byte-identical output, which means: no wall-clock timestamps, and all
 * ordering via an explicit codepoint comparator rather than `localeCompare`
 * (which is locale-sensitive, and would make a tracked file's byte order depend
 * on the machine that generated it).
 *
 * Validation runs first and aborts the whole run on any error, so a bad SVG can
 * never produce a partially-written src/ tree.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emitBarrel, emitComponent, emitMetadata } from "./lib/emit.mjs";
import { applyOrCheck, report } from "./lib/io.mjs";
import { collect, reportIssues } from "./lib/pipeline.mjs";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const { entries, errors, warnings } = collect({ root: PKG });

if (!reportIssues({ errors, warnings, count: entries.length })) process.exit(1);

const files = new Map();
for (const entry of entries) {
  files.set(
    `src/icons/${entry.name}.tsx`,
    emitComponent({ icon: entry, component: entry.component }),
  );
}
files.set("src/icons/index.ts", emitBarrel(entries));
files.set("src/metadata.ts", emitMetadata(entries));

const { written, stale, removed } = applyOrCheck({
  root: PKG,
  files,
  managedDirs: ["src/icons"],
  check: CHECK,
});

process.exit(
  report({
    label: "generated icon output",
    command: "bun run generate",
    written,
    stale,
    removed,
    check: CHECK,
  }),
);
