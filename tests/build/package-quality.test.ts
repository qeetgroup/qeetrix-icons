import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PKG } from "../helpers.js";

/**
 * The package as a published artifact.
 *
 * `verify:package` does the heavy version of this — it packs, installs into a
 * throwaway consumer, typechecks against the shipped declarations, renders on the
 * server and measures bundles. That takes a minute, so it runs as its own CI job.
 *
 * What is here is the fast half: the manifest promises, and the fact that the
 * heavy script exists and is wired up. A reviewer gets this signal immediately.
 */

const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
const built = existsSync(join(PKG, "dist/index.js"));

describe("manifest promises", () => {
  it("is ESM only", () => {
    expect(manifest.type).toBe("module");
    expect(manifest.main).toBeUndefined();
    expect(manifest.module).toBeUndefined();
  });

  it("declares itself side-effect free, so bundlers may drop unused icons", () => {
    expect(manifest.sideEffects).toBe(false);
  });

  it("ships only dist/", () => {
    expect(manifest.files).toEqual(["dist"]);
  });

  it("has no runtime dependencies", () => {
    expect(manifest.dependencies).toBeUndefined();
  });

  it("takes react as a peer rather than bundling a copy", () => {
    expect(manifest.peerDependencies).toEqual({ react: ">=19" });
  });

  it("points every export at a declaration file as well as an implementation", () => {
    for (const [key, value] of Object.entries<Record<string, string> | string>(manifest.exports)) {
      if (typeof value === "string") continue;
      expect(value.types, key).toMatch(/\.d\.ts$/);
      expect(value.import, key).toMatch(/\.js$/);
    }
  });

  it("exposes no internal path in an exports key", () => {
    for (const key of Object.keys(manifest.exports)) {
      expect(key).not.toMatch(/dist|src|scripts|node_modules/);
    }
  });

  it("is publishable: name, licence, access and repository are set", () => {
    expect(manifest.name).toBe("@qeetrix/icons");
    expect(manifest.license).toBe("MIT");
    expect(manifest.publishConfig?.access).toBe("public");
    expect(manifest.repository?.url).toContain("qeetrix-icons");
    expect(existsSync(join(PKG, "LICENSE"))).toBe(true);
    expect(existsSync(join(PKG, "README.md"))).toBe(true);
  });

  it("documents every entry point it exports", () => {
    const usage = readFileSync(join(PKG, "docs/usage.md"), "utf8");
    for (const key of Object.keys(manifest.exports)) {
      if (key === "./package.json") continue;
      const specifier = key === "." ? "@qeetrix/icons" : `@qeetrix/icons${key.slice(1)}`;
      expect(usage, specifier).toContain(specifier.replace("/*", "/"));
    }
  });
});

describe("the size baseline", () => {
  const baseline = join(PKG, "scripts/config/package-size.json");

  it("is committed, so growth shows up in a diff", () => {
    expect(existsSync(baseline)).toBe(true);
  });

  it("records every measurement verify:package takes", () => {
    const data = JSON.parse(readFileSync(baseline, "utf8"));
    for (const key of [
      "tarball",
      "distJs",
      "distDts",
      "metadata",
      "bundleOneIcon",
      "bundleWholeSet",
    ]) {
      expect(typeof data.sizes[key], key).toBe("number");
    }
    expect(data.tolerance).toBeGreaterThan(0);
  });

  it("still describes a tree-shakeable package", () => {
    const { sizes } = JSON.parse(readFileSync(baseline, "utf8"));
    // One icon must be a rounding error against the whole set, or the recorded
    // baseline is describing a package that stopped shaking.
    expect(sizes.bundleOneIcon / sizes.bundleWholeSet).toBeLessThan(0.05);
    expect(sizes.bundleDeepImport).toBeLessThanOrEqual(sizes.bundleOneIcon * 1.1);
  });
});

