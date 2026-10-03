import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { categories } from "../../config/categories.js";
import {
  type Catalogue,
  type CatalogueFilter,
  categoryOptions,
  emptyFilter,
  filterIcons,
  selectedVariant,
  type VariantFilter,
  variantFilterOptions,
} from "./catalogue.js";
import { typefaces, useFontAvailability } from "./fonts.js";
import { CalibrationStatus, Inspector } from "./inspector.js";
import {
  type Direction,
  parseUrlState,
  serializeUrlState,
  type Theme,
  type UrlState,
} from "./url-state.js";

export function App({ catalogue }: { catalogue: Catalogue }) {
  const [state, setState] = useState<UrlState>(() => parseUrlState(window.location.search));
  const [filter, setFilter] = useState<CatalogueFilter>(emptyFilter);
  const visible = useMemo(() => filterIcons(catalogue.icons, filter), [catalogue, filter]);
  const selected = state.icon ? catalogue.byId.get(state.icon) : undefined;
  const variant = selected ? selectedVariant(selected, state.variant) : undefined;
  const update = (change: Partial<UrlState>) => setState((current) => ({ ...current, ...change }));
  const refine = (change: Partial<CatalogueFilter>) =>
    setFilter((current) => ({ ...current, ...change }));

  // Layout effect, so previews that read computed colors in their own effects see the new theme.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);
  useEffect(() => {
    const query = serializeUrlState({ ...state, variant });
    window.history.replaceState(null, "", `${window.location.pathname}${query}`);
  }, [state, variant]);

  return (
    <div className="app">
      <header className="toolbar">
        <h1>
          Qeetrix Icons <span>Playground</span>
        </h1>
        <label>
          Theme
          <select
            value={state.theme}
            onChange={(event) => update({ theme: event.target.value as Theme })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          Preview direction
          <select
            value={state.dir}
            onChange={(event) => update({ dir: event.target.value as Direction })}
          >
            <option value="ltr">LTR</option>
            <option value="rtl">RTL (QA preview)</option>
          </select>
        </label>
        <FontStatus />
      </header>

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

      <div className="workspace">
        <aside className="catalogue" aria-label="Icon catalogue">
          <div className="filters">
            <label>
              Search
              <input
                type="search"
                value={filter.query}
                placeholder="Name, component, or category"
                onChange={(event) => refine({ query: event.target.value })}
              />
            </label>
            <label>
              Category
              <select
                value={filter.category}
                onChange={(event) => refine({ category: event.target.value })}
              >
                <option value="">All categories</option>
                {categoryOptions(catalogue.icons).map(({ id, label, count }) => (
                  <option key={id} value={id}>
                    {label} ({count})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Variants
              <select
                value={filter.variant}
                onChange={(event) => refine({ variant: event.target.value as VariantFilter })}
              >
                {variantFilterOptions().map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Direction
              <select
                value={filter.directionality}
                onChange={(event) =>
                  refine({
                    directionality: event.target.value as CatalogueFilter["directionality"],
                  })
                }
              >
                <option value="all">All</option>
                <option value="mirror">Mirror in RTL</option>
                <option value="preserve">Preserve in RTL</option>
              </select>
            </label>
          </div>
          <p className="count" aria-live="polite">
            {visible.length === catalogue.icons.length
              ? `${catalogue.icons.length} icons`
              : `${visible.length} of ${catalogue.icons.length} icons`}
          </p>
          <ul className="icon-grid">
            {visible.map((icon) => (
              <li key={icon.id}>
                <button
                  type="button"
                  className="icon-card"
                  aria-current={icon.id === selected?.id ? "true" : undefined}
                  onClick={() => update({ icon: icon.id })}
                >
                  <icon.Component size={24} />
                  <span className="icon-card-name">{icon.name}</span>
                  <span className="icon-card-meta">{icon.variants.join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="stage">
          {selected && variant ? (
            <Inspector
              key={selected.id}
              icon={selected}
              variant={variant}
              size={state.size}
              direction={state.dir}
              onVariant={(next) => update({ variant: next })}
              onSize={(next) => update({ size: next })}
            />
          ) : catalogue.icons.length === 0 ? (
            <EmptyState />
          ) : (
            <section className="placeholder">
              <h2>{state.icon ? `No icon named “${state.icon}”` : "Select an icon"}</h2>
              <p>Choose an icon from the catalogue to inspect it.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function FontStatus() {
  const availability = useFontAvailability();
  return (
    <ul className="font-status" aria-label="Typeface availability">
      {typefaces.map(({ family }) => (
        <li key={family} data-available={availability?.[family]}>
          {availability === undefined
            ? `${family}: checking`
            : availability[family]
              ? `${family} available`
              : `${family} unavailable — system fallback active`}
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <section className="empty">
      <h2>No production icons yet.</h2>
      <p>The Qeetrix Icons foundation is ready. Calibration icons will be introduced in Phase 3.</p>
      <h3>Review workflow</h3>
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
