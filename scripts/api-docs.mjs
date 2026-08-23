/**
 * Generate docs/api.md from the real public surface.
 *
 * Reads:  dist/*.d.ts (the shipped declarations), package.json
 * Writes: docs/api.md
 *
 *   bun run api
 *   bun run api -- --check      verify the committed doc is current (CI)
 *
 * The prose is a template here; the *facts* — which types exist, which props they
 * carry, what the constants equal, which entry points resolve — are read out of
 * the built `dist/`. That is the only way an API reference stays honest: a
 * hand-written one drifts the first time a prop is added, and documenting a prop
 * that does not exist is worse than documenting nothing.
 *
 * It reads `dist/` rather than `src/` on purpose. The declarations in `dist/` are
 * what a consumer's editor actually loads, so if the two ever disagree, this doc
 * describes the one that matters.
 *
 * It deliberately does **not** print the package version. This file is committed
 * and `--check`ed, and Changesets bumps the version without running any
 * generator — so embedding it made every release fail CI on a document whose
 * actual content had not changed. The version lives in package.json, CHANGELOG.md
 * and on npm; a document describing the shape of the API does not need it.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyOrCheck, report } from "./lib/io.mjs";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const DIST = join(PKG, "dist");

if (!existsSync(join(DIST, "index.d.ts"))) {
  console.error("✗ dist/ is missing — run `bun run build` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
const types = readFileSync(join(DIST, "types.d.ts"), "utf8");
const iconBase = readFileSync(join(DIST, "icon-base.d.ts"), "utf8");
const barrel = readFileSync(join(DIST, "index.d.ts"), "utf8");
const metadataDts = readFileSync(join(DIST, "metadata.d.ts"), "utf8");
const iconCount = readFileSync(join(DIST, "icons/index.d.ts"), "utf8")
  .split("\n")
  .filter((line) => line.startsWith("export ")).length;

/** Pull a named declaration and the JSDoc immediately above it. */
function declaration(source, name) {
  const pattern = new RegExp(
    `(?:/\\*\\*[\\s\\S]*?\\*/\\s*)?export declare (?:type|interface|const|function) ${name}\\b[\\s\\S]*?(?=\\n(?:/\\*\\*|export |$))`,
  );
  const match = source.match(pattern);
  return match ? match[0].trimEnd() : null;
}

/**
 * The value of an emitted constant.
 *
 * `tsc` emits `const X = "0 0 24 24";` for a literal-typed const and
 * `const X: number;` for a widened one, so both forms have to be read.
 */
function constValue(source, name) {
  const literal = source.match(new RegExp(`export declare const ${name}\\s*=\\s*([^;]+);`));
  if (literal) return literal[1].trim();
  const typed = source.match(new RegExp(`export declare const ${name}\\s*:\\s*([^;]+);`));
  return typed ? typed[1].trim() : "?";
}

/**
 * A one-line table summary of a JSDoc block.
 *
 * Short docs pass through whole. Longer ones are cut at the first sentence — but
 * not at `e.g.` or `i.e.`, which is where a naive split lands and truncates the
 * sentence exactly where the useful part starts.
 */
