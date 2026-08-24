import { useMemo, useState } from "react";
import { allVariants, categories, type Icon, icons, stats } from "./catalogue.js";

/**
 * A visual check for the whole icon set.
 *
 * The thing this is really for: the icons default to `color="white"`, which no
 * unit test can confirm renders — jsdom does not resolve SVG presentation
 * attributes. So the background toggle is the important control. On **dark** the
 * default set should be crisp and legible; on **light** it should vanish, which
 * is correct behaviour, not a bug. Set a colour or a class and both should work.
 */

type Bg = "dark" | "light" | "checker";

const SIZES = [16, 20, 24, 32, 48];

export function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [variant, setVariant] = useState("outline");
  const [size, setSize] = useState(32);
  const [bg, setBg] = useState<Bg>("dark");
  const [colour, setColour] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return icons.filter((icon) => {
      if (category && icon.category !== category) return false;
      if (onlyMissing && icon.variants.length > 1) return false;
      if (!q) return true;
      return (
        icon.name.includes(q) ||
        icon.component.toLowerCase().includes(q) ||
        icon.category.includes(q)
      );
    });
  }, [query, category, onlyMissing]);

  return (
    <div className="app">
      <header>
        <div className="titles">
          <h1>@qeetrix/icons</h1>
          <p className="sub">
            Rendered from <code>../src</code> — the working tree, not the published package.
          </p>
        </div>

        <dl className="stats">
          <div>
            <dt>icons</dt>
            <dd>{stats.icons}</dd>
          </div>
          <div>
            <dt>svg files</dt>
            <dd>{stats.files}</dd>
          </div>
          <div>
            <dt>categories</dt>
            <dd>{stats.categories}</dd>
          </div>
          <div>
            <dt>both styles</dt>
            <dd>{stats.bothStyles}</dd>
          </div>
          <div>
            <dt>outline only</dt>
            <dd>{stats.outlineOnly}</dd>
          </div>
          <div>
            <dt>solid only</dt>
            <dd>{stats.solidOnly}</dd>
          </div>
        </dl>

        <div className="controls">
          <label>
            <span>Search</span>
            <input
              type="search"
              value={query}
              placeholder="name, component or category"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <label>
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">all ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Variant</span>
            <select value={variant} onChange={(e) => setVariant(e.target.value)}>
              {allVariants.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
              <option value="both">both, side by side</option>
            </select>
          </label>

          <label>
            <span>Size</span>
            <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}px
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Background</span>
            <select value={bg} onChange={(e) => setBg(e.target.value as Bg)}>
              <option value="dark">dark</option>
              <option value="light">light</option>
              <option value="checker">checkerboard</option>
            </select>
          </label>

          <label>
            <span>Colour override</span>
            <input
              type="text"
              value={colour}
              placeholder="default (white)"
              onChange={(e) => setColour(e.target.value)}
            />
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(e) => setOnlyMissing(e.target.checked)}
            />
            <span>Only single-style icons</span>
          </label>
        </div>

        <p className="hint">
          Icons ship white by default. On a <strong>light</strong> background they should be
          invisible — that is correct, not a bug. Type a colour above, or use the checkerboard, to
          confirm the artwork is there. Showing <strong>{visible.length}</strong> of {stats.icons}.
        </p>
      </header>

      <main className={`grid bg-${bg}`}>
        {visible.map((icon) => (
          <Cell
            key={icon.name}
            icon={icon}
            variant={variant}
            size={size}
            colour={colour.trim()}
            onCopy={() => {
              void navigator.clipboard?.writeText(
                `import { ${icon.component} } from "@qeetrix/icons";`,
              );
            }}
          />
        ))}
        {visible.length === 0 && <p className="empty">Nothing matches.</p>}
      </main>
    </div>
  );
}

function Cell({
  icon,
  variant,
  size,
  colour,
  onCopy,
}: {
  icon: Icon;
  variant: string;
  size: number;
  colour: string;
  onCopy: () => void;
}) {
  const { Component, variants } = icon;
  // `content-visibility: auto` on the cell keeps 1166 inline SVGs cheap without
  // reaching for a virtualiser, so Cmd-F still finds every name on the page.
  const style = { contentVisibility: "auto", containIntrinsicSize: `${size + 44}px` } as const;
  const paint = colour ? { color: colour } : undefined;

  const shown =
    variant === "both" ? variants : [variants.includes(variant) ? variant : variants[0]];
  const substituted = variant !== "both" && !variants.includes(variant);

  return (
    <button type="button" className="cell" style={style} onClick={onCopy} title="Copy import">
      <span className="art">
        {shown.map((v) => (
          <Component key={v} variant={v} width={size} height={size} style={paint} aria-hidden />
        ))}
      </span>
      <span className="name">{icon.name}</span>
      <span className="meta">
        {icon.category}
        {substituted && <em> · no {variant}</em>}
        {variant === "both" && variants.length === 1 && <em> · {variants[0]} only</em>}
      </span>
    </button>
  );
}
