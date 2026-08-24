/**
 * The icon validation rule set.
 *
 * Every rule exists to stop one specific thing from reaching a consumer. Where
 * a rule looks stricter than necessary, the comment says what it prevents.
 *
 * Two structural choices are worth stating up front:
 *
 * 1. Colour is checked by ALLOWLIST, not by pattern-matching for colours. Any
 *    `fill`/`stroke` value outside `{none, currentColor, inherit, transparent}`
 *    is rejected, so `#f26d0e`, `rgb(0 0 0)`, `oklch(…)` and all 148 CSS named
 *    colours are caught without enumerating a single one of them.
 * 2. Elements and attributes are also allowlists. A blocklist of "bad" SVG
 *    features is unbounded and silently lets the next one through; an allowlist
 *    of the ~8 elements an outline icon needs cannot.
 *
 * Rules return issue objects rather than strings so tests can assert on a
 * stable `rule` id instead of on prose.
 */

import { byString } from "./io.mjs";
import { iconNameError, toComponentName } from "./naming.mjs";

/** Elements an outline icon may contain. */
const ALLOWED_ELEMENTS = new Set([
  "svg",
  "g",
  "path",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "rect",
]);

/** Presentation attributes valid on the root and on any shape or group. */
const PRESENTATION_ATTRS = new Set([
  "fill",
  "fill-opacity",
  "fill-rule",
  "clip-rule",
  "opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "vector-effect",
]);

/** Geometry attributes, per element. */
const GEOMETRY_ATTRS = {
  svg: new Set(["xmlns", "viewBox"]),
  g: new Set([]),
  path: new Set(["d"]),
  circle: new Set(["cx", "cy", "r"]),
  ellipse: new Set(["cx", "cy", "rx", "ry"]),
  line: new Set(["x1", "y1", "x2", "y2"]),
  polyline: new Set(["points"]),
  polygon: new Set(["points"]),
  // `rect` is the one element that legitimately needs width/height — the
  // no-fixed-dimensions rule applies to the root <svg> only.
  rect: new Set(["x", "y", "width", "height", "rx", "ry"]),
};

/** The only values `fill`, `stroke` and `stop-color` may take. */
const ALLOWED_COLOR_VALUES = new Set(["none", "currentColor", "inherit", "transparent"]);
const COLOR_ATTRS = new Set(["fill", "stroke", "stop-color"]);

/** Required root attributes and their exact expected values. */
const REQUIRED_VIEW_BOX = "0 0 24 24";

/**
 * The exact root attributes every source must declare.
 *
 * These are supplied by `<IconBase>` at render time, so strictly the source
 * could omit them. Requiring them anyway buys two things: a source file opens
 * correctly in a browser or design tool on its own, and a contributor who sets
 * `stroke-width="1"` on the root gets an error instead of silently having it
 * discarded by the generator.
 */
const REQUIRED_ROOT_ATTRS = {
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};

/** Root attrs for filled icons (style === "solid"). */
const REQUIRED_ROOT_ATTRS_SOLID = {
  xmlns: "http://www.w3.org/2000/svg",
  fill: "currentColor",
  stroke: "none",
};

/** Root attrs for sharp stroke icons (style === "sharp"). */
const REQUIRED_ROOT_ATTRS_SHARP = {
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "square",
  "stroke-linejoin": "miter",
};

/**
 * Names whose glyph carries a *horizontal* direction and so must mirror in RTL.
 *
 * Only horizontal: `arrow-up` and `chevron-down` point along an axis that RTL
 * does not flip, so matching on the `arrow-`/`chevron-` prefix would warn about
 * every vertical glyph in the set.
 */
const DIRECTIONAL_NAME = /(^|-)(left|right|forward|back|next|previous)($|-)/;

/**
 * Names that mention both directions, and so describe a symmetric glyph.
 *
 * `arrow-left-right` is a double-headed arrow: mirroring it yields the identical
 * image, so `mirror: false` is correct and warning about it is noise.
 */
