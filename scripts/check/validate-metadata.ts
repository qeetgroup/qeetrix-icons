import { categories } from "../../config/categories.js";
import type { IconMetadata } from "../../config/icon-metadata.js";
import { compareText, type Diagnostic, diagnostic } from "../lib/diagnostics.js";
import type { IconLocation } from "./validate-source-path.js";

export const metadataFile = "config/icon-metadata.ts";

/**
 * No metadata. The default for library functions, which validate whatever sources they are given;
 * only the repository CLIs pass this repository's `iconMetadata`.
 */
export const noMetadata: Readonly<Record<string, IconMetadata>> = {};

const directionalities: readonly string[] = ["mirror", "preserve"];
const categoryIds: ReadonlySet<string> = new Set(categories.map(({ id }) => id));

/**
 * Metadata may only describe icons that exist, with supported values. An entry left behind by a
 * rename or removal is an error rather than silently applying to nothing, and an icon listed under
 * categories must live in the folder of the first one.
 */
export function validateMetadata(
  metadata: Readonly<Record<string, IconMetadata>>,
  locations: ReadonlyMap<string, IconLocation>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const name of Object.keys(metadata).sort(compareText)) {
    const location = locations.get(name);
    if (!location) {
      diagnostics.push(
        diagnostic(
          "QXI-META-001",
          metadataFile,
          `Metadata for ${JSON.stringify(name)} has no matching source SVG.`,
        ),
      );
    }
    const { directionality, categories: listed } = metadata[name];
    if (directionality !== undefined && !directionalities.includes(directionality)) {
      diagnostics.push(
        diagnostic(
          "QXI-META-002",
          metadataFile,
          `Directionality ${JSON.stringify(directionality)} for ${JSON.stringify(name)} must be "mirror" or "preserve".`,
        ),
      );
    }
    if (listed === undefined) continue;
    const unknown = listed.filter((category) => !categoryIds.has(category));
    if (listed.length === 0 || unknown.length > 0) {
      diagnostics.push(
        diagnostic(
          "QXI-META-003",
          metadataFile,
          `Categories for ${JSON.stringify(name)} must be configured category ids; got ${JSON.stringify(listed)}.`,
        ),
      );
    } else if (location && listed[0] !== location.category) {
      diagnostics.push(
        diagnostic(
          "QXI-META-003",
          location.file,
          `First category ${JSON.stringify(listed[0])} for ${JSON.stringify(name)} must be its source folder.`,
        ),
      );
    }
  }
  return diagnostics;
}
