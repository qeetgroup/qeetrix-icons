import { fileURLToPath } from "node:url";
import { iconMetadata } from "../../config/icon-metadata.js";
import { formatDiagnostics } from "../lib/diagnostics.js";
import { writeGenerationPlan } from "../lib/generated-output.js";
import { planRepositoryGeneration } from "../lib/generation-plan.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

try {
  const plan = planRepositoryGeneration(repositoryRoot, iconMetadata);
  if (plan.diagnostics.length > 0) {
    const reason = plan.diagnostics.some(({ code }) => code === "QXI-GEN-001")
      ? "components could not be generated"
      : "icon validation failed";
    console.error(formatDiagnostics(plan.diagnostics));
    console.error(
      `Generation aborted: ${reason} with ${plan.diagnostics.length} error(s). No generated files were changed.`,
    );
    process.exitCode = 1;
  } else {
    const result = writeGenerationPlan(repositoryRoot, plan);
    if (result.diagnostics.length > 0) {
      console.error(formatDiagnostics(result.diagnostics));
      console.error(
        `Generation aborted after writing ${result.changedCount} and removing ${result.removedCount} file(s).`,
      );
      process.exitCode = 1;
    } else {
      console.log(`Validated ${plan.iconCount} production icons.`);
      console.log(
        `Generated ${result.generatedCount} React icon components, the root exports, and the manifest (${result.changedCount} files written, ${result.removedCount} stale removed).`,
      );
    }
  }
} catch (error) {
  console.error(
    `Generation failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