function summarise(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 120) return flat;
  // The first full stop that is not part of an abbreviation and is followed by
  // the start of a new sentence. Lookbehind rather than a placeholder sentinel,
  // which lint rightly rejects.
  const first = flat.match(/^[\s\S]*?(?<!\be\.g)(?<!\bi\.e)(?<!\betc)\.(?=\s+[A-Z`]|$)/);
  return (first ? first[0] : flat).trim();
}

/** Escape a type for a markdown table cell, where a bare pipe splits columns. */
function cell(type) {
  return type.replace(/\|/g, "\\|");
}

/**
 * Every property of an interface, with its JSDoc summary.
 *
 * Parsed line by line rather than with one big regex: declaration files nest
 * multi-line JSDoc above properties at arbitrary indentation, and a regex that
 * handles that is far harder to read than a five-line loop.
 */
function properties(source, interfaceName) {
  const body = source.match(
    new RegExp(`export (?:declare )?interface ${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`),
  )?.[1];
  if (!body) return [];

  const props = [];
  let doc = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith("/**") || line.startsWith("*") || line.startsWith("*/")) {
      const text = line
        .replace(/^\/\*\*/, "")
        .replace(/\*\/$/, "")
        .replace(/^\*/, "")
        .trim();
      if (text !== "") doc.push(text);
      continue;
    }
    const signature = line.match(/^([\w"'[\]-]+)(\?)?:\s*([^;]+);/);
    if (signature) {
      props.push({
        name: signature[1],
        optional: Boolean(signature[2]),
        type: signature[3].trim().replace(/\s+/g, " "),
        doc: summarise(doc.join(" ")),
      });
    }
    doc = [];
  }
  return props;
}

const iconMetadataProps = properties(types, "IconMetadata");
const deprecationProps = properties(types, "IconDeprecation");
const entryPoints = Object.entries(manifest.exports)
  .filter(([key]) => key !== "./package.json")
  .map(([key, value]) => ({
    specifier: key === "." ? manifest.name : `${manifest.name}${key.slice(1)}`,
    types: typeof value === "string" ? value : value.types,
  }));

const propTable = (rows) =>
  [
    "| Prop | Type | Default | Notes |",
    "|:--|:--|:--|:--|",
    ...rows.map((r) => `| \`${r.prop}\` | \`${cell(r.type)}\` | ${r.def} | ${r.notes} |`),
  ].join("\n");

const doc = `<!-- GENERATED by scripts/api-docs.mjs from dist/*.d.ts. Do not edit by hand — run \`bun run api\`. -->

# API reference

The complete public surface of \`${manifest.name}\`.

Generated from the shipped declarations in \`dist/\`, which is what your editor loads — so this
document cannot describe a prop that does not exist. \`bun run api -- --check\` proves the committed
copy is current, and CI runs it.

For guidance on *using* these, see [usage.md](usage.md).

## Entry points

| Specifier | Declarations |
|:--|:--|
${entryPoints.map((e) => `| \`${e.specifier}\` | \`${e.types}\` |`).join("\n")}
| \`${manifest.name}/icons/<name>\` | \`./dist/icons/<name>.d.ts\` |

\`${manifest.name}\` is the entry point to use. The others are documented in
[usage.md](usage.md#entry-points); no internal paths are exposed.

## Icon components

**${iconCount} icon components**, each a named export from the package root:

\`\`\`tsx
import { Search, ShieldCheck } from "${manifest.name}";
\`\`\`

Every icon has the identical signature:

\`\`\`ts
function Search(props: QeetrixIconProps): JSX.Element;
\`\`\`

They are plain function components — no \`forwardRef\` wrapper, no memoisation, no context. React 19
forwards \`ref\` to the underlying \`<svg>\` through props, so a ref works without one.

They are also server-safe: no hooks, no browser APIs, no \`"use client"\`.

## \`QeetrixIconProps\`

\`\`\`ts
${declaration(types, "QeetrixIconProps") ?? "type QeetrixIconProps = React.SVGProps<SVGSVGElement> & { size?: number | string };"}
\`\`\`

A thin extension of \`React.SVGProps<SVGSVGElement>\`. Everything valid on an \`<svg>\` element is
valid here; the only addition is \`size\`.

${propTable([
  {
    prop: "size",
    type: "number | string",
    def: `\`${constValue(iconBase, "ICON_DEFAULT_SIZE")}\``,
    notes: "Sets `width` and `height` together. Accepts any CSS length.",
  },
  {
    prop: "strokeWidth",
    type: "string | number",
    def: `\`${constValue(iconBase, "ICON_DEFAULT_STROKE_WIDTH")}\``,
    notes:
      "The design system's standard weight. Vary it per surface, never between adjacent icons.",
  },
  {
    prop: "className",
    type: "string",
    def: "—",
    notes: "Forwarded to the `<svg>`. `shrink-0` is often wanted inside flex containers.",
  },
  {
    prop: "aria-hidden",
    type: "Booleanish",
    def: "`true`",
    notes: "Applied automatically, then dropped when a label is present. Pass `false` to opt out.",
  },
  {
    prop: "aria-label",
    type: "string",
    def: "—",
    notes: 'Makes the icon a named graphic: adds `role="img"` and removes `aria-hidden`.',
  },
  {
    prop: "aria-labelledby",
    type: "string",
    def: "—",
    notes: "Same effect as `aria-label`, referencing an element id.",
  },
  {
    prop: "role",
    type: "AriaRole",
    def: "— / `img`",
    notes: "Set to `img` when a label is present. An explicit value always wins.",
  },
  {
    prop: "ref",
    type: "Ref<SVGSVGElement>",
    def: "—",
    notes: "Forwards to the `<svg>` element.",
  },
  {
    prop: "style, onClick, data-*, …",
    type: "SVGProps",
    def: "—",
    notes: "Every standard SVG and React attribute passes through unchanged.",
  },
])}

