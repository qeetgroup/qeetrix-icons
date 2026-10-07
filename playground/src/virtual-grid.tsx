import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  columnsFor,
  type GridKey,
  type GridRow,
  layoutGrid,
  moveInGrid,
  visibleRows,
} from "./grid-layout.js";

/**
 * A windowed grid scrolled by the page: only rows near the viewport are in the DOM, so 1,900 icon
 * tiles stay as cheap as a hundred. Implements the WAI-ARIA grid pattern with a
 * roving tab stop: one Tab stop for the whole grid, arrow keys, Home/End (Ctrl for the ends of the
 * list), and Page Up/Down. The active item's row is always rendered, so focus is never lost to
 * virtualization. A single delayed tooltip follows hover and keyboard focus.
 */

export type GridGroup = { readonly key: string; readonly label: string; readonly count: number };

export type GridItemProps = {
  readonly index: number;
  readonly tabIndex: 0 | -1;
  readonly "data-index": number;
};

type VirtualGridProps = {
  label: string;
  className?: string;
  groups: readonly GridGroup[];
  showHeaders: boolean;
  minTileWidth: number;
  columnGap: number;
  rowGap: number;
  rowHeight: number;
  headerHeight: number;
  /** The selected item, or -1. Where the roving tab stop starts. */
  selectedIndex: number;
  /** Renders a focusable item; spread `props` onto it. */
  renderItem: (props: GridItemProps) => ReactNode;
  renderHeader?: (group: GridGroup, index: number) => ReactNode;
  renderTooltip?: (index: number) => ReactNode;
  /** Called when keyboard navigation moves to an item (selection may follow it). */
  onNavigate?: (index: number) => void;
  /** Scrolls this item into view whenever `revealKey` changes. */
  revealIndex?: number;
  revealKey?: unknown;
  /** Pixels trimmed from the bottom, to clip the last row's hairline under a framed grid. */
  trimEnd?: number;
};

const gridKeys: readonly string[] = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
];
const overscan = 480;
const tooltipDelay = 450;

