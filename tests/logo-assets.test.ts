import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DOMParser, type Element } from "@xmldom/xmldom";
import CanvasKitInit, { type CanvasKit } from "canvaskit-wasm";
import { beforeAll, describe, expect, it } from "vitest";
import { validateBrandSvg } from "../scripts/check/validate-brands.js";
import { childElements, classifyBrandSvg, localName } from "../scripts/lib/brands.js";
import {
  deriveMaskFreeSvg,
  logoSvgPath,
  MaskFreeError,
  maskFreeLogoSvgPath,
  renderLogoPackageFiles,
} from "../scripts/lib/logo-assets.js";
import { planLogoGeneration } from "../scripts/lib/logo-plan.js";
import { logoManifest } from "../src/manifest.js";

const PKG = join(import.meta.dirname, "..");
const brandFile = (slug: string, variant: string) => `icons/brand-icons/${slug}/${variant}.svg`;
const read = (file: string) => readFileSync(join(PKG, file), "utf8");
const parse = (source: string) =>
  new DOMParser().parseFromString(source, "application/xml").documentElement as Element;
const flat = (value: string) => value.replace(/\s+/g, " ").trim();

/** Every element that paints where it stands: outside `<defs>` and `<mask>`, and not metadata. */
function rendered(root: Element): Element[] {
  return childElements(root).flatMap((element) =>
    ["defs", "mask", "title", "desc"].includes(localName(element))
      ? []
      : [element, ...rendered(element)],
  );
}

const attributes = (element: Element, except: readonly string[] = []) =>
  Array.from(element.attributes)
    .filter(({ name }) => !except.includes(name))
    .map(({ name, value }) => [name, flat(value)]);

let CK: CanvasKit;
beforeAll(async () => {
  CK = await CanvasKitInit();
});

describe("package logo files", () => {
  it("ships every logo file byte for byte, and a mask-free file beside each drawn with a mask", async () => {
    const plan = planLogoGeneration(PKG);
    expect(plan.diagnostics).toEqual([]);
    const files = await renderLogoPackageFiles(plan);
    const asDrawn = logoManifest.logos.flatMap(({ id, variants }) =>
      variants.map(({ name }) => ({ id, name, path: logoSvgPath(id, name) })),
    );
    const masked = asDrawn.filter(({ id, name }) => read(brandFile(id, name)).includes("<mask"));
    expect(masked.map(({ id, name }) => `${id}/${name}`)).toEqual(["qeet/default", "qeet/dark"]);
    expect(files.map(({ path }) => path)).toEqual(
      [
        ...asDrawn.map(({ path }) => path),
        ...masked.map(({ id, name }) => maskFreeLogoSvgPath(id, name)),
      ].sort(),
    );
    for (const { id, name, path } of asDrawn) {
      const file = files.find((candidate) => candidate.path === path);
      expect(
        Buffer.from(file?.contents ?? "").equals(readFileSync(join(PKG, brandFile(id, name)))),
        path,
      ).toBe(true);
    }
    expect(logoSvgPath("qeet-wordmark", "plain-dark")).toBe(
      "svg/logos/qeet-wordmark/plain-dark.svg",
    );
    expect(maskFreeLogoSvgPath("qeet", "dark")).toBe("svg/logos/qeet/dark.mask-free.svg");
  });
});

