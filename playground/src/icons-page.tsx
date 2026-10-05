import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { categories } from "../../config/categories.js";
import { iconSystem } from "../../config/icon-system.js";
import type { IconShape } from "../../src/types/icon.js";
import {
  type Catalogue,
  type CatalogueFilter,
  type CatalogueIcon,
  categoryOptions,
  filterIcons,
  groupByCategory,
  selectedVariant,
  shapeOptions,
  type VariantFilter,
} from "./catalogue.js";
import { typefaces, useFontAvailability } from "./fonts.js";
import { DesignValues, IconInspector } from "./icon-inspector.js";
import { PageLayout } from "./layout.js";
import { emptyLogoFilter, filterLogos } from "./logo-catalogue.js";
import { useLogoIndex } from "./logo-modules.js";
import { strokeStyle } from "./qa.js";
import {
  Disclosure,
  formatCount,
  Kbd,
  Segmented,
  Toolbar,
  UiIcon,
  useListKeys,
  useMediaQuery,
} from "./ui.js";
import {
  type ColorToken,
  colorTokens,
  defaultIconsState,
  type IconsState,
  previewSizes,
  strokeRange,
} from "./url-state.js";
import { type GridGroup, VirtualGrid } from "./virtual-grid.js";

export type Update<T> = (change: Partial<T>, mode?: "push" | "replace") => void;

const { architecture, design } = iconSystem;
const categoryLabels = new Map<string, string>(categories.map(({ id, label }) => [id, label]));

export const colorLabels: Record<ColorToken, string> = {
  foreground: "Foreground",
  muted: "Muted",
  accent: "Accent",
  blue: "Blue",
  green: "Green",
  amber: "Amber",
  red: "Red",
};

/** The CSS colour for a preview colour: a token's custom property, or the hex itself. */
export function previewColor(color: string): string {
  return colorTokens.includes(color as ColorToken) ? `var(--swatch-${color})` : `#${color}`;
}

/** Tile metrics per preview size: the tile grows with the drawing so it never feels cramped. */
function tileMetrics(preview: number, compact: boolean) {
  if (preview >= 48)
    return compact ? { minWidth: 104, height: 112 } : { minWidth: 128, height: 128 };
  if (preview >= 32)
    return compact ? { minWidth: 92, height: 100 } : { minWidth: 112, height: 112 };
  return compact ? { minWidth: 84, height: 92 } : { minWidth: 100, height: 100 };
}

