/** Outline is primary; a filled drawing exists only when its semantics justify it. */
export type IconVariant = "outline" | "filled";

/**
 * The drawing style: `"round"`, Lucide's round caps and joins, by default; or `"sharp"`, the same
 * geometry with square caps, mitered joins, and corners squared off. Every icon has both shapes,
 * each with the same variants.
 */
export type IconShape = "round" | "sharp";

/** Whether a concept follows reading direction or retains its authored orientation. */
export type IconDirectionality = "mirror" | "preserve";
