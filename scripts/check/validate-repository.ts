import { type Dirent, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import type { IconMetadata } from "../../config/icon-metadata.js";
import { iconSystem } from "../../config/icon-system.js";
import { compareText, type Diagnostic, diagnostic, sortDiagnostics } from "../lib/diagnostics.js";
import { noMetadata, validateMetadata } from "./validate-metadata.js";
import {
  type IconLocation,
  iconExportName,
  sourceFolder,
  validateSourcePath,
} from "./validate-source-path.js";
import { maxSvgBytes, validateSvg } from "./validate-svg.js";

export type IconSource = {
  readonly file: string;
  readonly source: string;
};

export type ValidationResult = {
  readonly iconCount: number;
  readonly diagnostics: readonly Diagnostic[];
};

export type SourceScan = ValidationResult & {
  readonly sources: readonly IconSource[];
};

export function validateSources(
  sources: readonly IconSource[],
  metadata: Readonly<Record<string, IconMetadata>> = noMetadata,
): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  const variantNames = new Map<string, IconLocation>();
  const canonicalNames = new Map<string, IconLocation>();
  const foldedNames = new Map<string, IconLocation>();
  const exportNames = new Map<string, IconLocation>();

  for (const { file, source } of [...sources].sort((left, right) =>
    compareText(left.file, right.file),
  )) {
    const result = validateSourcePath(file);
    diagnostics.push(...result.diagnostics);
    const location = result.location;
    if (!location) continue;
    for (const entry of validateSvg(source, file, location.variant, location.style)) {
      diagnostics.push(entry);
    }

    const variantKey = `${location.style}/${location.variant}/${location.name}`;
    const previousVariant = variantNames.get(variantKey);
    if (previousVariant) {
      diagnostics.push(
        diagnostic(
          "QXI-DUP-001",
          file,
          `Canonical name ${JSON.stringify(location.name)} already exists in ${JSON.stringify(previousVariant.file)} for this style and variant.`,
        ),
      );
    } else {
      variantNames.set(variantKey, location);
    }

    const previousName = canonicalNames.get(location.name);
    if (
      previousName &&
      (previousName.variant !== location.variant || previousName.style !== location.style) &&
      previousName.category !== location.category
    ) {
      diagnostics.push(
        diagnostic(
          "QXI-DUP-004",
          file,
          `Every drawing of a name must share category ${JSON.stringify(previousName.category)} from ${JSON.stringify(previousName.file)}.`,
        ),
      );
    } else if (!previousName) {
      canonicalNames.set(location.name, location);
    }

    const foldedName = location.name.toLowerCase();
    const previousCase = foldedNames.get(foldedName);
    if (previousCase && posix.basename(previousCase.file) !== posix.basename(file)) {
      diagnostics.push(
        diagnostic(
          "QXI-DUP-002",
          file,
          `Case-insensitive filename collision with ${JSON.stringify(previousCase.file)}.`,
        ),
      );
    } else if (!previousCase) {
      foldedNames.set(foldedName, location);
    }

    // Variants of one name share its export; only distinct names can collide.
    const exportName = iconExportName(location.name);
    const previousExport = exportNames.get(exportName);
    if (previousExport && previousExport.name !== location.name) {
      diagnostics.push(
        diagnostic(
          "QXI-DUP-003",
          file,
          `Normalized export ${JSON.stringify(exportName)} collides with ${JSON.stringify(previousExport.file)}.`,
        ),
      );
    } else if (!previousExport) {
      exportNames.set(exportName, location);
    }
  }
  // Outline-first: in each style, every concept needs its default-variant drawing; other variants
  // are optional.
  const { defaultVariant } = iconSystem.architecture;
  for (const location of variantNames.values()) {
    if (
      location.variant !== defaultVariant &&
      !variantNames.has(`${location.style}/${defaultVariant}/${location.name}`)
    ) {
      const outline = `icons/${sourceFolder(location.style, defaultVariant)}/${location.category}/${location.name}.svg`;
      diagnostics.push(
        diagnostic(
          "QXI-VAR-001",
          location.file,
          `A ${location.variant} drawing needs the ${defaultVariant} drawing ${outline}.`,
        ),
      );
    }
  }
  diagnostics.push(...validateMetadata(metadata, canonicalNames));
  return { iconCount: sources.length, diagnostics: sortDiagnostics(diagnostics) };
}

export function scanIconSources(repositoryRoot: string): SourceScan {
  const sourceRoot = join(repositoryRoot, "icons");
  const sources: IconSource[] = [];
  const diagnostics: Diagnostic[] = [];
  let iconCount = 0;

  try {
    const sourceInfo = lstatSync(sourceRoot);
    if (!sourceInfo.isDirectory() || sourceInfo.isSymbolicLink()) {
      return {
        iconCount,
        sources,
        diagnostics: [
          diagnostic(
            "QXI-IO-001",
            "icons",
            "The production source root must be a real directory, not a symbolic link.",
          ),
        ],
      };
    }
  } catch {
    return {
      iconCount,
      sources,
      diagnostics: [
        diagnostic("QXI-IO-001", "icons", "Cannot read the production source directory."),
      ],
    };
  }

  const pending = [{ absolute: sourceRoot, relative: "icons" }];
  while (pending.length > 0) {
    const directory = pending.pop();
    if (!directory) break;
    let entries: Dirent[];
    try {
      entries = readdirSync(directory.absolute, { encoding: "utf8", withFileTypes: true });
    } catch {
      diagnostics.push(
        diagnostic("QXI-IO-001", directory.relative, "Cannot read this source directory."),
      );
      continue;
    }

    for (const entry of entries.sort((left, right) => compareText(left.name, right.name))) {
      const file = `${directory.relative}/${entry.name}`;
      const absolute = join(directory.absolute, entry.name);
      if (entry.isSymbolicLink()) {
        diagnostics.push(
          diagnostic("QXI-IO-001", file, "Symbolic links are not allowed in production sources."),
        );
      } else if (entry.isDirectory()) {
        pending.push({ absolute, relative: file });
      } else if (entry.isFile() && file === "icons/.gitkeep") {
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".svg")) {
        iconCount += 1;
        try {
          if (lstatSync(absolute).size > maxSvgBytes) {
            diagnostics.push(
              diagnostic(
                "QXI-XML-001",
                file,
                `SVG source exceeds the ${maxSvgBytes}-byte parsing limit.`,
              ),
            );
            continue;
          }
          const source = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(absolute));
          sources.push({ file, source });
        } catch {
          diagnostics.push(
            diagnostic("QXI-IO-001", file, "Cannot read a valid UTF-8 SVG source file."),
          );
        }
      } else {
        diagnostics.push(
          diagnostic(
            "QXI-IO-001",
            file,
            "Only SVG files and the root .gitkeep placeholder belong in production sources.",
          ),
        );
      }
    }
  }
  return {
    iconCount,
    sources: sources.sort((left, right) => compareText(left.file, right.file)),
    diagnostics: sortDiagnostics(diagnostics),
  };
}

export function validateRepository(
  repositoryRoot: string,
  metadata: Readonly<Record<string, IconMetadata>> = noMetadata,
): ValidationResult {
  const scan = scanIconSources(repositoryRoot);
  return {
    iconCount: scan.iconCount,
    diagnostics: sortDiagnostics([
      ...scan.diagnostics,
      ...validateSources(scan.sources, metadata).diagnostics,
    ]),
  };
}