describe.each(["default", "dark"])("the Qeet mark's %s file without its mask", (variant) => {
  const file = brandFile("qeet", variant);
  const source = read(file);
  let derived = "";
  beforeAll(async () => {
    derived = (await deriveMaskFreeSvg(source, file)) ?? "";
  });

  it("has no mask, mask reference, or definitions left", () => {
    expect(source).toContain('mask="url(#qBowlHole)"');
    expect(derived).not.toMatch(/<mask\b|\bmask=|<defs\b|url\(/);
  });

  it("keeps every painted element as drawn, in order, minus its mask attribute", () => {
    const original = parse(source);
    const result = parse(derived);
    expect(attributes(result)).toEqual(attributes(original));
    expect(result.getElementsByTagName("title")[0]?.textContent).toBe("Qeet");
    const before = rendered(original);
    const after = rendered(result);
    expect(after.map((element) => element.tagName)).toEqual(before.map(({ tagName }) => tagName));
    after.forEach((element, index) => {
      expect(attributes(element)).toEqual(attributes(before[index] as Element, ["mask"]));
    });
  });

  it("loses nothing to the mask: no pixel centre at 1254 px lies in both the bowl and its hole", () => {
    // An aliased rendering paints exactly the pixels whose centres lie inside a shape, so this is
    // the masked and the mask-free rasterization compared pixel for pixel at the artwork's size.
    const original = parse(source);
    const bowl = rendered(original).find((element) => element.getAttribute("mask") !== null);
    const hole = original.getElementsByTagName("mask")[0]?.getElementsByTagName("path")[0];
    const bowlPath = CK.Path.MakeFromSVGString(bowl?.getAttribute("d") ?? "");
    const holePath = CK.Path.MakeFromSVGString(hole?.getAttribute("d") ?? "");
    if (!bowlPath || !holePath) throw new Error("unreadable path data");
    let inBowl = 0;
    let inHole = 0;
    let both = 0;
    for (let y = 0.5; y < 1254; y += 1) {
      for (let x = 0.5; x < 1254; x += 1) {
        const b = bowlPath.contains(x, y);
        const h = holePath.contains(x, y);
        if (b) inBowl += 1;
        if (h) inHole += 1;
        if (b && h) both += 1;
      }
    }
    bowlPath.delete();
    holePath.delete();
    expect(inBowl).toBeGreaterThan(100_000);
    expect(inHole).toBeGreaterThan(100_000);
    expect(both).toBe(0);
  }, 60_000);

  it("is a valid, self-contained logo file that paints the same colours on the same surface", () => {
    expect(validateBrandSvg(derived, file).filter(({ severity }) => severity === "error")).toEqual(
      [],
    );
    expect(classifyBrandSvg(derived)).toEqual(classifyBrandSvg(source));
  });
});

describe("mask-free derivation", () => {
  const svg = (mask: string, masked = '<path mask="url(#m)" fill="#F26D0E" d="M0 0H24V24H0Z"/>') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><mask id="m" maskUnits="userSpaceOnUse">${mask}</mask></defs>${masked}</svg>`;
  const pathOf = (derived: string | undefined) => {
    const element = parse(derived ?? "").getElementsByTagName("path")[0];
    const path = CK.Path.MakeFromSVGString(element?.getAttribute("d") ?? "");
    if (!path) throw new Error("unreadable path data");
    if (element?.getAttribute("fill-rule") === "evenodd") path.setFillType(CK.FillType.EvenOdd);
    return path;
  };
  const inside = (derived: string | undefined, points: readonly [number, number][]) => {
    const path = pathOf(derived);
    const result = points.map(([x, y]) => path.contains(x, y));
    path.delete();
    return result;
  };

  it("leaves a file without a mask alone", async () => {
    expect(await deriveMaskFreeSvg(read(brandFile("qeet-wordmark", "default")), "x.svg")).toBe(
      undefined,
    );
  });

  it("cuts a hole the drawing does not already leave open, and keeps the rest", async () => {
    const derived = await deriveMaskFreeSvg(
      svg(
        '<rect width="24" height="24" fill="#fff"/><rect x="8" y="8" width="8" height="8" fill="#000"/>',
      ),
      "hole.svg",
    );
    expect(derived).not.toMatch(/mask|<defs/);
    expect(derived).toContain('fill="#F26D0E"');
    expect(
      inside(derived, [
        [2, 2],
        [22, 12],
        [12, 12],
        [9, 15],
      ]),
    ).toEqual([true, true, false, false]);
  });

  it("paints white and black in order, unpainted mask cutting, within the mask's region", async () => {
    const derived = await deriveMaskFreeSvg(
      svg(
        '<rect width="24" height="24" fill="white"/><rect x="4" y="4" width="16" height="16" fill="#000000"/><path d="M10 10H14V14H10Z" fill="#FFF"/>',
      ),
      "rings.svg",
    );
    expect(
      inside(derived, [
        [2, 2],
        [6, 6],
        [12, 12],
      ]),
    ).toEqual([true, false, true]);
    const unpainted = await deriveMaskFreeSvg(
      svg('<rect width="12" height="24" fill="#fff"/>'),
      "half.svg",
    );
    expect(
      inside(unpainted, [
        [6, 12],
        [18, 12],
      ]),
    ).toEqual([true, false]);
    const region = await deriveMaskFreeSvg(
      svg('<rect width="24" height="24" fill="#fff"/>').replace(
        'maskUnits="userSpaceOnUse"',
        'maskUnits="userSpaceOnUse" x="0" y="0" width="50%" height="100%"',
      ),
      "region.svg",
    );
    expect(
      inside(region, [
        [6, 12],
        [18, 12],
      ]),
    ).toEqual([true, false]);
  });

  it("cuts under the fill rule the path inherits", async () => {
    // Two nested squares under an inherited evenodd: a frame, whose open centre a mask cutting
    // the centre leaves as it is.
    const frame =
      '<g fill-rule="evenodd"><path mask="url(#m)" fill="#F26D0E" d="M0 0H24V24H0Z M6 6H18V18H6Z"/></g>';
    const untouched = await deriveMaskFreeSvg(
      svg(
        '<rect width="24" height="24" fill="#fff"/><rect x="8" y="8" width="8" height="8" fill="#000"/>',
        frame,
      ),
      "frame.svg",
    );
    expect(untouched).toContain('d="M0 0H24V24H0Z M6 6H18V18H6Z"');
    expect(untouched).not.toContain("mask");
  });

  it("keeps the geometry as drawn when the mask cuts nothing from it", async () => {
    const derived = await deriveMaskFreeSvg(
      svg(
        '<rect width="24" height="24" fill="#fff"/><rect x="30" y="30" width="2" height="2" fill="#000"/>',
        '<path mask="url(#m)" fill="#F26D0E" d="M 2 2 H 10 V 10 H 2 Z"/>',
      ),
      "untouched.svg",
    );
    expect(derived).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n  <path fill="#F26D0E" d="M 2 2 H 10 V 10 H 2 Z"/>\n</svg>\n',
    );
  });

  it.each([
    ["a grey mask", svg('<rect width="24" height="24" fill="#808080"/>'), "not white or black"],
    ["mask opacity", svg('<rect width="24" height="24" fill="#fff" opacity="0.5"/>'), "opacity="],
    [
      "a transformed mask shape",
      svg('<rect width="24" height="24" fill="#fff" transform="scale(2)"/>'),
      "transform=",
    ],
    [
      "a circle in the mask",
      svg('<circle cx="12" cy="12" r="6" fill="#fff"/>'),
      "only <path> and <rect>",
    ],
    [
      "a bounding-box mask",
      svg('<rect width="24" height="24" fill="#fff"/>').replace(' maskUnits="userSpaceOnUse"', ""),
      "maskUnits",
    ],
    [
      "an alpha mask",
      svg('<rect width="24" height="24" fill="#fff"/>').replace(
        'maskUnits="userSpaceOnUse"',
        'maskUnits="userSpaceOnUse" mask-type="alpha"',
      ),
      "mask-type",
    ],
    [
      "a masked circle",
      svg(
        '<rect width="24" height="24" fill="#fff"/>',
        '<circle mask="url(#m)" cx="12" cy="12" r="6"/>',
      ),
      "only a masked <path>",
    ],
    [
      "a transformed masked path",
      svg(
        '<rect width="24" height="24" fill="#fff"/>',
        '<g transform="scale(2)"><path mask="url(#m)" d="M0 0H4V4H0Z"/></g>',
      ),
      "transform=",
    ],
    [
      "a missing mask",
      svg(
        '<rect width="24" height="24" fill="#fff"/>',
        '<path mask="url(#other)" d="M0 0H4V4H0Z"/>',
      ),
      "is no <mask>",
    ],
    [
      "a stylesheet",
      svg('<rect width="24" height="24" fill="#fff"/>').replace(
        "<defs>",
        "<style>path{mask:none}</style><defs>",
      ),
      "<style>",
    ],
    [
      "a CSS mask",
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path style="mask:url(#m)" d="M0 0H4V4H0Z"/></svg>',
      "CSS mask",
    ],
  ])(
    "refuses %s rather than ship a drawing that renders differently",
    async (_, source, message) => {
      await expect(deriveMaskFreeSvg(source, "refused.svg")).rejects.toThrow(MaskFreeError);
      await expect(deriveMaskFreeSvg(source, "refused.svg")).rejects.toThrow(message);
    },
  );
});
