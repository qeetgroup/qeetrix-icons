import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * The internal icon playground. Repository tooling only: it is never part of the published
 * package. JSX uses the automatic runtime configured in tsconfig, so no React plugin is needed;
 * edits reload the page rather than hot-swapping components.
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
  // Read-only access to the generated icons, manifest, runtime, and config one level up.
  server: { fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] } },
});