### The accessibility branch

There is one piece of behaviour in the props rather than just passthrough, and it is worth stating
exactly:

\`\`\`text
no aria-label and no aria-labelledby   →  aria-hidden="true",  no role
aria-label or aria-labelledby present  →  role="img",          no aria-hidden
\`\`\`

Defaults are applied *before* your props are spread, so anything you pass wins. That is what makes
\`aria-hidden={false}\` and \`role="presentation"\` work.

The reason for the automatic flip: an element that is both \`aria-hidden\` and labelled announces
nothing, which is the most common icon accessibility bug. Here it is unrepresentable.

## \`IconBase\`

\`\`\`ts
${declaration(iconBase, "IconBase")?.replace(/^\/\*\*[\s\S]*?\*\/\s*/, "") ?? "export declare function IconBase(props: QeetrixIconProps): JSX.Element;"}
\`\`\`

The shared \`<svg>\` shell every generated icon renders through. It is exported so you can build a
one-off glyph that matches the family exactly, without copying the attributes:

\`\`\`tsx
import { IconBase } from "${manifest.name}";
import type { QeetrixIconProps } from "${manifest.name}";

export function MyGlyph(props: QeetrixIconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 12h16" />
    </IconBase>
  );
}
\`\`\`

Prefer contributing the icon to the catalogue instead where the concept is general — see
[contributing.md](contributing.md).

## Specification constants

| Constant | Value | Meaning |
|:--|:--|:--|
| \`ICON_VIEW_BOX\` | \`${constValue(iconBase, "ICON_VIEW_BOX")}\` | The canonical grid every icon is drawn on |
| \`ICON_DEFAULT_SIZE\` | \`${constValue(iconBase, "ICON_DEFAULT_SIZE")}\` | Default rendered size in px |
| \`ICON_DEFAULT_STROKE_WIDTH\` | \`${constValue(iconBase, "ICON_DEFAULT_STROKE_WIDTH")}\` | Default stroke weight |

Exported so a consumer can match the spec in adjacent artwork without hard-coding the numbers.

## \`${manifest.name}/metadata\`

\`\`\`ts
${metadataDts
  .split("\n")
  .filter((line) => line.startsWith("export declare"))
  .join("\n")}
\`\`\`

The catalogue, importable without loading a single icon component (3.7 KB). Intended for icon
pickers, documentation search, design tooling and codemods — **not** as the runtime API for product
UI. See [usage.md](usage.md#the-metadata-entry-point) for why.

### \`IconMetadata\`

| Field | Type | Notes |
|:--|:--|:--|
${iconMetadataProps
  .map((p) => `| \`${p.name}${p.optional ? "?" : ""}\` | \`${cell(p.type)}\` | ${p.doc || "—"} |`)
  .join("\n")}

### \`IconDeprecation\`

Present on \`IconMetadata.deprecated\` only for icons scheduled for removal. Absent on every
supported icon, so \`if (icon.deprecated)\` is the whole check.

| Field | Type | Notes |
|:--|:--|:--|
${deprecationProps
  .map((p) => `| \`${p.name}${p.optional ? "?" : ""}\` | \`${cell(p.type)}\` | ${p.doc || "—"} |`)
  .join("\n")}

See [releases.md](releases.md#deprecation) for the policy this implements.

## Exported types

\`\`\`ts
${barrel
  .split("\n")
  .filter((line) => line.startsWith("export type"))
  .join("\n")}
\`\`\`

## What is not public

These exist in the repository and are deliberately unreachable from the package. If you find yourself
wanting one, open an issue rather than reaching for a deep path — an entry point that is not in the
\`exports\` map has no stability guarantee and may move in a patch release.

| | |
|:--|:--|
| \`icons/**/*.svg\` | The canonical sources. Not shipped in the tarball. |
| \`icon-metadata.json\` | The authoring file, including \`priority\`. Not shipped. |
| \`scripts/**\` | Generator, validator, explorer, package checks. Not shipped. |
| \`src/**\` | Source. Only the compiled \`dist/\` output ships. |
`;

const files = new Map([["docs/api.md", doc]]);
const { written, stale, removed } = applyOrCheck({
  root: PKG,
  files,
  managedDirs: [],
  check: CHECK,
});
process.exit(
  report({ label: "docs/api.md", command: "bun run api", written, stale, removed, check: CHECK }),
);
