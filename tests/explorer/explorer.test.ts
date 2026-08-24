import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { icons } from "../../src/metadata.js";
import { PKG } from "../helpers.js";

/**
 * The explorer, tested as the artifact it ships as.
 *
 * This loads the real generated `index.html` into jsdom and executes its inline
 * script, so what is under test is the file a developer opens — not a re-import
 * of its parts. That is the only way to catch the failures that matter here: a
 * control that renders but is never wired up, a dialog that opens without moving
 * focus, a filter that silently returns everything.
 *
 * Skips rather than fails when the file is absent, because `bun run explorer`
 * produces it and CI runs that before the suite.
 *
 * One caveat worth stating plainly: jsdom 29 does not implement
 * `HTMLDialogElement.showModal()`, so `makeDom` installs a minimal stand-in that
 * only toggles `open` and fires `close`. That means these tests verify *our*
 * dialog wiring — that it opens, moves focus, deep-links and restores focus —
 * but **not** the browser-native modal behaviour it relies on (backdrop, focus
 * trap, Escape to dismiss). Those come from `<dialog>` itself and are unverified
 * here.
 */

const HTML = join(PKG, ".explorer/index.html");
const built = existsSync(HTML);

let dom: JSDOM;
let doc: Document;
let win: Window & typeof globalThis;

/**
 * Build a DOM from the real explorer, with a `<dialog>` stand-in installed
 * before the page's own script runs.
 */
function makeDom(url: string) {
  return new JSDOM(readFileSync(HTML, "utf8"), {
    runScripts: "dangerously",
    url,
    pretendToBeVisual: true,
    beforeParse(w) {
      const proto = w.HTMLDialogElement?.prototype as
        | (HTMLDialogElement & { showModal?: () => void; close?: () => void })
        | undefined;
      if (!proto) return;
      if (typeof proto.showModal !== "function") {
        proto.showModal = function (this: HTMLDialogElement) {
          this.setAttribute("open", "");
        };
      }
      if (typeof proto.close !== "function") {
        proto.close = function (this: HTMLDialogElement) {
          if (!this.hasAttribute("open")) return;
          this.removeAttribute("open");
          this.dispatchEvent(new w.Event("close"));
        };
      }
    },
  });
}

const q = <T extends Element>(selector: string) => doc.querySelector<T>(selector);
const all = (selector: string) => [...doc.querySelectorAll(selector)];
const cells = () => all(".cell").map((c) => (c as HTMLElement).dataset.name);
const type = (value: string) => {
  const input = q<HTMLInputElement>("#q");
  if (!input) throw new Error("no search input");
  input.value = value;
  input.dispatchEvent(new win.Event("input", { bubbles: true }));
};
const click = (selector: string) => {
  const node = q<HTMLElement>(selector);
  if (!node) throw new Error(`no ${selector}`);
  node.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
};

beforeAll(() => {
  if (!built) return;
  dom = makeDom("https://example.test/explorer");
  win = dom.window as unknown as Window & typeof globalThis;
  doc = win.document;
});

afterAll(() => dom?.window.close());

