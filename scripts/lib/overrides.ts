import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Hand-drawn replacements for derived drawings, used where derivation cannot produce a clean
 * result. `config/overrides/<folder>/<category>/<name>.svg` replaces the derived
 * `icons/<folder>/<category>/<name>.svg` byte for byte. Each override names the Lucide outline it
 * was drawn against and that outline's SHA-256, so a Lucide upgrade that changes the outline makes
 * the override stale (an error) until someone reviews it and re-stamps it with
 * `bun run stamp:override`.
 */
export const overrideRoot = "config/overrides";
export const overrideFolders = ["round-filled", "sharp-outline", "sharp-filled"] as const;
export type OverrideFolder = (typeof overrideFolders)[number];

export function overridePath(folder: OverrideFolder, category: string, name: string): string {
  return `${overrideRoot}/${folder}/${category}/${name}.svg`;
}

/** The outline every override of `name` is drawn against. */
export function outlinePath(category: string, name: string): string {
  return `icons/round-outline/${category}/${name}.svg`;
}

export function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const headerPattern =
  /^<!-- Override: hand-drawn replacement for the derived drawing, drawn against (\S+) \(sha256 ([0-9a-f]{64})\)\. Edit this file, not icons\/\. -->\n/;

export function overrideHeader(outline: string, hash: string): string {
  return `<!-- Override: hand-drawn replacement for the derived drawing, drawn against ${outline} (sha256 ${hash}). Edit this file, not icons/. -->\n`;
}

/** Replaces (or adds) the header with the outline's current hash. */
export function stampOverride(source: string, outline: string, hash: string): string {
  // Drop an old override header and the "Derived from …" comment of a copied derived drawing.
  const body = source.replace(headerPattern, "").replace(/^<!-- Derived from [^]*?-->\n/, "");
  return overrideHeader(outline, hash) + body;
}

/**
 * The override for one drawing, if any. Throws a reviewable message when the override's header
 * is missing or names an outline that has since changed.
 */
export function readOverride(
  repositoryRoot: string,
  folder: OverrideFolder,
  category: string,
  name: string,
): string | undefined {
  const path = overridePath(folder, category, name);
  const absolute = join(repositoryRoot, path);
  if (!existsSync(absolute)) return undefined;
  const source = readFileSync(absolute, "utf8");
  const header = source.match(headerPattern);
  const outline = outlinePath(category, name);
  if (!header || header[1] !== outline) {
    throw new Error(
      `${path}: missing or wrong override header. Run \`bun run stamp:override ${path}\`.`,
    );
  }
  const current = sha256(readFileSync(join(repositoryRoot, outline)));
  if (header[2] !== current) {
    throw new Error(
      `${path}: drawn against an older ${outline}. Review it against the current outline, then run \`bun run stamp:override ${path}\`.`,
    );
  }
  return source;
}

/** Every override file, repository-relative, for detecting overrides that replace nothing. */
export function listOverrides(repositoryRoot: string, folder: OverrideFolder): string[] {
  const root = join(repositoryRoot, overrideRoot, folder);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((category) =>
    category.isDirectory()
      ? readdirSync(join(root, category.name))
          .filter((file) => file.endsWith(".svg"))
          .map((file) => `${overrideRoot}/${folder}/${category.name}/${file}`)
      : [],
  );
}

/** `--category <id>` on the derive commands: limits reading, writing, and stale removal to it. */
export function categoryArgument(argv: readonly string[]): string | undefined {
  const index = argv.indexOf("--category");
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error("--category needs a category id.");
  return value;
}
