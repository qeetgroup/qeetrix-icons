import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateBrandSvg,
  validateBrandsData,
  validateBrandsRepository,
} from "../scripts/check/validate-brands.js";
import { brandComponentName, classifyBrandSvg } from "../scripts/lib/brands.js";

const PKG = join(import.meta.dirname, "..");
const svg = (content: string, attributes = 'viewBox="0 0 24 24"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${content}</svg>`;
const square = (attributes = "") => `<path d="M0 0h24v24H0z" ${attributes}/>`;
const codes = (source: string) =>
  validateBrandSvg(source, "fixture.svg").map((entry) => entry.code);

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

describe("validateBrandsData", () => {
  const variant = (slug: string, name = "default") => ({
    file: `icons/brand-icons/${slug}/${name}.svg`,
    background: "light",
    colors: ["#000000"],
  });
  const logo = (slug: string) => ({
    title: slug,
    collection: "brands",
    componentName: brandComponentName(slug),
    defaultVariant: "default",
    variants: { default: variant(slug) },
    hex: null,
    categories: [],
    aliases: [],
    license: "LicenseRef-Qeet",
    licenseRaw: "Proprietary.",
    licenseClass: "first-party",
    firstParty: true,
    website: null,
    guidelines: null,
    source: "https://qeet.in",
  });
  const data = (logos: Record<string, ReturnType<typeof logo>>) => ({
    collections: [{ id: "brands", label: "Brands", count: Object.keys(logos).length }],
    logos,
  });
  const codes = (value: unknown) =>
    validateBrandsData(value).diagnostics.map((entry) => entry.code);

  it("accepts first-party logos with no upstream pin", () => {
    expect(codes(data({ qeet: logo("qeet") }))).toEqual([]);
  });

  it("rejects a logo that is not first-party", () => {
    const { firstParty: _, ...thirdParty } = logo("github");
    const result = validateBrandsData(
      data({ github: { ...thirdParty, licenseClass: "permissive" } as never }),
    );
    expect(result.diagnostics.map((entry) => entry.message)).toContain(
      "logos.github.firstParty must be true: only first-party logos ship.",
    );
  });

  it("reports duplicate component names and misplaced files", () => {
    const value = data({ qeet: logo("qeet"), stray: logo("stray") });
    value.logos.stray.componentName = "QeetLogo";
    value.logos.qeet.variants.default.file = "icons/brand-icons/qeet/other.svg";
    expect(codes(value)).toEqual(["QXB-MAP-003", "QXB-NAME-001", "QXB-NAME-002"]);
  });
});

describe("first-party logos", () => {
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
  // Lists the files without reading them; `bun run check:brands` validates their content.
  it("lists exactly the files in icons/brand-icons/, in the documented layout", () => {
    const result = validateBrandsRepository(PKG, { content: false });
    expect(result.diagnostics).toEqual([]);
    expect(result.logoCount).toBeGreaterThan(0);
    expect(result.fileCount).toBeGreaterThanOrEqual(result.logoCount);
  }, 60_000);
});
