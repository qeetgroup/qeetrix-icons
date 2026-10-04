import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix } from "node:path";
import { logoOutputDirectory } from "./logo-module.js";

export type LogoOutputComparison = {
  readonly stale: readonly string[];
  readonly missing: readonly string[];
  readonly extra: readonly string[];
};

type Inventory = { readonly files: Set<string>; readonly directories: string[] };

/** Every file and directory under the owned directory, repository-relative, without following links. */
function inventory(repositoryRoot: string): Inventory {
  const files = new Set<string>();
  const directories: string[] = [];
  const visit = (directory: string) => {
    let info: ReturnType<typeof lstatSync>;
    try {
      info = lstatSync(join(repositoryRoot, directory));
    } catch {
      return;
    }
    if (info.isSymbolicLink() || !info.isDirectory()) {
      if (directory === logoOutputDirectory) {
        throw new Error(`${directory} must be a real directory.`);
      }
      files.add(directory);
      return;
    }
    directories.push(directory);
    for (const name of readdirSync(join(repositoryRoot, directory)).sort()) {
      const path = posix.join(directory, name);
      const entry = lstatSync(join(repositoryRoot, path));
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(path);
      else files.add(path);
    }
  };
  visit(logoOutputDirectory);
  return { files, directories };
}

function readIfRegular(repositoryRoot: string, path: string): string | undefined {
  const info = lstatSync(join(repositoryRoot, path));
  return info.isFile() && !info.isSymbolicLink() ? readFileSync(join(repositoryRoot, path), "utf8") : undefined;
}

/** Read-only comparison of the planned files with what is on disk. */
export function compareLogoOutput(
  repositoryRoot: string,
  expected: ReadonlyMap<string, string>,
): LogoOutputComparison {
  const { files } = inventory(repositoryRoot);
  const stale: string[] = [];
  const missing: string[] = [];
  for (const [path, contents] of expected) {
    if (!files.has(path)) missing.push(path);
    else if (readIfRegular(repositoryRoot, path) !== contents) stale.push(path);
  }
  const extra = [...files].filter((path) => !expected.has(path)).sort();
  return { stale, missing, extra };
}

/** Writes changed files and removes everything else under the owned directory. */
export function writeLogoOutput(
  repositoryRoot: string,
  expected: ReadonlyMap<string, string>,
): { readonly written: number; readonly removed: number } {
  for (const path of expected.keys()) {
    if (!path.startsWith(`${logoOutputDirectory}/`) || path.includes("..")) {
      throw new Error(`Refusing to write ${path} outside ${logoOutputDirectory}.`);
    }
  }
  const { files, directories } = inventory(repositoryRoot);
  let removed = 0;
  for (const path of files) {
    if (!expected.has(path) || readIfRegular(repositoryRoot, path) === undefined) {
      unlinkSync(join(repositoryRoot, path));
      files.delete(path);
      removed += 1;
    }
  }
  let written = 0;
  for (const [path, contents] of expected) {
    if (files.has(path) && readFileSync(join(repositoryRoot, path), "utf8") === contents) continue;
    mkdirSync(dirname(join(repositoryRoot, path)), { recursive: true });
    writeFileSync(join(repositoryRoot, path), contents);
    written += 1;
  }
  const needed = new Set([...expected.keys()].flatMap((path) => {
    const parents: string[] = [];
    for (let parent = posix.dirname(path); parent.startsWith(logoOutputDirectory); parent = posix.dirname(parent)) {
      parents.push(parent);
    }
    return parents;
  }));
  for (const directory of directories.sort().reverse()) {
    if (!needed.has(directory)) {
      rmdirSync(join(repositoryRoot, directory));
      removed += 1;
    }
  }
  return { written, removed };
}
