/**
 * The only script. Turns `icons/**.svg` into React components.
 *
 *   node scripts/generate.mjs          write src/icons/
 *   node scripts/generate.mjs --check  fail if src/icons/ is out of date
 *
 * The contract is deliberately narrow: the SVG markup inside each component is
 * the source file's markup, byte for byte. Tag names, attribute values, path
 * data, `<g clip-path>`, `<defs>`, `<clipPath>` and `fill="white"` all survive
 * untouched. Two things change, and only these two:
 *
 *   1. Seven kebab-case attribute names become their JSX camelCase spelling
 *      (`clip-path` → `clipPath`), because JSX has no other way to say them.
 *   2. `{...props}` is appended to the root `<svg>` attribute list, so a
 *      consumer can override anything — width, height, fill, className.
 *
 * Whitespace *between* tags is reflowed for readability. Whitespace between
 * elements is inert in both SVG and JSX, so nothing rendered changes.
 *
 * Layout: icons/<style>/<category>/<name>.svg → src/icons/<category>/<name>.tsx
 * One component per name, with the style selected by a `variant` prop.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/** Outline first, so it is the default variant wherever it exists. */
const STYLE_ORDER = ["outline", "solid"];

/**
 * The only attribute names that change, and the only reason they do: JSX has no
 * kebab-case spelling for them. Every other attribute passes through verbatim.
 */
const JSX_ATTRS = {
  "clip-path": "clipPath",
  "clip-rule": "clipRule",
  "fill-rule": "fillRule",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-miterlimit": "strokeMiterlimit",
};

/** Deterministic comparator — output order must not depend on the machine. */
const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** `arrow-left` → `ArrowLeft`. */
const toComponentName = (name) =>
  name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

// ── read ──────────────────────────────────────────────────────────────────
/** Walk `icons/<style>/<category>/<name>.svg`. */
function discover() {
  const found = [];
  for (const style of readdirSync(join(PKG, "icons"))) {
    const styleDir = join(PKG, "icons", style);
    for (const category of readdirSync(styleDir)) {
      const categoryDir = join(styleDir, category);
      for (const file of readdirSync(categoryDir)) {
        if (!file.endsWith(".svg")) continue;
        found.push({
          name: file.slice(0, -4),
          style,
          category,
          file: `icons/${style}/${category}/${file}`,
          source: readFileSync(join(categoryDir, file), "utf8").trim(),
        });
      }
    }
  }
  return found;
}

// ── SVG → JSX ─────────────────────────────────────────────────────────────
/**
 * Rename the kebab-case attributes JSX cannot spell, and nothing else.
 *
 * Safe as a string substitution because no attribute value in the set contains
 * `=` or `>`: path data, colours, `url(#…)` references and numbers are all
 * clear of both. `scripts/generate.mjs --check` plus the byte-for-byte test in
 * `tests/icons.test.tsx` is what keeps that assumption honest.
 */
const toJsxAttrs = (tag) =>
  tag.replace(/([a-zA-Z-]+)=/g, (_, name) => `${JSX_ATTRS[name] ?? name}=`);

/**
 * Re-indent a flat tag sequence, preserving every tag exactly.
 *
 * Returns the markup ready to drop into JSX, indented to sit inside a `return (`.
 */
function toJsx(source, indent) {
  const tags = source.match(/<[^>]+>/g);
  if (!tags?.[0].startsWith("<svg")) {
    throw new Error(`not an <svg> document: ${source.slice(0, 60)}`);
  }

  // `{...props}` last, so a consumer's width/height/fill/className wins.
  const root = toJsxAttrs(tags[0]).replace(/\s*\/?>$/, " {...props}>");

  const lines = [`${indent}${root}`];
  let depth = 1;
  for (const tag of tags.slice(1)) {
    if (tag.startsWith("</")) depth -= 1;
    lines.push(`${indent}${"  ".repeat(depth)}${toJsxAttrs(tag)}`);
    if (!tag.startsWith("</") && !tag.endsWith("/>")) depth += 1;
  }
  return lines.join("\n");
}

