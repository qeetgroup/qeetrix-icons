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
import { validateSourcePath } from "../check/validate-source-path.js";
import { compareText, type Diagnostic, diagnostic, sortDiagnostics } from "./diagnostics.js";
import {
  type GeneratedIcon,
  type GenerationPlan,
  generatedIconsDirectory,
  generatedOutputPath,
} from "./generation-plan.js";

/** What currently exists inside the generated-icons directory, as repository-relative paths. */
type Inventory = {
  readonly root: string;
  readonly files: ReadonlySet<string>;
  readonly directories: ReadonlySet<string>;
};

type PreparedOutput = {
  readonly inventory: Inventory;
  readonly changed: readonly { readonly icon: GeneratedIcon; readonly missing: boolean }[];
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

/**
 * Lists the generated-icons directory without following links. Every ancestor must be a real
 * directory, and the tree may hold only regular, singly linked files: writing through a symlink or
 * hard link would modify data outside the boundary.
 */
function inspectOutput(repositoryRoot: string): Inventory {
  const root = realpathSync(repositoryRoot);
  const files = new Set<string>();
  const directories = new Set<string>();
  let ancestor = "";
  for (const part of generatedIconsDirectory.split("/")) {
    ancestor = posix.join(ancestor, part);
    const info = statIfPresent(join(root, ancestor));
    if (!info) return { root, files, directories };
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new OutputError(ancestor, "Generated-output ancestors must be real directories.");
    }
  }

  const pending = [generatedIconsDirectory];
  while (pending.length > 0) {
    const directory = pending.pop();
    if (!directory) break;
    directories.add(directory);
    for (const name of readdirSync(join(root, directory), { encoding: "utf8" }).sort(compareText)) {
      const file = posix.join(directory, name);
      const info = lstatSync(join(root, file));
      if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) {
        throw new OutputError(file, "Links and special files are not allowed in generated output.");
      }
      if (info.isDirectory()) {
        pending.push(file);
      } else if (info.nlink > 1) {
        throw new OutputError(file, "Hard-linked files are not allowed in generated output.");
      } else {
        files.add(file);
      }
    }
  }
  return { root, files, directories };
}

/** Proves every planned path is the canonical output of its own validated source. */
function assertPlannedPaths(plan: GenerationPlan): Set<string> {
  const expected = new Set<string>();
  for (const icon of plan.files) {
    const source = validateSourcePath(icon.file);
    if (
      !source.location ||
      source.diagnostics.length > 0 ||
      !icon.outputPath.startsWith(`${generatedIconsDirectory}/`) ||
      icon.outputPath !== posix.normalize(icon.outputPath) ||
      icon.outputPath !== generatedOutputPath(source.location)
    ) {
      throw new OutputError(
        icon.outputPath,
        `Planned output is not the canonical location for ${JSON.stringify(icon.file)}.`,
      );
    }
    if (expected.has(icon.outputPath)) {
      throw new OutputError(icon.outputPath, "Duplicate generated output path.");
    }
    expected.add(icon.outputPath);
  }
  return expected;
}

/** Read-only preflight shared by the writer and the checker. */
function prepareOutput(repositoryRoot: string, plan: GenerationPlan): PreparedOutput {
  const expected = assertPlannedPaths(plan);
  const inventory = inspectOutput(repositoryRoot);
  const changed: { icon: GeneratedIcon; missing: boolean }[] = [];
  for (const icon of plan.files) {
    if (inventory.directories.has(icon.outputPath)) {
      throw new OutputError(icon.outputPath, "A directory occupies a planned component file.");
    }
    for (
      let parent = posix.dirname(icon.outputPath);
      parent !== generatedIconsDirectory;
      parent = posix.dirname(parent)
    ) {
      if (inventory.files.has(parent)) {
        throw new OutputError(parent, "A file occupies a planned output directory.");
      }
    }
    const missing = !inventory.files.has(icon.outputPath);
    if (
      missing ||
      !readFileSync(join(inventory.root, icon.outputPath)).equals(Buffer.from(icon.code, "utf8"))
    ) {
      changed.push({ icon, missing });
    }
  }
  const stale = [...inventory.files].filter((file) => !expected.has(file)).sort(compareText);
  return { inventory, changed, stale };
}

function outputDiagnostic(error: unknown, prefix: string): Diagnostic {
  const file = error instanceof OutputError ? error.file : generatedIconsDirectory;
  const message = error instanceof Error ? error.message : String(error);
  return diagnostic("QXI-GEN-002", file, `${prefix}: ${message}`);
}

/**
 * Compares the plan with what is on disk, byte for byte, without writing anything. Reports
 * missing, edited or out-of-date, and stale files. Independent of Git.
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
    ...prepared.changed.map(({ icon, missing }) =>
      diagnostic(
        "QXI-GEN-003",
        icon.outputPath,
        `Generated component is ${missing ? "missing" : "out of date"}; run bun run generate.`,
      ),
    ),
    ...prepared.stale.map((file) =>
      diagnostic("QXI-GEN-003", file, "Stale generated file; run bun run generate."),
    ),
  ]);
}

/**
 * Makes the generated-icons directory match the plan: writes changed components, deletes stale
 * files, and removes emptied subdirectories. Refuses an invalid plan, and runs the full read-only
 * preflight before the first write, so a rejected run changes nothing.
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
    for (const { icon } of changed) {
      const absolute = join(inventory.root, icon.outputPath);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, icon.code, "utf8");
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
      if (directory === generatedIconsDirectory) continue;
      const absolute = join(inventory.root, directory);
      if (readdirSync(absolute).length === 0) rmdirSync(absolute);
    }
  } catch (error) {
    return {
      ...result,
      diagnostics: [outputDiagnostic(error, "Writing generated output failed")],
    };
  }
  return { ...result, generatedCount: plan.files.length, diagnostics: [] };
}
