import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { icons } from "../../src/metadata.js";
import { PKG } from "../helpers.js";

/**
 * Prove the package is tree-shakeable rather than asserting that it is.
 *
 * `sideEffects: false` plus one module per icon *should* be enough, but "should"
 * is exactly the word this test exists to remove. It bundles a real entry point
 * with a real bundler (`bun build`, already present — no new dependency) against
 * the real `dist/`, then checks that geometry belonging to icons the entry never
 * imported is absent from the output.
 *
 * Resolution goes through `dist/`, not `src/`, so this exercises the published
 * artifact and the `exports` map rather than the source tree.
 */

const dist = join(PKG, "dist");
const built = existsSync(join(dist, "index.js"));
const workspaces: string[] = [];

afterAll(() => {
  for (const dir of workspaces) rmSync(dir, { recursive: true, force: true });
});

/** Bundle `source` and return the minified output. */
function bundle(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "qeetrix-shake-"));
  workspaces.push(dir);
  const entry = join(dir, "entry.js");
  writeFileSync(entry, source);
  const out = spawnSync(
    "bun",
    ["build", entry, "--minify", "--external", "react", "--external", "react/jsx-runtime"],
    { cwd: PKG, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  expect(out.status, out.stderr).toBe(0);
  return out.stdout;
}

/** A path `d` value that belongs to exactly one icon, for use as a tracer. */
function tracer(name: string) {
  const icon = icons.find((i) => i.name === name);
  if (!icon) throw new Error(`icon "${name}" not found in metadata`);
  const source = readFileSync(join(PKG, "dist/icons", icon.category, `${name}.js`), "utf8");
  const match = source.match(/d:\s*"([^"]{12,})"/);
  if (!match) throw new Error(`no usable tracer path in ${name}`);
  return match[1];
}

describe.skipIf(!built)("tree-shaking", () => {
  it("a single named import from the barrel drops every other icon", () => {
    const output = bundle(
      `import { ArrowLeft } from "${dist}/index.js";\nconsole.log(ArrowLeft);\n`,
    );

    // The icon that was imported must survive.
    expect(output).toContain(tracer("arrow-left"));

    // Icons that were not imported must not be in the bundle. Sample across
    // categories rather than all 1166, to keep the test fast.
    for (const name of ["settings", "shield-tick", "data", "heart", "user"]) {
      expect(output, `${name} leaked into the bundle`).not.toContain(tracer(name));
    }
  });

  it("leaves out the great majority of the set", () => {
    const output = bundle(
      `import { ArrowLeft } from "${dist}/index.js";\nconsole.log(ArrowLeft);\n`,
    );
    const present = icons.filter((icon) => {
      try {
        return output.includes(tracer(icon.name));
      } catch {
        return false;
      }
    });
    // Only `arrow-left` should be reachable. Allow a tiny margin in case two
    // icons happen to share a path string, but nothing like the whole set.
    expect(present.map((icon) => icon.name).length).toBeLessThanOrEqual(2);
  });

  it("bundles one icon into a few kilobytes, not the whole catalogue", () => {
    const one = bundle(`import { ArrowLeft } from "${dist}/index.js";\nconsole.log(ArrowLeft);\n`);
    const all = bundle(`import * as icons from "${dist}/index.js";\nconsole.log(icons);\n`);
    expect(one.length).toBeLessThan(4_000);
    // The whole set must be markedly larger, or the single-import case was not
    // actually shaking anything.
    expect(all.length).toBeGreaterThan(one.length * 8);
  });

  it("supports deep-importing a single icon without touching the barrel", () => {
    const output = bundle(
      `import { ArrowRight } from "${dist}/icons/arrows/arrow-right.js";\nconsole.log(ArrowRight);\n`,
    );
    expect(output).toContain(tracer("arrow-right"));
    expect(output).not.toContain(tracer("arrow-left"));
    expect(output.length).toBeLessThan(4_000);
  });

  it("keeps the metadata catalogue out of a component-only import", () => {
    const output = bundle(
      `import { ArrowLeft } from "${dist}/index.js";\nconsole.log(ArrowLeft);\n`,
    );
    // Metadata lives behind its own subpath precisely so this holds.
    expect(output).not.toContain("magnifying-glass");
    expect(output).not.toContain("iconNames");
  });

  it("lets metadata be imported without pulling in any component", () => {
    const output = bundle(
      `import { iconNames } from "${dist}/metadata.js";\nconsole.log(iconNames);\n`,
    );
    expect(output).toContain("arrow-left");
    expect(output).not.toContain(tracer("arrow-left"));
  });
});
