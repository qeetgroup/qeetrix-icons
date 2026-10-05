import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { filledRecipes } from "../../config/filled.js";
import { compareText } from "../lib/diagnostics.js";
import { deriveFilled } from "../lib/filled.js";

/**
 * `bun run derive:filled` writes icons/round-filled/ from config/filled.ts: one drawing per listed name,
 * derived from its outline and placed in the outline's category. icons/round-filled/ is owned entirely by
 * this script, so unlisted drawings are removed. `--check` writes nothing and fails when any
 * drawing is missing, stale, or unlisted, which CI uses to keep the sources honest.
 */

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const check = process.argv.includes("--check");

const outlines = new Map<string, string>();
for (const category of readdirSync(join(repositoryRoot, "icons/round-outline")).sort(compareText)) {
  for (const file of readdirSync(join(repositoryRoot, "icons/round-outline", category))) {
    if (file.endsWith(".svg"))
      outlines.set(file.slice(0, -4), `icons/round-outline/${category}/${file}`);
  }
}

const existing = new Set<string>();
const filledRoot = join(repositoryRoot, "icons/round-filled");
try {
  for (const category of readdirSync(filledRoot)) {
    for (const file of readdirSync(join(filledRoot, category))) {
      existing.add(`icons/round-filled/${category}/${file}`);
    }
  }
} catch {
  // No filled drawings yet.
}

const problems: string[] = [];
const expected = new Map<string, string>();
for (const name of Object.keys(filledRecipes).sort(compareText)) {
  const outline = outlines.get(name);
  if (!outline) {
    problems.push(`config/filled.ts lists ${JSON.stringify(name)}, which has no outline drawing.`);
    continue;
  }
  try {
    const source = readFileSync(join(repositoryRoot, outline), "utf8");
    const { svg } = await deriveFilled(source, filledRecipes[name], outline);
    expected.set(outline.replace(/^icons\/round-outline\//, "icons/round-filled/"), svg);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
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

if (check) {
  const messages = [
    ...changed.map(([file]) => `${file} is ${existing.has(file) ? "stale" : "missing"}.`),
    ...stale.map((file) => `${file} is not listed in config/filled.ts.`),
  ];
  if (messages.length > 0) {
    console.error(messages.join("\n"));
    console.error("Filled drawings are out of date. Run `bun run derive:filled`.");
    process.exit(1);
  }
  console.log(`Filled drawings are up to date: ${expected.size} derived from their outlines.`);
} else {
  for (const file of stale) rmSync(join(repositoryRoot, file));
  for (const [file, svg] of changed) {
    mkdirSync(dirname(join(repositoryRoot, file)), { recursive: true });
    writeFileSync(join(repositoryRoot, file), svg);
  }
  for (const category of readdirSync(filledRoot)) {
    if (readdirSync(join(filledRoot, category)).length === 0) {
      rmSync(join(filledRoot, category), { recursive: true });
    }
  }
  console.log(
    `Derived ${expected.size} filled drawings (${changed.length} written, ${stale.length} removed).`,
  );
}
