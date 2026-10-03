import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { categories } from "../../config/categories.js";
import { iconSystem } from "../../config/icon-system.js";
import {
  type Catalogue,
  type CatalogueFilter,
  type CatalogueIcon,
  categoryOptions,
  emptyFilter,
  filterIcons,
  selectedVariant,
  type VariantFilter,
  variantFilterOptions,
} from "./catalogue.js";
import { typefaces, useFontAvailability } from "./fonts.js";
import { CalibrationStatus, Inspector, type InspectorTab } from "./inspector.js";
import { Segmented, UiIcon, UiIconProvider } from "./ui.js";
import {
  type Direction,
  parseUrlState,
  serializeUrlState,
  type Theme,
  type UrlState,
} from "./url-state.js";

const { architecture, calibration } = iconSystem;
const categoryDescriptions = new Map<string, string>(
  categories.map(({ id, description }) => [id, description]),
);
/** Browsing preview sizes. A local preference, not inspection state, so it stays out of the URL. */
const gridSizes = ["16", "20", "24", "32"] as const;

export function App({ catalogue }: { catalogue: Catalogue }) {
  const [state, setState] = useState<UrlState>(() => parseUrlState(window.location.search));
  const [filter, setFilter] = useState<CatalogueFilter>(emptyFilter);
  const [gridSize, setGridSize] = useState<(typeof gridSizes)[number]>("24");
  const [tab, setTab] = useState<InspectorTab>("overview");
  const search = useRef<HTMLInputElement>(null);
  const visible = useMemo(() => filterIcons(catalogue.icons, filter), [catalogue, filter]);
  const lookup = useMemo(() => (id: string) => catalogue.byId.get(id)?.Component, [catalogue]);
  const selected = state.icon ? catalogue.byId.get(state.icon) : undefined;
  const variant = selected ? selectedVariant(selected, state.variant) : undefined;
  const update = (change: Partial<UrlState>) => setState((current) => ({ ...current, ...change }));
  const refine = (change: Partial<CatalogueFilter>) =>
    setFilter((current) => ({ ...current, ...change }));
  const filtered =
    filter.query.trim() !== "" ||
    filter.category !== "" ||
    filter.variant !== emptyFilter.variant ||
    filter.directionality !== emptyFilter.directionality;

  // Layout effect, so previews that read computed colors in their own effects see the new theme.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);
  useEffect(() => {
    const query = serializeUrlState({ ...state, variant });
    window.history.replaceState(null, "", `${window.location.pathname}${query}`);
  }, [state, variant]);

  // Keep the selected tile in view, including when the arrow keys step through the catalogue.
  useEffect(() => {
    if (!selected) return;
    document
      .querySelector(`[data-icon-id="${selected.id}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected]);

  // "/" focuses search; Escape closes the inspector; ← and → step through the visible icons.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, select, textarea, [role='tab']")) return;
      if (event.key === "/") {
        event.preventDefault();
        search.current?.focus();
      } else if (event.key === "Escape" && state.icon) {
        update({ icon: undefined });
      } else if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && selected) {
        const index = visible.findIndex(({ id }) => id === selected.id);
        const next =
          index === -1 ? undefined : visible[index + (event.key === "ArrowRight" ? 1 : -1)];
        if (next) {
          event.preventDefault();
          update({ icon: next.id });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const heading = filter.query.trim()
    ? `Results for “${filter.query.trim()}”`
    : filter.category
      ? (catalogue.icons.find((icon) => icon.category === filter.category)?.categoryLabel ??
        filter.category)
      : "All icons";
  const description = filter.query.trim()
    ? "Matching names, component names, and categories."
    : filter.category
      ? categoryDescriptions.get(filter.category)
      : `${catalogue.icons.length} icons across ${categoryOptions(catalogue.icons).filter(({ count }) => count > 0).length} categories, drawn on one ${architecture.grid.width}×${architecture.grid.height} grid.`;

  return (
    <UiIconProvider value={lookup}>
      <div className="app" data-inspecting={state.icon ? "true" : undefined}>
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <UiIcon name="sparkle" size={18} />
            </span>
            <span className="brand-name">Qeetrix Icons</span>
            <span className="brand-tag">Playground</span>
          </div>
          <label className="search">
            <UiIcon name="search" size={16} />
            <input
              ref={search}
              type="search"
              aria-label="Search icons"
              value={filter.query}
              placeholder={`Search ${catalogue.icons.length} icons by name, component, or category`}
              onChange={(event) => refine({ query: event.target.value })}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                if (filter.query) refine({ query: "" });
                else event.currentTarget.blur();
              }}
            />
            <kbd title="Press / to search">/</kbd>
          </label>
          <div className="topbar-controls">
            <Segmented<Theme>
              label="Theme"
              value={state.theme}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              onChange={(theme) => update({ theme })}
            />
            <Segmented<Direction>
              label="Preview direction"
              value={state.dir}
              options={[
                { value: "ltr", label: "LTR" },
                { value: "rtl", label: "RTL", title: "RTL QA preview" },
              ]}
              onChange={(dir) => update({ dir })}
            />
            <FontStatus />
          </div>
        </header>

        <nav className="sidebar" aria-label="Categories and filters">
          <section className="sidebar-section">
            <h2 className="sidebar-heading">Categories</h2>
            <ul className="category-list">
              <li>
                <button
                  type="button"
                  className="category"
                  aria-current={filter.category === "" ? "true" : undefined}
                  onClick={() => refine({ category: "" })}
                >
                  <span>All icons</span>
                  <span className="category-count">{catalogue.icons.length}</span>
                </button>
              </li>
              {categoryOptions(catalogue.icons).map(({ id, label, count }) => (
                <li key={id}>
                  <button
                    type="button"
                    className="category"
                    aria-current={filter.category === id ? "true" : undefined}
                    disabled={count === 0 && filter.category !== id}
                    title={count === 0 ? "No icons in this category yet" : undefined}
                    onClick={() => refine({ category: id })}
                  >
                    <span>{label}</span>
                    <span className="category-count">{count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="sidebar-section">
            <h2 className="sidebar-heading">Variants</h2>
            <Segmented<VariantFilter>
              label="Variants"
              layout="stack"
              value={filter.variant}
              options={variantFilterOptions()}
              onChange={(next) => refine({ variant: next })}
            />
          </section>
          <section className="sidebar-section">
            <h2 className="sidebar-heading">Direction</h2>
            <Segmented<CatalogueFilter["directionality"]>
              label="Direction"
              layout="stack"
              value={filter.directionality}
              options={[
                { value: "all", label: "All" },
                { value: "mirror", label: "Mirror in RTL" },
                { value: "preserve", label: "Preserve in RTL" },
              ]}
              onChange={(next) => refine({ directionality: next })}
            />
          </section>
          {filtered && (
            <button
              type="button"
              className="button button-ghost reset"
              onClick={() => setFilter(emptyFilter)}
            >
              <UiIcon name="x" size={14} />
              Reset filters
            </button>
          )}
        </nav>

        <main className="browser" aria-label="Icon catalogue">
          {catalogue.problems.length > 0 && (
            <div className="notice" role="alert">
              <p>
                Generated icons and the manifest disagree. Run <code>bun run generate</code>.
              </p>
              <ul>
                {catalogue.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </div>
          )}

          {catalogue.icons.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <header className="browser-header">
                <div className="browser-title">
                  <h1>{heading}</h1>
                  {description && <p>{description}</p>}
                  {!filtered && (
                    <ul className="spec-list" aria-label="System values">
                      <li>
                        {architecture.grid.width} × {architecture.grid.height} grid
                      </li>
                      <li>{calibration.strokeWidth} stroke</li>
                      <li>
                        {calibration.linecap} caps · {calibration.linejoin} joins
                      </li>
                      <li>{calibration.safeAreaInset}-unit safe area</li>
                      <li>{architecture.color}</li>
                    </ul>
                  )}
                </div>
                <div className="browser-tools">
                  <p className="count" aria-live="polite">
                    {visible.length === catalogue.icons.length
                      ? `${catalogue.icons.length} icons`
                      : `${visible.length} of ${catalogue.icons.length} icons`}
                  </p>
                  <Segmented
                    label="Preview size"
                    value={gridSize}
                    options={gridSizes.map((size) => ({
                      value: size,
                      label: size,
                      title: `Preview at ${size}px`,
                    }))}
                    onChange={setGridSize}
                  />
                </div>
              </header>

              {visible.length === 0 ? (
                <div className="no-results">
                  <UiIcon name="search" size={32} />
                  <h2>No icons match</h2>
                  <p>Try another name, or clear the search and filters.</p>
                  <button type="button" className="button" onClick={() => setFilter(emptyFilter)}>
                    Reset search and filters
                  </button>
                </div>
              ) : filtered ? (
                <IconGrid
                  icons={visible}
                  size={Number(gridSize)}
                  selectedId={selected?.id}
                  onSelect={(icon) => update({ icon })}
                />
              ) : (
                groupByCategory(visible).map(({ id, label, icons }) => (
                  <section key={id} className="group" aria-labelledby={`group-${id}`}>
                    <h2 id={`group-${id}`} className="group-title">
                      {label}
                      <span className="group-count">{icons.length}</span>
                    </h2>
                    <IconGrid
                      icons={icons}
                      size={Number(gridSize)}
                      selectedId={selected?.id}
                      onSelect={(icon) => update({ icon })}
                    />
                  </section>
                ))
              )}
            </>
          )}
        </main>

        {state.icon && (
          <>
            <button
              type="button"
              className="scrim"
              aria-label="Close inspector"
              tabIndex={-1}
              onClick={() => update({ icon: undefined })}
            />
            <aside className="inspector-pane" aria-label="Inspector">
              {selected && variant ? (
                <Inspector
                  key={selected.id}
                  icon={selected}
                  variant={variant}
                  size={state.size}
                  direction={state.dir}
                  tab={tab}
                  onTab={setTab}
                  onVariant={(next) => update({ variant: next })}
                  onSize={(next) => update({ size: next })}
                  onClose={() => update({ icon: undefined })}
                />
              ) : (
                <section className="placeholder">
                  <UiIcon name="search" size={32} />
                  <h2>No icon named “{state.icon}”</h2>
                  <p>
                    It may have been renamed or not generated yet. Choose one from the catalogue.
                  </p>
                  <button
                    type="button"
                    className="button"
                    onClick={() => update({ icon: undefined })}
                  >
                    Close
                  </button>
                </section>
              )}
            </aside>
          </>
        )}
      </div>
    </UiIconProvider>
  );
}

function groupByCategory(icons: readonly CatalogueIcon[]) {
  const groups: { id: string; label: string; icons: CatalogueIcon[] }[] = [];
  for (const icon of icons) {
    const last = groups.at(-1);
    if (last?.id === icon.category) last.icons.push(icon);
    else groups.push({ id: icon.category, label: icon.categoryLabel, icons: [icon] });
  }
  return groups;
}

function IconGrid({
  icons,
  size,
  selectedId,
  onSelect,
}: {
  icons: readonly CatalogueIcon[];
  size: number;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="icon-grid">
      {icons.map((icon) => (
        <li key={icon.id}>
          <button
            type="button"
            className="tile"
            data-icon-id={icon.id}
            aria-current={icon.id === selectedId ? "true" : undefined}
            title={icon.componentName}
            onClick={() => onSelect(icon.id)}
          >
            <span className="tile-art">
              <icon.Component size={size} />
            </span>
            <span className="tile-name">{icon.name}</span>
            {(icon.directionality === "mirror" || icon.variants.length > 1) && (
              <span className="tile-flags">
                {icon.directionality === "mirror" && (
                  <span className="tile-flag" title="Mirrors in RTL">
                    RTL
                  </span>
                )}
                {icon.variants.length > 1 && (
                  <span className="tile-flag" title={icon.variants.join(", ")}>
                    {icon.variants.length}
                  </span>
                )}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function FontStatus() {
  const availability = useFontAvailability();
  return (
    <ul className="font-status" aria-label="Typeface availability">
      {typefaces.map(({ family }) => {
        const status =
          availability === undefined
            ? "checking"
            : availability[family]
              ? "available"
              : "unavailable — system fallback active";
        return (
          <li key={family} data-available={availability?.[family]} title={`${family}: ${status}`}>
            {family}
            <span className="visually-hidden"> {status}</span>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState() {
  return (
    <section className="empty">
      <h1>No production icons yet</h1>
      <p>The Qeetrix Icons foundation is ready. Calibration icons will be introduced in Phase 3.</p>
      <h2>Review workflow</h2>
      <ol>
        <li>
          Author or update an SVG in <code>icons/&lt;variant&gt;/&lt;category&gt;/</code>.
        </li>
        <li>
          Run <code>bun run check:icons</code>, then <code>bun run generate</code>.
        </li>
        <li>Inspect it here: sizes, construction, stroke, surfaces, typography, RTL, variants.</li>
        <li>Fix the SVG source and repeat. The playground never edits artwork.</li>
      </ol>
      <p className="muted">
        {categories.length} categories configured. See <code>docs/visual-qa.md</code>.
      </p>
      <CalibrationStatus />
    </section>
  );
}