describe("the heavy verification is wired up", () => {
  it("has a verify:package script", () => {
    expect(manifest.scripts["verify:package"]).toBe("node scripts/verify-package.mjs");
  });

  it("ships the consumer fixture the script installs", () => {
    for (const file of [
      "scripts/verify-package.mjs",
      "scripts/config/consumer-fixture.tsx",
      "scripts/config/consumer-render.tsx",
    ]) {
      expect(existsSync(join(PKG, file)), file).toBe(true);
    }
  });

  it("has the consumer fixture import only documented entry points", () => {
    const fixture = readFileSync(join(PKG, "scripts/config/consumer-fixture.tsx"), "utf8");
    const specifiers = [...fixture.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    for (const specifier of specifiers) {
      expect(specifier).toMatch(/^@qeetrix\/icons(\/(metadata|icons\/[a-z0-9-]+))?$/);
    }
  });

  it("runs it in CI as its own job", () => {
    const ci = readFileSync(join(PKG, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("bun run verify:package");
    expect(ci).toMatch(/^\s{2}package:$/m);
  });
});

describe("the release workflow", () => {
  const release = readFileSync(join(PKG, ".github/workflows/release.yml"), "utf8");

  it("separates versioning from publishing", () => {
    // Versioning must work without credentials; publishing must not be attempted
    // without them.
    expect(release).toMatch(/^\s{2}version:$/m);
    expect(release).toMatch(/^\s{2}publish:$/m);
  });

  it("does not pass a publish input to the changesets action", () => {
    // It used to. That makes the action attempt a publish on every push to main,
    // which failed with ENEEDAUTH on a repository with no NPM_TOKEN — a red run
    // on every merge. Publishing is the separate, guarded job instead.
    const withBlock = release.match(/uses: changesets\/action@v1\n(\s+)with:\n((?:\1 {2}.+\n)+)/);
    expect(withBlock, "changesets action `with:` block not found").not.toBeNull();
    expect(withBlock?.[2]).not.toContain("publish:");
  });

  it("guards the publish step on credentials actually being present", () => {
    expect(release).toContain("steps.creds.outputs.ready == 'true'");
    expect(release).toContain("steps.creds.outputs.ready != 'true'");
    // Reduced to a boolean output because secrets are unavailable in a step `if`.
    expect(release).toMatch(/secrets\.NPM_TOKEN != ''/);
  });

  it("gates publishing on the protected environment, and nothing else", () => {
    const publishJob = release.slice(release.indexOf("\n  publish:"));
    expect(publishJob).toContain("environment: npm-publish");
    const versionJob = release.slice(
      release.indexOf("\n  version:"),
      release.indexOf("\n  publish:"),
    );
    expect(versionJob).not.toContain("environment:");
  });

  it("uses a node version whose npm supports trusted publishing", () => {
    // npm >= 11.5 is required, which means Node 24. Node 20 ships npm 10.
    expect(release).toMatch(/node-version: 2[4-9]/);
  });

  it("explains the missing configuration rather than just failing", () => {
    expect(release).toContain("GITHUB_STEP_SUMMARY");
    expect(release).toContain("::warning");
  });
});

describe.skipIf(!built)("the generated API reference", () => {
  it("is current", () => {
    const result = spawnSync("node", ["scripts/api-docs.mjs", "--check"], {
      cwd: PKG,
      encoding: "utf8",
    });
    expect(result.stderr, result.stderr).not.toContain("stale");
    expect(result.status).toBe(0);
  });

  it("documents every public export the barrel declares", () => {
    const api = readFileSync(join(PKG, "docs/api.md"), "utf8");
    for (const name of [
      "QeetrixIconProps",
      "IconMetadata",
      "IconDeprecation",
      "IconBase",
      "ICON_VIEW_BOX",
      "ICON_DEFAULT_SIZE",
      "ICON_DEFAULT_STROKE_WIDTH",
    ]) {
      expect(api, name).toContain(name);
    }
  });

  it("reads its facts from dist rather than restating them", () => {
    const api = readFileSync(join(PKG, "docs/api.md"), "utf8");
    // Values pulled out of the declarations, not typed into the template.
    expect(api).toContain('`"0 0 24 24"`');
    expect(api).toContain("| `ICON_DEFAULT_SIZE` | `24` |");
    expect(api).toContain("| `ICON_DEFAULT_STROKE_WIDTH` | `2` |");
  });

  it("says what is deliberately not public", () => {
    const api = readFileSync(join(PKG, "docs/api.md"), "utf8");
    expect(api).toContain("What is not public");
    expect(api).toContain("icon-metadata.json");
  });

  it("does not embed the package version", () => {
    // It used to. Changesets bumps the version without running any generator,
    // so every release made these committed, --checked documents stale and
    // failed CI on content that had not changed. The version belongs in
    // package.json, CHANGELOG.md and npm — not in a document about API shape.
    for (const doc of ["docs/api.md", "docs/icon-catalog.md"]) {
      const text = readFileSync(join(PKG, doc), "utf8");
      // The `v0.2.0` heading form that used to be interpolated.
      expect(text, doc).not.toMatch(/v\d+\.\d+\.\d+/);
      // And no version printed next to the package name. Deliberately not a
      // bare search for the version string: `api.md` legitimately quotes an
      // example version in IconDeprecation's `since` doc, which would collide
      // with the real one by coincidence.
      expect(text, doc).not.toMatch(/@qeetrix\/icons`?\s+v?\d+\.\d+\.\d+/);
    }
  });
});
