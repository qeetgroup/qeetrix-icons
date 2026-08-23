/**
 * Walks the canonical `icons/` tree.
 *
 * Discovery is deliberately shallow — exactly `icons/<category>/<name>.svg`.
 * Nested subdirectories are rejected rather than flattened, because a flat
 * two-level tree is what makes "the category is the directory" true, and
 * therefore what lets metadata avoid ever restating a category by hand.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { byString } from "./io.mjs";

/** Non-SVG files tolerated inside a category directory. */
const ALLOWED_NON_SVG = new Set([".gitkeep", ".DS_Store"]);

/**
 * @typedef {object} DiscoveredIcon
 * @property {string} name Canonical name, i.e. the filename without `.svg`.
 * @property {string} category Parent directory name.
 * @property {string} file Repo-relative path, used verbatim in error messages.
 * @property {string} source Raw file contents.
 */

/**
 * @param {object} options
 * @param {string} options.root Directory containing the `icons/` tree.
 * @param {string[]} options.categories The declared category allowlist.
 * @param {string} [options.dir] Name of the tree to walk; overridable for tests.
 * @returns {{ icons: DiscoveredIcon[], errors: string[] }}
 */
export function discoverIcons({ root, categories, dir = "icons" }) {
  const known = new Set(categories);
  const icons = [];
  const errors = [];
  const iconsRoot = join(root, dir);

  const entries = readdirSync(iconsRoot, { withFileTypes: true }).sort((a, b) =>
    byString(a.name, b.name),
  );

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      if (!ALLOWED_NON_SVG.has(entry.name)) {
        errors.push(
          `${dir}/${entry.name}: icons must live in a category directory, not at the root`,
        );
      }
      continue;
    }
    if (!known.has(entry.name)) {
      errors.push(
        `${dir}/${entry.name}/: unknown category. Add it to scripts/config/categories.json or move these icons.`,
      );
      continue;
    }

    const category = entry.name;
    const categoryDir = join(iconsRoot, category);
    const files = readdirSync(categoryDir, { withFileTypes: true }).sort((a, b) =>
      byString(a.name, b.name),
    );

    for (const file of files) {
      const rel = `${dir}/${category}/${file.name}`;
      if (file.isDirectory()) {
        errors.push(
          `${rel}/: nested directories are not supported — use icons/<category>/<name>.svg`,
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
        category,
        file: rel,
        source: readFileSync(join(categoryDir, file.name), "utf8"),
      });
    }
  }

  icons.sort((a, b) => byString(a.name, b.name));
  return { icons, errors };
}

/** Load the declared category allowlist. */
export function loadCategories(root) {
  const config = JSON.parse(readFileSync(join(root, "scripts/config/categories.json"), "utf8"));
  return config.categories;
}
