import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { derived } from "../../config/derived/index.js";
import { filledRecipes } from "../../config/filled.js";
import { iconSystem } from "../../config/icon-system.js";
import { compareText } from "../lib/diagnostics.js";
import { deriveFilled } from "../lib/filled.js";
import { categoryArgument, listOverrides, readOverride } from "../lib/overrides.js";
import { sharpenOutline } from "../lib/sharp.js";

/**
 * `bun run derive:sharp` writes the sharp style's sources: every round outline sharpened
 * (icons/sharp-outline/<category>/<name>.svg), and a filled drawing derived from the sharp outline,
 * with the sharp stroke style, for every name in config/filled.ts
 * (icons/sharp-filled/<category>/<name>.svg). Both folders are owned entirely by this script, so
 * anything else in them is removed. A reviewed override in config/overrides/sharp-outline/ or
 * config/overrides/sharp-filled/ replaces the derived drawing byte for byte; a sharp filled drawing
 * is derived from the (possibly overridden) sharp outline. `--check` writes nothing and fails when
 * any drawing is missing, stale, or unlisted. `--category <id>` limits everything, including stale
 * removal, to one category.
 */

const roundOutlineRoot = "icons/round-outline";
const sharpOutlineRoot = "icons/sharp-outline";
const sharpFilledRoot = "icons/sharp-filled";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const check = process.argv.includes("--check");
const onlyCategory = categoryArgument(process.argv);
const inputRoot = roundOutlineRoot;

/** Round outline sources by name: repository-relative path and category. */
const outlines = new Map<string, { path: string; category: string; file: string }>();
for (const category of readdirSync(join(repositoryRoot, inputRoot)).sort(compareText)) {
  if (onlyCategory && category !== onlyCategory) continue;
  for (const file of readdirSync(join(repositoryRoot, inputRoot, category)).sort(compareText)) {
    if (file.endsWith(".svg")) {
      outlines.set(file.slice(0, -4), { path: `${inputRoot}/${category}/${file}`, category, file });
    }
  }
}

