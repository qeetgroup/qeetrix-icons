import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type BrandsData,
  brandsData,
  brandsDataPath,
  brandsRoot,
  readArchiveInfo,
  readBrandRelease,
  renderBrandsJson,
} from "../lib/brands.js";
import { compareText } from "../lib/diagnostics.js";

/**
 * `bun run sync:brands [commit] [--archive <thesvg.tar.gz>]` replaces icons/brand-icons/ with every
 * logo of the given theSVG commit (default: the commit pinned in config/brands.json) and rewrites
 * config/brands.json. `--archive` reads an already-downloaded GitHub tarball instead of fetching.
 *
 * Every file is written byte-for-byte to icons/brand-icons/<collection>/<slug>/<variant>.svg, from
 * all collections and with every licence; each logo's licence is recorded in config/brands.json.
 * `fetched` is the commit's date (read from the tarball), so re-syncing a commit is reproducible.
 *
 * What happens to upstream's loose ends (decided in readBrandRelease, scripts/lib/brands.ts):
 * - Files in a logo's folder that the manifest does not reference (such as `mono-lobe.svg`, or a
 *   `default.svg` beside a manifest default that points at `color.svg`) are kept as variants named
 *   after the file.
 * - Folders the manifest does not list are kept under the `unlisted` collection, titled from the
 *   folder name and with no licence (`NOASSERTION`), since upstream publishes no metadata for them.
 *   At c7531359 that is `the-lawyers-global` and `huggingface`. A folder byte-identical to a listed
 *   logo's folder would be skipped as a duplicate, but `huggingface` is not identical to
 *   `hugging-face` (it is different artwork), so it is kept.
 * - Files the manifest lists but the release lacks are skipped with a printed note. At c7531359
 *   that is `nextera-energy` wordmarkLight and wordmarkDark (`wordmark-light.svg`,
 *   `wordmark-dark.svg`; thesvg.org serves 404 too). The folder does ship `wordmarkLight.svg` and
 *   `wordmarkDark.svg`, which are kept as the unlisted variants `wordmark-light` and `wordmark-dark`.
 */

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const dataPath = join(repositoryRoot, brandsDataPath);
const previous: BrandsData | undefined = existsSync(dataPath)
  ? JSON.parse(readFileSync(dataPath, "utf8"))
  : undefined;

const positional: string[] = [];
let archivePath: string | undefined;
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index] ?? "";
  if (argument === "--archive") archivePath = process.argv[++index];
  else positional.push(argument);
}
const ref = positional[0] ?? previous?.commit;
if (!ref || !/^[\w./-]+$/.test(ref) || (archivePath !== undefined && !archivePath)) {
  console.error(
    "Usage: bun run sync:brands <commit> [--archive <thesvg.tar.gz>], for example c75313597b8bb14982e433ddae1b705813c66c7c.",
  );
  process.exit(1);
}

