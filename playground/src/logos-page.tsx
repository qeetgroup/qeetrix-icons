import { useEffect, useMemo, useRef, useState } from "react";
import { MissingSelection, NoResults, SearchField, type Update } from "./icons-page.js";
import { PageLayout } from "./layout.js";
import { LogoArt } from "./logo-art.js";
import {
  type BackgroundMode,
  backgroundModes,
  collectionOptions,
  filterLogos,
  groupByCollection,
  kindOptions,
  type LicenseClass,
  type LogoEntry,
  type LogoFilter,
  type LogoIndex,
  licenseInfo,
  licenseOptions,
  pickVariant,
  suitsBackground,
  type VariantKind,
} from "./logo-catalogue.js";
import { LogoInspector } from "./logo-inspector.js";
import { useLogoIndex } from "./logo-modules.js";
import {
  Disclosure,
  formatCount,
  Segmented,
  Toolbar,
  UiIcon,
  useListKeys,
  useMediaQuery,
} from "./ui.js";
import type { LogosState } from "./url-state.js";
import { type GridGroup, VirtualGrid } from "./virtual-grid.js";

const cardArtHeight = 40;

export function LogosPage({
  state,
  update,
  revealKey,
  onSearchIcons,
  countIcons,
}: {
  state: LogosState;
  update: Update<LogosState>;
  revealKey: number;
  onSearchIcons: (query: string) => void;
  /** How many icons match a query, for the no-results state. */
  countIcons: (query: string) => number;
}) {
  const index = useLogoIndex();
  if (!index) return <LogosLoading />;
  if (index.logos.length === 0) return <NoLogos />;
  return (
    <LoadedLogosPage
      index={index}
      state={state}
      update={update}
      revealKey={revealKey}
      onSearchIcons={onSearchIcons}
      countIcons={countIcons}
    />
  );
}