// ── emit ──────────────────────────────────────────────────────────────────
/**
 * One component, with every available style behind a `variant` prop.
 *
 * @param {string} component PascalCase name.
 * @param {Array<{style: string, file: string, source: string}>} variants
 */
function emitComponent(component, variants) {
  const sources = variants.map((v) => v.file).join(", ");
  const union = variants.map((v) => JSON.stringify(v.style)).join(" | ");
  // The default variant is the fall-through, so reading the component bottom-up
  // shows what `<Icon />` with no props renders.
  const fallback = variants[0];
  const branches = variants.slice(1);

  // A single-style icon still takes `variant`, so generic call sites keep
  // working. `_variant` marks it as deliberately unread rather than forgotten.
  const binding = branches.length === 0 ? "variant: _variant" : "variant";
  const signature =
    `export function ${component}({ ${binding} = ${JSON.stringify(variants[0].style)}, ...props }: ` +
    `SVGProps<SVGSVGElement> & { variant?: ${union} }) {`;

  const body = [
    ...branches.map((variant) =>
      [
        `  if (variant === ${JSON.stringify(variant.style)}) {`,
        "    return (",
        toJsx(variant.source, "      "),
        "    );",
        "  }",
      ].join("\n"),
    ),
    ["  return (", toJsx(fallback.source, "    "), "  );"].join("\n"),
  ].join("\n");

  return [
    `/* GENERATED from ${sources} by scripts/generate.mjs. Do not edit by hand. */`,
    'import type { SVGProps } from "react";',
    "",
    signature,
    body,
    "}",
    "",
  ].join("\n");
}

// ── run ───────────────────────────────────────────────────────────────────
const icons = new Map(); // name → { category, variants: [] }
for (const icon of discover()) {
  if (!icons.has(icon.name)) icons.set(icon.name, { category: icon.category, variants: [] });
  icons.get(icon.name).variants.push(icon);
}

const files = new Map(); // "src/icons/…" → contents
const exports = [];

for (const [name, { category, variants }] of [...icons.entries()].sort((a, b) =>
  byString(a[0], b[0]),
)) {
  variants.sort((a, b) => STYLE_ORDER.indexOf(a.style) - STYLE_ORDER.indexOf(b.style));
  const component = toComponentName(name);
  files.set(`src/icons/${category}/${name}.tsx`, emitComponent(component, variants));
  exports.push({ path: `./${category}/${name}.js`, component });
}

// Sorted by module path, not component name: that groups the barrel by category
// and matches what Biome's `organizeImports` assist would otherwise rewrite it to.
exports.sort((a, b) => byString(a.path, b.path));

files.set(
  "src/icons/index.ts",
  [
    "/* GENERATED by scripts/generate.mjs. Do not edit by hand. */",
    ...exports.map((e) => `export { ${e.component} } from "${e.path}";`),
    "",
  ].join("\n"),
);

if (CHECK) {
  const stale = [];
  for (const [rel, contents] of files) {
    const abs = join(PKG, rel);
    if (!existsSync(abs) || readFileSync(abs, "utf8") !== contents) stale.push(rel);
  }
  // Anything on disk that this run would not have written is an orphan.
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (!files.has(path.slice(PKG.length + 1))) stale.push(path.slice(PKG.length + 1));
    }
  };
  walk(join(PKG, "src/icons"));

  if (stale.length > 0) {
    console.error(`✗ src/icons is stale (${stale.length} file(s)):`);
    for (const rel of stale.sort(byString)) console.error(`    ${rel}`);
    console.error("\n  Run `bun run generate` and commit the result.");
    process.exit(1);
  }
  console.log(`✓ ${icons.size} component(s) up to date.`);
} else {
  // Rewrite the tree wholesale rather than reconciling: a renamed or deleted
  // source SVG then cannot leave an orphan behind.
  rmSync(join(PKG, "src/icons"), { recursive: true, force: true });
  for (const [rel, contents] of files) {
    const abs = join(PKG, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
  }
  console.log(
    `✔ generated ${icons.size} component(s) in src/icons/ from ${discover().length} SVGs.`,
  );
}
