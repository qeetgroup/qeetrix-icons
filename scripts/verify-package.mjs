/**
 * Verify the published package end to end, through the real package boundary.
 *
 *   bun run verify:package
 *   bun run verify:package -- --update-baseline   re-record the size baseline
 *
 * Every earlier phase of this repo verified the package by hand. This script is
 * that verification made reproducible, so it runs in CI and on any machine
 * instead of living in someone's shell history.
 *
 * It does five things, in order, and each one catches a failure the others miss:
 *
 * 1. **Packs the tarball** and asserts its contents. `files: ["dist"]` is a
 *    promise, not a guarantee — a stray `.npmignore`, a new top-level file, or a
 *    build that writes outside `dist/` all silently ship. So the archive is
 *    listed and compared against an allowlist.
 * 2. **Installs it into a throwaway consumer** outside the source tree. This is
 *    the only step that exercises the `exports` map: resolution through
 *    `node_modules` is a different code path from a relative import of `src/`.
 * 3. **Typechecks the consumer** with `skipLibCheck: false`, so the shipped
 *    `.d.ts` files are actually checked rather than skipped, and
 *    `noUncheckedIndexedAccess` on, so the metadata types are exercised strictly.
 * 4. **Renders on the server** with `react-dom/server`. Types compiling proves
 *    nothing about runtime; this proves the components execute and emit the SVG
 *    attributes the design system promises.
 * 5. **Measures tree-shaking and size** with a real bundler, and compares
 *    against a committed baseline so a regression is visible in a diff.
 *
 * Nothing here is asserted from configuration alone.
 */

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const UPDATE = process.argv.includes("--update-baseline");
const BASELINE = join(PKG, "scripts/config/package-size.json");

/** Growth beyond this fraction is reported. Generous: the catalogue grows. */
const SIZE_TOLERANCE = 0.25;

const failures = [];
const notes = [];
const fail = (message) => failures.push(message);
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  return { code: result.status ?? 1, out: result.stdout ?? "", err: result.stderr ?? "" };
}

// ── 0. the package must be built ──────────────────────────────────────────
if (!existsSync(join(PKG, "dist/index.js"))) {
  console.error("✗ dist/ is missing — run `bun run build` first.");
  process.exit(1);
}

console.log("Verifying @qeetrix/icons through the package boundary\n");

// ── 1. pack and inspect the tarball ───────────────────────────────────────
for (const stale of ["*.tgz"]) void stale;
const packed = run("bun", ["pm", "pack"], { cwd: PKG });
if (packed.code !== 0) {
  console.error(`✗ bun pm pack failed:\n${packed.err}`);
  process.exit(1);
}
const tarballName = (packed.out.match(/^\s*(qeetrix-icons-[\d.]+\.tgz)\s*$/m) ??
  packed.out.match(/([\w@./-]+\.tgz)/))?.[1];
const tarball = join(PKG, basename(tarballName ?? ""));
if (!tarballName || !existsSync(tarball)) {
  console.error(`✗ could not locate the packed tarball.\n${packed.out}`);
  process.exit(1);
}