describe.skipIf(!built)("explorer", () => {
  describe("boot", () => {
    it("renders one cell per icon", () => {
      expect(cells()).toHaveLength(icons.length);
    });

    it("reports the catalogue size and the mirror count", () => {
      expect(q("#total")?.textContent).toBe(String(icons.length));
      expect(Number(q("#mirrorcount")?.textContent)).toBe(icons.filter((i) => i.mirror).length);
    });

    it("populates the category filter from the real categories", () => {
      const options = all("#cat option").map((o) => (o as HTMLOptionElement).value);
      const categories = [...new Set(icons.map((i) => i.category))];
      expect(options).toContain("");
      for (const category of categories) expect(options).toContain(category);
    });

    it("offers every documented preview size", () => {
      const sizes = all("#size option").map((o) => (o as HTMLOptionElement).value);
      expect(sizes).toEqual(["16", "20", "24", "32", "48", "64"]);
    });

    it("inlines the icon geometry rather than linking to files", () => {
      const svg = q(".cell svg");
      expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(svg?.getAttribute("stroke")).toBe("currentColor");
      expect(svg?.children.length).toBeGreaterThan(0);
    });
  });

  describe("search", () => {
    it("filters and ranks as you type", () => {
      type("shield");
      const result = cells();
      expect(result[0]).toBe("shield");
      expect(result.every((n) => n?.includes("shield") || n === "vault")).toBeTruthy();
    });

    it("finds icons by alias", () => {
      type("delete");
      expect(cells()[0]).toBe("trash");
    });

    it("finds icons by tag", () => {
      type("find");
      expect(cells()[0]).toBe("search");
    });

    it("shows an empty state with a usable hint", () => {
      type("zzzznope");
      expect(cells()).toHaveLength(0);
      expect(q<HTMLElement>("#empty")?.hidden).toBe(false);
      expect(q("#empty")?.textContent).toContain("alias");
    });

    it("announces the result count to screen readers", () => {
      type("shield");
      expect(q("#live")?.textContent).toMatch(/^\d+ icons match$/);
    });

    it("resets every control", () => {
      type("shield");
      click("#mirror");
      click("#reset");
      expect(q<HTMLInputElement>("#q")?.value).toBe("");
      expect(q("#mirror")?.getAttribute("aria-pressed")).toBe("false");
      expect(cells()).toHaveLength(icons.length);
    });
  });

  describe("filters", () => {
    it("narrows by category", () => {
      const select = q<HTMLSelectElement>("#cat");
      if (!select) throw new Error("no category filter");
      select.value = "security";
      select.dispatchEvent(new win.Event("input", { bubbles: true }));
      const expected = icons.filter((i) => i.category === "security").length;
      expect(cells()).toHaveLength(expected);
      select.value = "";
      select.dispatchEvent(new win.Event("input", { bubbles: true }));
    });

    it("narrows by mirror", () => {
      click("#mirror");
      expect(cells()).toHaveLength(icons.filter((i) => i.mirror).length);
      click("#mirror");
    });

    it("toggles list view and reports the new state on the button", () => {
      click("#view");
      expect(q("#grid")?.className).toContain("list");
      expect(q("#view")?.getAttribute("aria-pressed")).toBe("true");
      expect(q("#view")?.textContent).toBe("Grid view");
      click("#view");
      expect(q("#grid")?.className).not.toContain("list");
    });

    it("toggles the dark preview without touching icon colour", () => {
      click("#bg");
      expect(q("#grid")?.className).toContain("on-dark");
      // The icons still inherit; nothing hard-codes a colour.
      expect(q(".cell svg")?.getAttribute("stroke")).toBe("currentColor");
      click("#bg");
      expect(q("#grid")?.className).toContain("on-light");
    });
  });

  describe("icon detail", () => {
    it("opens on click and shows the full metadata", () => {
      click("#reset");
      const cell = q<HTMLElement>('.cell[data-name="shield-tick"]');
      cell?.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
      expect(q("#dcomp")?.textContent).toBe("ShieldTick");
      expect(q("#dname")?.textContent).toBe("shield-tick");
      expect(q("#dcat")?.textContent).toBe("security");
      expect(q("#dpri")?.textContent).toMatch(/^P[0-3]$/);
      expect(q("#dmirror")?.textContent).toContain("not mirror");
      expect(q("#dalias")?.textContent).toContain("verified");
    });

    it("previews at all six sizes", () => {
      const sizes = all("#dsizes svg").map((s) => s.getAttribute("width"));
      expect(sizes).toEqual(["16", "20", "24", "32", "48", "64"]);
    });

    it("offers copyable import, JSX and component name", () => {
      expect(q("#dimport")?.textContent).toBe('import { ShieldTick } from "@qeetrix/icons";');
      expect(q("#dusage")?.textContent).toBe('<ShieldTick size={20} aria-hidden="true" />');
      expect(q("#dcname")?.textContent).toBe("ShieldTick");
      expect(all("[data-copy]")).toHaveLength(3);
    });

    it("moves focus into the dialog when it opens", () => {
      expect(doc.activeElement?.id).toBe("dclose");
    });

    it("deep-links the open icon into the URL", () => {
      expect(win.location.hash).toContain("icon=shield-tick");
    });

    it("lets a tag be clicked to search for it", () => {
      const tag = q<HTMLElement>("#dtags .tag");
      const term = tag?.dataset.term;
      tag?.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
      expect(q<HTMLInputElement>("#q")?.value).toBe(term);
    });

    it("closes and clears the icon from the URL", () => {
      click("#reset");
      q<HTMLElement>('.cell[data-name="user"]')?.dispatchEvent(
        new win.MouseEvent("click", { bubbles: true }),
      );
      expect(win.location.hash).toContain("icon=user");
      click("#dclose");
      expect(win.location.hash).not.toContain("icon=");
    });
  });

  describe("URL state", () => {
    it("keeps the query and filters in the hash so a view is shareable", () => {
      click("#reset");
      type("shield");
      const select = q<HTMLSelectElement>("#cat");
      if (select) {
        select.value = "security";
        select.dispatchEvent(new win.Event("input", { bubbles: true }));
      }
      expect(win.location.hash).toContain("q=shield");
      expect(win.location.hash).toContain("category=security");
    });

    it("restores state from the hash on load", () => {
      const restored = makeDom("https://example.test/explorer#q=lock&category=security");
      const rdoc = restored.window.document;
      expect(rdoc.querySelector<HTMLInputElement>("#q")?.value).toBe("lock");
      expect(rdoc.querySelector<HTMLSelectElement>("#cat")?.value).toBe("security");
      const restoredCells = [...rdoc.querySelectorAll(".cell")].map(
        (c) => (c as HTMLElement).dataset.name,
      );
      // The query matched, the category narrowed, and ranking put `lock` first.
      expect(restoredCells.length).toBeGreaterThan(0);
      expect(restoredCells[0]).toBe("lock");
      expect(restoredCells).toContain("unlock");
      restored.window.close();
    });

    it("opens the detail view directly from a deep link", () => {
      const deep = makeDom("https://example.test/explorer#icon=arrow-left");
      const ddoc = deep.window.document;
      expect(ddoc.querySelector("#dcomp")?.textContent).toBe("ArrowLeft");
      expect(ddoc.querySelector("#d")?.hasAttribute("open")).toBe(true);
      deep.window.close();
    });
  });

  describe("keyboard", () => {
    it("makes every cell a real button, so Tab and Enter work natively", () => {
      click("#reset");
      const cell = q(".cell");
      expect(cell?.tagName).toBe("BUTTON");
      expect(cell?.getAttribute("type")).toBe("button");
    });

    it("focuses search on the slash key", () => {
      q<HTMLElement>("#view")?.focus();
      doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "/", bubbles: true }));
      expect(doc.activeElement?.id).toBe("q");
    });

    it("moves between cells with arrow keys", () => {
      click("#reset");
      const list = all(".cell") as HTMLElement[];
      list[0].focus();
      q("#grid")?.dispatchEvent(
        new win.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      expect(doc.activeElement).toBe(list[1]);
    });

    it("has a skip link to the grid", () => {
      expect(q<HTMLAnchorElement>(".skip")?.getAttribute("href")).toBe("#grid");
    });
  });

  describe("accessibility", () => {
    it("labels the search input and every control", () => {
      expect(q('label[for="q"]')).not.toBeNull();
      expect(q('label[for="cat"]')).not.toBeNull();
      expect(q('label[for="size"]')).not.toBeNull();
      for (const button of all("button")) {
        const named = button.textContent?.trim() || button.getAttribute("aria-label");
        expect(named, button.outerHTML.slice(0, 60)).toBeTruthy();
      }
    });

    it("gives every cell an accessible name", () => {
      click("#reset");
      for (const cell of all(".cell").slice(0, 30)) {
        expect(cell.getAttribute("aria-label")).toBeTruthy();
      }
    });

    it("hides decorative icon SVGs from the accessibility tree", () => {
      expect(q(".cell svg")?.getAttribute("aria-hidden")).toBe("true");
    });

    it("marks the search region and the live region", () => {
      expect(q("#controls")?.getAttribute("role")).toBe("search");
      expect(q("#live")?.getAttribute("aria-live")).toBe("polite");
      expect(q("#live")?.getAttribute("role")).toBe("status");
    });

    it("labels the dialog by its heading", () => {
      expect(q("#d")?.getAttribute("aria-labelledby")).toBe("dcomp");
    });

    it("declares a document language", () => {
      expect(doc.documentElement.getAttribute("lang")).toBe("en");
    });

    it("passes axe on the header and controls", async () => {
      // Scoped to the chrome: 331 inline SVG cells make a full-page axe run slow
      // without testing anything the per-cell assertions above do not.
      const header = doc.querySelector("header");
      expect(await axe(header as Element)).toHaveNoViolations();
    });

    it("passes axe on the page landmarks and a populated grid", async () => {
      // Narrowed first: a full 331-cell axe run is slow and tests nothing the
      // per-cell assertions above do not. `main` rather than `#grid`, so the
      // landmark structure is part of what is checked.
      type("shield-check");
      expect(await axe(doc.querySelector("main") as Element)).toHaveNoViolations();
      click("#reset");
    });
  });

  describe("performance posture", () => {
    it("uses native content-visibility instead of a JS virtualiser", () => {
      const html = readFileSync(HTML, "utf8");
      expect(html).toContain("content-visibility: auto");
      expect(html).toContain("contain-intrinsic-size");
    });

    it("ships as a single self-contained file with no external requests", () => {
      const html = readFileSync(HTML, "utf8");
      expect(html).not.toMatch(/<script[^>]+src=/);
      expect(html).not.toMatch(/<link[^>]+stylesheet/);
      expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    });

    it("stays a reasonable size for the whole catalogue", () => {
      const bytes = readFileSync(HTML).byteLength;
      expect(bytes).toBeGreaterThan(50_000);
      expect(bytes).toBeLessThan(4_000_000);
    });
  });
});