function LoadedLogosPage({
  index,
  state,
  update,
  revealKey,
  onSearchIcons,
  countIcons,
}: {
  index: LogoIndex;
  state: LogosState;
  update: Update<LogosState>;
  revealKey: number;
  onSearchIcons: (query: string) => void;
  countIcons: (query: string) => number;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const compact = useMediaQuery("(max-width: 640px)");
  const byId = useMemo(() => new Map(index.logos.map((logo) => [logo.id, logo])), [index]);
  const collections = useMemo(() => collectionOptions(index), [index]);
  const collection = collections.some(({ id }) => id === state.collection) ? state.collection : "";
  const filter = useMemo<LogoFilter>(
    () => ({ query: state.q, collection, licenses: state.licenses, kinds: state.kinds }),
    [state.q, collection, state.licenses, state.kinds],
  );
  const visible = useMemo(() => filterLogos(index.logos, filter), [index, filter]);
  const grouped = !state.q.trim() && !collection;
  const groups = useMemo(
    () => (grouped ? groupByCollection(visible, index) : []),
    [grouped, visible, index],
  );
  const gridGroups: GridGroup[] = useMemo(
    () =>
      grouped
        ? groups.map(({ id, label, logos }) => ({ key: id, label, count: logos.length }))
        : [{ key: "results", label: "Results", count: visible.length }],
    [grouped, groups, visible],
  );
  const positions = useMemo(() => new Map(visible.map((logo, i) => [logo.id, i])), [visible]);
  const selected = state.logo ? byId.get(state.logo) : undefined;
  const selectedIndex = selected ? (positions.get(selected.id) ?? -1) : -1;
  const resetFilters = () => update({ q: "", collection: "", licenses: [], kinds: [] }, "push");
  const iconMatches = visible.length === 0 && state.q.trim() ? countIcons(state.q) : 0;
  const collectionLabel = collections.find(({ id }) => id === collection)?.label;
  const heading = state.q.trim()
    ? `Results for “${state.q.trim()}”`
    : (collectionLabel ?? "All logos");

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

  const step = (direction: 1 | -1) => {
    if (selectedIndex === -1) return;
    const next = visible[selectedIndex + direction];
    if (next) update({ logo: next.id }, "replace");
  };
  const cardFor = (id: string | undefined) =>
    id ? document.querySelector<HTMLElement>(`[data-logo-id="${id}"]`) : null;
  const closeInspector = () => {
    const id = state.logo;
    const hadFocus = document.activeElement?.closest(".inspector-dock") !== null;
    update({ logo: undefined }, "push");
    if (hadFocus) requestAnimationFrame(() => cardFor(id)?.focus({ preventScroll: true }));
  };

  return (
    <PageLayout
      sidebarLabel="Logo collections and filters"
      sidebarOpen={sidebarOpen}
      onCloseSidebar={() => setSidebarOpen(false)}
      sidebar={
        <LogoSidebar
          index={index}
          filter={filter}
          state={state}
          update={(change, mode) => {
            update(change, mode);
            if ("collection" in change) setSidebarOpen(false);
          }}
        />
      }
      inspectorLabel={selected ? `${selected.title} logo` : "Logo inspector"}
      onCloseInspector={closeInspector}
      restoreFocus={() => cardFor(state.logo)}
      inspector={
        state.logo ? (
          selected ? (
            <LogoInspector
              key={selected.id}
              logo={selected}
              collectionLabel={
                index.collections.find(({ id }) => id === selected.collection)?.label ??
                selected.collection
              }
              position={
                selectedIndex === -1 ? undefined : { index: selectedIndex, total: visible.length }
              }
              onStep={step}
              onClose={closeInspector}
            />
          ) : (
            <MissingSelection kind="logo" id={state.logo} onClose={closeInspector} />
          )
        ) : null
      }
    >
      <header className="page-header">
        <div className="page-heading">
          <p className="eyebrow">Library</p>
          <h1>Logos</h1>
          <p className="page-lede">
            {formatCount(index.logos.length)} brand logos from theSVG
            {index.version ? ` ${index.version}` : ""}, embedded byte for byte. Each renders at its
            own aspect ratio.
          </p>
        </div>
        <p className="trademark-line">
          <UiIcon name="info" size={14} />
          Logos are trademarks of their owners, shown for identification only.
        </p>
      </header>

      <Toolbar label="Logo display">
        <button
          type="button"
          className="button toolbar-filters"
          onClick={() => setSidebarOpen(true)}
        >
          <UiIcon name="sliders-horizontal" size={15} />
          Filters
          {(collection ? 1 : 0) + state.licenses.length + state.kinds.length > 0 && (
            <span className="badge">
              {(collection ? 1 : 0) + state.licenses.length + state.kinds.length}
            </span>
          )}
        </button>
        <SearchField
          inputRef={search}
          value={state.q}
          placeholder={`Search ${formatCount(index.logos.length)} logos`}
          label="Search logos by name, slug, alias, or category"
          onChange={(q) => update({ q })}
        />
        <div className="toolbar-controls">
          <Segmented<BackgroundMode>
            label="Card background"
            value={state.bg}
            options={backgroundModes.map(({ value, label }) => ({
              value,
              label: (
                <>
                  <span className={`bg-glyph bg-glyph-${value}`} aria-hidden="true" />
                  {label}
                </>
              ),
              title:
                value === "checker"
                  ? "Transparent: shows exactly what each file paints"
                  : `${label} background; picks the variant drawn for it where one exists`,
            }))}
            onChange={(bg) => update({ bg })}
          />
        </div>
      </Toolbar>

      <div className="results-bar">
        <p className="results-summary" aria-live="polite">
          <strong>{heading}</strong>
          <span className="results-count">
            {visible.length === index.logos.length
              ? `${formatCount(visible.length)} logos`
              : `${formatCount(visible.length)} of ${formatCount(index.logos.length)}`}
          </span>
        </p>
        <LogoActiveFilters
          state={state}
          collectionLabel={collectionLabel}
          update={update}
          onReset={resetFilters}
        />
      </div>

      {visible.length === 0 ? (
        <NoResults
          kind="logos"
          query={state.q.trim()}
          filtered={collection !== "" || state.licenses.length > 0 || state.kinds.length > 0}
          onClearQuery={() => update({ q: "" })}
          onReset={resetFilters}
          otherMatches={iconMatches}
          onSearchOther={() => onSearchIcons(state.q.trim())}
        />
      ) : (
        <VirtualGrid
          label={`${heading}, ${visible.length} logos`}
          className="logo-grid"
          groups={gridGroups}
          showHeaders={grouped}
          minTileWidth={compact ? 148 : 196}
          columnGap={compact ? 8 : 12}
          rowGap={compact ? 8 : 12}
          rowHeight={compact ? 148 : 164}
          headerHeight={56}
          selectedIndex={selectedIndex}
          revealIndex={selectedIndex}
          revealKey={revealKey}
          onNavigate={(next) => {
            if (state.logo && visible[next]) update({ logo: visible[next].id }, "replace");
          }}
          renderHeader={(group) => (
            <h2 className="grid-heading grid-heading-loose">
              {group.label}
              <span className="grid-heading-count">{formatCount(group.count)}</span>
            </h2>
          )}
          renderItem={({ index: position, ...props }) => {
            const logo = visible[position];
            return (
              <LogoCard
                key={logo.id}
                logo={logo}
                bg={state.bg}
                selected={logo.id === state.logo}
                itemProps={props}
                onSelect={() =>
                  update({ logo: logo.id === state.logo ? undefined : logo.id }, "push")
                }
              />
            );
          }}
        />
      )}
    </PageLayout>
  );
}

function LogoCard({
  logo,
  bg,
  selected,
  itemProps,
  onSelect,
}: {
  logo: LogoEntry;
  bg: BackgroundMode;
  selected: boolean;
  itemProps: { tabIndex: 0 | -1; "data-index": number };
  onSelect: () => void;
}) {
  const variant = pickVariant(logo, bg);
  const license = licenseInfo(logo.licenseClass);
  const count = logo.variants.length;
  return (
    <button
      type="button"
      className="logo-card"
      {...itemProps}
      data-logo-id={logo.id}
      aria-current={selected ? "true" : undefined}
      aria-label={`${logo.title}, ${count} ${count === 1 ? "variant" : "variants"}, ${license.label} licence`}
      onClick={onSelect}
    >
      <span className={`logo-card-art backdrop-${bg}`}>
        <LogoArt logo={logo} variant={variant.name} height={cardArtHeight} delay={50} />
        {!suitsBackground(variant, bg) && (
          <span className="bg-mismatch" title={`No variant is drawn for ${bg} backgrounds`}>
            {variant.background === "light" ? "Light bg only" : "Dark bg only"}
          </span>
        )}
      </span>
      <span className="logo-card-body">
        <span className="logo-card-title">{logo.title}</span>
        <span className="logo-card-meta">
          {logo.hex ? (
            <>
              <span className="swatch swatch-sm" style={{ background: `#${logo.hex}` }} />
              <span className="mono">#{logo.hex}</span>
            </>
          ) : (
            <span>No brand colour</span>
          )}
          <span className="meta-sep" aria-hidden="true" />
          <span>
            {count} {count === 1 ? "variant" : "variants"}
          </span>
          {license.tone === "warning" && (
            <span className="license-flag" title={`${license.label} licence: review before use`}>
              <UiIcon name="triangle-alert" size={13} />
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function LogoSidebar({
  index,
  filter,
  state,
  update,
}: {
  index: LogoIndex;
  filter: LogoFilter;
  state: LogosState;
  update: Update<LogosState>;
}) {
  const listKeys = useListKeys();
  // Facet counts: each facet counts what the other filters leave.
  const collectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const logo of filterLogos(index.logos, { ...filter, collection: "" })) {
      counts.set(logo.collection, (counts.get(logo.collection) ?? 0) + 1);
    }
    return counts;
  }, [index, filter]);
  const licenses = useMemo(
    () => licenseOptions(filterLogos(index.logos, { ...filter, licenses: [] })),
    [index, filter],
  );
  const kinds = useMemo(
    () => kindOptions(filterLogos(index.logos, { ...filter, kinds: [] })),
    [index, filter],
  );
  const allCount = [...collectionCounts.values()].reduce((sum, count) => sum + count, 0);
  const toggle = <T extends string>(list: readonly T[], value: T) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  return (
    <>
      <Disclosure title="Collections">
        <ul className="nav-list" {...listKeys}>
          <li>
            <button
              type="button"
              className="nav-item"
              data-list-item
              aria-current={filter.collection === "" ? "true" : undefined}
              onClick={() => update({ collection: "" }, "push")}
            >
              <UiIcon name="layout-grid" size={15} />
              <span className="nav-label">All logos</span>
              <span className="nav-count">{formatCount(allCount)}</span>
            </button>
          </li>
          {collectionOptions(index).map(({ id, label }) => (
            <li key={id}>
              <button
                type="button"
                className="nav-item"
                data-list-item
                aria-current={filter.collection === id ? "true" : undefined}
                data-empty={(collectionCounts.get(id) ?? 0) === 0 || undefined}
                onClick={() => update({ collection: id }, "push")}
              >
                <span className="nav-label">{label}</span>
                <span className="nav-count">{formatCount(collectionCounts.get(id) ?? 0)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Disclosure>
      <Disclosure
        title="Licence"
        aside={
          state.licenses.length > 0 ? (
            <button
              type="button"
              className="link-button"
              onClick={() => update({ licenses: [] }, "push")}
            >
              Clear
            </button>
          ) : undefined
        }
      >
        <fieldset className="check-list">
          <legend className="visually-hidden">Licence class</legend>
          {licenses.map((option) => (
            <label
              key={option.id}
              className="check-item"
              title={option.summary}
              data-empty={option.count === 0 || undefined}
            >
              <input
                type="checkbox"
                checked={state.licenses.includes(option.id)}
                onChange={() =>
                  update({ licenses: toggle<LicenseClass>(state.licenses, option.id) }, "push")
                }
              />
              <span className="tone-dot" data-tone={option.tone} aria-hidden="true" />
              <span className="nav-label">{option.label}</span>
              <span className="nav-count">{formatCount(option.count)}</span>
            </label>
          ))}
        </fieldset>
        <p className="sidebar-hint">
          <span className="tone-dot" data-tone="warning" aria-hidden="true" /> Non-commercial,
          copyleft, and unlicensed logos need review before they ship.
        </p>
      </Disclosure>
      <Disclosure
        title="Variants"
        aside={
          state.kinds.length > 0 ? (
            <button
              type="button"
              className="link-button"
              onClick={() => update({ kinds: [] }, "push")}
            >
              Clear
            </button>
          ) : undefined
        }
      >
        <fieldset className="check-list">
          <legend className="visually-hidden">Has variant</legend>
          {kinds
            .filter(({ count, id }) => count > 0 || state.kinds.includes(id))
            .map((option) => (
              <label
                key={option.id}
                className="check-item"
                data-empty={option.count === 0 || undefined}
              >
                <input
                  type="checkbox"
                  checked={state.kinds.includes(option.id)}
                  onChange={() =>
                    update({ kinds: toggle<VariantKind>(state.kinds, option.id) }, "push")
                  }
                />
                <span className="nav-label">{option.label}</span>
                <span className="nav-count">{formatCount(option.count)}</span>
              </label>
            ))}
        </fieldset>
        <p className="sidebar-hint">Selected variants must all be present.</p>
      </Disclosure>
      <div className="sidebar-footer">
        <p className="sidebar-note">
          Source: theSVG{index.version ? ` ${index.version}` : ""}
          {index.commit ? (
            <>
              {" "}
              at <code title={index.commit}>{index.commit.slice(0, 7)}</code>
            </>
          ) : null}
          . Logos are trademarks of their respective owners.
        </p>
      </div>
    </>
  );
}

function LogoActiveFilters({
  state,
  collectionLabel,
  update,
  onReset,
}: {
  state: LogosState;
  collectionLabel?: string;
  update: Update<LogosState>;
  onReset: () => void;
}) {
  const chips: { key: string; label: string; clear: Partial<LogosState> }[] = [];
  if (collectionLabel)
    chips.push({ key: "collection", label: collectionLabel, clear: { collection: "" } });
  for (const license of state.licenses) {
    chips.push({
      key: `license-${license}`,
      label: licenseInfo(license).label,
      clear: { licenses: state.licenses.filter((item) => item !== license) },
    });
  }
  for (const kind of state.kinds) {
    chips.push({
      key: `kind-${kind}`,
      label: `Has ${kind === "sized" ? "pixel sizes" : kind}`,
      clear: { kinds: state.kinds.filter((item) => item !== kind) },
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

function LogosLoading() {
  return (
    <div className="layout">
      <div className="main main-loading" role="status" aria-live="polite">
        <span className="visually-hidden">Loading logos…</span>
        <div className="page-header">
          <div className="page-heading">
            <span className="skeleton skeleton-line" style={{ width: 64 }} />
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-line" style={{ width: 420 }} />
          </div>
        </div>
        <div className="skeleton-grid">
          {Array.from({ length: 15 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders.
            <span key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      </div>
    </div>
  );
}

function NoLogos() {
  return (
    <div className="layout">
      <main className="main" id="main">
        <section className="empty-state empty-state-wide">
          <span className="empty-state-art" aria-hidden="true">
            <UiIcon name="badge-check" size={28} strokeWidth={1.5} />
          </span>
          <h2>No logos yet</h2>
          <p>
            Sync the brand logos and generate their components with <code>bun run sync:brands</code>{" "}
            and <code>bun run generate:logos</code>, then reload.
          </p>
        </section>
      </main>
    </div>
  );
}
