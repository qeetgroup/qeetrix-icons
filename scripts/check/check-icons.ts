import { fileURLToPath } from "node:url";
import { formatDiagnostics } from "../lib/diagnostics.js";
import { validateRepository } from "./validate-repository.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const result = validateRepository(repositoryRoot);

if (result.diagnostics.length > 0) {
  console.error(formatDiagnostics(result.diagnostics));
  console.error(
    `Icon validation failed: ${result.diagnostics.length} error(s) across ${result.iconCount} production SVG file(s).`,
  );
  process.exitCode = 1;
} else {
  console.log(`${result.iconCount} production icons validated.`);
}
