import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { logoGeneratedPaths as iconGeneratorSkips } from "../scripts/lib/generation-plan.js";
import {
  logoBarrelPath,
  logoGeneratedPaths,
  logoModulePath,
  logoModuleSource,
  logoVariantLinePattern,
  type PlannedLogo,
} from "../scripts/lib/logo-module.js";
import { brandsConfigPath } from "../scripts/lib/logo-plan.js";
import {
  decodeSvgDataUri,
  LogoSourceError,
  readSvgIntrinsicSize,
  svgDataUri,
} from "../scripts/lib/logo-source.js";
import * as runtime from "../src/runtime/render-logo.js";
import type { LogoData, LogoProps } from "../src/types/logo.js";

const PKG = join(import.meta.dirname, "..");

/** Reads many files concurrently; ~20,000 sequential reads are several times slower. */
async function readAll(paths: readonly string[]): Promise<Buffer[]> {
  const buffers = new Array<Buffer>(paths.length);
  let next = 0;
  const worker = async () => {
    while (next < paths.length) {
      const index = next++;
      buffers[index] = await readFile(paths[index] as string);
    }
  };
  await Promise.all(Array.from({ length: 64 }, worker));
  return buffers;
}
const bytes = (text: string) => new TextEncoder().encode(text);
const markup = (element: ReactElement) => renderToStaticMarkup(element);
/** The value of one attribute in static markup, HTML-unescaped. */
const attribute = (html: string, name: string) =>
  new RegExp(` ${name}="([^"]*)"`)
    .exec(html)?.[1]
    ?.replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

