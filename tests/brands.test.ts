import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import {
  validateBrandSvg,
  validateBrandsData,
  validateBrandsRepository,
} from "../scripts/check/validate-brands.js";
import {
  brandComponentName,
  brandSlug,
  brandsData,
  brandVariantName,
  classifyBrandSvg,
  firstPartyBrandLogos,
  normalizeBrandLicense,
  readArchiveInfo,
  readBrandRelease,
  renderBrandsJson,
  withFirstPartyLogos,
} from "../scripts/lib/brands.js";
import { writeFixture } from "./helpers.js";

const PKG = join(import.meta.dirname, "..");
const svg = (content: string, attributes = 'viewBox="0 0 24 24"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${content}</svg>`;
const square = (attributes = "") => `<path d="M0 0h24v24H0z" ${attributes}/>`;
const codes = (source: string) =>
  validateBrandSvg(source, "fixture.svg").map((entry) => entry.code);

describe("brandVariantName", () => {
  it("maps upstream keys and file stems to kebab-case", () => {
    expect(
      [
        "default",
        "mono",
        "wordmarkDark",
        "wordmark-dark",
        "wordmarkLight",
        "monoLobe",
        "lockupDark",
        "wordmarkMono",
        "16",
        "SVGLogo",
        "dark_mode",
      ].map(brandVariantName),
    ).toEqual([
      "default",
      "mono",
      "wordmark-dark",
      "wordmark-dark",
      "wordmark-light",
      "mono-lobe",
      "lockup-dark",
      "wordmark-mono",
      "16",
      "svg-logo",
      "dark-mode",
    ]);
  });

  it("rejects keys with nothing to name", () => {
    expect(() => brandVariantName("--")).toThrow("Cannot derive a variant name");
  });
});

describe("brandComponentName", () => {
  it("is PascalCase of the slug plus Logo", () => {
    expect(brandComponentName("github")).toBe("GithubLogo");
    expect(brandComponentName("aws-amazon-api-gateway")).toBe("AwsAmazonApiGatewayLogo");
  });

  it("prefixes Brand when the name would start with a digit", () => {
    expect(brandComponentName("1001tracklists")).toBe("Brand1001tracklistsLogo");
    expect(brandComponentName("42")).toBe("Brand42Logo");
  });

  it("keeps hyphenated and unhyphenated slugs distinct", () => {
    expect(brandComponentName("arch-linux")).toBe("ArchLinuxLogo");
    expect(brandComponentName("archlinux")).toBe("ArchlinuxLogo");
    expect(brandComponentName("hugging-face")).not.toBe(brandComponentName("huggingface"));
  });

  it("normalizes upstream slugs to kebab-case first", () => {
    const slug = brandSlug("gcp-cloud-optimization-ai---fleet-routing-api");
    expect(slug).toBe("gcp-cloud-optimization-ai-fleet-routing-api");
    expect(brandComponentName(slug)).toBe("GcpCloudOptimizationAiFleetRoutingApiLogo");
    expect(brandSlug("Café")).toBe("cafe");
  });
});

describe("normalizeBrandLicense", () => {
  it("maps upstream text to SPDX where it fits and keeps the raw text", () => {
    expect(normalizeBrandLicense("GPL-3.0")).toEqual({
      license: "GPL-3.0-only",
      licenseRaw: "GPL-3.0",
      licenseClass: "copyleft",
    });
    expect(normalizeBrandLicense("CC0-1.0").licenseClass).toBe("public-domain");
    expect(normalizeBrandLicense("Apache-2.0").licenseClass).toBe("permissive");
    expect(normalizeBrandLicense("CC-BY-4.0").licenseClass).toBe("attribution");
    expect(normalizeBrandLicense("CC-BY-SA-3.0").licenseClass).toBe("share-alike");
    expect(normalizeBrandLicense("CC-BY-ND-2.0").licenseClass).toBe("no-derivatives");
    expect(normalizeBrandLicense("CC-BY-NC-SA-4.0").licenseClass).toBe("non-commercial");
    expect(normalizeBrandLicense("brand-use")).toEqual({
      license: "brand-use",
      licenseRaw: "brand-use",
      licenseClass: "no-licence",
    });
    expect(normalizeBrandLicense(null)).toEqual({
      license: "NOASSERTION",
      licenseRaw: null,
      licenseClass: "no-licence",
    });
  });
});

describe("classifyBrandSvg", () => {
  it("reads dark artwork as meant for light backgrounds", () => {
    expect(classifyBrandSvg(svg(square('fill="#000"')))).toEqual({
      background: "light",
      colors: ["#000000"],
    });
    expect(classifyBrandSvg(svg(square('fill="#18181b"'))).background).toBe("light");
  });

  it("treats no fill and currentColor as dark-on-light", () => {
    expect(classifyBrandSvg(svg(square()))).toEqual({ background: "light", colors: ["#000000"] });
    expect(classifyBrandSvg(svg(square('fill="currentColor"')))).toEqual({
      background: "light",
      colors: ["currentColor"],
    });
  });

  it("reads light artwork as meant for dark backgrounds", () => {
    expect(classifyBrandSvg(svg(square('fill="white"')))).toEqual({
      background: "dark",
      colors: ["#ffffff"],
    });
    expect(classifyBrandSvg(svg(square('fill="none" stroke="#eee"'))).background).toBe("dark");
  });

  it("reads colourful, mid-tone and self-contained artwork as any", () => {
    expect(classifyBrandSvg(svg(square('fill="#1877F2"'))).background).toBe("any");
    expect(classifyBrandSvg(svg(square('fill="#808080"'))).background).toBe("any");
    // Saturated bright colours are colourful, not light; pure yellow is light.
    expect(classifyBrandSvg(svg(square('fill="#42e8ca"'))).background).toBe("any");
    expect(classifyBrandSvg(svg(square('fill="#ffff00"'))).background).toBe("dark");
    // A tile (the first painted shape spans the artwork) carries its own contrast.
    expect(
      classifyBrandSvg(svg(`${square('fill="#000"')}<circle cx="12" cy="12" r="4" fill="#fff"/>`))
        .background,
    ).toBe("any");
    expect(
      classifyBrandSvg(
        svg('<circle cx="12" cy="12" r="12" fill="#1877F2"/><path d="M8 8h8v8H8z" fill="#fff"/>'),
      ).background,
    ).toBe("any");
    expect(classifyBrandSvg(svg('<image href="data:image/png;base64,AA=="/>')).background).toBe(
      "any",
    );
  });

  it("reads mixed artwork by its exposed extreme tone", () => {
    const wide = 'viewBox="0 0 64 16"';
    const mark = '<path d="M0 0h16v16H0z" fill="#0061fe"/>';
    // Dark text beside a coloured mark needs a light background, white text a dark one.
    expect(
      classifyBrandSvg(svg(`${mark}<path d="M20 2h44v12H20z" fill="#1e1919"/>`, wide)).background,
    ).toBe("light");
    expect(
      classifyBrandSvg(svg(`${mark}<path d="M20 2h44v12H20z" fill="#fff"/>`, wide)).background,
    ).toBe("dark");
    // White details on the mark, even in one path with several subpaths, are carried by it.
    expect(
      classifyBrandSvg(
        svg(
          `${mark}<path d="M20 2h44v12H20z" fill="#0061fe"/><path d="M4 4h8v8H4zM30 6h4v4h-4z" fill="#fff"/>`,
          wide,
        ),
      ).background,
    ).toBe("any");
    // A sliver of exposed white (under a fifth of the painted area) does not decide.
    expect(
      classifyBrandSvg(svg(`${mark}<path d="M18 0h2v2h-2z" fill="#fff"/>`, wide)).background,
    ).toBe("any");
  });

  it("follows gradients, stylesheets, inheritance and <use>", () => {
    const gradient =
      '<defs><linearGradient id="g"><stop stop-color="#fff"/><stop offset="1" stop-color="#eee"/></linearGradient></defs>';
    expect(classifyBrandSvg(svg(`${gradient}${square('fill="url(#g)"')}`))).toEqual({
      background: "dark",
      colors: ["#eeeeee", "#ffffff"],
    });
    expect(
      classifyBrandSvg(svg(`<style>.a{fill:#fff}.b:hover{fill:red}</style>${square('class="a"')}`)),
    ).toEqual({ background: "dark", colors: ["#ffffff"] });
    expect(classifyBrandSvg(svg(`<g fill="#fff">${square()}</g>`)).colors).toEqual(["#ffffff"]);
    expect(
      classifyBrandSvg(
        svg(`<symbol id="s">${square()}</symbol><use href="#s" fill="rgb(255, 255, 255)"/>`),
      ).colors,
    ).toEqual(["#ffffff"]);
    expect(
      classifyBrandSvg(svg(`<g color="#fff">${square('fill="currentColor"')}</g>`)).colors,
    ).toEqual(["#ffffff"]);
  });

  it("ignores masks, clip paths, hidden content and unreadable fallbacks", () => {
    const mask = '<mask id="m"><rect width="24" height="24" fill="white"/></mask>';
    expect(classifyBrandSvg(svg(`${mask}${square('fill="#000" mask="url(#m)"')}`))).toEqual({
      background: "light",
      colors: ["#000000"],
    });
    expect(
      classifyBrandSvg(svg(`${square('fill="#000"')}${square('fill="red" opacity="0"')}`)).colors,
    ).toEqual(["#000000"]);
    expect(
      classifyBrandSvg(svg(square('style="fill:#EBF0F0;fill:lab(95% 0 0);fill-opacity:1"'))),
    ).toEqual({ background: "dark", colors: ["#ebf0f0"] });
    expect(
      classifyBrandSvg(svg(square('style="fill:#000;fill:color(display-p3 1 1 1)"'))).colors,
    ).toEqual(["#ffffff"]);
  });
});

describe("validateBrandSvg", () => {
  it("accepts a plain logo, width/height without a viewBox, and local references", () => {
    expect(codes(svg(square('fill="#000"')))).toEqual([]);
    expect(codes(svg(square(), 'width="24" height="12.5px"'))).toEqual([]);
    expect(
      codes(
        svg(
          `<defs><linearGradient id="g"/></defs><use href="#p"/><path id="p" d="M0 0" fill="url(#g)"/>` +
            '<image href="data:image/png;base64,AA=="/><style>.a{fill:url(#g)}</style>',
        ),
      ),
    ).toEqual([]);
  });

  it("requires an <svg> root with a usable size", () => {
    expect(codes(svg(square(), ""))).toEqual(["QXB-SVG-002"]);
    expect(codes(svg(square(), 'viewBox="0 0 0 0"'))).toEqual(["QXB-SVG-002"]);
    expect(codes(svg(square(), 'viewBox="0 0 0 0" width="4" height="4"'))).toEqual(["QXB-SVG-008"]);
    expect(codes('<html xmlns="http://www.w3.org/1999/xhtml"/>')).toEqual(["QXB-SVG-001"]);
    expect(codes("<svg><path></svg>")).toEqual(["QXB-XML-001"]);
    const warning = validateBrandSvg('<svg viewBox="0 0 1 1"/>', "fixture.svg");
    expect(warning.map((entry) => [entry.code, entry.severity])).toEqual([
      ["QXB-SVG-007", "warning"],
    ]);
  });

  it("rejects script, event attributes and foreignObject", () => {
    expect(codes(svg("<script>alert(1)</script>"))).toEqual(["QXB-SVG-003"]);
    expect(codes(svg(square('onclick="alert(1)"')))).toEqual(["QXB-SVG-004"]);
    expect(codes(svg('<animate attributeName="onload" to="alert(1)"/>'))).toEqual(["QXB-SVG-004"]);
    expect(codes(svg("<foreignObject><div/></foreignObject>"))).toEqual(["QXB-SVG-005"]);
  });

  it("rejects references outside the file", () => {
    const xlink = 'xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24"';
    expect(codes(svg('<image href="https://example.com/logo.png"/>'))).toEqual(["QXB-SVG-006"]);
    expect(codes(svg('<use xlink:href="other.svg#a"/>', xlink))).toEqual(["QXB-SVG-006"]);
    expect(codes(svg('<a href="javascript:alert(1)"/>'))).toEqual(["QXB-SVG-006"]);
    expect(codes(svg(square('style="fill:url(https://example.com/p.svg#g)"')))).toEqual([
      "QXB-SVG-006",
    ]);
    expect(codes(svg(square('fill="url(paint.svg#g)"')))).toEqual(["QXB-SVG-006"]);
    expect(codes(svg('<style>@import url("https://example.com/a.css");</style>'))).toEqual([
      "QXB-SVG-006",
    ]);
    expect(codes(svg("<style>@import 'a.css';</style>"))).toEqual(["QXB-SVG-006"]);
    expect(codes(svg('<set attributeName="href" to="https://example.com"/>'))).toEqual([
      "QXB-SVG-006",
    ]);
    expect(codes(`<?xml-stylesheet href="https://example.com/a.css"?>${svg(square())}`)).toEqual([
      "QXB-SVG-006",
    ]);
  });

  it("allows W3C SVG DTDs and internal entities, and checks what the entities expand to", () => {
    const w3c =
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
    expect(codes(`<?xml version="1.0"?>\n${w3c}\n${svg(square())}`)).toEqual([]);
    const internal =
      '<!DOCTYPE svg [\n  <!ENTITY ns_svg "http://www.w3.org/2000/svg">\n  <!-- note -->\n]>';
    expect(codes(`${internal}<svg xmlns="&ns_svg;" viewBox="0 0 1 1">${square()}</svg>`)).toEqual(
      [],
    );
    const sneaky = '<!DOCTYPE svg [<!ENTITY link "https://example.com/x.png">]>';
    expect(codes(`${sneaky}${svg('<image href="&link;"/>')}`)).toEqual(["QXB-SVG-006"]);
  });

  it("rejects external entities, parameter entities and other external DTDs", () => {
    const external = '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>';
    expect(codes(`${external}${svg("<text>&x;</text>")}`)).toEqual(["QXB-XML-001", "QXB-XML-002"]);
    expect(codes(`<!DOCTYPE svg [<!ENTITY % p "x">]>${svg(square())}`)).toEqual(["QXB-XML-002"]);
    expect(codes(`<!DOCTYPE svg SYSTEM "https://example.com/svg.dtd">${svg(square())}`)).toEqual([
      "QXB-XML-002",
    ]);
  });
});

describe("readBrandRelease and brandsData", () => {
  const root = mkdtempSync(join(tmpdir(), "qeetrix-brands-test-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const black = svg(square('fill="#000"'));
  const white = svg(square('fill="#fff"'));
  const blue = svg(square('fill="#1877F2"'));
  const release = (files: Record<string, string>) => {
    const directory = mkdtempSync(join(root, "release-"));
    for (const [file, contents] of Object.entries(files)) writeFixture(directory, file, contents);
    return directory;
  };
  const manifest = [
    {
      slug: "acme",
      title: "Acme",
      aliases: ["acme inc"],
      hex: "fff",
      categories: ["Software"],
      variants: {
        default: "/icons/acme/color.svg",
        color: "/icons/acme/color.svg",
        mono: "/icons/acme/white.svg",
        wordmarkDark: "/icons/acme/wordmark-dark.svg",
        wordmarkLight: "/icons/acme/wordmark-light.svg",
      },
      license: "GPL-3.0",
      url: "https://acme.test",
      collection: "brands",
    },
    {
      slug: "1up",
      title: "1UP",
      aliases: [],
      hex: "000000",
      categories: [],
      variants: { default: "/icons/1up/default.svg" },
      license: "CC0-1.0",
      collection: "community",
    },
  ];
  const base = {
    "src/data/icons.json": JSON.stringify(manifest),
    "packages/thesvg/package.json": '{ "version": "9.9.9" }',
    "public/icons/acme/color.svg": blue,
    "public/icons/acme/default.svg": blue,
    "public/icons/acme/white.svg": white,
    "public/icons/acme/wordmark-dark.svg": black,
    "public/icons/acme/wordmarkLight.svg": white,
    "public/icons/acme/monoLobe.svg": black,
    "public/icons/1up/default.svg": black,
    "public/icons/one-up-copy/default.svg": black,
    "public/icons/stray/default.svg": white,
  };
  const commit = "c75313597b8bb14982e433ddae1b705813c66c7c";

  it("keeps every file, names variants from keys or stems, and records loose ends", () => {
    const result = readBrandRelease(release(base), commit);
    expect(result.packageVersion).toBe("9.9.9");
    expect(result.logos.map((logo) => logo.slug)).toEqual(["1up", "acme", "stray"]);
    const acme = result.logos.find((logo) => logo.slug === "acme");
    expect(acme?.defaultVariant).toBe("color");
    expect(
      acme?.variants.map(({ name, upstreamFile, upstreamKeys }) => [
        name,
        upstreamFile,
        upstreamKeys,
      ]),
    ).toEqual([
      ["color", "public/icons/acme/color.svg", ["color", "default"]],
      ["default", "public/icons/acme/default.svg", []],
      ["mono", "public/icons/acme/white.svg", ["mono"]],
      ["mono-lobe", "public/icons/acme/monoLobe.svg", []],
      ["wordmark-dark", "public/icons/acme/wordmark-dark.svg", ["wordmarkDark"]],
      ["wordmark-light", "public/icons/acme/wordmarkLight.svg", []],
    ]);
    expect(acme?.variants.find((variant) => variant.name === "mono")?.bytes.toString()).toBe(white);
    const stray = result.logos.find((logo) => logo.slug === "stray");
    expect(stray).toMatchObject({ listed: false, collection: "unlisted", licenseRaw: null });
    expect(result.skipped).toEqual([
      {
        item: "acme wordmarkLight",
        reason:
          "listed upstream as /icons/acme/wordmark-light.svg, but the release has no such file; " +
          "the folder's unlisted public/icons/acme/wordmarkLight.svg is kept as variant wordmark-light",
      },
      {
        item: "public/icons/one-up-copy",
        reason: "not in upstream's manifest and byte-identical to 1up",
      },
    ]);
  });

  it("keeps an unlisted folder that differs from its look-alike", () => {
    const result = readBrandRelease(
      release({ ...base, "public/icons/one-up-copy/default.svg": white }),
      commit,
    );
    expect(result.logos.map((logo) => logo.slug)).toContain("one-up-copy");
  });

  it("refuses two files that would share a variant name", () => {
    const directory = release({
      ...base,
      "public/icons/stray/wordmarkDark.svg": black,
      "public/icons/stray/wordmark-dark.svg": white,
    });
    expect(() => readBrandRelease(directory, commit)).toThrow(
      'both map to variant "wordmark-dark"',
    );
  });

  it("builds sorted, schema-valid data with licences, names and measured backgrounds", () => {
    const data = brandsData(readBrandRelease(release(base), commit), "2026-10-04");
    expect(data.collections).toEqual([
      { id: "brands", label: "Brands", count: 1 },
      { id: "community", label: "Community", count: 1 },
      { id: "unlisted", label: "Unlisted", count: 1 },
    ]);
    const acme = data.logos.acme;
    expect(acme).toMatchObject({
      componentName: "AcmeLogo",
      hex: "FFFFFF",
      license: "GPL-3.0-only",
      licenseRaw: "GPL-3.0",
      licenseClass: "copyleft",
      website: "https://acme.test",
      source: "https://thesvg.org/icon/acme",
    });
    expect(acme?.variants.mono).toEqual({
      file: "icons/brand-icons/brands/acme/mono.svg",
      background: "dark",
      colors: ["#ffffff"],
      upstreamKeys: ["mono"],
    });
    expect(data.logos["1up"]?.componentName).toBe("Brand1upLogo");
    expect(data.logos.stray?.license).toBe("NOASSERTION");
    expect(validateBrandsData(JSON.parse(renderBrandsJson(data))).diagnostics).toEqual([]);
    const rendered = JSON.parse(renderBrandsJson(data));
    expect(Object.keys(rendered)).toEqual([...Object.keys(rendered)].sort());
    expect(Object.keys(rendered.logos.acme)).toEqual([...Object.keys(rendered.logos.acme)].sort());
  });

  it("reports duplicate component names and misplaced files", () => {
    const data = JSON.parse(
      renderBrandsJson(brandsData(readBrandRelease(release(base), commit), "2026-10-04")),
    );
    data.logos.stray.componentName = "AcmeLogo";
    data.logos.acme.variants.mono.file = "icons/brand-icons/brands/acme/white.svg";
    expect(validateBrandsData(data).diagnostics.map((entry) => entry.code)).toEqual([
      "QXB-MAP-003",
      "QXB-NAME-001",
      "QXB-NAME-002",
    ]);
  });
});

describe("readArchiveInfo", () => {
  it("reads the commit and commit date from a git-archive tarball header", () => {
    const commit = "c75313597b8bb14982e433ddae1b705813c66c7c";
    const mtime = Date.UTC(2026, 9, 4, 20, 34, 47) / 1000;
    const record = `52 comment=${commit}\n`;
    const header = Buffer.alloc(512);
    header.write("pax_global_header", 0, "latin1");
    header.write(`${record.length.toString(8).padStart(11, "0")}\0`, 124, "latin1");
    header.write(`${mtime.toString(8).padStart(11, "0")}\0`, 136, "latin1");
    header.write("g", 156, "latin1");
    const body = Buffer.alloc(512);
    body.write(record, 0, "utf8");
    const archive = gzipSync(Buffer.concat([header, body, Buffer.alloc(1024)]));
    expect(readArchiveInfo(archive)).toEqual({ commit, date: "2026-10-04" });
  });
});

describe("first-party logos", () => {
  const upstream = (slug: string, collection = "brands") => ({
    title: slug,
    collection,
    componentName: brandComponentName(slug),
    defaultVariant: "default",
    variants: {
      default: {
        file: `icons/brand-icons/${collection}/${slug}/default.svg`,
        background: "light" as const,
        colors: ["#000000"],
        upstreamKeys: ["default"],
      },
    },
    hex: null,
    categories: [],
    aliases: [],
    license: "MIT",
    licenseRaw: "MIT",
    licenseClass: "permissive" as const,
    website: null,
    guidelines: null,
    source: `https://thesvg.org/icon/${slug}`,
  });
  const synced = {
    source: "https://github.com/glincker/thesvg",
    commit: "abc",
    packageVersion: "1.0.0",
    fetched: "2026-01-01",
    collections: [{ id: "brands", label: "Brands", count: 1 }],
    logos: { github: upstream("github") },
  };
  const qeet = {
    ...upstream("qeet"),
    license: "LicenseRef-Qeet",
    licenseRaw: "Proprietary.",
    licenseClass: "first-party" as const,
    firstParty: true as const,
  };

  it("picks only the entries marked firstParty", () => {
    expect(
      Object.keys(firstPartyBrandLogos({ logos: { github: upstream("github"), qeet } })),
    ).toEqual(["qeet"]);
    expect(firstPartyBrandLogos(undefined)).toEqual({});
  });

  it("carries first-party logos across a re-sync and recounts their collection", () => {
    const merged = withFirstPartyLogos(synced, { qeet });
    expect(Object.keys(merged.logos).sort()).toEqual(["github", "qeet"]);
    expect(merged.logos.qeet?.firstParty).toBe(true);
    expect(merged.collections).toEqual([{ id: "brands", label: "Brands", count: 2 }]);
  });

  it("refuses a first-party slug or component name that upstream also uses", () => {
    expect(() => withFirstPartyLogos(synced, { github: { ...qeet } })).toThrow(/clashes/);
    expect(() =>
      withFirstPartyLogos(synced, { "git-hub": { ...qeet, componentName: "GithubLogo" } }),
    ).toThrow(/share GithubLogo/);
  });

  it("is recorded for the Qeet logo, with a light and a dark file", () => {
    const repository = JSON.parse(
      readFileSync(join(PKG, "config/brands.json"), "utf8"),
    ) as BrandsConfigFile;
    const entry = repository.logos.qeet;
    expect(entry).toMatchObject({
      componentName: "QeetLogo",
      firstParty: true,
      licenseClass: "first-party",
      defaultVariant: "default",
    });
    expect(entry?.variants.default?.background).toBe("light");
    expect(entry?.variants.dark?.background).toBe("dark");
  });
});

type BrandsConfigFile = {
  logos: Record<
    string,
    {
      componentName: string;
      firstParty?: boolean;
      licenseClass: string;
      defaultVariant: string;
      variants: Record<string, { background: string }>;
    }
  >;
};

describe("repository brand logos", () => {
  // Lists ~13,400 files without reading them; `bun run check:brands` validates their content.
  it("lists exactly the files in icons/brand-icons/, in the documented layout", () => {
    const result = validateBrandsRepository(PKG, { content: false });
    expect(result.diagnostics).toEqual([]);
    expect(result.logoCount).toBeGreaterThan(0);
    expect(result.fileCount).toBeGreaterThanOrEqual(result.logoCount);
  }, 60_000);
});
