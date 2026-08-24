/**
 * The only script. Turns `icons/**.svg` into React components.
 *
 *   node scripts/generate.mjs          write src/icons/
 *   node scripts/generate.mjs --check  fail if src/icons/ is out of date
 *
 * The contract is deliberately narrow: the SVG markup inside each component is
 * the source file's markup, byte for byte. Tag names, path data, `<g clip-path>`,
 * `<defs>` and `<clipPath>` all survive untouched. Three things change, and only
 * these three:
 *
 *   1. Seven kebab-case attribute names become their JSX camelCase spelling
 *      (`clip-path` → `clipPath`), because JSX has no other way to say them.
 *   2. `{...props}` is appended to the root `<svg>` attribute list, so a
 *      consumer can override anything — width, height, color, className.
 *   3. On *visible* geometry only, `fill="white"` and `stroke="white"` become
 *      `currentColor`, and the root gains `color="white"`. See below.
 *
 * Whitespace *between* tags is reflowed for readability. Whitespace between
 * elements is inert in both SVG and JSX, so nothing rendered changes.
 *
 * ── why the colour swap, and why it renders identically ───────────────────────
 *
 * Every source file paints in a single flat `white` (audited: 8427 fills and 33
 * strokes, zero multi-tone icons). Hard-coding that in the component makes the
 * icon un-themeable, because an explicit `fill` on a child beats an inherited
 * one from the root — so a `fill` prop on the `<svg>` would paint nothing.
 *
 * Routing the paint through `currentColor` and defaulting the root to
 * `color="white"` keeps the default output pixel-identical to the source while
 * making one knob control the whole icon:
 *
 *   <Activity />                        white, exactly as the SVG was drawn
 *   <Activity color="black" />          any colour, via a plain prop
 *   <Activity className="text-red-500" />        CSS wins over the default
 *   <Activity className="text-black dark:text-white" />   dark / light mode
 *
 * `color` is a presentation attribute, which CSS outranks — so a Tailwind class
 * or a stylesheet rule beats the `white` default without `!important`.
 *
 * The swap is applied ONLY outside `<defs>`. The 2175 `<rect fill="white">`
 * elements inside `<clipPath>` are masks: they are never painted, so recolouring
 * them would be meaningless. They are left exactly as authored.
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
 * Route flat white paint through `currentColor` so one prop can retheme the icon.
 *
 * Only the exact value `white` is touched, and only on `fill`/`stroke`. Callers
 * must not apply this inside `<defs>` — see the header comment.
 */
const toCurrentColor = (tag) => tag.replace(/(fill|stroke)="white"/g, '$1="currentColor"');

/** The name of an element from its opening tag. */
const tagName = (tag) => tag.match(/^<\/?([a-zA-Z]+)/)?.[1];

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

  // `color="white"` before `{...props}`, so it is the default a consumer's
  // `color`, `className` or stylesheet overrides rather than fights.
  const root = toJsxAttrs(tags[0]).replace(/\s*\/?>$/, ' color="white" {...props}>');

  const lines = [`${indent}${root}`];
  let depth = 1;
  // Elements inside <defs> are masks, never painted, so their fills stay as
  // authored. Track the depth <defs> opened at to know when it closes.
  let defsDepth = -1;

  for (const tag of tags.slice(1)) {
    const closing = tag.startsWith("</");
    if (closing) {
      depth -= 1;
      if (defsDepth === depth) defsDepth = -1;
    } else if (tagName(tag) === "defs" && defsDepth === -1) {
      defsDepth = depth;
    }

    const inDefs = defsDepth !== -1;
    const body = inDefs ? toJsxAttrs(tag) : toJsxAttrs(toCurrentColor(tag));
    lines.push(`${indent}${"  ".repeat(depth)}${body}`);

    if (!closing && !tag.endsWith("/>")) depth += 1;
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
