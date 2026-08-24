/**
 * Catalogue health checks — the questions that only become interesting at scale.
 *
 *   bun run doctor
 *
 * `validate` answers "is every icon legal?". At 300+ icons a different class of
 * problem appears that no single icon is guilty of: two glyphs that mean the same
 * thing, a naming pattern applied inconsistently across a family, a category that
 * has quietly become a dumping ground, a modifier used once. None of those make a
 * file invalid, and all of them make the catalogue worse.
 *
 * Everything here is deterministic and advisory. It reports and exits 0 unless
 * `--strict` is passed, because these are judgement calls: `square`/`stop` really
 * are near-identical shapes with genuinely different semantics, and a tool that
 * failed the build over that would just get switched off.
 *
 * CI runs it without `--strict` so the report is visible on every PR.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCategories } from "./lib/discover.mjs";
import { byString } from "./lib/io.mjs";
import { toComponentName } from "./lib/naming.mjs";
import { collect, loadMetadata } from "./lib/pipeline.mjs";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const STRICT = process.argv.includes("--strict");

const { entries, errors } = collect({ root: PKG });
if (errors.length > 0) {
  console.error("✗ fix validation errors first — run `bun run validate`.");
  process.exit(1);
}
const metadata = loadMetadata(PKG);
const categories = loadCategories(PKG);
const names = new Set(entries.map((e) => e.name));
const findings = [];

/** Whether two names differ only by a direction or a container shape. */
function areCounterparts(a, b) {
  const SWAPS = [
    ["left", "right"],
    ["up", "down"],
    ["horizontal", "vertical"],
    ["circle", "square"],
    ["asc", "desc"],
    ["open", "off"],
    ["incoming", "outgoing"],
    ["file", "folder"],
  ];
  for (const [x, y] of SWAPS) {
    if (a.split("-").includes(x) && b.replace(y, x) === a) return true;
    if (a.split("-").includes(y) && b.replace(x, y) === a) return true;
  }
  // A base and its own modifier variant, e.g. `battery` / `battery-charging`.
  return b.startsWith(`${a}-`) || a.startsWith(`${b}-`);
}
const note = (check, message) => findings.push({ check, message });

// ── 1. duplicate semantics ────────────────────────────────────────────────
// Two icons whose tag sets overlap heavily are candidates for being one icon
// plus an alias. Jaccard rather than raw overlap, so a long tag list is not
// penalised for being thorough.
// Deduplicate entries by name first: the same icon may appear as outline+solid.
const uniqueEntries = [...new Map(entries.map((e) => [e.name, e])).values()];
for (let i = 0; i < uniqueEntries.length; i++) {
  for (let j = i + 1; j < uniqueEntries.length; j++) {
    // Counterpart pairs share tags by design: `align-left`/`align-right` describe
    // the same operation in opposite directions, and `plus-circle`/`plus-square`
    // the same action in two shapes. Flagging them is noise.
    if (areCounterparts(uniqueEntries[i].name, uniqueEntries[j].name)) continue;
    const a = new Set(metadata[uniqueEntries[i].name]?.tags ?? []);
    const b = new Set(metadata[uniqueEntries[j].name]?.tags ?? []);
    if (a.size < 4 || b.size < 4) continue;
    const shared = [...a].filter((t) => b.has(t));
    const union = new Set([...a, ...b]).size;
    if (shared.length / union >= 0.6) {
      note(
        "duplicate-semantics",
        `"${uniqueEntries[i].name}" and "${uniqueEntries[j].name}" share ${shared.length}/${union} tags (${shared.join(", ")}) — should one be an alias of the other?`,
      );
    }
  }
}

// ── 2. family consistency ─────────────────────────────────────────────────
// A modifier used on one base but not its siblings is usually an oversight
// rather than a decision. Report the gap, not a verdict.
const MODIFIERS = ["plus", "minus", "check", "x", "lock", "search", "edit", "off", "open"];
const families = new Map();
for (const name of [...names].sort(byString)) {
  const parts = name.split("-");
  const modifier = parts.at(-1);
  if (parts.length < 2 || !MODIFIERS.includes(modifier)) continue;
  const base = parts.slice(0, -1).join("-");
  if (!names.has(base)) {
    note("orphan-variant", `"${name}" has no base icon "${base}"`);
    continue;
  }
  if (!families.has(base)) families.set(base, new Set());
  families.get(base).add(modifier);
}
for (const [base, mods] of [...families.entries()].sort((a, b) => byString(a[0], b[0]))) {
  // Only flag families big enough that a gap is conspicuous.
  if (mods.size < 3) continue;
  const missing = ["plus", "minus", "check", "x"].filter((m) => !mods.has(m));
  if (missing.length > 0 && missing.length < 4) {
    note(
      "family-gap",
      `"${base}" has ${[...mods].sort().join("/")} but not ${missing.join("/")} — intentional?`,
    );
  }
}

