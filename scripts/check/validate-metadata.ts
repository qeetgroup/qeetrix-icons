import type { IconMetadataOverride } from "../../config/icon-metadata.js";
import { compareText, type Diagnostic, diagnostic } from "../lib/diagnostics.js";

export const metadataFile = "config/icon-metadata.ts";

/**
 * No authored exceptions. The default for library functions, which validate whatever sources they
 * are given; only the repository CLIs pass this repository's `iconMetadata`.
 */
export const noMetadata: Readonly<Record<string, IconMetadataOverride>> = {};

const directionalities: readonly string[] = ["mirror", "preserve"];

/**
 * Authored metadata may only describe icons that exist, with supported values. An entry left
 * behind by a rename or removal is an error rather than silently applying to nothing.
 */
export function validateMetadata(
  metadata: Readonly<Record<string, IconMetadataOverride>>,
  names: ReadonlySet<string>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const name of Object.keys(metadata).sort(compareText)) {
    if (!names.has(name)) {
      diagnostics.push(
        diagnostic(
          "QXI-META-001",
          metadataFile,
          `Metadata for ${JSON.stringify(name)} has no matching source SVG.`,
        ),
      );
    }
    const { directionality } = metadata[name];
    if (!directionalities.includes(directionality)) {
      diagnostics.push(
        diagnostic(
          "QXI-META-002",
          metadataFile,
          `Directionality ${JSON.stringify(directionality)} for ${JSON.stringify(name)} must be "mirror" or "preserve".`,
        ),
      );
    }
  }
  return diagnostics;
}
