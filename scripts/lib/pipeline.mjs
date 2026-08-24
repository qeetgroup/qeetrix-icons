/**
 * The shared front half of the pipeline: discover → parse → validate.
 *
 * Both `validate.mjs` and `generate.mjs` need exactly this, and it matters that
 * they share it rather than each doing their own version — otherwise `validate`
 * could pass while `generate` chokes, which is the worst possible split.
 *
 * Validation is total: it collects every issue across every icon rather than
 * failing on the first. A contributor adding ten icons should see all ten
 * problems in one run.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { discoverIcons, loadCategories } from "./discover.mjs";
import { toComponentName } from "./naming.mjs";
import { formatIssue, validateIcon, validateSet } from "./rules.mjs";
import { parseSvg, transformRawIconsax } from "./svg.mjs";

/** Load the hand-authored metadata registry, minus its `$comment` key. */
export function loadMetadata(root) {
  const raw = JSON.parse(readFileSync(join(root, "icon-metadata.json"), "utf8"));
  return Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith("$")));
}

/**
 * One validated icon, carrying everything the emitters need.
 *
 * @typedef {object} IconEntry
 * @property {string} name      Canonical kebab-case name.
 * @property {string} component PascalCase React export name.
 * @property {string} style     "outline" or "solid".
 * @property {string} category  Topical group (arrows, media, …).
 * @property {string} group     Alias for category — topical group used by the explorer.
 * @property {string} file      Repo-relative source path.
 * @property {import("./svg.mjs").SvgNode} tree Parsed root `<svg>` node.
 * @property {string[]} tags
 * @property {string[]} aliases
 * @property {boolean} mirror
 * @property {{since: string, replacement: string|null, reason: string}} [deprecated]
 */

/**
 * @param {object} options
 * @param {string} options.root Package root.
 * @param {string} [options.dir] Icon tree to walk; overridden by tests.
 * @param {Record<string, { tags?: string[], aliases?: string[], mirror?: boolean }>} [options.metadata]
 * @returns {{ entries: IconEntry[], errors: string[], warnings: string[] }}
 */
export function collect({ root, dir = "icons", metadata = loadMetadata(root) }) {
  const categories = loadCategories(root);
  const { icons, errors: discoveryErrors } = discoverIcons({ root, categories, dir });

  const errors = [...discoveryErrors];
  const warnings = [];
  const entries = [];

  for (const icon of icons) {
    const raw = parseSvg(icon.source);
    const parsed = transformRawIconsax(raw, icon.style);
    const result = validateIcon(icon, parsed);
    errors.push(...result.errors.map(formatIssue));
    warnings.push(...result.warnings.map(formatIssue));

    if (result.errors.length > 0 || !parsed.root) continue;

    const entry = metadata[icon.name] ?? {};
    entries.push({
      name: icon.name,
      component: toComponentName(icon.name),
      style: icon.style,
      category: icon.category,
      group: icon.category,
      file: icon.file,
      tree: parsed.root,
      tags: entry.tags ?? [],
      aliases: entry.aliases ?? [],
      mirror: entry.mirror ?? false,
      ...(entry.deprecated ? { deprecated: entry.deprecated } : {}),
    });
  }

  const set = validateSet(icons, metadata);
  errors.push(...set.errors.map(formatIssue));
  warnings.push(...set.warnings.map(formatIssue));

  return { entries, errors, warnings };
}

/** Print collected issues. Returns true when the run may continue. */
export function reportIssues({ errors, warnings, count }) {
  for (const warning of warnings) console.warn(`⚠ ${warning}`);

  if (errors.length > 0) {
    console.error(`\n✗ ${errors.length} validation error(s):`);
    for (const error of errors) console.error(`    ${error}`);
    console.error("\n  See docs/icon-guidelines.md for the icon specification.");
    return false;
  }

  const suffix = warnings.length > 0 ? ` (${warnings.length} warning(s))` : "";
  console.log(`✓ ${count} icon(s) valid${suffix}.`);
  return true;
}