// ── 3. naming governance ──────────────────────────────────────────────────
// The canonical form is <base>-<modifier>. A leading verb is the mistake this
// catches: `add-user` instead of `user-plus`.
const LEADING_VERBS = ["add", "remove", "delete", "new", "create", "edit", "open", "close", "show"];
for (const name of [...names].sort(byString)) {
  const first = name.split("-")[0];
  if (name.includes("-") && LEADING_VERBS.includes(first)) {
    note("naming", `"${name}" leads with the verb "${first}" — prefer <noun>-<modifier>`);
  }
  // Words we deliberately express with a different modifier.
  for (const [banned, use] of [
    ["add", "plus"],
    ["remove", "minus"],
    ["delete", "x or trash"],
  ]) {
    if (name.split("-").includes(banned)) {
      note("naming", `"${name}" uses "${banned}" — the canonical modifier is "${use}"`);
    }
  }
}

// ── 4. category balance ───────────────────────────────────────────────────
const counts = new Map(categories.map((c) => [c, 0]));
for (const entry of entries) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
const total = entries.length;
for (const [category, n] of [...counts.entries()].sort((a, b) => byString(a[0], b[0]))) {
  if (n === 0) note("empty-category", `"${category}" is declared but has no icons`);
  else if (n / total > 0.2) {
    note(
      "category-imbalance",
      `"${category}" holds ${n}/${total} icons (${Math.round((n / total) * 100)}%)`,
    );
  }
}

// ── 5. directional metadata ───────────────────────────────────────────────
// Two icons that are each other's mirror should agree on whether they mirror.
for (const name of [...names].sort(byString)) {
  const opposite = name.includes("-left")
    ? name.replace("-left", "-right")
    : name.includes("-right")
      ? name.replace("-right", "-left")
      : null;
  if (!opposite || !names.has(opposite)) continue;
  const a = metadata[name]?.mirror;
  const b = metadata[opposite]?.mirror;
  if (a !== b)
    note("mirror-mismatch", `"${name}" (mirror: ${a}) and "${opposite}" (mirror: ${b}) disagree`);
}

// ── 6. metadata depth ─────────────────────────────────────────────────────
for (const entry of entries) {
  const meta = metadata[entry.name];
  if (!meta) continue;
  if ((meta.tags ?? []).length < 2) {
    note(
      "thin-tags",
      `"${entry.name}" has ${(meta.tags ?? []).length} tag(s) — hard to find by search`,
    );
  }
  if ((meta.tags ?? []).length > 8) {
    note(
      "tag-spam",
      `"${entry.name}" has ${meta.tags.length} tags — keep them to real search intent`,
    );
  }
}

// ── 7. component-name sanity ──────────────────────────────────────────────
for (const entry of entries) {
  if (toComponentName(entry.name) !== entry.component) {
    note(
      "component-drift",
      `"${entry.name}" → "${entry.component}" is not the expected PascalCase form`,
    );
  }
}

// ── report ────────────────────────────────────────────────────────────────
const grouped = new Map();
for (const f of findings) {
  if (!grouped.has(f.check)) grouped.set(f.check, []);
  grouped.get(f.check).push(f.message);
}

console.log(`Catalogue health — ${entries.length} icons across ${counts.size} categories\n`);
if (findings.length === 0) {
  console.log("✓ no findings.");
  process.exit(0);
}
for (const [check, messages] of [...grouped.entries()].sort((a, b) => byString(a[0], b[0]))) {
  console.log(`${check} (${messages.length})`);
  for (const message of messages) console.log(`    ${message}`);
  console.log("");
}
console.log(`${findings.length} finding(s). These are advisory — review, do not obey blindly.`);
process.exit(STRICT ? 1 : 0);
