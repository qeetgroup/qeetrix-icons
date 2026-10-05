import { describe, expect, it } from "vitest";
import { deriveFilled, pathDataArea } from "../scripts/lib/filled.js";
import { syntheticSvg } from "./helpers.js";

const outline = (content: string) => syntheticSvg({}, content);
const pathOf = (svg: string) => {
  const match = svg.match(/ d="([^"]+)"(?: fill-rule="(evenodd)")?/);
  if (!match) throw new Error("No path in derived drawing.");
  return { d: match[1], rule: (match[2] ?? "nonzero") as "nonzero" | "evenodd" };
};
const areaOf = async (svg: string) => {
  const { d, rule } = pathOf(svg);
  return pathDataArea(d, rule);
};

describe("deriveFilled", () => {
  it("fills a closed shape to the outline's painted extent", async () => {
    const { svg, roles } = await deriveFilled(outline('<circle cx="12" cy="12" r="10"/>'));
    expect(roles).toEqual(["fill"]);
    expect(svg).toMatch(/^<!-- Derived from the outline by `bun run derive:filled`\./);
    expect(svg).toContain('viewBox="0 0 24 24" fill="currentColor">');
    // Interior plus half the 2-unit stroke: a disc of radius 11.
    expect(await areaOf(svg)).toBeCloseTo(Math.PI * 11 ** 2, 0);
  });

  it("keeps small circles round rather than fitting them with a few coarse curves", async () => {
    // Skia fits strokes to a pixel tolerance; at 1× a radius-3 ring came out as a rounded square.
    const { svg } = await deriveFilled(outline('<circle cx="12" cy="12" r="3"/>'));
    const area = await areaOf(svg);
    expect(Math.abs(area - Math.PI * 4 ** 2) / (Math.PI * 4 ** 2)).toBeLessThan(0.002);
  });

  it("cuts details inside a body as negative lines", async () => {
    const source = outline('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>');
    const { svg, roles } = await deriveFilled(source);
    expect(roles).toEqual(["fill", "cut"]);
    const disc = Math.PI * 11 ** 2;
    const area = await areaOf(svg);
    expect(area).toBeLessThan(disc - 10);
    expect(area).toBeGreaterThan(disc - 25);
  });

  it("cuts a solid dot whole, leaving no speck in the hole", async () => {
    const source = outline(
      '<rect x="3" y="3" width="18" height="18"/><circle cx="12" cy="12" r=".5" fill="currentColor"/>',
    );
    const { svg, roles } = await deriveFilled(source);
    expect(roles).toEqual(["fill", "cut"]);
    // A 20×20 body with round joins, minus a disc of radius 1.5.
    const body = 18 * 18 + 4 * 18 + Math.PI;
    expect(await areaOf(svg)).toBeCloseTo(body - Math.PI * 1.5 ** 2, 0);
  });

  it("keeps an attached handle a line instead of filling its chord", async () => {
    const lock = outline(
      '<rect x="3" y="11" width="18" height="11"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    );
    expect((await deriveFilled(lock)).roles).toEqual(["fill", "stroke"]);
  });

  it("joins a connector between bodies, and gaps a line crossing a body", async () => {
    const nodes = outline(
      '<circle cx="5" cy="12" r="3"/><circle cx="19" cy="12" r="3"/><path d="M8 12h8"/>',
    );
    expect((await deriveFilled(nodes)).roles).toEqual(["fill", "fill", "stroke"]);
    const slashed = outline('<rect x="5" y="5" width="14" height="14"/><path d="m2 2 20 20"/>');
    expect((await deriveFilled(slashed)).roles).toEqual(["fill", "gap"]);
  });

  it("applies listed roles, cutting details in a front body after placing it", async () => {
    const copy = outline(
      '<path d="m12 15 2 2 4-4"/><rect width="14" height="14" x="8" y="8"/><path d="M4 16V4h12"/>',
    );
    const { svg, roles } = await deriveFilled(copy, { roles: { 1: "front", 2: "stroke" } });
    expect(roles).toEqual(["cut", "front", "stroke"]);
    const front = 16 * 16 - 4 + Math.PI;
    expect(await areaOf(svg)).toBeLessThan(front + 2 * 14 + 2 * 12);
  });

  it("rejects a role for an element that does not exist", async () => {
    await expect(
      deriveFilled(outline('<circle cx="12" cy="12" r="10"/>'), { roles: { 3: "fill" } }),
    ).rejects.toThrow("recipe role for element 3 out of range");
  });

  it("is deterministic", async () => {
    const source = outline(
      '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    );
    expect((await deriveFilled(source)).svg).toBe((await deriveFilled(source)).svg);
  });
});
