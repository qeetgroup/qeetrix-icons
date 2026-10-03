import { fileURLToPath } from "node:url";
import { formatDiagnostics } from "../lib/diagnostics.js";
import { checkGenerationPlan } from "../lib/generated-output.js";
import { planRepositoryGeneration } from "../lib/generation-plan.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

try {
  const plan = planRepositoryGeneration(repositoryRoot);
  const diagnostics = checkGenerationPlan(repositoryRoot, plan);
  if (diagnostics.length > 0) {
    console.error(formatDiagnostics(diagnostics));
    console.error(
      plan.diagnostics.length > 0
        ? `Generated-output check aborted: ${diagnostics.length} source error(s).`
        : `Generated output does not match source: ${diagnostics.length} problem(s). Run bun run generate.`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Generated output is up to date: ${plan.concepts.length} React icon components, the root exports, and the manifest from ${plan.iconCount} production icons.`,
    );
  }
} catch (error) {
  console.error(
    `Generated-output check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
