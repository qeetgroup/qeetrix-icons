import { categories } from "../../config/categories.js";
import { type IconStyle, iconSystem } from "../../config/icon-system.js";
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
  readonly style: IconStyle;
  readonly variant: IconVariant;
};

/** The source folder of a style and variant: `round-outline`, `sharp-filled`, … */
export function sourceFolder(style: IconStyle, variant: IconVariant): string {
  return `${style}-${variant}`;
}

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

  // Names are Lucide's, verbatim: `trash`, `clock-12`, `book-copy`, and `type-outline` are all
  // real Lucide icons, so there are no suffix rules beyond the filename shape.
  const name = filename.slice(0, -4);
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(name)) {
    return [diagnostic("QXI-NAME-001", file, "This filename is reserved on Windows.")];
  }
  return [];
}

/**
 * The canonical public component name for a source filename. Variant never affects it:
 * `round-outline/…/star.svg` and `sharp-filled/…/star.svg` are both `StarIcon`. Generation, exports,
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
          "Use icons/<style>-<variant>/<category>/<name>.svg with repository-relative forward slashes.",
        ),
      ],
    };
  }

  const [, folder, categoryName, filename] = parts;
  const diagnostics = validateIconName(filename, file);
  const { styles, variants } = iconSystem.architecture;
  const pair = styles
    .flatMap((style) => variants.map((variant) => ({ style, variant })))
    .find(({ style, variant }) => sourceFolder(style, variant) === folder);
  const category = categories.find((candidate) => candidate.id === categoryName);
  if (!pair) {
    const folders = styles.flatMap((style) => variants.map((v) => sourceFolder(style, v)));
    diagnostics.push(
      diagnostic(
        "QXI-PATH-003",
        file,
        `Unknown source folder ${JSON.stringify(folder)}; use ${folders.join(", ")}.`,
      ),
    );
  }
  if (!category) {
    diagnostics.push(
      diagnostic("QXI-PATH-002", file, `Unknown category ${JSON.stringify(categoryName)}.`),
    );
  }
  return {
    location:
      pair && category && /\.svg$/i.test(filename)
        ? { file, name: filename.slice(0, -4), ...pair, category: category.id }
        : undefined,
    diagnostics: sortDiagnostics(diagnostics),
  };
}
