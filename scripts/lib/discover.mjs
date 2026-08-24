/**
 * Walks the canonical `icons/` tree.
 *
 * Discovery is three-level: `icons/<style>/<category>/<name>.svg`.
 * - Top-level directories must be one of the two hardcoded styles ("outline",
 *   "solid") — categories are not derived from them.
 * - Second-level directories must appear in `scripts/config/categories.json`.
 * - Third-level entries must be `.svg` files.
 *
 * `icon.style` carries the outline/solid distinction.
 * `icon.category` carries the topical group (arrows, media, …).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { byString } from "./io.mjs";

/** Non-SVG files tolerated inside a category directory. */
const ALLOWED_NON_SVG = new Set([".gitkeep", ".DS_Store"]);

/** The valid style names — hardcoded, never inferred from the filesystem. */
const VALID_STYLES = new Set(["outline", "solid", "sharp"]);

/**
 * @typedef {object} DiscoveredIcon
 * @property {string} name     Canonical name, i.e. the filename without `.svg`.
 * @property {string} style    "outline" or "solid".
 * @property {string} category Topical subcategory (arrows, media, …).
 * @property {string} file     Repo-relative path, used verbatim in error messages.
 * @property {string} source   Raw file contents.
 */

/**
 * @param {object}   options
 * @param {string}   options.root       Directory containing the `icons/` tree.
 * @param {string[]} options.categories The declared topical-category allowlist.
 * @param {string}   [options.dir]      Name of the tree to walk; overridable for tests.
 * @returns {{ icons: DiscoveredIcon[], errors: string[] }}
 */
export function discoverIcons({ root, categories, dir = "icons" }) {
  const knownCategories = new Set(categories);
  const icons = [];
  const errors = [];
  const iconsRoot = join(root, dir);

  // ── Level 1: style directories ──────────────────────────────────────────
  const styleEntries = readdirSync(iconsRoot, { withFileTypes: true }).sort((a, b) =>
    byString(a.name, b.name),
  );

  for (const styleEntry of styleEntries) {
    if (!styleEntry.isDirectory()) {
      if (!ALLOWED_NON_SVG.has(styleEntry.name)) {
        errors.push(
          `${dir}/${styleEntry.name}: icons must live under a style directory (outline/ or solid/), not at the root`,
        );
      }
      continue;
    }
    if (!VALID_STYLES.has(styleEntry.name)) {
      errors.push(
        `${dir}/${styleEntry.name}/: unknown style directory. Only "outline", "solid", and "sharp" are allowed at the top level of icons/.`,
      );
      continue;
    }

    const style = styleEntry.name;
    const styleDir = join(iconsRoot, style);

    // ── Level 2: category directories ─────────────────────────────────────
    const catEntries = readdirSync(styleDir, { withFileTypes: true }).sort((a, b) =>
      byString(a.name, b.name),
    );

    for (const catEntry of catEntries) {
      if (!catEntry.isDirectory()) {
        if (!ALLOWED_NON_SVG.has(catEntry.name)) {
          errors.push(
            `${dir}/${style}/${catEntry.name}: icons must live in a category directory, not directly under the style`,
          );
        }
        continue;
      }
      if (!knownCategories.has(catEntry.name)) {
        errors.push(
          `${dir}/${style}/${catEntry.name}/: unknown category. Add it to scripts/config/categories.json or move these icons.`,
        );
        continue;
      }

      const category = catEntry.name;
      const categoryDir = join(styleDir, category);

      // ── Level 3: SVG files ─────────────────────────────────────────────
      const files = readdirSync(categoryDir, { withFileTypes: true }).sort((a, b) =>
        byString(a.name, b.name),
      );

      for (const file of files) {
        const rel = `${dir}/${style}/${category}/${file.name}`;
        if (file.isDirectory()) {
          errors.push(
            `${rel}/: nested directories are not supported — use icons/<style>/<category>/<name>.svg`,
          );
          continue;
        }
        if (!file.name.endsWith(".svg")) {
          if (!ALLOWED_NON_SVG.has(file.name)) {
            errors.push(`${rel}: only .svg files are allowed in a category directory`);
          }
          continue;
        }
        icons.push({
          name: file.name.slice(0, -".svg".length),
          style,
          category,
          file: rel,
          source: readFileSync(join(categoryDir, file.name), "utf8"),
        });
      }
    }
  }

  icons.sort((a, b) => byString(a.name, b.name));
  return { icons, errors };
}

/** Load the declared topical-category allowlist. */
export function loadCategories(root) {
  const config = JSON.parse(readFileSync(join(root, "scripts/config/categories.json"), "utf8"));
  return config.categories;
}
