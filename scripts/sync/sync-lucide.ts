import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type LucideData,
  lucideData,
  outlineSourcePath,
  readLucideRelease,
  renderCategoriesModule,
} from "../lib/lucide.js";

/**
 * `bun run sync:lucide [version]` replaces icons/round-outline/ with the given Lucide release (default:
 * the version pinned in config/lucide.json), rewrites config/lucide.json and config/categories.ts,
 * then re-derives the filled drawings and regenerates the components and manifest.
 */

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const dataPath = join(repositoryRoot, "config/lucide.json");
const previous: LucideData | undefined = existsSync(dataPath)
  ? JSON.parse(readFileSync(dataPath, "utf8"))
  : undefined;
const version = process.argv[2] ?? previous?.version;
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: bun run sync:lucide <version>, for example 1.52.0.");
  process.exit(1);
}

function run(command: string, args: string[], cwd = repositoryRoot): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed.`);
}

const workDirectory = mkdtempSync(join(tmpdir(), "qeetrix-lucide-"));
try {
  const url = `https://codeload.github.com/lucide-icons/lucide/tar.gz/refs/tags/${version}`;
  console.log(`Downloading Lucide ${version} from ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}.`);
  const archive = join(workDirectory, "lucide.tgz");
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  run("tar", ["-xzf", archive, "-C", workDirectory]);

  const release = readLucideRelease(join(workDirectory, `lucide-${version}`), version);
  const data = lucideData(release);

  rmSync(join(repositoryRoot, "icons/round-outline"), { recursive: true, force: true });
  for (const icon of release.icons) {
    const file = join(repositoryRoot, outlineSourcePath(icon));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, icon.svg);
  }
  writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
  writeFileSync(join(repositoryRoot, "config/categories.ts"), renderCategoriesModule(data));
  run("bunx", ["biome", "format", "--write", "config/lucide.json", "config/categories.ts"]);

  const before = new Set(Object.keys(previous?.icons ?? {}));
  const after = new Set(Object.keys(data.icons));
  const added = [...after].filter((name) => !before.has(name));
  const removed = [...before].filter((name) => !after.has(name));
  console.log(
    `Synced ${release.icons.length} Lucide ${version} icons in ${data.categories.length} categories` +
      ` (${added.length} added, ${removed.length} removed since ${previous?.version ?? "nothing"}).`,
  );
  if (release.skipped.length > 0) {
    console.log(`Skipped deprecated upstream icons: ${release.skipped.join(", ")}.`);
  }
  if (removed.length > 0) console.log(`Removed: ${removed.join(", ")}.`);
} finally {
  rmSync(workDirectory, { recursive: true, force: true });
}

run("bun", ["run", "derive:filled"]);
run("bun", ["run", "generate"]);