function run(command: string, args: string[], cwd = repositoryRoot): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed.`);
}

function count<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

const workDirectory = mkdtempSync(join(tmpdir(), "qeetrix-brands-"));
try {
  let archive: Buffer;
  if (archivePath) {
    console.log(`Reading theSVG ${ref} from ${archivePath}`);
    archive = readFileSync(archivePath);
  } else {
    const url = `https://codeload.github.com/glincker/thesvg/tar.gz/${ref}`;
    console.log(`Downloading theSVG ${ref} from ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}.`);
    archive = Buffer.from(await response.arrayBuffer());
  }

  const info = readArchiveInfo(archive);
  const commit = info.commit ?? (/^[0-9a-f]{40}$/.test(ref) ? ref : undefined);
  if (!commit) throw new Error("The archive does not name its commit; pass a full commit SHA.");
  if (/^[0-9a-f]{7,40}$/.test(ref) && !commit.startsWith(ref)) {
    throw new Error(`The archive holds commit ${commit}, not ${ref}.`);
  }

  const archiveFile = join(workDirectory, "thesvg.tgz");
  writeFileSync(archiveFile, archive);
  const extractDirectory = join(workDirectory, "release");
  mkdirSync(extractDirectory);
  run("tar", ["-xzf", archiveFile, "-C", extractDirectory]);
  const [top, ...extra] = readdirSync(extractDirectory);
  if (!top || extra.length > 0) throw new Error("Expected one top-level folder in the archive.");

  const release = readBrandRelease(join(extractDirectory, top), commit);
  const data = brandsData(release, info.date);

  const root = join(repositoryRoot, brandsRoot);
  mkdirSync(root, { recursive: true });
  for (const entry of readdirSync(root)) {
    if (entry !== ".gitkeep") rmSync(join(root, entry), { recursive: true, force: true });
  }
  type Written = { collection: string; variant: string; bytes: number; background: string };
  const written: Written[] = [];
  for (const logo of release.logos) {
    const variants = data.logos[logo.slug]?.variants ?? {};
    for (const variant of logo.variants) {
      const entry = variants[variant.name];
      if (!entry) throw new Error(`${logo.slug}: ${variant.name} is missing from the data.`);
      const file = join(repositoryRoot, entry.file);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, variant.bytes);
      written.push({
        collection: logo.collection,
        variant: variant.name,
        bytes: variant.bytes.length,
        background: entry.background,
      });
    }
  }
  writeFileSync(dataPath, renderBrandsJson(data));
  // config/brands.json is several MiB, past Biome's 1 MiB default, so raise the limit for it.
  run("bunx", ["biome", "format", "--write", "--files-max-size=67108864", brandsDataPath]);

  const totalBytes = written.reduce((sum, entry) => sum + entry.bytes, 0);
  console.log(
    `Synced ${release.logos.length} logos (${written.length} files, ${totalBytes} bytes) from theSVG ` +
      `${commit}${release.packageVersion ? ` (thesvg@${release.packageVersion})` : ""}, dated ${info.date}.`,
  );
  const filesByCollection = count(written, (entry) => entry.collection);
  for (const collection of data.collections) {
    console.log(
      `  ${collection.id}: ${collection.count} logos, ${filesByCollection.get(collection.id) ?? 0} files`,
    );
  }
  const byVariant = new Map<string, Map<string, number>>();
  for (const entry of written) {
    const backgrounds = byVariant.get(entry.variant) ?? new Map<string, number>();
    backgrounds.set(entry.background, (backgrounds.get(entry.background) ?? 0) + 1);
    byVariant.set(entry.variant, backgrounds);
  }
  console.log("Files per variant (by measured background: light / dark / any):");
  for (const [variant, backgrounds] of [...byVariant].sort(
    (left, right) =>
      [...right[1].values()].reduce((a, b) => a + b, 0) -
        [...left[1].values()].reduce((a, b) => a + b, 0) || compareText(left[0], right[0]),
  )) {
    const total = [...backgrounds.values()].reduce((a, b) => a + b, 0);
    const split = ["light", "dark", "any"].map((name) => backgrounds.get(name) ?? 0).join(" / ");
    console.log(`  ${variant}: ${total} (${split})`);
  }
  // theSVG documents `light` as white artwork for dark backgrounds and `dark` as black artwork for
  // light backgrounds; count how often the measured background disagrees.
  for (const [suffix, documented] of [
    ["light", "dark"],
    ["dark", "light"],
  ] as const) {
    const named = written.filter((entry) => entry.variant.split("-").at(-1) === suffix);
    const matches = named.filter((entry) => entry.background === documented).length;
    const inverted = named.filter(
      (entry) => entry.background !== documented && entry.background !== "any",
    ).length;
    console.log(
      `  *${suffix} files: ${named.length}; ${matches} as documented (${documented} background), ` +
        `${inverted} inverted, ${named.length - matches - inverted} any.`,
    );
  }
  if (release.skipped.length > 0) {
    console.log("Skipped or substituted:");
    for (const { item, reason } of release.skipped) console.log(`  ${item}: ${reason}`);
  }
  if (previous) {
    const before = new Set(Object.keys(previous.logos));
    const after = new Set(Object.keys(data.logos));
    const added = [...after].filter((slug) => !before.has(slug));
    const removed = [...before].filter((slug) => !after.has(slug));
    console.log(
      `${added.length} logos added, ${removed.length} removed since ${previous.commit.slice(0, 12)}.`,
    );
    if (removed.length > 0) console.log(`Removed: ${removed.join(", ")}.`);
  }
} finally {
  rmSync(workDirectory, { recursive: true, force: true });
}

// Like sync:lucide, leave the repository consistent: validate the new sources, then regenerate the
// logo components and catalogue from them.
for (const script of ["check:brands", "generate:logos"]) {
  const result = spawnSync("bun", ["run", script], { cwd: repositoryRoot, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`bun run ${script} failed after the sync.`);
    process.exit(1);
  }
}
