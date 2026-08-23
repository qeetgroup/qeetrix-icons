/**
 * The consumer fixture, copied into a throwaway project by
 * scripts/verify-package.mjs and typechecked against the *shipped* declarations.
 *
 * It is deliberately written as a realistic screen rather than a list of imports:
 * a toolbar, a data table, a status column and a form. That way the check
 * exercises the props a product actually passes — `size`, `strokeWidth`,
 * `className`, `aria-label`, `aria-hidden`, event handlers and refs — instead of
 * only proving that the module resolves.
 *
 * Every import path here is a documented public entry point. Nothing reaches
 * into `dist/` or `src/`.
 */

import type { IconDeprecation, IconMetadata, QeetrixIconProps } from "@qeetrix/icons";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  BellDot,
  CheckSquare,
  ChevronRight,
  CloudUpload,
  CreditCardCheck,
  DragHandle,
  FilterX,
  ICON_DEFAULT_SIZE,
  ICON_DEFAULT_STROKE_WIDTH,
  ICON_VIEW_BOX,
  IconBase,
  ListChecks,
  Moon,
  Passkey,
  Search,
  ShieldCheck,
  SortAsc,
  Sun,
  Trash,
  UserLock,
  Vault,
  Zap,
} from "@qeetrix/icons";
import { Checks } from "@qeetrix/icons/icons/checks";
import { iconNames, icons } from "@qeetrix/icons/metadata";

// ── the pattern the README leads with ─────────────────────────────────────
export function SearchButton() {
  return (
    <button type="button" aria-label="Search">
      <Search aria-hidden="true" size={20} />
    </button>
  );
}

// ── toolbar: sizes, stroke width, class names, handlers ───────────────────
export function Toolbar({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <button type="button" aria-label="Back" onClick={onBack}>
        <ArrowLeft size={16} />
      </button>
      <SortAsc size={16} className="text-muted" />
      <FilterX size={16} strokeWidth={1.5} />
      <ListChecks size="1.25rem" />
      <BellDot size={16} aria-label="3 unread notifications" />
      <Sun size={16} aria-hidden={false} role="img" aria-label="Light theme" />
      <Moon size={16} />
      <Zap size={16} style={{ opacity: 0.6 }} />
    </div>
  );
}

// ── data table: icons as status indicators and row controls ───────────────
export function Row({ verified }: { verified: boolean }) {
  return (
    <tr>
      <td>
        <DragHandle size={16} />
      </td>
      <td>
        <CheckSquare size={16} />
      </td>
      <td>
        Ada <ChevronRight size={14} /> Security
      </td>
      <td>
        {verified ? (
          <ShieldCheck size={16} aria-label="Verified" />
        ) : (
          <Ban size={16} aria-label="Blocked" />
        )}
      </td>
      <td>
        <Passkey size={16} /> <Vault size={16} /> <UserLock size={16} />
      </td>
      <td>
        <Checks size={16} aria-label="Read" />
      </td>
      <td>
        <button type="button" aria-label="Delete row">
          <Trash size={16} />
        </button>
      </td>
    </tr>
  );
}

export function Alerts() {
  return (
    <>
      <AlertTriangle size={16} />
      <CreditCardCheck size={16} />
      <CloudUpload size={16} />
    </>
  );
}

// ── the shared shell and the spec constants are public too ────────────────
export function CustomGlyph(props: QeetrixIconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 12h16" />
    </IconBase>
  );
}

export const spec: { viewBox: string; size: number; strokeWidth: number } = {
  viewBox: ICON_VIEW_BOX,
  size: ICON_DEFAULT_SIZE,
  strokeWidth: ICON_DEFAULT_STROKE_WIDTH,
};

// ── prop spreading and refs ───────────────────────────────────────────────
const shared: QeetrixIconProps = { size: 20, "aria-hidden": true, onClick: () => {} };
export const spread = <ArrowLeft {...shared} />;
export const withRef = <ArrowLeft ref={(node: SVGSVGElement | null) => void node} />;

// ── the metadata entry point, as an icon picker would use it ──────────────
export const total: number = iconNames.length;
export const mirrored: string[] = icons.filter((icon) => icon.mirror).map((icon) => icon.component);
export const categories: string[] = [...new Set(icons.map((icon) => icon.category))].sort();

export function search(query: string): IconMetadata[] {
  const q = query.toLowerCase();
  return icons.filter(
    (icon) =>
      icon.name.includes(q) ||
      icon.tags.some((tag) => tag.includes(q)) ||
      icon.aliases.some((alias) => alias.includes(q)),
  );
}

// `deprecated` is optional, so a picker must narrow before reading it. With
// `noUncheckedIndexedAccess` on, this only compiles if the types are right.
export function supported(): IconMetadata[] {
  return icons.filter((icon) => !icon.deprecated);
}

export function deprecationNotice(icon: IconMetadata): string | null {
  const info: IconDeprecation | undefined = icon.deprecated;
  if (!info) return null;
  return info.replacement
    ? `${icon.name} is deprecated since ${info.since}; use ${info.replacement}.`
    : `${icon.name} is deprecated since ${info.since}. ${info.reason}`;
}

const first = icons[0];
export const firstName: string = first ? first.name : "none";
