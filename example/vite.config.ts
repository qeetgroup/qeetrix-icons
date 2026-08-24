import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Points `@qeetrix/icons` at `../src`, not at `dist/` or the published package.
 *
 * That is deliberate: this example exists to check the icons you are about to
 * commit, so it must render the working tree. `bun run generate` then a browser
 * refresh is the whole feedback loop.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@qeetrix/icons": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
    },
  },
  server: {
    // The icon sources and generated components live above this directory, and
    // App.tsx reaches them with import.meta.glob.
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
  },
  build: {
    // This app imports all 1166 icons on purpose, so one large chunk is the
    // expected shape rather than something to fix. Consumers tree-shake.
    chunkSizeWarningLimit: 6000,
  },
});
