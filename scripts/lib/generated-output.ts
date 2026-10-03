import { Buffer } from "node:buffer";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  type Stats,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix } from "node:path";
import { iconSystem } from "../../config/icon-system.js";
import { validateSourcePath } from "../check/validate-source-path.js";
import { compareText, type Diagnostic, diagnostic, sortDiagnostics } from "./diagnostics.js";
import {
  barrelPath,
  type GenerationPlan,
  generatedDirectory,
  generatedOutputPath,
  manifestJsonPath,
  manifestModulePath,
  packageArtifactPaths,
} from "./generation-plan.js";

/** Generated files outside the owned directory. Written and compared, never deleted. */
const ownedRootFiles: readonly string[] = [manifestJsonPath];

/** Written after every component, in this order. */
const writeLast: readonly string[] = [barrelPath, manifestModulePath, manifestJsonPath];

type ChangedFile = { readonly path: string; readonly contents: string; readonly missing: boolean };

/** What currently exists in generated locations, as repository-relative paths. */
type Inventory = {
  readonly root: string;
  /** Files inside the owned directory. */
  readonly files: ReadonlySet<string>;
  readonly directories: ReadonlySet<string>;
  /** Owned root files that currently exist. */
  readonly rootFiles: ReadonlySet<string>;
};

type PreparedOutput = {
  readonly inventory: Inventory;
  readonly changed: readonly ChangedFile[];
  readonly stale: readonly string[];
};

export type GenerationResult = {
  readonly generatedCount: number;
  readonly changedCount: number;
  readonly removedCount: number;
  readonly diagnostics: readonly Diagnostic[];
};

class OutputError extends Error {
  readonly file: string;

  constructor(file: string, message: string) {
    super(message);
    this.file = file;
  }
}

function statIfPresent(path: string): Stats | undefined {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

/** Writing through a symlink or hard link would modify data outside the boundary. */
function assertRegularFile(file: string, info: Stats): void {
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new OutputError(file, "Links and special files are not allowed as generated output.");
  }
  if (info.nlink > 1) {
    throw new OutputError(file, "Hard-linked files are not allowed as generated output.");
  }
}

/**
 * Lists generated locations without following links. Every ancestor of the owned directory must be
 * a real directory, and generated files must be regular, singly linked files.
 */
function inspectOutput(repositoryRoot: string): Inventory {
  const root = realpathSync(repositoryRoot);
  const files = new Set<string>();
  const directories = new Set<string>();
  const rootFiles = new Set<string>();

  for (const file of ownedRootFiles) {
    const info = statIfPresent(join(root, file));
    if (!info) continue;
    assertRegularFile(file, info);
    rootFiles.add(file);
  }

  let ancestor = "";
  for (const part of generatedDirectory.split("/")) {
    ancestor = posix.join(ancestor, part);
    const info = statIfPresent(join(root, ancestor));
    if (!info) return { root, files, directories, rootFiles };
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new OutputError(ancestor, "Generated-output ancestors must be real directories.");
    }
  }

  const pending = [generatedDirectory];
  while (pending.length > 0) {
    const directory = pending.pop();
    if (!directory) break;
    directories.add(directory);
    for (const name of readdirSync(join(root, directory), { encoding: "utf8" }).sort(compareText)) {
      const file = posix.join(directory, name);
      const info = lstatSync(join(root, file));
      if (info.isDirectory() && !info.isSymbolicLink()) {
        pending.push(file);
      } else {
        assertRegularFile(file, info);
        files.add(file);
      }
    }
  }
  return { root, files, directories, rootFiles };
}

/**
 * Proves the plan writes exactly the canonical set: one module per concept at the path derived from
 * its validated sources (which must agree on name and category, default variant first), plus the
 * fixed package artifacts, each once.
 */
function expectedFiles(plan: GenerationPlan): Map<string, string> {
  const allowed = new Set(packageArtifactPaths);
  for (const concept of plan.concepts) {
    const canonical =
      concept.id === concept.name &&
      concept.outputPath === generatedOutputPath(concept.name) &&
      concept.sources[0]?.variant === iconSystem.architecture.defaultVariant &&
      concept.sources.every(({ file, name, category, variant }) => {
        const source = validateSourcePath(file);
        return (
          source.diagnostics.length === 0 &&
          source.location?.name === name &&
          source.location.category === category &&
          source.location.variant === variant &&
          name === concept.name &&
          category === concept.category
        );
      });
    if (!canonical) {
      throw new OutputError(
        concept.outputPath,
        `Planned output is not the canonical module for concept ${JSON.stringify(concept.name)}.`,
      );
    }
    if (allowed.has(concept.outputPath)) {
      throw new OutputError(concept.outputPath, "Duplicate generated output path.");
    }
    allowed.add(concept.outputPath);
  }

  const expected = new Map<string, string>();
  for (const file of plan.files) {
    if (!allowed.has(file.path)) {
      throw new OutputError(file.path, "Planned file is not a canonical generated path.");
    }
    if (expected.has(file.path)) {
      throw new OutputError(file.path, "Duplicate generated output path.");
    }
    expected.set(file.path, file.contents);
  }
  for (const path of allowed) {
    if (!expected.has(path)) throw new OutputError(path, "The plan omits a generated file.");
  }
  return expected;
}

