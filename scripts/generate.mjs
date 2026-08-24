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
 * ── layout and the two style axes ────────────────────────────────────────────
 *
 *   icons/<shape>-<variant>/<category>/<name>.svg
 *     → src/icons/<category>/<name>.tsx
 *
 * Style is two independent axes, so the component takes two props rather than
 * one compound value. `variant="solid"` therefore means the same thing it always
 * did, and adding sharp artwork does not rename anything:
 *
 *   icons/round-outline/…   <Activity />                        (both defaults)
 *   icons/round-solid/…     <Activity variant="solid" />
 *   icons/sharp-outline/…   <Activity shape="sharp" />
 *   icons/sharp-solid/…     <Activity shape="sharp" variant="solid" />
 *
 * Both unions are derived per icon from the files that actually exist, so an
 * empty `sharp-*` directory contributes nothing and `shape` stays `"round"`.
 * Drop sharp SVGs in and the type widens on the next run — no edit here needed.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/** Preferred order on each axis. The first that exists becomes the default. */
const SHAPE_ORDER = ["round", "sharp"];
const VARIANT_ORDER = ["outline", "solid"];

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
/**
 * Walk `icons/<shape>-<variant>/<category>/<name>.svg`.
 *
 * The directory name is the contract: exactly one hyphen, `<shape>-<variant>`,
 * both drawn from SHAPE_ORDER and VARIANT_ORDER. A typo in a folder name is a
 * hard error rather than a silently ignored directory — otherwise a mistyped
 * `round-outine` would just make 1154 icons quietly disappear.
 */
function discover() {
  const found = [];
  for (const style of readdirSync(join(PKG, "icons"))) {
    const styleDir = join(PKG, "icons", style);
    const [shape, variant, ...rest] = style.split("-");

    if (rest.length > 0 || !SHAPE_ORDER.includes(shape) || !VARIANT_ORDER.includes(variant)) {
      throw new Error(
        `icons/${style}: directory must be named "<shape>-<variant>" with shape one of ` +
          `${SHAPE_ORDER.join("|")} and variant one of ${VARIANT_ORDER.join("|")}.`,
      );
    }

    for (const category of readdirSync(styleDir)) {
      const categoryDir = join(styleDir, category);
      for (const file of readdirSync(categoryDir)) {
        if (!file.endsWith(".svg")) continue;
        found.push({
          name: file.slice(0, -4),
          shape,
          variant,
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
 * One component, with every artwork it has behind `shape` and `variant` props.
 *
 * Each union is only as wide as the files that exist, so a combination the icon
 * does not ship is not expressible. Where an icon has exactly one value on an
 * axis, that prop is accepted but unread — generic call sites keep working, and
 * the `_` prefix marks it deliberate rather than forgotten.
 *
 * @param {string} component PascalCase name.
 * @param {Array<{shape: string, variant: string, file: string, source: string}>} artworks
 */
function emitComponent(component, artworks) {
  const sources = artworks.map((a) => a.file).join(", ");

  const shapes = SHAPE_ORDER.filter((s) => artworks.some((a) => a.shape === s));
  const variants = VARIANT_ORDER.filter((v) => artworks.some((a) => a.variant === v));
  const defaultShape = shapes[0];
  const defaultVariant = variants[0];

  // The default pair is the fall-through, so reading a component bottom-up shows
  // what `<Icon />` with no props renders. If the icon happens not to ship that
  // exact pair, the first artwork stands in.
  const fallback =
    artworks.find((a) => a.shape === defaultShape && a.variant === defaultVariant) ?? artworks[0];
  const branches = artworks.filter((a) => a !== fallback);

  /** Only test an axis that actually varies — a one-value check is dead code. */
  const condition = (artwork) =>
    [
      shapes.length > 1 ? `shape === ${JSON.stringify(artwork.shape)}` : null,
      variants.length > 1 ? `variant === ${JSON.stringify(artwork.variant)}` : null,
    ]
      .filter(Boolean)
      .join(" && ");

  const bind = (name, values, fallbackValue) =>
    `${values.length > 1 ? name : `${name}: _${name}`} = ${JSON.stringify(fallbackValue)}`;

  const signature =
    `export function ${component}({ ` +
    `${bind("variant", variants, fallback.variant)}, ` +
    `${bind("shape", shapes, fallback.shape)}, ...props }: ` +
    "SVGProps<SVGSVGElement> & { " +
    `variant?: ${variants.map((v) => JSON.stringify(v)).join(" | ")}; ` +
    `shape?: ${shapes.map((s) => JSON.stringify(s)).join(" | ")} }) {`;

  const body = [
    ...branches.map((artwork) =>
      [
        `  if (${condition(artwork)}) {`,
        "    return (",
        toJsx(artwork.source, "      "),
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
const sources = discover();

const icons = new Map(); // name → { category, artworks: [] }
for (const icon of sources) {
  if (!icons.has(icon.name)) icons.set(icon.name, { category: icon.category, artworks: [] });
  icons.get(icon.name).artworks.push(icon);
}

const files = new Map(); // "src/icons/…" → contents
const exports = [];

for (const [name, { category, artworks }] of [...icons.entries()].sort((a, b) =>
  byString(a[0], b[0]),
)) {
  // Shape first, then variant, so the default pair sorts to the front and the
  // emitted branch order is stable across runs.
  artworks.sort(
    (a, b) =>
      SHAPE_ORDER.indexOf(a.shape) - SHAPE_ORDER.indexOf(b.shape) ||
      VARIANT_ORDER.indexOf(a.variant) - VARIANT_ORDER.indexOf(b.variant),
  );
  const component = toComponentName(name);
  files.set(`src/icons/${category}/${name}.tsx`, emitComponent(component, artworks));
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
  console.log(`✔ generated ${icons.size} component(s) in src/icons/ from ${sources.length} SVGs.`);
}
