import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import {
  ArrowLeft,
  ArrowRightShort,
  Check,
  Search,
  Settings,
  ShieldTick,
  Trash,
  User,
} from "../../src/index.js";


const svgOf = (container: HTMLElement) => container.querySelector("svg") as SVGSVGElement;

describe("rendering", () => {
  it("renders an svg on the 24×24 grid", () => {
    const { container } = render(<ArrowLeft />);
    const svg = svgOf(container);
    expect(svg).toBeInTheDocument();
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
  });

  it("defaults to 24px square with stroke width 2", () => {
    const svg = svgOf(render(<ArrowLeft />).container);
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
    expect(svg.getAttribute("stroke-width")).toBe("2");
  });

  it("inherits colour from the surrounding text", () => {
    const svg = svgOf(render(<ArrowLeft />).container);
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("fill")).toBe("none");
  });

  it("draws its own geometry rather than an empty shell", () => {
    const svg = svgOf(render(<ShieldTick />).container);
    expect(
      svg.querySelectorAll("path, circle, rect, line, polyline, polygon").length,
    ).toBeGreaterThan(0);
  });

  it("keeps a long path on a single element", () => {
    // `settings` paths far exceed the 100-column limit, exercising the
    // emitter's line-breaking. Assert shape rather than coordinates.
    const svg = svgOf(render(<Settings />).container);
    const paths = svg.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
    const longest = Math.max(...[...paths].map((p) => p.getAttribute("d")?.length ?? 0));
    expect(longest).toBeGreaterThan(100);
  });
});

describe("sizing", () => {
  it.each([16, 20, 24, 32])("applies size=%i to both axes", (size) => {
    const svg = svgOf(render(<ArrowLeft size={size} />).container);
    expect(svg.getAttribute("width")).toBe(String(size));
    expect(svg.getAttribute("height")).toBe(String(size));
  });

  it("accepts a CSS length string", () => {
    const svg = svgOf(render(<ArrowLeft size="1.5rem" />).container);
    expect(svg.getAttribute("width")).toBe("1.5rem");
  });

  it("lets an explicit width/height win over size", () => {
    const svg = svgOf(render(<ArrowLeft size={20} width={40} />).container);
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("height")).toBe("20");
  });

  it("allows the stroke width to be overridden", () => {
    const svg = svgOf(render(<ArrowLeft strokeWidth={1.5} />).container);
    expect(svg.getAttribute("stroke-width")).toBe("1.5");
  });
});

describe("accessibility", () => {
  it("is decorative by default", () => {
    const svg = svgOf(render(<ArrowLeft />).container);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
  });

  it("becomes a named image when given an aria-label", () => {
    render(<ArrowLeft aria-label="Go back" />);
    const svg = screen.getByRole("img", { name: "Go back" });
    expect(svg).toBeInTheDocument();
    // The whole point of the automatic flip: a labelled icon must not also be
    // hidden, or the label is never announced.
    expect(svg.getAttribute("aria-hidden")).toBeNull();
  });

  it("becomes a named image when given aria-labelledby", () => {
    const { container } = render(
      <>
        <span id="lbl">Go back</span>
        <ArrowLeft aria-labelledby="lbl" />
      </>,
    );
    const svg = svgOf(container);
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
  });

  it("lets a consumer opt out of the decorative default", () => {
    const svg = svgOf(render(<ArrowLeft aria-hidden={false} />).container);
    expect(svg.getAttribute("aria-hidden")).toBe("false");
  });

  it("lets a consumer override role explicitly", () => {
    const svg = svgOf(render(<ArrowLeft role="presentation" />).container);
    expect(svg.getAttribute("role")).toBe("presentation");
  });

  it("passes axe as a decorative icon inside a labelled button", async () => {
    const { container } = render(
      <button type="button">
        <ArrowLeft size={20} />
        Back
      </button>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("passes axe as an icon-only button named by the icon", async () => {
    const { container } = render(
      <button type="button" aria-label="Go back">
        <ArrowLeft size={20} />
      </button>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("passes axe as a standalone semantic icon", async () => {
    const { container } = render(<Check aria-label="Completed" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("standard SVG props pass through", () => {
  it("forwards className", () => {
    const svg = svgOf(render(<ArrowLeft className="size-4 text-brand" />).container);
    expect(svg.getAttribute("class")).toBe("size-4 text-brand");
  });

  it("forwards data attributes and style", () => {
    const svg = svgOf(render(<ArrowLeft data-testid="x" style={{ opacity: 0.5 }} />).container);
    expect(svg.getAttribute("data-testid")).toBe("x");
    expect(svg.style.opacity).toBe("0.5");
  });

  it("forwards event handlers", () => {
    let clicked = false;
    const svg = svgOf(
      render(
        <ArrowLeft
          onClick={() => {
            clicked = true;
          }}
        />,
      ).container,
    );
    svg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicked).toBe(true);
  });

  it("forwards a ref to the svg element", () => {
    let node: SVGSVGElement | null = null;
    render(
      <ArrowLeft
        ref={(el: SVGSVGElement | null) => {
          node = el;
        }}
      />,
    );
    expect(node).toBeInstanceOf(SVGSVGElement);
  });
});

describe("icons in the contexts products actually use them", () => {
  // §34: the accessibility contract has to hold inside real controls, not just
  // standalone. Each case is a pattern that appears in every Qeet product.

  it("in an icon-only button, named by the button", async () => {
    const { container } = render(
      <button type="button" aria-label="Delete row">
        <Trash size={16} />
      </button>,
    );
    expect(screen.getByRole("button", { name: "Delete row" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("in a link with visible text", async () => {
    const { container } = render(
      <a href="/settings">
        Settings <ArrowRightShort size={16} />
      </a>,
    );
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("as a decoration inside a labelled text input", async () => {
    const { container } = render(
      <div>
        <label htmlFor="q">Search</label>
        <Search size={16} />
        <input id="q" type="search" />
      </div>,
    );
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("in a navigation list", async () => {
    const { container } = render(
      <nav aria-label="Main">
        <ul>
          <li>
            <a href="/home">
              <User size={16} /> People
            </a>
          </li>
        </ul>
      </nav>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("in a menu item", async () => {
    // Buttons rather than list items: a `menuitem` has to be focusable, and
    // this is the markup a real menu uses.
    const { container } = render(
      <div role="menu" aria-label="Row actions">
        <button type="button" role="menuitem">
          <Settings size={16} /> Preferences
        </button>
        <button type="button" role="menuitem">
          <Trash size={16} /> Delete
        </button>
      </div>,
    );
    expect(screen.getByRole("menuitem", { name: "Preferences" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("as a status indicator in a data table cell", async () => {
    const { container } = render(
      <table>
        <caption>Accounts</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Verified</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Ada</td>
            <td>
              <ShieldTick size={16} aria-label="Verified" />
            </td>
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByRole("img", { name: "Verified" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("beside a form field's validation message", async () => {
    const { container } = render(
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" aria-describedby="err" aria-invalid="true" />
        <p id="err">
          <Check size={16} /> Looks right
        </p>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("as a tooltip trigger, where the icon carries the only name", async () => {
    const { container } = render(
      <button type="button" aria-describedby="tip">
        <ArrowLeft size={16} aria-label="Go back" />
      </button>,
    );
    expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