/** Read-only preflight shared by the writer and the checker. */
function prepareOutput(repositoryRoot: string, plan: GenerationPlan): PreparedOutput {
  const expected = expectedFiles(plan);
  const inventory = inspectOutput(repositoryRoot);
  const changed: ChangedFile[] = [];
  for (const [path, contents] of expected) {
    if (inventory.directories.has(path)) {
      throw new OutputError(path, "A directory occupies a planned generated file.");
    }
    for (
      let parent = posix.dirname(path);
      parent.startsWith(`${generatedDirectory}/`);
      parent = posix.dirname(parent)
    ) {
      if (inventory.files.has(parent)) {
        throw new OutputError(parent, "A file occupies a planned output directory.");
      }
    }
    const missing = !inventory.files.has(path) && !inventory.rootFiles.has(path);
    if (
      missing ||
      !readFileSync(join(inventory.root, path)).equals(Buffer.from(contents, "utf8"))
    ) {
      changed.push({ path, contents, missing });
    }
  }
  // Components first and the catalogue last, so an interrupted write never leaves the barrel or
  // manifest describing components that were not written.
  const order = (path: string) => writeLast.indexOf(path);
  changed.sort(
    (left, right) => order(left.path) - order(right.path) || compareText(left.path, right.path),
  );
  const stale = [...inventory.files].filter((file) => !expected.has(file)).sort(compareText);
  return { inventory, changed, stale };
}

function outputDiagnostic(error: unknown, prefix: string): Diagnostic {
  const file = error instanceof OutputError ? error.file : generatedDirectory;
  const message = error instanceof Error ? error.message : String(error);
  return diagnostic("QXI-GEN-002", file, `${prefix}: ${message}`);
}

/**
 * Compares the plan with what is on disk, byte for byte, without writing anything. Reports
 * missing, edited or out-of-date, and stale generated files. Independent of Git.
 */
export function checkGenerationPlan(
  repositoryRoot: string,
  plan: GenerationPlan,
): readonly Diagnostic[] {
  if (plan.diagnostics.length > 0) return plan.diagnostics;
  let prepared: PreparedOutput;
  try {
    prepared = prepareOutput(repositoryRoot, plan);
  } catch (error) {
    return [outputDiagnostic(error, "Unsafe or unreadable generated output")];
  }
  return sortDiagnostics([
    ...prepared.changed.map(({ path, missing }) =>
      diagnostic(
        "QXI-GEN-003",
        path,
        `Generated file is ${missing ? "missing" : "out of date"}; run bun run generate.`,
      ),
    ),
    ...prepared.stale.map((file) =>
      diagnostic("QXI-GEN-003", file, "Stale generated file; run bun run generate."),
    ),
  ]);
}

/**
 * Makes generated locations match the plan: writes changed files, deletes stale files inside
 * `src/generated/`, and removes emptied subdirectories. Refuses an invalid plan, and runs the full
 * read-only preflight before the first write, so a rejected run changes nothing.
 */
export function writeGenerationPlan(
  repositoryRoot: string,
  plan: GenerationPlan,
): GenerationResult {
  const result = { generatedCount: 0, changedCount: 0, removedCount: 0 };
  if (plan.diagnostics.length > 0) return { ...result, diagnostics: plan.diagnostics };

  let prepared: PreparedOutput;
  try {
    prepared = prepareOutput(repositoryRoot, plan);
  } catch (error) {
    return {
      ...result,
      diagnostics: [
        outputDiagnostic(error, "Unsafe or unreadable generated output; nothing written"),
      ],
    };
  }

  const { inventory, changed, stale } = prepared;
  try {
    for (const { path, contents } of changed) {
      const absolute = join(inventory.root, path);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, contents, "utf8");
      result.changedCount += 1;
    }
    for (const file of stale) {
      unlinkSync(join(inventory.root, file));
      result.removedCount += 1;
    }
    // Deepest first, so a parent is only checked after its emptied children are gone.
    const directories = [...inventory.directories].sort(
      (left, right) => right.length - left.length || compareText(right, left),
    );
    for (const directory of directories) {
      if (directory === generatedDirectory) continue;
      const absolute = join(inventory.root, directory);
      if (readdirSync(absolute).length === 0) rmdirSync(absolute);
    }
  } catch (error) {
    return {
      ...result,
      diagnostics: [outputDiagnostic(error, "Writing generated output failed")],
    };
  }
  return { ...result, generatedCount: plan.concepts.length, diagnostics: [] };
}
