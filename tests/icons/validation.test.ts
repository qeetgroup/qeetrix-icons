import { describe, expect, it } from "vitest";
import { validateIcon } from "../../scripts/lib/rules.mjs";
import { parseSvg } from "../../scripts/lib/svg.mjs";
import { fixture, fixtureNames } from "../helpers.js";

/**
 * Which rule each invalid fixture is supposed to trip.
 *
 * Asserting the *specific* rule, not merely "some error", is the point: a
 * fixture that fails for an unrelated reason would otherwise give false
 * confidence that the rule it was written for still works.
 */
const EXPECTED: Record<string, string> = {
  attribute: "attribute",
  class: "class",
  "color-hex": "color",
  "color-named": "color",
  "color-oklch": "color",
  "color-rgb": "color",
  doctype: "doctype",
  "editor-metadata": "editor-metadata",
  "editor-metadata-ns": "editor-metadata",
  element: "element",
  empty: "empty",
  "external-reference": "external-reference",
  "fixed-dimensions": "fixed-dimensions",
  id: "id",
  "inline-style": "inline-style",
  "inline-style-attr": "inline-style",
  parse: "parse",
  "parse-not-svg": "parse",
  "parse-two-roots": "parse",
  "parse-unbalanced": "parse",
  raster: "raster",
  "root-spec": "root-spec",
  "text-content": "text-content",
  transform: "transform",
  "view-box": "view-box",
};

const validate = (kind: "valid" | "invalid", name: string) => {
  const icon = fixture(kind, name);
  return validateIcon(icon, parseSvg(icon.source));
};

describe("valid fixtures", () => {
  const names = fixtureNames("valid");

  it("has fixtures to check", () => {
    expect(names.length).toBeGreaterThan(0);
  });

  it.each(names)("%s passes with no errors", (name) => {
    const { errors } = validate("valid", name);
    expect(errors.map((e) => `${e.rule}: ${e.message}`)).toEqual([]);
  });
});

describe("invalid fixtures", () => {
  const names = fixtureNames("invalid");

  // Guards the pair of directories against drift: a new fixture with no
  // declared expectation, or an expectation whose fixture was deleted.
  it("every fixture has a declared expected rule", () => {
    expect(names).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(names)("%s is rejected by the expected rule", (name) => {
    const { errors } = validate("invalid", name);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.map((e) => e.rule)).toContain(EXPECTED[name]);
  });
});

describe("error reporting", () => {
  it("names the offending file", () => {
    const { errors } = validate("invalid", "view-box");
    expect(errors[0].file).toBe("tests/fixtures/invalid/view-box.svg");
  });

  it("reports what it found, not just what it wanted", () => {
    const { errors } = validate("invalid", "view-box");
    const viewBox = errors.find((e) => e.rule === "view-box");
    expect(viewBox?.message).toContain('"0 0 24 24"');
    expect(viewBox?.message).toContain('"0 0 32 32"');
  });

  it("collects every error rather than stopping at the first", () => {
    // `fixed-dimensions` sets both width and height.
    const { errors } = validate("invalid", "fixed-dimensions");
    expect(errors.filter((e) => e.rule === "fixed-dimensions")).toHaveLength(2);
  });
});

describe("colour is validated by allowlist", () => {
  // The reason hex/rgb/hsl/oklch/named colours are all caught without any of
  // them being enumerated in the rule set.
  it.each(["#f26d0e", "rgb(0 0 0)", "hsl(20 100% 50%)", "oklch(0.7 0.1 40)", "rebeccapurple"])(
    "rejects stroke=%s",
    (value) => {
      const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16" stroke="${value}" /></svg>`;
      const icon = { name: "probe", category: "interface", file: "probe.svg", source };
      const { errors } = validateIcon(icon, parseSvg(source));
      expect(errors.map((e) => e.rule)).toContain("color");
    },
  );

  it.each(["none", "currentColor", "inherit", "transparent"])("accepts stroke=%s", (value) => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16" stroke="${value}" /></svg>`;
    const icon = { name: "probe", category: "interface", file: "probe.svg", source };
    const { errors } = validateIcon(icon, parseSvg(source));
    expect(errors).toEqual([]);
  });
});
