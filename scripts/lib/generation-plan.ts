import { posix } from "node:path";
import { categories } from "../../config/categories.js";
import type { IconMetadata } from "../../config/icon-metadata.js";
import { type IconStyle, iconSystem } from "../../config/icon-system.js";
import type { IconDirectionality } from "../../src/types/icon.js";
import type { IconManifest } from "../../src/types/icon-manifest.js";
import { noMetadata } from "../check/validate-metadata.js";
import { type IconSource, scanIconSources, validateSources } from "../check/validate-repository.js";
import {
  componentNameFromFilename,
  type IconLocation,
  validateSourcePath,
} from "../check/validate-source-path.js";
import { renderComponentSource } from "./component-source.js";
import { compareText, type Diagnostic, diagnostic, sortDiagnostics } from "./diagnostics.js";
import { renderBarrel, renderManifestJson, renderManifestModule } from "./package-sources.js";
import { svgToReact } from "./svg-to-react.js";

/** Owned entirely by generation: every file inside is generated, and anything else is stale. */
export const generatedDirectory = "src/generated";
export const generatedIconsDirectory = "src/generated/icons";
export const barrelPath = "src/generated/icon-index.ts";
export const manifestModulePath = "src/generated/icon-manifest.ts";
/** The one generated file outside `src/generated/`. */
export const manifestJsonPath = "icon-manifest.json";

/**
 * Paths inside `src/generated/` that belong to the logo generator (`bun run generate:logos`):
 * icon generation never reads, writes, or removes them, and the logo generator owns nothing else.
 */
export const logoGeneratedPaths: readonly string[] = [
  "src/generated/logos",
  "src/generated/logo-index.ts",
  "src/generated/logo-manifest.ts",
];

/** Fixed-path artifacts; every other generated file is a concept's component at its canonical path. */
export const packageArtifactPaths: readonly string[] = [
  barrelPath,
  manifestJsonPath,
  manifestModulePath,
];

/**
 * One semantic icon concept: every drawing of one name, in every shape (source style) and variant,
 * generated as one component. Internal tooling data that drives the component, the barrel, and the
 * manifest, which is its public projection.
 */
export type PlannedConcept = {
  /** Public id: the direct-import subpath and file name. Equal to `name`. */
  readonly id: string;
  readonly name: string;
  readonly componentName: string;
  readonly category: IconLocation["category"];
  /** Every category, primary first: the metadata's list, or just the source folder. */
  readonly categories: readonly string[];
  readonly directionality: IconDirectionality;
  readonly tags: readonly string[];
  readonly aliases: readonly string[];
  /**
   * One validated source per drawing: grouped by style, the default style first, then configured
   * order; within a style, in configured variant order. The default drawing comes first.
   */
  readonly sources: readonly IconLocation[];
  readonly outputPath: string;
};

export type GeneratedFile = {
  readonly path: string;
  readonly contents: string;
};

export type GenerationPlan = {
  /** Production SVG files scanned, matching `check:icons`. Drawings, not concepts. */
  readonly iconCount: number;
  /** In manifest order. */
  readonly concepts: readonly PlannedConcept[];
  readonly manifest: IconManifest;
  /** Every generated file, in path order. Empty whenever `diagnostics` is not. */
  readonly files: readonly GeneratedFile[];
  readonly diagnostics: readonly Diagnostic[];
};

/** One flat, category-free module per concept, so `./icons/*` can target it directly. */
export function generatedOutputPath(name: string): string {
  return `${generatedIconsDirectory}/${name}.tsx`;
}

function failedPlan(iconCount: number, diagnostics: readonly Diagnostic[]): GenerationPlan {
  return {
    iconCount,
    concepts: [],
    manifest: { schemaVersion: 1, icons: [] },
    files: [],
    diagnostics: sortDiagnostics(diagnostics),
  };
}

const { variants, defaultDirectionality, defaultStyle, styles } = iconSystem.architecture;
const categoryIds: readonly string[] = categories.map(({ id }) => id);
/** Style order within a concept: the default style first, then configured order. */
const styleRank = (style: IconStyle) => (style === defaultStyle ? -1 : styles.indexOf(style));

/**
 * Validates every source and the authored metadata with the source validator, groups the
 * drawings into concepts, then builds every generated artifact in memory from those concepts:
 * one component per concept, the root barrel, and the manifest as a typed module and as JSON.
 *
 * A source style is a public `shape`: each component renders every shape of its concept, the
 * default style's drawings when no `shape` is given. Validation guarantees each concept has, in
 * each style, exactly one default-variant drawing, at most one of each other variant, and one
 * category, and that styles mirror the default style. Nothing is written here. Any scan,
 * validation, or conversion error yields a plan with no files, so a writer can never act on part
 * of a library.
 */
