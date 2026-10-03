import { categories } from "../../config/categories.js";
import { iconSystem } from "../../config/icon-system.js";
import type { IconVariant } from "../../src/types/icon.js";
import {
  type Diagnostic,
  diagnostic,
  formatDiagnostics,
  sortDiagnostics,
} from "../lib/diagnostics.js";

export type IconLocation = {
  readonly file: string;
  readonly name: string;
  readonly category: (typeof categories)[number]["id"];
  readonly variant: IconVariant;
};

/** PascalCase plus `Icon`: `user-plus` → `UserPlusIcon`. The only PascalCase conversion. */
export function iconExportName(name: string): string {
  return `${name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}Icon`;
}

export function validateIconName(filename: string, file = filename): Diagnostic[] {
  if (filename.trim() !== filename || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.svg$/.test(filename)) {
    return [
      diagnostic(
        "QXI-NAME-001",
        file,
        "Use a lowercase ASCII kebab-case .svg filename beginning with a letter.",
      ),
    ];
  }

  const name = filename.slice(0, -4);
  if (/(?:-icon|-alt|-new|-copy|-final|-\d+)$/.test(name)) {
    return [
      diagnostic(
        "QXI-NAME-001",
        file,
        "Do not use an Icon suffix, draft modifier, or trailing numeric duplicate suffix.",
      ),
    ];
  }
  if (iconSystem.architecture.variants.some((variant) => name.endsWith(`-${variant}`))) {
    return [
      diagnostic(
        "QXI-NAME-001",
        file,
        "Variant suffixes are reserved; put filled artwork in icons/filled/ under the same name.",
      ),
    ];
  }
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(name)) {
    return [diagnostic("QXI-NAME-001", file, "This filename is reserved on Windows.")];
  }
  return [];
}

/**
 * The canonical public component name for a source filename. Variant never affects it:
 * `outline/…/star.svg` and `filled/…/star.svg` are both the one `StarIcon`. Generation, exports,
 * and the manifest all use this. Throws on an invalid filename rather than producing a broken
 * identifier.
 */
export function componentNameFromFilename(filename: string): string {
  const diagnostics = validateIconName(filename);
  if (diagnostics.length > 0) throw new Error(formatDiagnostics(diagnostics));
  return iconExportName(filename.slice(0, -4));
}

export function validateSourcePath(file: string): {
  location?: IconLocation;
  diagnostics: Diagnostic[];
} {
  const parts = file.split("/");
  if (
    parts.length !== 4 ||
    parts[0] !== "icons" ||
    parts.some((part) => !part || part === "." || part === ".." || part.includes("\\"))
  ) {
    return {
      diagnostics: [
        diagnostic(
          "QXI-PATH-001",
          file,
          "Use icons/<variant>/<category>/<name>.svg with repository-relative forward slashes.",
        ),
      ],
    };
  }

  const [, variantName, categoryName, filename] = parts;
  const diagnostics = validateIconName(filename, file);
  const variant = iconSystem.architecture.variants.find((candidate) => candidate === variantName);
  const category = categories.find((candidate) => candidate.id === categoryName);
  if (!variant) {
    diagnostics.push(
      diagnostic("QXI-PATH-003", file, `Unknown variant ${JSON.stringify(variantName)}.`),
    );
  }
  if (!category) {
    diagnostics.push(
      diagnostic("QXI-PATH-002", file, `Unknown category ${JSON.stringify(categoryName)}.`),
    );
  }
  return {
    location:
      variant && category && /\.svg$/i.test(filename)
        ? { file, name: filename.slice(0, -4), variant, category: category.id }
        : undefined,
    diagnostics: sortDiagnostics(diagnostics),
  };
}
