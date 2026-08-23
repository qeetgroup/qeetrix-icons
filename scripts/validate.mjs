/**
 * Validate every source SVG in `icons/` against the Qeetrix icon specification.
 *
 * Generated from: nothing — this script only reads.
 *
 *   bun run validate
 *
 * Run by CI before anything else, so a malformed icon fails in the cheapest
 * possible step rather than surfacing as a confusing TypeScript error after
 * generation. `generate.mjs` runs the same checks itself, so it is impossible to
 * generate from markup that would not pass here.
 *
 * Exits 1 on any error. Warnings are printed but never fail the run: an icon
 * with no tags is a backlog item, not a broken build.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collect, reportIssues } from "./lib/pipeline.mjs";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");

const { entries, errors, warnings } = collect({ root: PKG });

process.exit(reportIssues({ errors, warnings, count: entries.length }) ? 0 : 1);
