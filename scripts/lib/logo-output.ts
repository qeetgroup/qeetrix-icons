import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  type Stats,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, posix } from "node:path";
import { logoBarrelPath, logoManifestPath, logoModuleDirectory } from "./logo-module.js";

export type LogoOutputComparison = {
  readonly stale: readonly string[];
  readonly missing: readonly string[];
  readonly extra: readonly string[];
};

/** Generated files outside the module directory: written and compared, never deleted. */
const ownedFiles: readonly string[] = [logoBarrelPath, logoManifestPath];

function statIfPresent(path: string): Stats | undefined {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

/** Planned paths must be a module directly inside the directory, or one of the owned files. */
function assertOwned(path: string): void {
  const inDirectory =
    posix.dirname(path) === logoModuleDirectory && /^[a-z0-9-]+\.ts$/.test(posix.basename(path));
  if (!inDirectory && !ownedFiles.includes(path)) {
    throw new Error(`Refusing to write ${path}: the logo generator does not own it.`);
  }
}

type Inventory = {
  /** Files (and links) inside the module directory, plus owned files that exist. */
  readonly files: Set<string>;
  /** Subdirectories of the module directory, deepest last. */
  readonly directories: string[];
};

/** What exists in the generator's paths, without following links. */
function inventory(repositoryRoot: string): Inventory {
  const files = new Set<string>();
  const directories: string[] = [];
  for (const file of ownedFiles) {
    const info = statIfPresent(join(repositoryRoot, file));
    if (!info) continue;
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error(`${file} must be a regular file.`);
    }
    files.add(file);
  }
  const root = statIfPresent(join(repositoryRoot, logoModuleDirectory));
  if (!root) return { files, directories };
  if (root.isSymbolicLink() || !root.isDirectory()) {
    throw new Error(`${logoModuleDirectory} must be a real directory.`);
  }
  const pending = [logoModuleDirectory];
  while (pending.length > 0) {
    const directory = pending.shift() as string;
    if (directory !== logoModuleDirectory) directories.push(directory);
    for (const name of readdirSync(join(repositoryRoot, directory)).sort()) {
      const path = posix.join(directory, name);
      const info = lstatSync(join(repositoryRoot, path));
      if (info.isDirectory() && !info.isSymbolicLink()) pending.push(path);
      else files.add(path);
    }
  }
  return { files, directories };
}

function readRegular(repositoryRoot: string, path: string): string | undefined {
  const info = lstatSync(join(repositoryRoot, path));
  return info.isFile() && !info.isSymbolicLink()
    ? readFileSync(join(repositoryRoot, path), "utf8")
    : undefined;
}

/** Read-only comparison of the planned files with what is on disk. */
export function compareLogoOutput(
  repositoryRoot: string,
  expected: ReadonlyMap<string, string>,
): LogoOutputComparison {
  for (const path of expected.keys()) assertOwned(path);
  const { files, directories } = inventory(repositoryRoot);
  const stale: string[] = [];
  const missing: string[] = [];
  for (const [path, contents] of expected) {
    if (!files.has(path)) missing.push(path);
    else if (readRegular(repositoryRoot, path) !== contents) stale.push(path);
  }
  const extra = [...files, ...directories].filter((path) => !expected.has(path)).sort();
  return { stale, missing, extra };
}

/**
 * Writes changed files and removes everything else inside `src/generated/logos/`. Nothing else
 * in `src/generated/` is ever touched.
 */
export function writeLogoOutput(
  repositoryRoot: string,
  expected: ReadonlyMap<string, string>,
): { readonly written: number; readonly removed: number } {
  for (const path of expected.keys()) assertOwned(path);
  const { files, directories } = inventory(repositoryRoot);
  let removed = 0;
  for (const path of files) {
    if (!path.startsWith(`${logoModuleDirectory}/`)) continue;
    if (!expected.has(path) || readRegular(repositoryRoot, path) === undefined) {
      unlinkSync(join(repositoryRoot, path));
      files.delete(path);
      removed += 1;
    }
  }
  for (const directory of directories.reverse()) {
    rmdirSync(join(repositoryRoot, directory));
    removed += 1;
  }
  mkdirSync(join(repositoryRoot, logoModuleDirectory), { recursive: true });
  let written = 0;
  for (const [path, contents] of expected) {
    if (files.has(path) && readFileSync(join(repositoryRoot, path), "utf8") === contents) continue;
    writeFileSync(join(repositoryRoot, path), contents);
    written += 1;
  }
  return { written, removed };
}
