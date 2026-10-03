import { posix } from "node:path";
import { categories } from "../../config/categories.js";
import { iconSystem } from "../../config/icon-system.js";
import { type IconSource, scanIconSources, validateSources } from "../check/validate-repository.js";
import {
  componentNameFromFilename,
  type IconLocation,
  validateSourcePath,
} from "../check/validate-source-path.js";
import { renderComponentSource } from "./component-source.js";
import { compareText, type Diagnostic, diagnostic, sortDiagnostics } from "./diagnostics.js";
import { svgToReact } from "./svg-to-react.js";

/** The only directory generation owns. Nothing outside it is ever written or deleted. */
export const generatedIconsDirectory = "src/generated/icons";

/**
 * One planned component: the validated source identity (`file` is the source path), where its
 * module goes, and the module's exact contents. Internal tooling data, not a manifest.
 */
export type GeneratedIcon = IconLocation & {
  readonly outputPath: string;
  readonly componentName: string;
  readonly code: string;
};

export type GenerationPlan = {
  /** Production SVG files scanned, matching `check:icons`. */
  readonly iconCount: number;
  /** Empty whenever `diagnostics` is not: a plan is all-or-nothing. */
  readonly files: readonly GeneratedIcon[];
  readonly diagnostics: readonly Diagnostic[];
};

export function generatedOutputPath(location: IconLocation): string {
  return posix.join(
    generatedIconsDirectory,
    location.variant,
    location.category,
    `${location.name}.tsx`,
  );
}

function planIcon(source: IconSource): GeneratedIcon {
  const location = validateSourcePath(source.file).location;
  if (!location) throw new Error("Validated source has no resolved location.");
  const outputPath = generatedOutputPath(location);
  const componentName = componentNameFromFilename(posix.basename(source.file));
  const code = renderComponentSource({
    sourcePath: source.file,
    outputPath,
    componentName,
    svg: svgToReact(source.source),
  });
  return { ...location, outputPath, componentName, code };
}

/**
 * Validates every source with the Phase 2B validator, then converts them all in memory.
 *
 * Nothing is written here. Any scan, validation, or conversion error yields a plan with no files,
 * so a writer can never act on part of a library. Output order follows configured variant order,
 * then configured category order, then codepoint name order, never discovery order.
 */
export function createGenerationPlan(
  sources: readonly IconSource[],
  scanDiagnostics: readonly Diagnostic[] = [],
): GenerationPlan {
  const iconCount = sources.length;
  const validation = [...scanDiagnostics, ...validateSources(sources).diagnostics];
  if (validation.length > 0) {
    return { iconCount, files: [], diagnostics: sortDiagnostics(validation) };
  }

  const files: GeneratedIcon[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const source of sources) {
    try {
      files.push(planIcon(source));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      diagnostics.push(
        diagnostic("QXI-GEN-001", source.file, `Cannot generate component: ${message}`),
      );
    }
  }
  if (diagnostics.length > 0) {
    return { iconCount, files: [], diagnostics: sortDiagnostics(diagnostics) };
  }

  const { variants } = iconSystem.architecture;
  const categoryIds: readonly string[] = categories.map(({ id }) => id);
  files.sort(
    (left, right) =>
      variants.indexOf(left.variant) - variants.indexOf(right.variant) ||
      categoryIds.indexOf(left.category) - categoryIds.indexOf(right.category) ||
      compareText(left.name, right.name),
  );
  return { iconCount, files, diagnostics: [] };
}

export function planRepositoryGeneration(repositoryRoot: string): GenerationPlan {
  const scan = scanIconSources(repositoryRoot);
  return createGenerationPlan(scan.sources, scan.diagnostics);
}
