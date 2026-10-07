import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { encodeLogoIndex } from "./src/logo-catalogue.js";

/**
 * The internal icon and logo playground. Repository tooling only: it is never part of the
 * published package. JSX uses the automatic runtime configured in tsconfig, so no React plugin is
 * needed; edits reload the page rather than hot-swapping components.
 */

const repository = fileURLToPath(new URL("..", import.meta.url));
const files = {
  packageJson: `${repository}package.json`,
  lucide: `${repository}config/lucide.json`,
  brands: `${repository}config/brands.json`,
};

function readJson(path: string): unknown {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
  } catch {
    return undefined;
  }
}

const field = (value: unknown, key: string): string | null => {
  const entry =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : null;
  return typeof entry === "string" ? entry : null;
};

/**
 * Small build-time data modules, so the browser never bundles the large config files:
 *
 * - `virtual:qeetrix-meta`: version stamps (package, Lucide) and the logo count.
 * - `virtual:qeetrix-logos`: the compact logo index from `config/brands.json`, loaded lazily by
 *   the Logos page and the command palette. Empty when the file is absent.
 *
 * Both are rebuilt when their source files change.
 */
function playgroundData(): Plugin {
  const modules = { meta: "virtual:qeetrix-meta", logos: "virtual:qeetrix-logos" };
  const resolved = (id: string) => `\0${id}`;
  return {
    name: "qeetrix-playground-data",
    resolveId(id) {
      return Object.values(modules).includes(id) ? resolved(id) : undefined;
    },
    load(id) {
      if (id === resolved(modules.meta)) {
        for (const path of Object.values(files)) if (existsSync(path)) this.addWatchFile(path);
        const brands = readJson(files.brands);
        const meta = {
          packageVersion: field(readJson(files.packageJson), "version"),
          lucideVersion: field(readJson(files.lucide), "version"),
          logos: brands
            ? {
                count: Object.keys((brands as { logos?: Record<string, unknown> }).logos ?? {})
                  .length,
              }
            : null,
        };
        return `export default ${JSON.stringify(meta)};`;
      }
      if (id === resolved(modules.logos)) {
        if (existsSync(files.brands)) this.addWatchFile(files.brands);
        const index = encodeLogoIndex(readJson(files.brands));
        // JSON.parse of a string literal parses faster than the equivalent object literal.
        return `export default JSON.parse(${JSON.stringify(JSON.stringify(index))});`;
      }
      return undefined;
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [playgroundData()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Thousands of lazy logo chunks: preload wrappers would add bytes to every loader for nothing.
    modulePreload: false,
    // One small chunk per logo component, loaded per visible card; the icon chunk is the catalogue.
    chunkSizeWarningLimit: 6000,
  },
  // Read-only access to the generated icons, manifest, runtime, and config one level up.
  server: { fs: { allow: [repository] } },
});
