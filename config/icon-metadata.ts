import type { LucideData } from "../scripts/lib/lucide.js";
import type { IconDirectionality } from "../src/types/icon.js";
import lucideJson from "./lucide.json";

/** Catalogue metadata for one icon name. Every field is optional. */
export type IconMetadata = {
  /** Defaults to `iconSystem.architecture.defaultDirectionality` ("preserve"). */
  readonly directionality?: IconDirectionality;
  /** Every category the icon belongs to; the first must be its source folder. */
  readonly categories?: readonly string[];
  /** Search keywords. */
  readonly tags?: readonly string[];
  /** Earlier names, for search and migration. Never exported. */
  readonly aliases?: readonly string[];
};

const lucide: LucideData = lucideJson;

/**
 * Semantic concepts that follow reading direction in RTL (docs/rtl.md). Physical directions such
 * as arrow-left, chevron-right, corner-*, and panel-left-* keep the default "preserve".
 */
const mirrored = [
  "undo",
  "undo-2",
  "undo-dot",
  "redo",
  "redo-2",
  "redo-dot",
  "reply",
  "reply-all",
  "message-square-reply",
  // Forwarding a message, not media fast-forward.
  "forward",
  "send",
  "send-horizontal",
  "log-in",
  "log-out",
  // Text-relative: indentation and start/end alignment follow reading direction.
  "list-indent-increase",
  "list-indent-decrease",
  "text-align-start",
  "text-align-end",
];

/**
 * Metadata keyed by canonical icon name: Lucide's categories, tags, and aliases for every synced
 * icon (config/lucide.json), plus the RTL policy above. Name, variant, and component names come
 * from the source path. A mirrored name with no source still gets an entry, so validation reports
 * it instead of silently dropping it. See docs/rtl.md before adding one.
 */
export const iconMetadata: Readonly<Record<string, IconMetadata>> = {
  ...lucide.icons,
  ...Object.fromEntries(
    mirrored.map((name) => [name, { ...lucide.icons[name], directionality: "mirror" as const }]),
  ),
};
