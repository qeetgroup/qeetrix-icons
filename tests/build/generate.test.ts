import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { PKG } from "../helpers.js";

/**
 * These run the real generator as a subprocess against a throwaway copy of the
 * repo, so nothing here can touch the working tree. A copy is also the only
 * honest way to test the `--check` failure path: it needs a file to be stale.
 */
const workspaces: string[] = [];

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "qeetrix-icons-"));
  for (const entry of ["icons", "scripts", "src", "icon-metadata.json", "package.json"]) {
    cpSync(join(PKG, entry), join(dir, entry), { recursive: true });
  }
  // Symlink rather than copy: `svgson` is the only dependency the generator
  // needs, and deep-copying the whole install per sandbox is ruinously slow.
  symlinkSync(join(PKG, "node_modules"), join(dir, "node_modules"), "dir");
  workspaces.push(dir);
  return dir;
}

function generate(dir: string, args: string[] = []) {
  // spawnSync, not execFileSync: the latter returns only stdout, and warnings
  // go to stderr, so asserting on them needs both streams.
  const result = spawnSync("node", ["scripts/generate.mjs", ...args], {
    cwd: dir,
    encoding: "utf8",
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/** Snapshot every generated file as path → contents. */
function snapshot(dir: string) {
  const out: Record<string, string> = {};
  for (const name of readdirSync(join(dir, "src/icons")).sort()) {
    out[`src/icons/${name}`] = readFileSync(join(dir, "src/icons", name), "utf8");
  }
  out["src/metadata.ts"] = readFileSync(join(dir, "src/metadata.ts"), "utf8");
  return out;
}

/** Delete an icon and its metadata entry, the way a real removal would. */
function dropIcon(dir: string, category: string, name: string) {
  rmSync(join(dir, `icons/${category}/${name}.svg`));
  const path = join(dir, "icon-metadata.json");
  const registry = JSON.parse(readFileSync(path, "utf8"));
  delete registry[name];
  writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`);
}

afterAll(() => {
  for (const dir of workspaces) rmSync(dir, { recursive: true, force: true });
});

describe("determinism", () => {
  it("produces byte-identical output across two runs", () => {
    const dir = sandbox();
    expect(generate(dir).code).toBe(0);
    const first = snapshot(dir);
    expect(generate(dir).code).toBe(0);
    expect(snapshot(dir)).toEqual(first);
  });

  it("produces identical output from a clean slate as from an existing tree", () => {
    const fresh = sandbox();
    rmSync(join(fresh, "src/icons"), { recursive: true, force: true });
    rmSync(join(fresh, "src/metadata.ts"), { force: true });
    expect(generate(fresh).code).toBe(0);

    const existing = sandbox();
    expect(generate(existing).code).toBe(0);

    expect(snapshot(fresh)).toEqual(snapshot(existing));
  });

  it("does not stamp output with a timestamp or any other volatile value", () => {
    const dir = sandbox();
    generate(dir);
    const all = Object.values(snapshot(dir)).join("\n");
    expect(all).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(all).not.toMatch(/generated at/i);
  });
});

describe("the committed tree matches its generator", () => {
  it("--check passes against the real repository", () => {
    // This is the guard CI relies on. It runs against PKG, read-only.
    const result = generate(PKG, ["--check"]);
    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("up to date");
  });
});

describe("--check catches drift", () => {
  it("fails and names a hand-edited component", () => {
    const dir = sandbox();
    generate(dir);
    const target = join(dir, "src/icons/arrow-left.tsx");
    writeFileSync(target, `${readFileSync(target, "utf8")}\n// hand edit\n`);

    const result = generate(dir, ["--check"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("src/icons/arrow-left.tsx");
    expect(result.stderr).toContain("bun run generate");
  });

  it("fails when a generated file is missing", () => {
    const dir = sandbox();
    generate(dir);
    rmSync(join(dir, "src/icons/user.tsx"));

    const result = generate(dir, ["--check"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("src/icons/user.tsx");
  });

  it("fails on an orphan left behind by a deleted source SVG", () => {
    const dir = sandbox();
    generate(dir);
    dropIcon(dir, "users", "user");

    const result = generate(dir, ["--check"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("src/icons/user.tsx");
  });

  it("reports a half-finished delete, where metadata still names the icon", () => {
    const dir = sandbox();
    generate(dir);
    rmSync(join(dir, "icons/users/user.svg"));

    const result = generate(dir, ["--check"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('entry "user" has no matching icon');
  });

  it("--check never writes", () => {
    const dir = sandbox();
    generate(dir);
    const before = snapshot(dir);
    writeFileSync(join(dir, "src/icons/arrow-left.tsx"), "// stale\n");
    generate(dir, ["--check"]);
    expect(readFileSync(join(dir, "src/icons/arrow-left.tsx"), "utf8")).toBe("// stale\n");
    expect(Object.keys(snapshot(dir))).toEqual(Object.keys(before));
  });
});

describe("reconciliation", () => {
  it("removes the component when its source SVG is deleted", () => {
    const dir = sandbox();
    generate(dir);
    dropIcon(dir, "users", "user");

    expect(generate(dir).code).toBe(0);
    expect(readdirSync(join(dir, "src/icons"))).not.toContain("user.tsx");
    // Exactly `User`, not `UserPlus`/`Users`, which legitimately remain.
    expect(readFileSync(join(dir, "src/icons/index.ts"), "utf8")).not.toContain(
      "export { User } from",
    );
    expect(readFileSync(join(dir, "src/metadata.ts"), "utf8")).not.toContain('name: "user",');
  });

  it("generates a component, an export and metadata for a new SVG", () => {
    const dir = sandbox();
    const spec =
      'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    writeFileSync(
      join(dir, "icons/navigation/example.svg"),
      `<svg ${spec}>\n  <path d="M4 12h16" />\n</svg>\n`,
    );

    const result = generate(dir);
    expect(result.code).toBe(0);

    const component = readFileSync(join(dir, "src/icons/example.tsx"), "utf8");
    expect(component).toContain("export function Example(props: QeetrixIconProps)");
    expect(component).toContain('d="M4 12h16"');
    expect(readFileSync(join(dir, "src/icons/index.ts"), "utf8")).toContain(
      'export { Example } from "./example.js";',
    );
    expect(readFileSync(join(dir, "src/metadata.ts"), "utf8")).toContain('component: "Example"');
    // Untagged, so it warns without failing.
    expect(result.stderr).toContain("has no tags in icon-metadata.json");
  });
});

describe("invalid input aborts the whole run", () => {
  it("refuses to generate and leaves the tree untouched", () => {
    const dir = sandbox();
    generate(dir);
    const before = snapshot(dir);

    writeFileSync(
      join(dir, "icons/interface/broken.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M1 1" fill="red" /></svg>\n',
    );

    const result = generate(dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("validation error");
    // No partial write: `broken.tsx` must not exist and nothing else changed.
    expect(readdirSync(join(dir, "src/icons"))).not.toContain("broken.tsx");
    expect(snapshot(dir)).toEqual(before);
  });
});