export function createGenerationPlan(
  sources: readonly IconSource[],
  scanDiagnostics: readonly Diagnostic[] = [],
  metadata: Readonly<Record<string, IconMetadata>> = noMetadata,
): GenerationPlan {
  const iconCount = sources.length;
  const validation = [...scanDiagnostics, ...validateSources(sources, metadata).diagnostics];
  if (validation.length > 0) return failedPlan(iconCount, validation);

  const drawings = new Map<string, { location: IconLocation; source: string }[]>();
  for (const { file, source } of sources) {
    const location = validateSourcePath(file).location;
    if (!location) {
      const message = "Cannot generate component: validated source has no resolved location.";
      return failedPlan(iconCount, [diagnostic("QXI-GEN-001", file, message)]);
    }
    drawings.set(location.name, [...(drawings.get(location.name) ?? []), { location, source }]);
  }

  const concepts: PlannedConcept[] = [];
  const components: GeneratedFile[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const [name, group] of drawings) {
    group.sort(
      (left, right) =>
        styleRank(left.location.style) - styleRank(right.location.style) ||
        variants.indexOf(left.location.variant) - variants.indexOf(right.location.variant),
    );
    const [primary] = group;
    const shapes = [...new Set(group.map(({ location }) => location.style))];
    // Own keys only, so a name such as `constructor` never reads Object.prototype.
    const entry = Object.hasOwn(metadata, name) ? metadata[name] : {};
    try {
      const concept: PlannedConcept = {
        id: name,
        name,
        componentName: componentNameFromFilename(posix.basename(primary.location.file)),
        category: primary.location.category,
        categories: entry.categories ?? [primary.location.category],
        directionality: entry.directionality ?? defaultDirectionality,
        tags: entry.tags ?? [],
        aliases: entry.aliases ?? [],
        sources: group.map(({ location }) => location),
        outputPath: generatedOutputPath(name),
      };
      components.push({
        path: concept.outputPath,
        contents: renderComponentSource({
          outputPath: concept.outputPath,
          componentName: concept.componentName,
          shapes: shapes.map((shape) => ({
            shape,
            variants: group
              .filter(({ location }) => location.style === shape)
              .map(({ location, source }) => ({
                variant: location.variant,
                sourcePath: location.file,
                svg: svgToReact(source),
              })),
          })),
        }),
      });
      concepts.push(concept);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const { location } of group) {
        diagnostics.push(
          diagnostic("QXI-GEN-001", location.file, `Cannot generate component: ${message}`),
        );
      }
    }
  }
  if (diagnostics.length > 0) return failedPlan(iconCount, diagnostics);

  concepts.sort(
    (left, right) =>
      categoryIds.indexOf(left.category) - categoryIds.indexOf(right.category) ||
      compareText(left.name, right.name),
  );
  const manifest: IconManifest = {
    schemaVersion: 1,
    icons: concepts.map(
      ({
        id,
        name,
        componentName,
        category,
        categories,
        sources,
        directionality,
        tags,
        aliases,
      }) => ({
        id,
        name,
        componentName,
        category,
        categories,
        // Styles mirror one another, so the default style's variants are every style's.
        variants: sources
          .filter(({ style }) => style === defaultStyle)
          .map(({ variant }) => variant),
        shapes: [...new Set(sources.map(({ style }) => style))],
        directionality,
        tags,
        aliases,
      }),
    ),
  };
  const barrel = [...concepts].sort((left, right) => compareText(left.id, right.id));
  const files: GeneratedFile[] = [
    ...components,
    { path: barrelPath, contents: renderBarrel(barrel) },
    { path: manifestModulePath, contents: renderManifestModule(manifest) },
    { path: manifestJsonPath, contents: renderManifestJson(manifest) },
  ].sort((left, right) => compareText(left.path, right.path));
  return { iconCount, concepts, manifest, files, diagnostics: [] };
}

export function planRepositoryGeneration(
  repositoryRoot: string,
  metadata?: Readonly<Record<string, IconMetadata>>,
): GenerationPlan {
  const scan = scanIconSources(repositoryRoot);
  return createGenerationPlan(scan.sources, scan.diagnostics, metadata);
}
