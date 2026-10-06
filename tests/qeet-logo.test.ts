import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decodeSvgDataUri } from "../scripts/lib/logo-source.js";
import { QeetLogo, QeetWordmarkLogo } from "../src/index.js";
import { logoManifest } from "../src/manifest.js";

const PKG = join(import.meta.dirname, "..");
const file = (variant: string, slug = "qeet") =>
  readFileSync(join(PKG, `icons/brand-icons/brands/${slug}/${variant}.svg`));
/** The `src` attribute, HTML-unescaped the way the other logo tests read it. */
const src = (markup: string) =>
  (/ src="([^"]*)"/.exec(markup)?.[1] ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

describe("QeetLogo", () => {
  it("is in the catalogue as first-party, with a light-surface and a dark-surface file", () => {
    const entry = logoManifest.logos.find(({ id }) => id === "qeet");
    expect(entry).toMatchObject({
      componentName: "QeetLogo",
      title: "Qeet",
      collection: "brands",
      defaultVariant: "default",
      license: "LicenseRef-Qeet",
      hex: "F26D0E",
    });
    expect(entry?.variants).toEqual([
      { name: "default", background: "light" },
      { name: "dark", background: "dark" },
    ]);
  });

  it("renders the light-surface artwork by default and the dark-surface artwork on request", () => {
    const light = renderToStaticMarkup(createElement(QeetLogo));
    const dark = renderToStaticMarkup(createElement(QeetLogo, { variant: "dark" }));
    expect(Buffer.from(decodeSvgDataUri(src(light))).equals(file("default"))).toBe(true);
    expect(Buffer.from(decodeSvgDataUri(src(dark))).equals(file("dark"))).toBe(true);
    // the bowl is graphite on light surfaces and near-white on dark ones; the orange is the same
    expect(file("default").toString()).toContain('fill="#0A0A0A"');
    expect(file("dark").toString()).toContain('fill="#FFFFFF"');
    for (const variant of ["default", "dark"]) {
      expect(file(variant).toString()).toContain('fill="#F26D0E"');
    }
  });

  it("is decorative by default and named by aria-label", () => {
    const decorative = renderToStaticMarkup(createElement(QeetLogo));
    expect(decorative).toContain('alt=""');
    expect(decorative).toContain('aria-hidden="true"');
    const named = renderToStaticMarkup(createElement(QeetLogo, { "aria-label": "Qeet" }));
    expect(named).toContain('alt="Qeet"');
    expect(named).not.toContain("aria-hidden");
  });

  it("sizes from height like every logo, keeping the artwork's square ratio", () => {
    const markup = renderToStaticMarkup(createElement(QeetLogo, { height: 32 }));
    expect(markup).toContain('height="32"');
    expect(markup).toContain('width="32"');
  });
});

describe("QeetWordmarkLogo", () => {
  const wordmark = (variant: string) => file(variant, "qeet-wordmark").toString();

  it("is in the catalogue as first-party, with tiled and plain files for light and dark surfaces", () => {
    const entry = logoManifest.logos.find(({ id }) => id === "qeet-wordmark");
    expect(entry).toMatchObject({
      componentName: "QeetWordmarkLogo",
      title: "Qeet wordmark",
      collection: "brands",
      defaultVariant: "default",
      license: "LicenseRef-Qeet",
    });
    expect(entry?.variants.map(({ name }) => name)).toEqual([
      "default",
      "dark",
      "plain",
      "plain-dark",
    ]);
    const config = JSON.parse(readFileSync(join(PKG, "config/brands.json"), "utf8")) as {
      logos: Record<string, { firstParty?: boolean; licenseClass: string }>;
    };
    for (const slug of ["qeet", "qeet-wordmark"]) {
      expect(config.logos[slug]).toMatchObject({ firstParty: true, licenseClass: "first-party" });
    }
  });

  it("embeds each file byte for byte", () => {
    for (const variant of ["default", "dark", "plain", "plain-dark"] as const) {
      const markup = renderToStaticMarkup(createElement(QeetWordmarkLogo, { variant }));
      expect(
        Buffer.from(decodeSvgDataUri(src(markup))).equals(file(variant, "qeet-wordmark")),
      ).toBe(true);
    }
  });

  it("is a dark tile for light surfaces and a white tile for dark ones, with the Qeet stop", () => {
    // default: graphite tile, white letters; dark: white tile, graphite letters
    expect(wordmark("default")).toMatch(/<rect [^>]*fill="#0A0A0A"/);
    expect(wordmark("default")).toContain('<path fill="#FFFFFF"');
    expect(wordmark("dark")).toMatch(/<rect [^>]*fill="#FFFFFF"/);
    expect(wordmark("dark")).toContain('<path fill="#0A0A0A"');
    for (const variant of ["default", "dark", "plain", "plain-dark"]) {
      expect(wordmark(variant)).toContain('<path fill="#F26D0E"');
      // outlined artwork: no font, no text, no external references
      expect(wordmark(variant)).not.toMatch(/<text|font-family|href=/);
    }
  });

  it("has plain files without the tile: graphite letters for light surfaces, white for dark", () => {
    for (const variant of ["plain", "plain-dark"]) expect(wordmark(variant)).not.toContain("<rect");
    expect(wordmark("plain")).toContain('<path fill="#0A0A0A"');
    expect(wordmark("plain-dark")).toContain('<path fill="#FFFFFF"');
    // only the ink changes between the two: the letter outlines are identical
    const letters = (svg: string) => /<path fill="#(?:0A0A0A|FFFFFF)" d="([^"]*)"/.exec(svg)?.[1];
    expect(letters(wordmark("plain"))).toBe(letters(wordmark("plain-dark")));
  });

  it("keeps each file's aspect ratio when sized by height", () => {
    const ratio = (variant: "default" | "plain") => {
      const markup = renderToStaticMarkup(createElement(QeetWordmarkLogo, { variant, height: 40 }));
      expect(markup).toContain('height="40"');
      return Number(/ width="([\d.]+)"/.exec(markup)?.[1]) / 40;
    };
    expect(ratio("default")).toBeCloseTo(2773 / 1006, 2);
    expect(ratio("plain")).toBeCloseTo(2403 / 793, 2);
  });
});