function stickyOffset(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function VirtualGrid({
  label,
  className,
  groups,
  showHeaders,
  minTileWidth,
  columnGap,
  rowGap,
  rowHeight,
  headerHeight,
  selectedIndex,
  renderItem,
  renderHeader,
  renderTooltip,
  onNavigate,
  revealIndex,
  revealKey,
  trimEnd = 0,
}: VirtualGridProps) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, -1]);
  const [active, setActive] = useState(-1);
  const pendingFocus = useRef(-1);
  const itemCount = groups.reduce((sum, group) => sum + group.count, 0);
  const columns = width > 0 ? columnsFor(width, minTileWidth, columnGap) : 1;
  const layout = useMemo(
    () =>
      layoutGrid(
        groups.map(({ count }) => count),
        { columns, rowHeight, rowGap, headerHeight: showHeaders ? headerHeight : 0 },
      ),
    [groups, columns, rowHeight, rowGap, headerHeight, showHeaders],
  );
  const roving =
    active >= 0 && active < itemCount
      ? active
      : selectedIndex >= 0 && selectedIndex < itemCount
        ? selectedIndex
        : 0;

  // Width, and therefore columns, follow the container (the docked inspector narrows it).
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The visible row range, recomputed on scroll and resize, committed only when it changes.
  const measure = useCallback(() => {
    const element = container.current;
    if (!element) return;
    const top = -element.getBoundingClientRect().top;
    const next = visibleRows(layout.rows, top - overscan, top + window.innerHeight + overscan);
    setRange((current) => (current[0] === next[0] && current[1] === next[1] ? current : next));
  }, [layout]);
  useLayoutEffect(() => {
    measure();
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [measure]);

  // Keyboard moves focus after render, then keeps the item clear of the sticky header.
  useLayoutEffect(() => {
    const index = pendingFocus.current;
    if (index < 0 || index !== active) return;
    pendingFocus.current = -1;
    const element = container.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!element) return;
    element.focus({ preventScroll: true });
    const rect = element.getBoundingClientRect();
    const top = stickyOffset();
    if (rect.top < top) window.scrollBy({ top: rect.top - top });
    else if (rect.bottom > window.innerHeight - 8) {
      window.scrollBy({ top: rect.bottom - window.innerHeight + 8 });
    }
  });

  // Reveal on request (deep link, command palette), once the layout knows its columns. Only an
  // explicit request scrolls; layout changes alone never move the page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberately keyed on the request.
  useEffect(() => {
    if (revealKey === undefined || width === 0) return;
    const index = revealIndex ?? -1;
    const element = container.current;
    if (!element || index < 0 || index >= itemCount) return;
    const row = layout.rows[layout.rowOfItem[index]];
    if (!row) return;
    const top = stickyOffset();
    const rowTop = element.getBoundingClientRect().top + row.top;
    if (rowTop >= top && rowTop + row.height <= window.innerHeight) return;
    window.scrollTo({
      top: window.scrollY + rowTop - top - Math.max(0, (window.innerHeight - top) / 3),
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  }, [revealKey, width === 0]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!gridKeys.includes(event.key) || event.altKey) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (!target) return;
    const index = Number(target.dataset.index);
    const visibleItemRows = Math.max(
      1,
      Math.floor((window.innerHeight - stickyOffset()) / rowHeight) - 1,
    );
    const next = moveInGrid(layout, index, event.key as GridKey, {
      toEdge: event.ctrlKey || event.metaKey,
      pageRows: visibleItemRows,
    });
    event.preventDefault();
    if (next < 0 || next === index) return;
    pendingFocus.current = next;
    setActive(next);
    hideTooltip();
    onNavigate?.(next);
  };

  // Tooltip
  const [tooltip, setTooltip] = useState<{ index: number; rect: DOMRect } | null>(null);
  const timer = useRef(0);
  const hideTooltip = useCallback(() => {
    window.clearTimeout(timer.current);
    setTooltip(null);
  }, []);
  const scheduleTooltip = (element: HTMLElement | null) => {
    window.clearTimeout(timer.current);
    if (!renderTooltip || !element) return;
    const index = Number(element.dataset.index);
    timer.current = window.setTimeout(
      () => setTooltip({ index, rect: element.getBoundingClientRect() }),
      tooltip ? 60 : tooltipDelay,
    );
  };
  useEffect(() => {
    if (!tooltip) return;
    const hide = () => setTooltip(null);
    window.addEventListener("scroll", hide, { passive: true, once: true });
    return () => window.removeEventListener("scroll", hide);
  }, [tooltip]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const element = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (!element) return;
    setActive(Number(element.dataset.index));
    if (element.matches(":focus-visible")) scheduleTooltip(element);
  };
  const onPointerOver = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const element = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (element && Number(element.dataset.index) !== tooltip?.index) scheduleTooltip(element);
  };

  const [first, last] = range;
  const rendered: number[] = [];
  for (let row = Math.max(0, first); row <= last && row < layout.rows.length; row++)
    rendered.push(row);
  const activeRow = layout.rowOfItem[roving];
  if (activeRow !== undefined && !rendered.includes(activeRow)) rendered.push(activeRow);

  // A windowed ARIA grid: rows are absolutely placed divs, so they cannot be table elements, and
  // only the item inside each cell is focusable (roving tab stop), per the WAI-ARIA grid pattern.
  // biome-ignore-start lint/a11y/useSemanticElements: see above.
  // biome-ignore-start lint/a11y/useFocusableInteractive: see above.
  const renderRow = (row: GridRow, rowIndex: number) => {
    const style: CSSProperties = { top: row.top, height: row.height };
    if (row.kind === "header") {
      const group = groups[row.group];
      return (
        <div
          key={`h-${group.key}`}
          role="row"
          aria-rowindex={rowIndex + 1}
          className="vgrid-header"
          style={style}
        >
          <div role="gridcell" aria-colspan={columns} className="vgrid-header-cell">
            {renderHeader ? renderHeader(group, row.group) : group.label}
          </div>
        </div>
      );
    }
    const cells: ReactNode[] = [];
    for (let index = row.start; index < row.end; index++) {
      cells.push(
        <div
          key={index}
          role="gridcell"
          aria-colindex={index - row.start + 1}
          aria-selected={index === selectedIndex}
          className="vgrid-cell"
        >
          {renderItem({ index, tabIndex: index === roving ? 0 : -1, "data-index": index })}
        </div>,
      );
    }
    return (
      <div
        key={`r-${row.start}`}
        role="row"
        aria-rowindex={rowIndex + 1}
        className="vgrid-row"
        style={{ ...style, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, columnGap }}
      >
        {cells}
      </div>
    );
  };

  return (
    <>
      <div
        ref={container}
        role="grid"
        aria-label={label}
        aria-rowcount={layout.rows.length}
        aria-colcount={columns}
        className={["vgrid", className].filter(Boolean).join(" ")}
        style={{ height: Math.max(0, layout.height - trimEnd) }}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={hideTooltip}
        onPointerOver={onPointerOver}
        onPointerLeave={hideTooltip}
        onPointerDown={hideTooltip}
      >
        {rendered.map((rowIndex) => renderRow(layout.rows[rowIndex], rowIndex))}
      </div>
      {tooltip && renderTooltip && (
        <Tooltip rect={tooltip.rect}>{renderTooltip(tooltip.index)}</Tooltip>
      )}
    </>
  );
  // biome-ignore-end lint/a11y/useFocusableInteractive: see above.
  // biome-ignore-end lint/a11y/useSemanticElements: see above.
}

/** A tooltip above (or, near the top, below) a rectangle, kept inside the viewport. */
function Tooltip({ rect, children }: { rect: DOMRect; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; below: boolean }>();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    const below = rect.top - height - 8 < stickyOffset();
    const left = Math.min(
      window.innerWidth - width - 8,
      Math.max(8, rect.left + rect.width / 2 - width / 2),
    );
    setPosition({ left, top: below ? rect.bottom + 8 : rect.top - height - 8, below });
  }, [rect]);
  return (
    <div
      ref={ref}
      className="tooltip"
      aria-hidden="true"
      data-placement={position?.below ? "below" : "above"}
      style={position ? { left: position.left, top: position.top } : { visibility: "hidden" }}
    >
      {children}
    </div>
  );
}