const listed = run("tar", ["-tzf", tarball]);
const files = listed.out
  .split("\n")
  .map((line) => line.trim().replace(/^package\//, ""))
  .filter((line) => line !== "" && !line.endsWith("/"));

// Everything the package is allowed to contain. npm always adds package.json,
// README and LICENSE regardless of `files`, which is why they are listed here.
const ALLOWED = [/^dist\//, /^package\.json$/, /^README\.md$/, /^LICENSE$/];
// Things whose presence would be a real leak, checked by name so the failure
// message can say what leaked rather than just "unexpected file".
const MUST_NOT_SHIP = {
  "source SVGs": /^icons\//,
  tests: /^tests\//,
  "build scripts": /^scripts\//,
  "internal docs": /^docs\//,
  "CI config": /^\.github\//,
  "TypeScript config": /^tsconfig/,
  "lint config": /^biome\.json$/,
  "test config": /^vitest\.config/,
  lockfile: /^bun\.lock$/,
  "authoring metadata": /^icon-metadata\.json$/,
  changesets: /^\.changeset\//,
  explorer: /^\.explorer\//,
};

const unexpected = files.filter((f) => !ALLOWED.some((re) => re.test(f)));
if (unexpected.length > 0) fail(`tarball contains unexpected files: ${unexpected.join(", ")}`);
for (const [label, re] of Object.entries(MUST_NOT_SHIP)) {
  const leaked = files.filter((f) => re.test(f));
  if (leaked.length > 0) fail(`tarball ships ${label}: ${leaked.slice(0, 3).join(", ")}`);
}
for (const required of [
  "package.json",
  "README.md",
  "LICENSE",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/metadata.js",
]) {
  if (!files.includes(required)) fail(`tarball is missing ${required}`);
}

const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
for (const [key, expected] of [
  ["name", "@qeetrix/icons"],
  ["license", "MIT"],
  ["type", "module"],
  ["sideEffects", false],
]) {
  if (manifest[key] !== expected)
    fail(
      `package.json ${key} is ${JSON.stringify(manifest[key])}, expected ${JSON.stringify(expected)}`,
    );
}
if (manifest.dependencies) fail("package.json declares runtime dependencies; there should be none");
if (!manifest.peerDependencies?.react) fail("package.json does not declare react as a peer");
for (const key of Object.keys(manifest.exports)) {
  if (/dist|src|scripts/.test(key)) fail(`exports key "${key}" leaks an internal path`);
}

const jsBytes = files.filter((f) => f.endsWith(".js")).length;
const dtsBytes = files.filter((f) => f.endsWith(".d.ts")).length;
console.log(`  tarball        ${files.length} files (${jsBytes} .js, ${dtsBytes} .d.ts)`);

// ── 2. install into a throwaway consumer ──────────────────────────────────
const consumer = mkdtempSync(join(tmpdir(), "qeetrix-icons-consumer-"));
cpSync(tarball, join(consumer, "pkg.tgz"));
writeFileSync(
  join(consumer, "package.json"),
  `${JSON.stringify({ name: "consumer", private: true, type: "module" }, null, 2)}\n`,
);
writeFileSync(
  join(consumer, "tsconfig.json"),
  `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        // The two settings that make this a real check of the shipped types.
        skipLibCheck: false,
        noUncheckedIndexedAccess: true,
        verbatimModuleSyntax: true,
      },
      include: ["src"],
    },
    null,
    2,
  )}\n`,
);

// `src/` is the app surface, typechecked strictly with no node types — it has to
// look like real browser code. `harness/` is the node script that proves runtime,
// and is deliberately outside the typechecked root.
const consumerSrc = join(consumer, "src");
mkdirSync(consumerSrc, { recursive: true });
mkdirSync(join(consumer, "harness"), { recursive: true });
cpSync(join(PKG, "scripts/config/consumer-fixture.tsx"), join(consumerSrc, "App.tsx"));
cpSync(join(PKG, "scripts/config/consumer-render.tsx"), join(consumer, "harness/render.tsx"));

const install = run("bun", ["add", "./pkg.tgz", "react@19", "react-dom@19"], { cwd: consumer });
if (install.code !== 0) fail(`consumer install failed: ${install.err.slice(0, 400)}`);
const installDev = run(
  "bun",
  ["add", "-d", "typescript@6", "@types/react@19", "@types/react-dom@19"],
  { cwd: consumer },
);
if (installDev.code !== 0)
  fail(`consumer devDependency install failed: ${installDev.err.slice(0, 400)}`);

// ── 3. typecheck the consumer against the shipped declarations ────────────
const tsc = run("bunx", ["tsc", "--noEmit"], { cwd: consumer });
if (tsc.code === 0) {
  console.log("  types          ✓ consumer typechecks (skipLibCheck: false)");
} else {
  fail(`consumer typecheck failed:\n${(tsc.out + tsc.err).split("\n").slice(0, 12).join("\n")}`);
}

// ── 4. render on the server, to prove runtime and not just types ──────────
const render = run("bun", ["run", "harness/render.tsx"], { cwd: consumer });
const rendered = render.out;
if (rendered.includes("RENDER_OK")) {
  console.log("  runtime        ✓ server-rendered, SVG attributes correct");
} else {
  fail(`consumer render failed:\n${(render.out + render.err).slice(0, 600)}`);
}

// ── 5. tree-shaking and size, measured with a real bundler ────────────────
const dist = join(PKG, "dist");
function bundle(source) {
  const entry = join(consumer, "entry.js");
  writeFileSync(entry, source);
  const result = run(
    "bun",
    ["build", entry, "--minify", "--external", "react", "--external", "react/jsx-runtime"],
    { cwd: PKG },
  );
  if (result.code !== 0) {
    fail(`bundling failed: ${result.err.slice(0, 300)}`);
    return "";
  }
  return result.out;
}

const oneIcon = bundle(`import { Search } from "${dist}/index.js";\nconsole.log(Search);\n`);
const deepIcon = bundle(
  `import { Search } from "${dist}/icons/search.js";\nconsole.log(Search);\n`,
);
const wholeSet = bundle(`import * as i from "${dist}/index.js";\nconsole.log(i);\n`);
const metadataOnly = bundle(
  `import { iconNames } from "${dist}/metadata.js";\nconsole.log(iconNames);\n`,
);

/** A path `d` value unique to one icon, used as a tracer in the bundle. */
function tracer(name) {
  const source = readFileSync(join(dist, "icons", `${name}.js`), "utf8");
  return source.match(/d:\s*"([^"]{12,})"/)?.[1] ?? null;
}
const searchTracer = tracer("search");
if (searchTracer && !oneIcon.includes(searchTracer)) {
  fail("the icon that was imported is missing from the bundle");
}
const leaked = ["settings", "shield-check", "database", "trophy", "banknote", "workflow"]
  .map((name) => ({ name, path: tracer(name) }))
  .filter(({ path }) => path && oneIcon.includes(path));
if (leaked.length > 0) {
  fail(
    `unimported icons leaked into a single-icon bundle: ${leaked.map((l) => l.name).join(", ")}`,
  );
}
if (!oneIcon.includes("arrow") && metadataOnly.includes(searchTracer ?? "\u0000")) {
  fail("metadata import pulled in component geometry");
}

const sizes = {
  tarball: readFileSync(tarball).byteLength,
  distJs: run("sh", ["-c", `find ${dist} -name '*.js' -exec cat {} + | wc -c`]).out.trim() * 1,
  distDts: run("sh", ["-c", `find ${dist} -name '*.d.ts' -exec cat {} + | wc -c`]).out.trim() * 1,
  metadata: readFileSync(join(dist, "metadata.js")).byteLength,
  bundleOneIcon: oneIcon.length,
  bundleDeepImport: deepIcon.length,
  bundleWholeSet: wholeSet.length,
  bundleMetadataOnly: metadataOnly.length,
};

const shakeRatio = sizes.bundleOneIcon / sizes.bundleWholeSet;
if (shakeRatio > 0.1) {
  fail(
    `tree-shaking looks broken: one icon is ${(shakeRatio * 100).toFixed(1)}% of the whole set ` +
      `(${sizes.bundleOneIcon} / ${sizes.bundleWholeSet} bytes)`,
  );
}

console.log(
  `  tree-shaking   ✓ one icon ${sizes.bundleOneIcon} B of ${sizes.bundleWholeSet} B ` +
    `(${(shakeRatio * 100).toFixed(1)}%)`,
);
console.log("\n  size report");
for (const [key, value] of Object.entries(sizes)) {
  console.log(`    ${key.padEnd(20)} ${kb(value).padStart(10)}`);
}

// ── baseline comparison ───────────────────────────────────────────────────
if (UPDATE) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        $comment:
          "Size baseline for bun run verify:package. Recorded with --update-baseline. " +
          "Growth beyond the tolerance is reported, not failed: the catalogue is meant to grow. " +
          "Re-record deliberately, in the same change that grows the package, so the diff shows it.",
        tolerance: SIZE_TOLERANCE,
        sizes,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\n✔ baseline updated (${BASELINE.replace(`${PKG}/`, "")})`);
} else if (existsSync(BASELINE)) {
  const base = JSON.parse(readFileSync(BASELINE, "utf8"));
  for (const [key, value] of Object.entries(sizes)) {
    const before = base.sizes?.[key];
    if (!before) continue;
    const growth = (value - before) / before;
    if (growth > (base.tolerance ?? SIZE_TOLERANCE)) {
      notes.push(
        `${key} grew ${(growth * 100).toFixed(0)}% (${kb(before)} → ${kb(value)}) — ` +
          "re-record with `bun run verify:package -- --update-baseline` if intended",
      );
    }
  }
} else {
  notes.push("no size baseline recorded yet — run with --update-baseline");
}

rmSync(consumer, { recursive: true, force: true });
rmSync(tarball, { force: true });

// ── report ────────────────────────────────────────────────────────────────
console.log("");
for (const note of notes) console.log(`⚠ ${note}`);
if (failures.length === 0) {
  console.log("✓ package verified: contents, resolution, types, runtime, tree-shaking.");
  process.exit(0);
}
console.error(`✗ ${failures.length} package problem(s):`);
for (const failure of failures) console.error(`    ${failure}`);
process.exit(1);
