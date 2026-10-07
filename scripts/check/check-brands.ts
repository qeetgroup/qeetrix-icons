import { fileURLToPath } from "node:url";
import { formatBrandDiagnostics, validateBrandsRepository } from "./validate-brands.js";

/** `bun run check:brands`: validates config/brands.json and every file in icons/brand-icons/. */

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const result = validateBrandsRepository(repositoryRoot);
const errors = result.diagnostics.filter((entry) => entry.severity === "error");
const warnings = result.diagnostics.filter((entry) => entry.severity === "warning");

if (warnings.length > 0) {
  console.warn(formatBrandDiagnostics(warnings));
  console.warn(`${warnings.length} warning(s); logo files stay byte-for-byte, so these are notes.`);
}
if (errors.length > 0) {
  console.error(formatBrandDiagnostics(errors));
  console.error(
    `Brand validation failed: ${errors.length} error(s) across ${result.fileCount} file(s) of ${result.logoCount} logo(s).`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `${result.fileCount} brand logo files (${result.bytes} bytes) across ${result.logoCount} logos validated.`,
  );
}
