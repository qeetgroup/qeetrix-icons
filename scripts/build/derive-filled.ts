import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { filledRecipes } from "../../config/filled.js";
import { compareText } from "../lib/diagnostics.js";
import { deriveFilled } from "../lib/filled.js";
import { categoryArgument, listOverrides, overridePath, readOverride } from "../lib/overrides.js";

/**
 * `bun run derive:filled` writes icons/round-filled/ from the filled recipes in
 * config/derived/<category>.ts: one drawing per listed name, derived from its outline and placed in
 * the outline's category, or copied from a reviewed override in config/overrides/round-filled/.
 * icons/round-filled/ is owned entirely by this script, so unlisted drawings are removed.
 * `--check` writes nothing and fails when any drawing is missing, stale, or unlisted.
 * `--category <id>` limits everything, including stale removal, to one category.
 */

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const check = process.argv.includes("--check");
const onlyCategory = categoryArgument(process.argv);

const outlines = new Map<string, { path: string; category: string }>();
for (const category of readdirSync(join(repositoryRoot, "icons/round-outline")).sort(compareText)) {
  if (onlyCategory && category !== onlyCategory) continue;
  for (const file of readdirSync(join(repositoryRoot, "icons/round-outline", category))) {
    if (file.endsWith(".svg")) {
      outlines.set(file.slice(0, -4), {
        path: `icons/round-outline/${category}/${file}`,
        category,
      });
    }
  }
}
if (onlyCategory && outlines.size === 0) {
  console.error(`No outline drawings in category ${JSON.stringify(onlyCategory)}.`);
  process.exit(1);
}

const filledRoot = join(repositoryRoot, "icons/round-filled");
const existing = new Set<string>();
if (existsSync(filledRoot)) {
  for (const category of readdirSync(filledRoot)) {
    if (onlyCategory && category !== onlyCategory) continue;
    for (const file of readdirSync(join(filledRoot, category))) {
      existing.add(`icons/round-filled/${category}/${file}`);
    }
  }
}

const problems: string[] = [];
const expected = new Map<string, string>();
let overridden = 0;
for (const name of Object.keys(filledRecipes).sort(compareText)) {
  const outline = outlines.get(name);
  if (!outline) {
    if (!onlyCategory) {
      problems.push(`config/derived lists ${JSON.stringify(name)}, which has no outline drawing.`);
    }
    continue;
  }
  const target = `icons/round-filled/${outline.category}/${name}.svg`;
  try {
    const override = readOverride(repositoryRoot, "round-filled", outline.category, name);
    if (override !== undefined) {
      expected.set(target, override);
      overridden += 1;
      continue;
    }
    const source = readFileSync(join(repositoryRoot, outline.path), "utf8");
    const { svg } = await deriveFilled(source, filledRecipes[name], outline.path);
    expected.set(target, svg);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }
}
// An override must replace a listed drawing; otherwise it is dead weight or a typo.
for (const path of listOverrides(repositoryRoot, "round-filled")) {
  const [, , , category, file] = path.split("/");
  if (onlyCategory && category !== onlyCategory) continue;
  const name = file.slice(0, -4);
  if (overridePath("round-filled", category, name) !== path) continue;
  if (!expected.has(`icons/round-filled/${category}/${file}`)) {
    problems.push(
      `${path}: replaces no listed filled drawing (list ${name} in config/derived/${category}.ts).`,
    );
  }
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`Filled derivation failed with ${problems.length} error(s). Nothing was written.`);
  process.exit(1);
}

const stale = [...existing].filter((file) => !expected.has(file)).sort(compareText);
const changed = [...expected].filter(([file, svg]) => {
  if (!existing.has(file)) return true;
  return readFileSync(join(repositoryRoot, file), "utf8") !== svg;
});
const scope = onlyCategory ? ` in ${onlyCategory}` : "";

if (check) {
  const messages = [
    ...changed.map(([file]) => `${file} is ${existing.has(file) ? "stale" : "missing"}.`),
    ...stale.map((file) => `${file} is not listed in config/derived.`),
  ];
  if (messages.length > 0) {
    console.error(messages.join("\n"));
    console.error("Filled drawings are out of date. Run `bun run derive:filled`.");
    process.exit(1);
  }
  console.log(
    `Filled drawings are up to date${scope}: ${expected.size} (${overridden} from overrides).`,
  );
} else {
  for (const file of stale) rmSync(join(repositoryRoot, file));
  for (const [file, svg] of changed) {
    mkdirSync(dirname(join(repositoryRoot, file)), { recursive: true });
    writeFileSync(join(repositoryRoot, file), svg);
  }
  if (existsSync(filledRoot)) {
    for (const category of readdirSync(filledRoot)) {
      if (readdirSync(join(filledRoot, category)).length === 0) {
        rmSync(join(filledRoot, category), { recursive: true });
      }
    }
  }
  console.log(
    `Derived ${expected.size} filled drawings${scope} (${overridden} from overrides; ${changed.length} written, ${stale.length} removed).`,
  );
}