export function IconsPage({
  catalogue,
  state,
  update,
  revealKey,
  onSearchLogos,
}: {
  catalogue: Catalogue;
  state: IconsState;
  update: Update<IconsState>;
  /** Changes when the selection was set from outside the grid (deep link, command palette). */
  revealKey: number;
  onSearchLogos: (query: string) => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const filter = useMemo<CatalogueFilter>(
    () => ({
      query: state.q,
      category: state.category,
      variant: state.variants,
      directionality: state.directionality,
    }),
    [state.q, state.category, state.variants, state.directionality],
  );
  const visible = useMemo(() => filterIcons(catalogue.icons, filter), [catalogue, filter]);
  const grouped = !state.q.trim() && !state.category;
  const groups = useMemo(() => (grouped ? groupByCategory(visible) : []), [grouped, visible]);
  const gridGroups: GridGroup[] = useMemo(
    () =>
      grouped
        ? groups.map(({ id, label, icons }) => ({ key: id, label, count: icons.length }))
        : [{ key: "results", label: "Results", count: visible.length }],
    [grouped, groups, visible],
  );
  const indexOf = useMemo(() => new Map(visible.map((icon, index) => [icon.id, index])), [visible]);
  const selected = state.icon ? catalogue.byId.get(state.icon) : undefined;
  const selectedIndex = selected ? (indexOf.get(selected.id) ?? -1) : -1;
  const renderVariant = state.variants === "filled" ? "filled" : architecture.defaultVariant;
  const compact = useMediaQuery("(max-width: 640px)");
  const metrics = tileMetrics(state.preview, compact);
  const color = previewColor(state.color);
  const resetFilters = () =>
    update({ q: "", category: "", variants: "all", directionality: "all" }, "push");
  // When nothing matches, say whether the logos would: the index is warmed after first paint.
  const logoIndex = useLogoIndex(visible.length === 0 && state.q.trim() !== "");
  const logoMatches =
    logoIndex && visible.length === 0 && state.q.trim()
      ? filterLogos(logoIndex.logos, { ...emptyLogoFilter, query: state.q }).length
      : 0;

  // "/" focuses search from anywhere on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const select = (id: string | undefined) => update({ icon: id }, "push");
  const step = (direction: 1 | -1) => {
    if (selectedIndex === -1) return;
    const next = visible[selectedIndex + direction];
    if (next) update({ icon: next.id }, "replace");
  };
  const tileFor = (id: string | undefined) =>
    id ? document.querySelector<HTMLElement>(`[data-icon-id="${id}"]`) : null;
  const closeInspector = () => {
    const id = state.icon;
    const hadFocus = document.activeElement?.closest(".inspector-dock") !== null;
    update({ icon: undefined }, "push");
    if (hadFocus) requestAnimationFrame(() => tileFor(id)?.focus({ preventScroll: true }));
  };

  const heading = state.q.trim()
    ? `Results for “${state.q.trim()}”`
    : state.category
      ? (categoryLabels.get(state.category) ?? state.category)
      : "All icons";

  return (
    <PageLayout
      sidebarLabel="Icon categories and filters"
      sidebarOpen={sidebarOpen}
      onCloseSidebar={() => setSidebarOpen(false)}
      sidebar={
        <IconSidebar
          catalogue={catalogue}
          state={state}
          update={(change, mode) => {
            update(change, mode);
            setSidebarOpen(false);
          }}
        />
      }
      inspectorLabel={selected ? `${selected.name} icon` : "Icon inspector"}
      onCloseInspector={closeInspector}
      restoreFocus={() => tileFor(state.icon)}
      inspector={
        state.icon ? (
          selected ? (
            <IconInspector
              key={selected.id}
              icon={selected}
              shape={state.shape}
              variant={selectedVariant(selected, state.variant ?? renderVariant)}
              size={state.size}
              direction={state.dir}
              usage={{
                size: state.preview,
                strokeWidth: state.stroke,
                color: colorTokens.includes(state.color as ColorToken)
                  ? undefined
                  : `#${state.color}`,
              }}
              position={
                selectedIndex === -1 ? undefined : { index: selectedIndex, total: visible.length }
              }
              onStep={step}
              onShape={(shape) => update({ shape })}
              onVariant={(variant) => update({ variant })}
              onSize={(size) => update({ size })}
              onDirection={(dir) => update({ dir })}
              onClose={closeInspector}
            />
          ) : (
            <MissingSelection kind="icon" id={state.icon} onClose={closeInspector} />
          )
        ) : null
      }
    >
      <header className="page-header">
        <div className="page-heading">
          <p className="eyebrow">Library</p>
          <h1>Icons</h1>
          <p className="page-lede">
            {formatCount(catalogue.icons.length)} Lucide icons on one {architecture.grid.width}×
            {architecture.grid.height} grid, each in round and sharp shapes, with{" "}
            {formatCount(catalogue.icons.filter(({ variants }) => variants.length > 1).length)}{" "}
            filled drawings.
          </p>
        </div>
        <SpecList shape={state.shape} />
      </header>

      {catalogue.problems.length > 0 && (
        <div className="notice" role="alert">
          <UiIcon name="triangle-alert" size={16} />
          <div>
            <p>
              Generated icons and the manifest disagree. Run <code>bun run generate</code>.
            </p>
            <ul>
              {catalogue.problems.slice(0, 8).map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {catalogue.icons.length === 0 ? (
        <EmptyCatalogue />
      ) : (
        <>
          <IconToolbar
            searchRef={search}
            state={state}
            update={update}
            total={catalogue.icons.length}
            onOpenFilters={() => setSidebarOpen(true)}
            filterCount={
              (state.category ? 1 : 0) +
              (state.variants !== "all" ? 1 : 0) +
              (state.directionality !== "all" ? 1 : 0)
            }
          />
          <div className="results-bar">
            <p className="results-summary" aria-live="polite">
              <strong>{heading}</strong>
              <span className="results-count">
                {visible.length === catalogue.icons.length
                  ? `${formatCount(visible.length)} icons`
                  : `${formatCount(visible.length)} of ${formatCount(catalogue.icons.length)}`}
              </span>
            </p>
            <ActiveFilters state={state} update={update} onReset={resetFilters} />
          </div>

          {visible.length === 0 ? (
            <NoResults
              kind="icons"
              query={state.q.trim()}
              filtered={
                state.category !== "" || state.variants !== "all" || state.directionality !== "all"
              }
              onClearQuery={() => update({ q: "" })}
              onReset={resetFilters}
              otherMatches={logoMatches}
              onSearchOther={() => onSearchLogos(state.q.trim())}
            />
          ) : (
            <VirtualGrid
              label={`${heading}, ${visible.length} icons`}
              className="icon-grid"
              groups={gridGroups}
              showHeaders={grouped}
              minTileWidth={metrics.minWidth}
              columnGap={0}
              rowGap={0}
              rowHeight={metrics.height}
              headerHeight={44}
              trimEnd={1}
              selectedIndex={selectedIndex}
              revealIndex={selectedIndex}
              revealKey={revealKey}
              onNavigate={(index) => {
                // With the inspector open, selection follows the keyboard, like a preview pane.
                if (state.icon && visible[index]) update({ icon: visible[index].id }, "replace");
              }}
              renderHeader={(group) => (
                <h2 className="grid-heading">
                  {group.label}
                  <span
                    className="grid-heading-count"
                    title={`Icons whose primary category is ${group.label}; the sidebar also counts icons listed there second`}
                  >
                    {formatCount(group.count)}
                  </span>
                </h2>
              )}
              renderTooltip={(index) => {
                const icon = visible[index];
                return icon ? <IconTooltip icon={icon} /> : null;
              }}
              renderItem={({ index, ...props }) => {
                const icon = visible[index];
                return (
                  <button
                    type="button"
                    className="icon-tile"
                    {...props}
                    data-icon-id={icon.id}
                    aria-label={icon.name}
                    aria-current={icon.id === state.icon ? "true" : undefined}
                    onClick={() => select(icon.id === state.icon ? undefined : icon.id)}
                  >
                    <span className="icon-tile-art" style={{ color }}>
                      <icon.Component
                        shape={state.shape}
                        variant={selectedVariant(icon, renderVariant)}
                        size={state.preview}
                        strokeWidth={state.stroke === design.strokeWidth ? undefined : state.stroke}
                      />
                    </span>
                    <span className="icon-tile-name">{icon.name}</span>
                  </button>
                );
              }}
            />
          )}
        </>
      )}
    </PageLayout>
  );
}

function IconTooltip({ icon }: { icon: CatalogueIcon }) {
  return (
    <>
      <span className="tooltip-title">{icon.name}</span>
      <span className="tooltip-meta">
        <code>{icon.componentName}</code>
        {icon.variants.length > 1 && <span className="tooltip-tag">Filled</span>}
        {icon.directionality === "mirror" && <span className="tooltip-tag">Mirrors in RTL</span>}
      </span>
    </>
  );
}

function SpecList({ shape }: { shape: IconShape }) {
  const stroke = strokeStyle(shape);
  return (
    <ul className="spec-list" aria-label="System values">
      <li>
        <span>Grid</span>
        {architecture.grid.width}×{architecture.grid.height}
      </li>
      <li>
        <span>Stroke</span>
        {design.strokeWidth}px
      </li>
      <li>
        <span>Caps</span>
        {stroke.linecap} / {stroke.linejoin}
      </li>
      <li>
        <span>Padding</span>
        {design.safeAreaInset}px
      </li>
      <li>
        <span>Colour</span>
        {architecture.color}
      </li>
    </ul>
  );
}

function IconSidebar({
  catalogue,
  state,
  update,
}: {
  catalogue: Catalogue;
  state: IconsState;
  update: Update<IconsState>;
}) {
  const options = useMemo(() => categoryOptions(catalogue.icons), [catalogue]);
  const listKeys = useListKeys();
  const filledCount = catalogue.icons.filter(({ variants }) => variants.length > 1).length;
  const mirrorCount = catalogue.icons.filter(
    ({ directionality }) => directionality === "mirror",
  ).length;
  return (
    <>
      <Disclosure title="Categories">
        <ul className="nav-list" {...listKeys}>
          <li>
            <button
              type="button"
              className="nav-item"
              data-list-item
              aria-current={state.category === "" ? "true" : undefined}
              onClick={() => update({ category: "" }, "push")}
            >
              <UiIcon name="layout-grid" size={15} />
              <span className="nav-label">All icons</span>
              <span className="nav-count">{formatCount(catalogue.icons.length)}</span>
            </button>
          </li>
          {options.map(({ id, label, count }) => (
            <li key={id}>
              <button
                type="button"
                className="nav-item"
                data-list-item
                aria-current={state.category === id ? "true" : undefined}
                disabled={count === 0 && state.category !== id}
                onClick={() => update({ category: id }, "push")}
              >
                <span className="nav-label">{label}</span>
                <span className="nav-count">{formatCount(count)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Disclosure>
      <Disclosure title="Direction">
        <ul className="nav-list" {...listKeys}>
          {(
            [
              ["all", "Any direction", catalogue.icons.length],
              ["mirror", "Mirrors in RTL", mirrorCount],
              ["preserve", "Preserved in RTL", catalogue.icons.length - mirrorCount],
            ] as const
          ).map(([value, label, count]) => (
            <li key={value}>
              <button
                type="button"
                className="nav-item"
                data-list-item
                aria-current={state.directionality === value ? "true" : undefined}
                onClick={() => update({ directionality: value }, "push")}
              >
                <span className="nav-label">{label}</span>
                <span className="nav-count">{formatCount(count)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Disclosure>
      <SidebarFooter filledCount={filledCount} />
    </>
  );
}

function SidebarFooter({ filledCount }: { filledCount: number }) {
  const availability = useFontAvailability();
  return (
    <div className="sidebar-footer">
      <p className="sidebar-note">
        {formatCount(filledCount)} icons have a filled drawing. Every icon has round and sharp
        shapes.
      </p>
      <ul className="font-status" aria-label="Typeface availability">
        {typefaces.map(({ family }) => {
          const status =
            availability === undefined
              ? "checking"
              : availability[family]
                ? "loaded"
                : "unavailable, system fallback active";
          return (
            <li key={family} data-available={availability?.[family]} title={`${family}: ${status}`}>
              {family}
              <span className="visually-hidden"> {status}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IconToolbar({
  searchRef,
  state,
  update,
  total,
  onOpenFilters,
  filterCount,
}: {
  searchRef: RefObject<HTMLInputElement | null>;
  state: IconsState;
  update: Update<IconsState>;
  total: number;
  onOpenFilters: () => void;
  filterCount: number;
}) {
  return (
    <Toolbar label="Icon display">
      <button type="button" className="button toolbar-filters" onClick={onOpenFilters}>
        <UiIcon name="sliders-horizontal" size={15} />
        Filters
        {filterCount > 0 && <span className="badge">{filterCount}</span>}
      </button>
      <SearchField
        inputRef={searchRef}
        value={state.q}
        placeholder={`Search ${formatCount(total)} icons`}
        label="Search icons by name, tag, category, or component"
        onChange={(q) => update({ q })}
      />
      <div className="toolbar-controls">
        <Segmented<IconShape>
          label="Shape"
          value={state.shape}
          options={shapeOptions()}
          onChange={(shape) => update({ shape })}
        />
        <Segmented<VariantFilter>
          label="Variants"
          value={state.variants}
          options={[
            { value: "all", label: "All" },
            {
              value: "default-only",
              label: "Outline only",
              title: "Icons without a filled drawing",
            },
            {
              value: "filled",
              label: "Filled",
              title: "Icons with a filled drawing, shown filled",
            },
          ]}
          onChange={(variants) => update({ variants }, "push")}
        />
        <span className="toolbar-break" aria-hidden="true" />
        <Segmented<string>
          label="Preview size in pixels"
          size="sm"
          value={String(state.preview)}
          options={previewSizes.map((size) => ({
            value: String(size),
            label: String(size),
            title: `Preview at ${size}px`,
          }))}
          onChange={(preview) => update({ preview: Number(preview) })}
        />
        <StrokeControl
          value={state.stroke}
          disabled={state.variants === "filled"}
          onChange={(stroke) => update({ stroke })}
        />
        <ColorControl value={state.color} onChange={(color) => update({ color })} />
        {(state.stroke !== defaultIconsState.stroke ||
          state.preview !== defaultIconsState.preview ||
          state.color !== defaultIconsState.color) && (
          <button
            type="button"
            className="button button-ghost button-sm"
            onClick={() =>
              update({
                stroke: defaultIconsState.stroke,
                preview: defaultIconsState.preview,
                color: defaultIconsState.color,
              })
            }
          >
            Reset display
          </button>
        )}
      </div>
    </Toolbar>
  );
}

export function SearchField({
  inputRef,
  value,
  placeholder,
  label,
  onChange,
}: {
  inputRef?: RefObject<HTMLInputElement | null>;
  value: string;
  placeholder: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="search-field">
      <UiIcon name="search" size={15} />
      <input
        ref={inputRef}
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          if (value) {
            event.preventDefault();
            onChange("");
          } else event.currentTarget.blur();
        }}
      />
      {value ? (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef?.current?.focus();
          }}
        >
          <UiIcon name="x" size={14} />
        </button>
      ) : (
        <Kbd>/</Kbd>
      )}
    </div>
  );
}

function StrokeControl({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div
      className="stroke-control"
      data-disabled={disabled || undefined}
      title={disabled ? "Stroke width applies to outline drawings" : "The strokeWidth prop"}
    >
      <label htmlFor={id}>Stroke</label>
      <input
        id={id}
        type="range"
        min={strokeRange.min}
        max={strokeRange.max}
        step={strokeRange.step}
        value={value}
        disabled={disabled}
        style={
          {
            "--fill": `${((value - strokeRange.min) / (strokeRange.max - strokeRange.min)) * 100}%`,
          } as CSSProperties
        }
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output htmlFor={id}>{value.toFixed(2)}</output>
    </div>
  );
}

/**
 * Preview colour picker in a native popover: it renders in the top layer, so neither the sticky
 * toolbar (whose backdrop filter would anchor fixed positioning) nor the scrolling control strip
 * on small screens can clip it, and the browser provides light dismiss and Escape.
 */
function ColorControl({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const onBeforeToggle = (event: Event) => {
      const opening = (event as ToggleEvent).newState === "open";
      setOpen(opening);
      const rect = trigger.current?.getBoundingClientRect();
      if (!opening || !rect) return;
      element.style.top = `${rect.bottom + 6}px`;
      element.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 248))}px`;
    };
    element.addEventListener("beforetoggle", onBeforeToggle);
    return () => element.removeEventListener("beforetoggle", onBeforeToggle);
  }, []);
  const isToken = colorTokens.includes(value as ColorToken);
  const label = isToken ? colorLabels[value as ColorToken] : `#${value}`;
  return (
    <div className="color-control">
      <button
        ref={trigger}
        type="button"
        className="button"
        popoverTarget={panelId}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="swatch" style={{ background: previewColor(value) }} aria-hidden="true" />
        <span className="color-control-label">
          <span className="visually-hidden">Colour: </span>
          {label}
        </span>
        <UiIcon name="chevron-down" size={14} />
      </button>
      <div ref={panel} className="popover" id={panelId} popover="auto">
        <fieldset className="swatch-grid">
          <legend className="popover-title">Preview colour</legend>
          {colorTokens.map((token) => (
            <label key={token} className="swatch-option" title={colorLabels[token]}>
              <input
                type="radio"
                name={`${panelId}-color`}
                checked={value === token}
                onChange={() => onChange(token)}
              />
              <span className="swatch swatch-lg" style={{ background: previewColor(token) }} />
              <span className="visually-hidden">{colorLabels[token]}</span>
            </label>
          ))}
        </fieldset>
        <label className="custom-color">
          <span>Custom</span>
          <input
            type="color"
            value={isToken ? "#ea580c" : `#${value}`}
            onChange={(event) => onChange(event.target.value.slice(1).toLowerCase())}
          />
          <code>{isToken ? "—" : `#${value}`}</code>
        </label>
        <p className="popover-note">
          Icons inherit <code>currentColor</code>; this only tints the previews.
        </p>
      </div>
    </div>
  );
}

function ActiveFilters({
  state,
  update,
  onReset,
}: {
  state: IconsState;
  update: Update<IconsState>;
  onReset: () => void;
}) {
  const chips: { key: string; label: string; clear: Partial<IconsState> }[] = [];
  if (state.category) {
    chips.push({
      key: "category",
      label: categoryLabels.get(state.category) ?? state.category,
      clear: { category: "" },
    });
  }
  if (state.variants !== "all") {
    chips.push({
      key: "variants",
      label: state.variants === "filled" ? "Has filled" : "Outline only",
      clear: { variants: "all" },
    });
  }
  if (state.directionality !== "all") {
    chips.push({
      key: "direction",
      label: state.directionality === "mirror" ? "Mirrors in RTL" : "Preserved in RTL",
      clear: { directionality: "all" },
    });
  }
  if (chips.length === 0 && !state.q.trim()) return null;
  return (
    <div className="active-filters">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="filter-chip"
          aria-label={`Remove filter: ${chip.label}`}
          onClick={() => update(chip.clear, "push")}
        >
          {chip.label}
          <UiIcon name="x" size={12} />
        </button>
      ))}
      <button type="button" className="link-button" onClick={onReset}>
        Clear all
      </button>
    </div>
  );
}

export function NoResults({
  kind,
  query,
  filtered,
  onClearQuery,
  onReset,
  otherMatches = 0,
  onSearchOther,
}: {
  kind: "icons" | "logos";
  query: string;
  /** Whether filters other than the search are narrowing the set. */
  filtered: boolean;
  onClearQuery: () => void;
  onReset: () => void;
  /** How many items on the other page match the query. */
  otherMatches?: number;
  onSearchOther: () => void;
}) {
  const other = kind === "icons" ? "logos" : "icons";
  return (
    <section className="empty-state" aria-labelledby="no-results-title">
      <span className="empty-state-art" aria-hidden="true">
        <UiIcon name="search-x" size={28} strokeWidth={1.5} />
      </span>
      <h2 id="no-results-title">
        {query ? `No ${kind} match “${query}”` : `No ${kind} match these filters`}
      </h2>
      <p>
        {query
          ? kind === "icons"
            ? "Search reads names, earlier Lucide names, tags, and categories. Try a broader word, such as “arrow” or “user”."
            : "Search reads brand names, slugs, aliases, and categories. Try the company name without a suffix."
          : "Every filter narrows the set. Remove one to see more."}
        {query && filtered ? " Filters are narrowing the results too." : ""}
      </p>
      <div className="empty-state-actions">
        {query && (
          <button type="button" className="button" onClick={onClearQuery}>
            Clear search
          </button>
        )}
        {filtered && (
          <button type="button" className="button" onClick={onReset}>
            Reset all filters
          </button>
        )}
        {query && otherMatches > 0 && (
          <button type="button" className="button button-ghost" onClick={onSearchOther}>
            {formatCount(otherMatches)} {otherMatches === 1 ? other.slice(0, -1) : other} match
            {otherMatches === 1 ? "es" : ""} “{query}”
            <UiIcon name="arrow-right" size={14} />
          </button>
        )}
      </div>
    </section>
  );
}

export function MissingSelection({
  kind,
  id,
  onClose,
}: {
  kind: "icon" | "logo";
  id: string;
  onClose: () => void;
}) {
  return (
    <section className="empty-state empty-state-inset">
      <span className="empty-state-art" aria-hidden="true">
        <UiIcon name="search-x" size={28} strokeWidth={1.5} />
      </span>
      <h2>
        No {kind} named “{id}”
      </h2>
      <p>It may have been renamed or not generated yet. Choose one from the grid.</p>
      <div className="empty-state-actions">
        <button type="button" className="button" data-autofocus onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}

function EmptyCatalogue() {
  return (
    <section className="empty-state empty-state-wide">
      <span className="empty-state-art" aria-hidden="true">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      </span>
      <h2>No icons yet</h2>
      <p>Sync the outline icons from Lucide to populate the library.</p>
      <ol className="steps">
        <li>
          Run <code>bun run sync:lucide &lt;version&gt;</code>. It writes{" "}
          <code>icons/round-outline/</code>, derives the filled and sharp drawings, and regenerates
          the components.
        </li>
        <li>
          Inspect icons here: sizes, construction, stroke, surfaces, typography, RTL, variants.
        </li>
        <li>
          Adjust filled recipes in <code>config/filled.ts</code>, then run{" "}
          <code>bun run derive:filled</code> and <code>bun run generate</code>.
        </li>
      </ol>
      <p className="muted">
        {categories.length} categories configured. See <code>docs/visual-qa.md</code>.
      </p>
      <DesignValues />
    </section>
  );
}
