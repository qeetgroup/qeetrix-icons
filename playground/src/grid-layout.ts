/**
 * Layout and keyboard arithmetic for the windowed grids. Pure, so the hard parts (rows across
 * group headers, visible ranges, arrow-key movement) are unit-tested without a browser.
 *
 * Items are one flat list. Groups split it into runs that each start on a new row, optionally
 * under a header row. Every row has a known height, so offsets are prefix sums and the visible
 * window is a binary search.
 */

export type HeaderRow = {
  readonly kind: "header";
  readonly group: number;
  readonly top: number;
  readonly height: number;
};
export type ItemRow = {
  readonly kind: "items";
  readonly group: number;
  /** First item index (inclusive) and last (exclusive). */
  readonly start: number;
  readonly end: number;
  readonly top: number;
  readonly height: number;
};
export type GridRow = HeaderRow | ItemRow;

export type GridMetrics = {
  readonly columns: number;
  readonly rowHeight: number;
  /** Vertical space between item rows. */
  readonly rowGap: number;
  /** Header row height; 0 means no header rows. */
  readonly headerHeight: number;
};

export type GridLayout = {
  readonly rows: readonly GridRow[];
  /** Row index of each item. */
  readonly rowOfItem: readonly number[];
  readonly height: number;
};

/** Columns that fit `width` with tiles at least `minTile` wide. Always at least one. */
export function columnsFor(width: number, minTile: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (minTile + gap)));
}

export function layoutGrid(groupSizes: readonly number[], metrics: GridMetrics): GridLayout {
  const columns = Math.max(1, Math.floor(metrics.columns));
  const rows: GridRow[] = [];
  const rowOfItem: number[] = [];
  let top = 0;
  let start = 0;
  groupSizes.forEach((size, group) => {
    if (size <= 0) return;
    if (metrics.headerHeight > 0) {
      rows.push({ kind: "header", group, top, height: metrics.headerHeight });
      top += metrics.headerHeight;
    }
    for (let offset = 0; offset < size; offset += columns) {
      const rowStart = start + offset;
      const rowEnd = Math.min(rowStart + columns, start + size);
      for (let item = rowStart; item < rowEnd; item++) rowOfItem[item] = rows.length;
      rows.push({
        kind: "items",
        group,
        start: rowStart,
        end: rowEnd,
        top,
        height: metrics.rowHeight,
      });
      top += metrics.rowHeight + metrics.rowGap;
    }
    start += size;
  });
  const last = rows.at(-1);
  const height = last ? last.top + last.height : 0;
  return { rows, rowOfItem, height };
}

/** The first row whose bottom edge is below `offset`. */
function firstRowBelow(rows: readonly GridRow[], offset: number): number {
  let low = 0;
  let high = rows.length - 1;
  let found = rows.length;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (rows[middle].top + rows[middle].height > offset) {
      found = middle;
      high = middle - 1;
    } else low = middle + 1;
  }
  return found;
}

/** Inclusive row range intersecting `[top, bottom]` (grid coordinates), or empty as `[0, -1]`. */
export function visibleRows(
  rows: readonly GridRow[],
  top: number,
  bottom: number,
): [first: number, last: number] {
  if (rows.length === 0 || bottom < top) return [0, -1];
  const first = firstRowBelow(rows, Math.max(0, top));
  if (first >= rows.length) return [0, -1];
  let last = first;
  while (last + 1 < rows.length && rows[last + 1].top < bottom) last++;
  return [first, last];
}

export type GridKey =
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown";

/**
 * The item a key moves to from `index`: left and right step through the list (wrapping across
 * rows); up and down keep the column, clamped to shorter rows, skipping headers; Home and End go
 * to the row's ends, or the list's with `toEdge` (Ctrl/⌘); Page keys move `pageRows` item rows.
 */
export function moveInGrid(
  layout: GridLayout,
  index: number,
  key: GridKey,
  options: { readonly toEdge?: boolean; readonly pageRows?: number } = {},
): number {
  const count = layout.rowOfItem.length;
  if (count === 0) return -1;
  if (index < 0 || index >= count) return 0;
  const row = layout.rows[layout.rowOfItem[index]] as ItemRow;
  const column = index - row.start;
  const stepRows = (rowIndex: number, direction: 1 | -1, steps: number) => {
    let target = rowIndex;
    let moved = 0;
    for (
      let next = rowIndex + direction;
      next >= 0 && next < layout.rows.length;
      next += direction
    ) {
      if (layout.rows[next].kind !== "items") continue;
      target = next;
      moved++;
      if (moved === steps) break;
    }
    const destination = layout.rows[target] as ItemRow;
    return Math.min(destination.start + column, destination.end - 1);
  };
  switch (key) {
    case "ArrowLeft":
      return Math.max(0, index - 1);
    case "ArrowRight":
      return Math.min(count - 1, index + 1);
    case "ArrowUp":
      return stepRows(layout.rowOfItem[index], -1, 1);
    case "ArrowDown":
      return stepRows(layout.rowOfItem[index], 1, 1);
    case "PageUp":
      return stepRows(layout.rowOfItem[index], -1, Math.max(1, options.pageRows ?? 1));
    case "PageDown":
      return stepRows(layout.rowOfItem[index], 1, Math.max(1, options.pageRows ?? 1));
    case "Home":
      return options.toEdge ? 0 : row.start;
    case "End":
      return options.toEdge ? count - 1 : row.end - 1;
  }
}