describe("lossless data URIs", () => {
  const every = Uint8Array.from({ length: 512 }, (_, index) => index % 256);
  const svg = bytes(
    `<?xml version="1.0" encoding="UTF-8"?>\n<!-- © 2024 -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">\n\t<path fill="#FF0000" style='fill:url(#a)' d="M0 0h10v10z"/><text>100% ✓ \\ </text></svg> `,
  );

  it("decodes back to the identical bytes, for every byte value", async () => {
    for (const input of [
      every,
      svg,
      new Uint8Array(),
      bytes("\uFEFF<svg/>"),
      Uint8Array.of(0xff, 0xfe, 0x80),
    ]) {
      const uri = svgDataUri(input);
      expect(Buffer.from(decodeSvgDataUri(uri)).equals(Buffer.from(input))).toBe(true);
      // The WHATWG URL parser and Fetch's data: URL processor agree, so browsers get these bytes.
      const fetched = Buffer.from(await (await fetch(uri)).arrayBuffer());
      expect(fetched.equals(Buffer.from(input))).toBe(true);
    }
  });

  it("escapes only what a URI or a single-quoted literal cannot carry", () => {
    const uri = svgDataUri(svg);
    expect(
      uri.startsWith('data:image/svg+xml,<?xml version="1.0" encoding="UTF-8"?>%0A%3C!--'),
    ).toBe(true);
    expect(uri).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">%0A%09<path fill="%23FF0000"',
    );
    expect(uri).toContain("style=%27fill:url(%23a)%27");
    expect(uri).toContain("100%25 %E2%9C%93 %5C </text></svg>%20");
    expect(uri).toMatch(/^[\x20-\x7e]*$/);
    expect(uri).not.toMatch(/['\\]/);
    expect(svgDataUri(bytes("</SCRIPT>"))).toBe("data:image/svg+xml,%3C/SCRIPT>");
    expect(() => decodeSvgDataUri("data:image/svg+xml,%G0")).toThrow(LogoSourceError);
    expect(() => decodeSvgDataUri("data:text/plain,x")).toThrow(LogoSourceError);
  });
});

describe("intrinsic size", () => {
  const size = (text: string) => readSvgIntrinsicSize(bytes(text));
  const ns = 'xmlns="http://www.w3.org/2000/svg"';

  it("uses absolute width and height, else the viewBox, without changing the file", () => {
    expect(size(`<svg ${ns} width="800px" height="400" viewBox="0 0 24 24"/>`)).toMatchObject({
      width: 800,
      height: 400,
      from: "width-height",
      problems: [],
    });
    expect(size(`<svg ${ns} width="30pt" height="1.5em"/>`)).toMatchObject({
      width: 40,
      height: 24,
    });
    expect(size(`<svg ${ns} width="100%" height="100%" viewBox="0,0,192,96"/>`)).toMatchObject({
      width: 192,
      height: 96,
      from: "viewBox",
    });
    // One dimension only: SVG 2 sizing takes the ratio from the viewBox, as browsers do.
    expect(size(`<svg ${ns} height="1em" viewBox="0 0 182 24"/>`)).toMatchObject({
      width: 182,
      height: 24,
    });
  });

  it("reads past the prolog: declaration, comments, DOCTYPE with an internal subset", () => {
    const source = `\uFEFF<?xml version="1.0"?>\n<!-- <svg width="1" height="1"> -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd" [\n<!ENTITY ns_svg "http://www.w3.org/2000/svg">\n<!ENTITY a "]>">\n]>\n<svg xmlns="&ns_svg;" viewBox="0 0 30 10"><path d="M0 0"/></svg>`;
    expect(size(source)).toEqual({ width: 30, height: 10, from: "viewBox", problems: [] });
    expect(
      size(`<svg:svg xmlns:svg="http://www.w3.org/2000/svg" viewBox="0 0 2 1"/>`),
    ).toMatchObject({
      width: 2,
      problems: [],
    });
  });

  it("reports published defects that browsers show as nothing, and rejects files with no ratio", () => {
    expect(size(`<svg viewBox="0 0 10 10"/>`).problems).toEqual([
      "the root does not declare the SVG namespace, so browsers do not display it as an image",
    ]);
    expect(size(`<svg ${ns} viewBox="1 2 0 0" width="10" height="5"/>`)).toMatchObject({
      width: 10,
      height: 5,
      problems: ['its viewBox "1 2 0 0" has no area, so browsers render nothing'],
    });
    expect(() => size(`<svg ${ns} width="10"/>`)).toThrow(LogoSourceError);
    expect(() => size(`<html ${ns}/>`)).toThrow(/not <svg>/);
  });
});

describe("renderLogo", () => {
  const wide = svgDataUri(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"/>'));
  const square = svgDataUri(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"/>'));
  const data: LogoData<"default" | "mono"> = {
    defaultVariant: "default",
    variants: {
      default: { width: 40, height: 20, src: wide },
      mono: { width: 8, height: 8, src: square },
    },
  };
  const Logo = (props: LogoProps<"default" | "mono">) => runtime.renderLogo(data, props);
  const html = (props: LogoProps<"default" | "mono"> = {}) => markup(createElement(Logo, props));

  it("renders the selected file unmodified as an <img>", () => {
    expect(attribute(html(), "src")).toBe(wide);
    expect(attribute(html({ variant: "mono" }), "src")).toBe(square);
    // An unknown name (from untyped callers) falls back to the default.
    expect(attribute(html({ variant: "gold" as "mono" }), "src")).toBe(wide);
    expect(attribute(html({ variant: "constructor" as "mono" }), "src")).toBe(wide);
    expect(html()).toMatch(/^<img [^>]*\/>$/);
  });

  it("derives the width from the file's aspect ratio, or the height from a lone width", () => {
    expect([attribute(html(), "width"), attribute(html(), "height")]).toEqual(["48", "24"]);
    expect([
      attribute(html({ height: 40 }), "width"),
      attribute(html({ height: 40 }), "height"),
    ]).toEqual(["80", "40"]);
    expect([
      attribute(html({ width: 120 }), "width"),
      attribute(html({ width: 120 }), "height"),
    ]).toEqual(["120", "60"]);
    expect([
      attribute(html({ height: "30" }), "width"),
      attribute(html({ height: "30" }), "height"),
    ]).toEqual(["60", "30"]);
    expect(attribute(html({ width: 10, height: 10 }), "width")).toBe("10");
    expect(attribute(html({ variant: "mono", height: 33 }), "width")).toBe("33");
    expect(runtime.scaleLogoLength(7, 1 / 3)).toBe(2.333);
  });

  it("puts CSS lengths in style, where a caller style wins", () => {
    const em = html({ height: "2em" });
    expect(attribute(em, "style")).toBe("width:4em;height:2em");
    expect(attribute(em, "width")).toBeUndefined();
    expect(attribute(html({ height: "50%" }), "style")).toBe("height:50%");
    expect(
      attribute(html({ height: "1rem", style: { width: "auto", color: "red" } }), "style"),
    ).toBe("width:auto;height:1rem;color:red");
    expect(attribute(html({ style: { opacity: 0.5 } }), "style")).toBe("opacity:0.5");
  });

  it("is decorative by default and named by alt or aria-label", () => {
    const decorative = html();
    expect(attribute(decorative, "alt")).toBe("");
    expect(attribute(decorative, "aria-hidden")).toBe("true");
    expect(attribute(html({ "aria-label": "  " }), "aria-hidden")).toBe("true");

    const labelled = html({ "aria-label": "Acme" });
    expect(attribute(labelled, "alt")).toBe("Acme");
    expect(attribute(labelled, "aria-label")).toBeUndefined();
    expect(attribute(labelled, "aria-hidden")).toBeUndefined();

    const alt = html({ alt: "Acme logo" });
    expect(attribute(alt, "alt")).toBe("Acme logo");
    expect(attribute(alt, "aria-hidden")).toBeUndefined();

    const labelledBy = html({ "aria-labelledby": "caption" });
    expect(attribute(labelledBy, "aria-labelledby")).toBe("caption");
    expect(attribute(labelledBy, "aria-hidden")).toBeUndefined();
    expect(attribute(labelledBy, "alt")).toBeUndefined();

    expect(attribute(html({ "aria-label": "Acme", "aria-hidden": true }), "aria-hidden")).toBe(
      "true",
    );
    expect(attribute(html({ "aria-hidden": false }), "aria-hidden")).toBe("false");
  });

  it("passes native <img> props through but keeps its own src", () => {
    const passed = html({
      className: "brand",
      loading: "lazy",
      decoding: "async",
      draggable: false,
      title: "Acme",
      id: "logo",
      ...{ "data-testid": "acme", src: "https://example.com/x.svg" },
    } as LogoProps<"default">);
    for (const [name, value] of [
      ["class", "brand"],
      ["loading", "lazy"],
      ["decoding", "async"],
      ["draggable", "false"],
      ["title", "Acme"],
      ["id", "logo"],
      ["data-testid", "acme"],
      ["src", wide],
    ]) {
      expect(attribute(passed, name as string)).toBe(value);
    }
  });

  it("uses no hooks, so it renders anywhere, including outside a React render", () => {
    const element = Logo({ variant: "mono" }) as ReactElement<{ src: string }>;
    expect(element.type).toBe("img");
    expect(element.props.src).toBe(square);
  });
});

/** Executes a generated module as emitted, with React and the real runtime injected. */
function load(code: string, componentName: string) {
  const { outputText } = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const modules = new Map<string, unknown>([
    ["react", { createElement }],
    ["../../runtime/render-logo.js", runtime],
  ]);
  const exports: Record<string, unknown> = {};
  new Function("exports", "require", outputText)(exports, (name: string) => modules.get(name));
  return exports[componentName] as (props: LogoProps) => ReactElement;
}

describe("generated logo modules", () => {
  const file = bytes(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 1">\n<path d="M0 0"/></svg>\n',
  );
  const logo: PlannedLogo = {
    id: "acme",
    componentName: "AcmeLogo",
    title: "Acme */ Corp",
    collection: "brands",
    defaultVariant: "default",
    variants: [
      {
        name: "default",
        background: "light",
        file: "icons/brand-icons/acme/default.svg",
        src: svgDataUri(file),
        width: 3,
        height: 1,
      },
      {
        name: "wordmark-dark",
        background: "dark",
        file: "icons/brand-icons/acme/wordmark-dark.svg",
        src: svgDataUri(bytes("<svg/>")),
        width: 1,
        height: 1,
      },
    ],
    hex: null,
    categories: [],
    aliases: [],
    license: "CC0-1.0",
    website: null,
    guidelines: null,
    source: null,
  };
  it("is deterministic, names its sources and license, and embeds each file on one line", () => {
    const source = logoModuleSource(logo);
    expect(logoModuleSource(logo)).toBe(source);
    expect(source).toMatch(
      /^\/\/ Generated by @qeetrix\/icons from icons\/brand-icons\/acme\/default\.svg, icons\/brand-icons\/acme\/wordmark-dark\.svg\./,
    );
    expect(source).toContain("// First-party: Qeet Group's own artwork");
    expect(source).toContain("// Logo license: CC0-1.0.");
    expect(source).toContain("Do not edit this file directly.");
    expect(source).toContain('type Variant = "default" | "wordmark-dark";');
    expect(source).toContain(" * Acme *\\/ Corp logo.");
    const lines = [...source.matchAll(logoVariantLinePattern)];
    expect(lines.map((match) => match[1])).toEqual(["default", '"wordmark-dark"']);
    expect(Buffer.from(decodeSvgDataUri(lines[0]?.[4] ?? "")).equals(Buffer.from(file))).toBe(true);
  });

  it("renders its files exactly", () => {
    const AcmeLogo = load(logoModuleSource(logo), "AcmeLogo");
    const html = markup(createElement(AcmeLogo, {}));
    expect(
      Buffer.from(decodeSvgDataUri(attribute(html, "src") ?? "")).equals(Buffer.from(file)),
    ).toBe(true);
    expect([attribute(html, "width"), attribute(html, "height")]).toEqual(["72", "24"]);
    expect(attribute(markup(createElement(AcmeLogo, { variant: "wordmark-dark" })), "src")).toBe(
      "data:image/svg+xml,<svg/>",
    );
  });
});

describe("repository logos", () => {
  type BrandsConfig = {
    logos: Record<string, { componentName: string; variants: Record<string, { file: string }> }>;
  };
  const brands = JSON.parse(readFileSync(join(PKG, brandsConfigPath), "utf8")) as BrandsConfig;

  it("owns exactly the paths the icon generator skips", () => {
    expect([...logoGeneratedPaths].sort()).toEqual([...iconGeneratorSkips].sort());
  });

  it("embeds every variant byte for byte", async () => {
    const entries = Object.entries(brands.logos);
    const modules = await readAll(entries.map(([id]) => join(PKG, logoModulePath(id))));
    const sources = entries.flatMap(([, logo]) =>
      Object.values(logo.variants).map(({ file }) => file),
    );
    const originals = new Map(
      (await readAll(sources.map((file) => join(PKG, file)))).map((buffer, index) => [
        sources[index],
        buffer,
      ]),
    );
    const mismatches: string[] = [];
    entries.forEach(([id, logo], index) => {
      const module = modules[index]?.toString("utf8") ?? "";
      const embedded = new Map(
        [...module.matchAll(logoVariantLinePattern)].map((match) => [
          (match[1] ?? "").replace(/"/g, ""),
          match[4] ?? "",
        ]),
      );
      expect([...embedded.keys()].sort(), id).toEqual(Object.keys(logo.variants).sort());
      expect(module, id).toContain(`export function ${logo.componentName}(`);
      for (const [name, { file }] of Object.entries(logo.variants)) {
        const decoded = Buffer.from(decodeSvgDataUri(embedded.get(name) ?? ""));
        if (!originals.get(file)?.equals(decoded)) mismatches.push(file);
      }
    });
    expect(mismatches).toEqual([]);
    expect(originals.size).toBe(sources.length);
  }, 60_000);

  it("exports every logo from the barrel and renders real modules", async () => {
    const barrel = readFileSync(join(PKG, logoBarrelPath), "utf8");
    const exported = [
      ...barrel.matchAll(/^export \{ (\w+) \} from "\.\/logos\/([a-z0-9-]+)\.js";$/gm),
    ];
    expect(exported.map((match) => match[2])).toEqual(Object.keys(brands.logos).sort());
    expect(exported.map((match) => match[1])).toEqual(
      Object.keys(brands.logos)
        .sort()
        .map((id) => brands.logos[id]?.componentName),
    );
    for (const id of ["github", "manifest"].filter((slug) => slug in brands.logos)) {
      const logo = brands.logos[id];
      if (!logo) continue;
      const module = (await import(`../src/generated/logos/${id}.ts`)) as Record<
        string,
        (props: LogoProps) => ReactElement
      >;
      const Component = module[logo.componentName];
      if (!Component) throw new Error(`${id} does not export ${logo.componentName}`);
      for (const [variant, { file }] of Object.entries(logo.variants)) {
        const src = attribute(markup(createElement(Component, { variant })), "src") ?? "";
        expect(Buffer.from(decodeSvgDataUri(src)).equals(readFileSync(join(PKG, file))), file).toBe(
          true,
        );
      }
    }
  });

  it("lists every logo in the manifest", async () => {
    const { logoManifest } = await import("../src/generated/logo-manifest.js");
    expect(logoManifest.schemaVersion).toBe(1);
    expect(logoManifest.logos.map(({ id }) => id)).toEqual(Object.keys(brands.logos).sort());
    for (const entry of logoManifest.logos) {
      const logo = brands.logos[entry.id];
      expect(entry.componentName).toBe(logo?.componentName);
      expect(entry.variants.map(({ name }) => name).sort()).toEqual(
        Object.keys(logo?.variants ?? {}).sort(),
      );
      expect(entry.variants.map(({ name }) => name)).toContain(entry.defaultVariant);
    }
  });

  it("passes check:logos", () => {
    const output = execFileSync("bun", ["scripts/build/generate-logos.ts", "--check"], {
      cwd: PKG,
      encoding: "utf8",
      stdio: "pipe",
    });
    expect(output).toContain("Generated logos are up to date");
  }, 180_000);
});
