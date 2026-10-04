import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import type { LogoBackground } from "../../src/types/logo.js";
import {
  type LogoUpstream,
  logoBarrelPath,
  logoBarrelSource,
  logoManifestPath,
  logoManifestSource,
  logoModulePath,
  logoModuleSource,
  type PlannedLogo,
  type PlannedLogoVariant,
} from "./logo-module.js";
import { LogoSourceError, readSvgIntrinsicSize, svgDataUri } from "./logo-source.js";

/** The brand catalogue written by `sync:brands`, relative to the repository root. */
export const brandsConfigPath = "config/brands.json";
/** Every logo source lives under this directory. */
export const brandSourceDirectory = "icons/brand-icons";

export type LogoPlan = {
  readonly upstream: LogoUpstream;
  readonly logos: readonly PlannedLogo[];
  /** Repository-relative path to contents, every file the generator owns. */
  readonly files: ReadonlyMap<string, string>;
  readonly diagnostics: readonly string[];
  /** Sources that are embedded as published but will not display as expected. */
  readonly warnings: readonly string[];
};

const slugPattern = /^[a-z0-9]+(?:-+[a-z0-9]+)*$/;
const variantPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const componentPattern = /^[A-Z][A-Za-z0-9]*Logo$/;
const backgrounds: ReadonlySet<string> = new Set<LogoBackground>(["light", "dark", "any"]);

const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Resolves a variant's `file` to a repository-relative path under `icons/brand-icons/`. Paths may
 * be given relative to the repository or to that directory.
 */
export function resolveBrandSource(file: string): string | undefined {
  if (file.includes("\\") || file.startsWith("/")) return undefined;
  const path = posix.normalize(
    file.startsWith(`${brandSourceDirectory}/`) ? file : `${brandSourceDirectory}/${file}`,
  );
  return path.startsWith(`${brandSourceDirectory}/`) && path.endsWith(".svg") ? path : undefined;
}

/**
 * Validates `config/brands.json` and embeds every variant of every logo: the file's bytes as a
 * lossless data URI, and its intrinsic size, read without modifying it.
 */
export function planLogoGeneration(repositoryRoot: string): LogoPlan {
  const diagnostics: string[] = [];
  const warnings: string[] = [];
  const configFile = join(repositoryRoot, brandsConfigPath);
  if (!existsSync(configFile)) {
    return {
      upstream: { source: "", commit: "", packageVersion: "" },
      logos: [],
      files: new Map(),
      diagnostics: [`${brandsConfigPath}: missing. Run \`bun run sync:brands\` first.`],
      warnings,
    };
  }
  const config: unknown = JSON.parse(readFileSync(configFile, "utf8"));
  if (!isRecord(config) || !isRecord(config.logos)) {
    return {
      upstream: { source: "", commit: "", packageVersion: "" },
      logos: [],
      files: new Map(),
      diagnostics: [`${brandsConfigPath}: expected an object with a "logos" object.`],
      warnings,
    };
  }
  const str = (value: unknown) => (typeof value === "string" ? value : "");
  const upstream: LogoUpstream = {
    source: str(config.source),
    commit: str(config.commit),
    packageVersion: str(config.packageVersion),
  };
  if (!upstream.source || !upstream.commit) {
    diagnostics.push(`${brandsConfigPath}: "source" and "commit" are required.`);
  }

  const logos: PlannedLogo[] = [];
  const componentOwners = new Map<string, string>();
  for (const id of Object.keys(config.logos).sort(compareText)) {
    const entry = config.logos[id];
    const where = `${brandsConfigPath}: logos.${id}`;
    if (!slugPattern.test(id)) diagnostics.push(`${where}: invalid slug.`);
    if (!isRecord(entry) || !isRecord(entry.variants)) {
      diagnostics.push(`${where}: expected an object with "variants".`);
      continue;
    }
    const componentName = str(entry.componentName);
    if (!componentPattern.test(componentName)) {
      diagnostics.push(`${where}: invalid componentName ${JSON.stringify(entry.componentName)}.`);
    }
    const owner = componentOwners.get(componentName);
    if (owner)
      diagnostics.push(`${where}: componentName ${componentName} is also used by ${owner}.`);
    componentOwners.set(componentName, id);

    const defaultVariant = str(entry.defaultVariant);
    const names = Object.keys(entry.variants);
    if (!names.includes(defaultVariant)) {
      diagnostics.push(
        `${where}: defaultVariant ${JSON.stringify(entry.defaultVariant)} is not a variant.`,
      );
    }
    const ordered = [defaultVariant, ...names.filter((name) => name !== defaultVariant)].filter(
      (name) => names.includes(name),
    );
    const variants: PlannedLogoVariant[] = [];
    for (const name of ordered) {
      const variant = entry.variants[name];
      const at = `${where}.variants.${name}`;
      if (!variantPattern.test(name)) diagnostics.push(`${at}: invalid variant name.`);
      if (!isRecord(variant)) {
        diagnostics.push(`${at}: expected an object.`);
        continue;
      }
      const background = str(variant.background);
      if (!backgrounds.has(background)) {
        diagnostics.push(`${at}: invalid background ${JSON.stringify(variant.background)}.`);
      }
      const file = resolveBrandSource(str(variant.file));
      if (!file) {
        diagnostics.push(`${at}: invalid file ${JSON.stringify(variant.file)}.`);
        continue;
      }
      const absolute = join(repositoryRoot, file);
      let info: ReturnType<typeof lstatSync> | undefined;
      try {
        info = lstatSync(absolute);
      } catch {
        info = undefined;
      }
      if (!info?.isFile()) {
        diagnostics.push(`${file}: missing (${at}).`);
        continue;
      }
      try {
        const bytes = readFileSync(absolute);
        const size = readSvgIntrinsicSize(bytes);
        for (const problem of size.problems)
          warnings.push(`${file}: embedded as published, but ${problem}.`);
        variants.push({
          name,
          background: background as LogoBackground,
          file,
          src: svgDataUri(bytes),
          width: size.width,
          height: size.height,
        });
      } catch (error) {
        if (!(error instanceof LogoSourceError)) throw error;
        diagnostics.push(`${file}: ${error.message}`);
      }
    }
    if (variants.length !== names.length) continue;

    const strings = (value: unknown) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    const nullable = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);
    logos.push({
      id,
      componentName,
      title: str(entry.title) || id,
      collection: str(entry.collection),
      defaultVariant,
      variants,
      hex: nullable(entry.hex),
      categories: strings(entry.categories),
      aliases: strings(entry.aliases),
      license: str(entry.license) || str(entry.licenseRaw) || "Unknown",
      website: nullable(entry.website),
      guidelines: nullable(entry.guidelines),
      source: nullable(entry.source),
    });
  }

  const files = new Map<string, string>();
  if (diagnostics.length === 0) {
    for (const logo of logos) {
      files.set(logoModulePath(logo.id), logoModuleSource(logo, upstream));
    }
    files.set(logoBarrelPath, logoBarrelSource(logos, upstream));
    files.set(logoManifestPath, logoManifestSource(logos, upstream));
  }
  return { upstream, logos, files, diagnostics, warnings };
}