const BIDIRECTIONAL_NAME = /(left.*right|right.*left|up.*down|down.*up)/;

/**
 * @typedef {object} Issue
 * @property {string} rule Stable identifier. Tests assert on this, not on prose.
 * @property {string} file Repo-relative path the issue concerns.
 * @property {string} message Human-readable explanation, naming what was found.
 */

/** @returns {Issue} */
const issue = (rule, file, message) => ({ rule, file, message });

/**
 * Validate a single icon's markup and filename.
 *
 * @param {{ name: string, category: string, file: string, source: string }} icon
 * @param {import("./svg.mjs").ParsedSvg} parsed
 * @returns {{ errors: Issue[], warnings: Issue[] }}
 */
export function validateIcon(icon, parsed) {
  const errors = [];
  const warnings = [];
  const { file } = icon;

  // ── naming ──────────────────────────────────────────────────────────────
  const nameError = iconNameError(icon.name);
  if (nameError) errors.push(issue("naming", file, nameError));

  // ── raw-source checks the AST cannot see ────────────────────────────────
  // svgson drops comments and doctypes, so these would otherwise ship unseen.
  if (/<!DOCTYPE/i.test(icon.source)) {
    errors.push(issue("doctype", file, "must not declare a DOCTYPE"));
  }
  if (/<!\[CDATA\[/.test(icon.source)) {
    errors.push(issue("cdata", file, "must not contain CDATA sections"));
  }

  // ── structure ───────────────────────────────────────────────────────────
  if (parsed.error) {
    errors.push(issue("parse", file, parsed.error));
    return { errors, warnings };
  }

  const root = parsed.root;

  if (root.attributes.viewBox !== REQUIRED_VIEW_BOX) {
    const found = root.attributes.viewBox;
    errors.push(
      issue(
        "view-box",
        file,
        found === undefined
          ? `viewBox is required and must be "${REQUIRED_VIEW_BOX}"`
          : `viewBox must be "${REQUIRED_VIEW_BOX}" (found "${found}")`,
      ),
    );
  }

  for (const attr of ["width", "height"]) {
    if (root.attributes[attr] !== undefined) {
      errors.push(
        issue(
          "fixed-dimensions",
          file,
          `root <svg> must not set ${attr}="${root.attributes[attr]}" — size is a render-time prop, not baked into the source`,
        ),
      );
    }
  }

  const requiredRootAttrs =
    icon.style === "solid" ? REQUIRED_ROOT_ATTRS_SOLID :
    icon.style === "sharp" ? REQUIRED_ROOT_ATTRS_SHARP :
    REQUIRED_ROOT_ATTRS;
  for (const [attr, expected] of Object.entries(requiredRootAttrs)) {
    const found = root.attributes[attr];
    if (found === expected) continue;
    errors.push(
      issue(
        "root-spec",
        file,
        found === undefined
          ? `root <svg> must declare ${attr}="${expected}"`
          : `root <svg> must declare ${attr}="${expected}" (found "${found}")`,
      ),
    );
  }

  // Element children only — a source file's own indentation shows up as
  // whitespace text nodes, which would otherwise make an empty icon look full.
  if (root.children.filter((child) => child.type === "element").length === 0) {
    errors.push(issue("empty", file, "contains no drawable elements"));
  }

  // ── per-node checks ─────────────────────────────────────────────────────
  for (const node of parsed.elements) {
    if (node.type === "text") {
      if (node.value.trim() !== "") {
        errors.push(
          issue(
            "text-content",
            file,
            `unexpected text content "${node.value.trim()}" at ${node.path}`,
          ),
        );
      }
      continue;
    }

    // Specific messages first — a bare "element not allowed" for <style> or
    // <image> tells a contributor nothing about why.
    if (node.name === "style") {
      errors.push(
        issue(
          "inline-style",
          file,
          "must not contain a <style> element — icons inherit currentColor",
        ),
      );
      continue;
    }
    if (node.name === "image") {
      errors.push(issue("raster", file, "must not embed a raster <image>"));
      continue;
    }
    if (node.name === "metadata" || node.name === "desc" || node.name === "title") {
      errors.push(
        issue(
          "editor-metadata",
          file,
          `must not contain <${node.name}> — strip editor metadata before committing (accessible names are a render-time concern, see docs/icon-guidelines.md)`,
        ),
      );
      continue;
    }
    if (!ALLOWED_ELEMENTS.has(node.name)) {
      errors.push(
        issue(
          "element",
          file,
          `<${node.name}> is not an allowed element (allowed: ${[...ALLOWED_ELEMENTS].sort(byString).join(", ")})`,
        ),
      );
      continue;
    }

    const geometry = GEOMETRY_ATTRS[node.name];

    for (const [attr, value] of Object.entries(node.attributes)) {
      // Specific, useful messages before the generic allowlist rejection.
      if (attr === "style") {
        errors.push(
          issue("inline-style", file, `must not use a style="" attribute (on <${node.name}>)`),
        );
        continue;
      }
      if (attr === "id") {
        errors.push(
          issue(
            "id",
            file,
            `must not use id="${value}" — ids collide when many icons render in one document, and an outline icon never needs one`,
          ),
        );
        continue;
      }
      if (attr === "class" || attr === "className") {
        errors.push(
          issue(
            "class",
            file,
            `must not use ${attr}="${value}" — styling is the consumer's concern`,
          ),
        );
        continue;
      }
      if (attr === "transform") {
        errors.push(
          issue(
            "transform",
            file,
            `must not use transform="${value}" on <${node.name}> — author absolute coordinates instead. A transform makes the source coordinates disagree with what renders, so reviewing geometry means mentally composing matrices, and two icons that look aligned can have unrelated path data.`,
          ),
        );
        continue;
      }
      if (attr === "href" || attr === "xlink:href") {
        errors.push(
          issue("external-reference", file, `must not reference external content via ${attr}`),
        );
        continue;
      }
      if (/^(sodipodi|inkscape|serif|illustrator|sketch):/.test(attr) || /^xmlns:/.test(attr)) {
        errors.push(
          issue("editor-metadata", file, `must not carry editor namespace attribute "${attr}"`),
        );
        continue;
      }

      // A double quote would break out of the generated JSX attribute. No
      // legitimate geometry or presentation value contains one.
      if (value.includes('"')) {
        errors.push(
          issue(
            "attribute-value",
            file,
            `${attr} must not contain a double quote (found "${value}")`,
          ),
        );
        continue;
      }

      if (/url\(/i.test(value)) {
        errors.push(
          issue("external-reference", file, `${attr} must not use url(...) (found "${value}")`),
        );
        continue;
      }
      if (/data:/i.test(value)) {
        errors.push(issue("raster", file, `${attr} must not embed a data: URI`));
        continue;
      }

      if (COLOR_ATTRS.has(attr) && !ALLOWED_COLOR_VALUES.has(value)) {
        errors.push(
          issue(
            "color",
            file,
            `${attr}="${value}" is a hard-coded colour — use one of ${[...ALLOWED_COLOR_VALUES].join(", ")} so the icon inherits its colour from the surrounding text`,
          ),
        );
        continue;
      }

      if (!geometry.has(attr) && !PRESENTATION_ATTRS.has(attr)) {
        errors.push(
          issue(
            "attribute",
            file,
            `${attr}="${value}" is not an allowed attribute on <${node.name}>`,
          ),
        );
      }
    }
  }

  return { errors, warnings };
}

/**
 * Checks that only make sense across the whole set: uniqueness, component-name
 * collisions, and metadata that has drifted from the icon tree.
 *
 * @param {Array<{ name: string, category: string, file: string }>} icons
 * @param {Record<string, { tags?: string[], aliases?: string[], mirror?: boolean }>} metadata
 * @returns {{ errors: Issue[], warnings: Issue[] }}
 */
export function validateSet(icons, metadata) {
  const errors = [];
  const warnings = [];

  // Duplicate canonical name within the same style.
  const byName = new Map(); // name → first icon seen (for metadata checks below)
  const byStyleAndName = new Map(); // "style:name" → icon
  for (const icon of icons) {
    const key = `${icon.style}:${icon.name}`;
    const seen = byStyleAndName.get(key);
    if (seen) {
      errors.push(
        issue(
          "duplicate-name",
          icon.file,
          `duplicates the icon name "${icon.name}" already defined by ${seen.file}`,
        ),
      );
      continue;
    }
    byStyleAndName.set(key, icon);
    if (!byName.has(icon.name)) byName.set(icon.name, icon);
  }

  // Two different filenames that produce the same React component name.
  // Cross-style icons share one component (variant prop), so only same-style
  // collisions (two different names that happen to PascalCase identically) matter.
  const byStyleAndComponent = new Map(); // "style:Component" → icon
  for (const icon of icons) {
    if (iconNameError(icon.name)) continue; // already reported
    const component = toComponentName(icon.name);
    const key = `${icon.style}:${component}`;
    const seen = byStyleAndComponent.get(key);
    if (seen) {
      errors.push(
        issue(
          "component-collision",
          icon.file,
          `generates the component "${component}", which ${seen.file} already generates`,
        ),
      );
      continue;
    }
    byStyleAndComponent.set(key, icon);
  }

  // Alias and tag hygiene. Search always covers the canonical name and the
  // aliases, so restating either as a tag is duplicated maintenance, and an
  // alias that is itself an icon name makes a query ambiguous between two
  // different glyphs.
  // Deduplicate by name: same icon with multiple styles shares one metadata entry.
  const checkedHygieneNames = new Set();
  for (const icon of icons) {
    if (checkedHygieneNames.has(icon.name)) continue;
    checkedHygieneNames.add(icon.name);
    const entry = metadata[icon.name];
    if (!entry) continue;
    const tags = entry.tags ?? [];
    const aliases = entry.aliases ?? [];

    for (const [field, values] of [
      ["tag", tags],
      ["alias", aliases],
    ]) {
      if (values.includes(icon.name)) {
        errors.push(
          issue(
            "redundant-metadata",
            "icon-metadata.json",
            `"${icon.name}" lists its own name as a ${field} — the canonical name is always searched`,
          ),
        );
      }
    }

    for (const alias of aliases) {
      if (byName.has(alias)) {
        errors.push(
          issue(
            "alias-collision",
            "icon-metadata.json",
            `"${icon.name}" has the alias "${alias}", which is also a real icon name — a search for it would be ambiguous`,
          ),
        );
      }
      if (tags.includes(alias)) {
        warnings.push(
          issue(
            "redundant-metadata",
            "icon-metadata.json",
            `"${icon.name}" repeats its alias "${alias}" as a tag — aliases are searched already`,
          ),
        );
      }
    }
  }

  // `priority` is planning data, but a missing or bogus value silently drops an
  // icon out of the coverage matrix, so it is validated like everything else.
  for (const icon of icons) {
    const priority = metadata[icon.name]?.priority;
    if (priority === undefined) continue; // absent metadata is warned about elsewhere
    if (!["P0", "P1", "P2", "P3"].includes(priority)) {
      errors.push(
        issue(
          "priority",
          "icon-metadata.json",
          `"${icon.name}" has priority "${priority}" — must be one of P0, P1, P2, P3`,
        ),
      );
    }
  }

  // A deprecation is a promise to consumers, so its shape is validated rather
  // than trusted: a replacement pointing at nothing, or a missing reason, makes
  // the deprecation useless exactly when someone is trying to act on it.
  for (const icon of icons) {
    const dep = metadata[icon.name]?.deprecated;
    if (dep === undefined) continue;
    const where = `"${icon.name}" deprecated`;
    if (typeof dep.since !== "string" || !/^\d+\.\d+\.\d+/.test(dep.since)) {
      errors.push(
        issue(
          "deprecation",
          "icon-metadata.json",
          `${where} needs a semver "since", got ${JSON.stringify(dep.since)}`,
        ),
      );
    }
    if (typeof dep.reason !== "string" || dep.reason.trim() === "") {
      errors.push(
        issue("deprecation", "icon-metadata.json", `${where} needs a non-empty "reason"`),
      );
    }
    if (dep.replacement !== null && !byName.has(dep.replacement)) {
      errors.push(
        issue(
          "deprecation",
          "icon-metadata.json",
          `${where} names the replacement "${dep.replacement}", which is not an icon — use null if there is none`,
        ),
      );
    }
    if (dep.replacement === icon.name) {
      errors.push(
        issue("deprecation", "icon-metadata.json", `${where} names itself as its replacement`),
      );
    }
  }

  // An alias asserts "this icon is also called X", so two owners make the query
  // ambiguous. Tags carry no such claim and may be shared freely.
  // Deduplicate by name: an icon with both outline and solid variants shares one
  // metadata entry, so the same alias would otherwise appear to collide with itself.
  const aliasOwner = new Map();
  const checkedAliasNames = new Set();
  for (const icon of icons) {
    if (checkedAliasNames.has(icon.name)) continue;
    checkedAliasNames.add(icon.name);
    for (const alias of metadata[icon.name]?.aliases ?? []) {
      const held = aliasOwner.get(alias);
      if (held) {
        errors.push(
          issue(
            "alias-collision",
            "icon-metadata.json",
            `the alias "${alias}" is claimed by both "${held}" and "${icon.name}" — pick one owner and make it a tag on the other`,
          ),
        );
        continue;
      }
      aliasOwner.set(alias, icon.name);
    }
  }

  // Metadata pointing at an icon that does not exist — the usual cause is a
  // rename where only one side was updated.
  for (const key of Object.keys(metadata)) {
    if (key.startsWith("$")) continue;
    if (byName.has(key)) continue;
    errors.push(
      issue(
        "orphan-metadata",
        "icon-metadata.json",
        `entry "${key}" has no matching icon in icons/`,
      ),
    );
  }

  // Warnings: an untagged icon is invisible to search, and a directional glyph
  // that does not mirror is a real RTL bug — but neither should block a build,
  // because "drop in one SVG and it works" has to stay true.
  for (const icon of icons) {
    const entry = metadata[icon.name];
    if (entry && entry.priority === undefined) {
      warnings.push(
        issue(
          "missing-priority",
          icon.file,
          "has no priority in icon-metadata.json — it will be absent from docs/icon-catalog.md",
        ),
      );
    }
    if (!entry || !Array.isArray(entry.tags) || entry.tags.length === 0) {
      warnings.push(
        issue(
          "missing-tags",
          icon.file,
          "has no tags in icon-metadata.json — it will not be findable by search",
        ),
      );
    }
    // Media transport controls are the standing exception: `skip-forward` points
    // right in every locale, because playback direction is not reading
    // direction. Warning about them would train contributors to ignore warnings.
    const transport = icon.category === "media";
    const symmetric = BIDIRECTIONAL_NAME.test(icon.name);
    if (
      !transport &&
      !symmetric &&
      DIRECTIONAL_NAME.test(icon.name) &&
      entry &&
      entry.mirror !== true
    ) {
      warnings.push(
        issue(
          "mirror",
          icon.file,
          `looks directional but has "mirror": false — confirm it should not flip under dir="rtl"`,
        ),
      );
    }
  }

  return { errors, warnings };
}

/**
 * Render an issue as a single reviewable line.
 *
 * @param {Issue} issue
 */
export function formatIssue({ file, message }) {
  return `${file}: ${message}`;
}