/** Every file under a directory, repository-relative. */
function listFiles(directory: string): string[] {
  const absolute = join(repositoryRoot, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`],
  );
}

if (onlyCategory && outlines.size === 0) {
  console.error(`No outline drawings in category ${JSON.stringify(onlyCategory)}.`);
  process.exit(1);
}
const inScope = (file: string) => !onlyCategory || file.split("/")[2] === onlyCategory;
const existing = new Set(
  [...listFiles(sharpOutlineRoot), ...listFiles(sharpFilledRoot)].filter(inScope),
);
let overridden = 0;
const problems: string[] = [];
const expected = new Map<string, string>();

for (const [name, { path, category, file }] of outlines) {
  try {
    const override = readOverride(repositoryRoot, "sharp-outline", category, name);
    if (override !== undefined) overridden += 1;
    const sharp =
      override ?? sharpenOutline(readFileSync(join(repositoryRoot, path), "utf8"), name);
    expected.set(`${sharpOutlineRoot}/${category}/${file}`, sharp);
  } catch (error) {
    problems.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const name of Object.keys(filledRecipes).sort(compareText)) {
  const outline = outlines.get(name);
  if (!outline) {
    if (!onlyCategory) {
      problems.push(`config/derived lists ${JSON.stringify(name)}, which has no outline drawing.`);
    }
    continue;
  }
  const filledOverride = (() => {
    try {
      return readOverride(repositoryRoot, "sharp-filled", outline.category, name);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
      return undefined;
    }
  })();
  if (filledOverride !== undefined) {
    expected.set(`${sharpFilledRoot}/${outline.category}/${outline.file}`, filledOverride);
    overridden += 1;
    continue;
  }
  const sharpOutline = `${sharpOutlineRoot}/${outline.category}/${outline.file}`;
  const source = expected.get(sharpOutline);
  if (source === undefined) continue;
  try {
    // The sharp drawing plays every element in the role the round one does, listed or inferred,
    // so both styles share one reviewed design. (Inferring afresh can flip a role: square caps
    // push a connector's ends further into the bodies it joins, or a dot's cap past its body.)
    // Sharpening keeps element order and count, so the roles carry over index for index.
    const round = await deriveFilled(
      readFileSync(join(repositoryRoot, outline.path), "utf8"),
      filledRecipes[name],
      outline.path,
    );
    // Index-for-index transfer only holds while the sharp outline keeps the round element count
    // (a hand-drawn sharp outline may not); config/derived's sharpFilledRoles adjust either way.
    const roundCount = round.roles.length;
    const sharpCount = (source.match(/^ {2}<[a-z]/gm) ?? []).length;
    const inherited =
      sharpCount === roundCount
        ? Object.fromEntries(round.roles.map((role, index) => [index, role]))
        : {};
    const { svg } = await deriveFilled(
      source,
      { roles: { ...inherited, ...(derived.sharpFilledRoles[name] ?? {}) } },
      sharpOutline,
      iconSystem.design.sharp,
      // Bodies close, and cuts run on through the edge, from the round outline's line ends,
      // which sharpening may have pulled back off the strokes they meet.
      sharpCount === roundCount ? round : undefined,
    );
    // deriveFilled names its own command in the leading comment; this file comes from ours.
    const comment = svg.replace("`bun run derive:filled`", "`bun run derive:sharp`");
    expected.set(`${sharpFilledRoot}/${outline.category}/${outline.file}`, comment);
  } catch (error) {
    problems.push(
      `${sharpOutline}: sharp filled drawing failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

for (const folder of ["sharp-outline", "sharp-filled"] as const) {
  const root = folder === "sharp-outline" ? sharpOutlineRoot : sharpFilledRoot;
  for (const path of listOverrides(repositoryRoot, folder)) {
    const [, , , category, file] = path.split("/");
    if (onlyCategory && category !== onlyCategory) continue;
    if (!expected.has(`${root}/${category}/${file}`)) {
      problems.push(`${path}: replaces no ${folder} drawing.`);
    }
  }
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`Sharp derivation failed with ${problems.length} error(s). Nothing was written.`);
  process.exit(1);
}

const stale = [...existing].filter((file) => !expected.has(file)).sort(compareText);
const changed = [...expected].filter(([file, svg]) => {
  if (!existing.has(file)) return true;
  return readFileSync(join(repositoryRoot, file), "utf8") !== svg;
});
const counts = () => {
  const filled = [...expected.keys()].filter((file) => file.startsWith(sharpFilledRoot)).length;
  const scope = onlyCategory ? ` in ${onlyCategory}` : "";
  return `${expected.size - filled} outlines and ${filled} filled drawings${scope} (${overridden} from overrides)`;
};

if (check) {
  const messages = [
    ...changed.map(([file]) => `${file} is ${existing.has(file) ? "stale" : "missing"}.`),
    ...stale.map((file) => `${file} is not derived from any outline or filled recipe.`),
  ];
  if (messages.length > 0) {
    console.error(messages.join("\n"));
    console.error("Sharp drawings are out of date. Run `bun run derive:sharp`.");
    process.exit(1);
  }
  console.log(`Sharp drawings are up to date: ${counts()}.`);
} else {
  for (const file of stale) rmSync(join(repositoryRoot, file));
  for (const [file, svg] of changed) {
    mkdirSync(dirname(join(repositoryRoot, file)), { recursive: true });
    writeFileSync(join(repositoryRoot, file), svg);
  }
  // Remove directories left empty, deepest first, keeping the two roots.
  const removeEmpty = (directory: string, keep: boolean): boolean => {
    const absolute = join(repositoryRoot, directory);
    if (!existsSync(absolute)) return false;
    let empty = true;
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (!entry.isDirectory() || !removeEmpty(`${directory}/${entry.name}`, false)) empty = false;
    }
    if (empty && !keep) rmSync(absolute, { recursive: true });
    return empty;
  };
  removeEmpty(sharpOutlineRoot, true);
  removeEmpty(sharpFilledRoot, true);
  console.log(`Derived ${counts()} (${changed.length} written, ${stale.length} removed).`);
}
