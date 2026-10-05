import { type ReactNode, useRef } from "react";
import {
  dockedInspectorQuery,
  dockedSidebarQuery,
  useEscape,
  useFocusTrap,
  useMediaQuery,
  useScrollLock,
} from "./ui.js";

/**
 * The frame every page shares: a sidebar, the main column, and an inspector. On wide screens the
 * sidebar and the inspector are docked and the grid stays interactive beside them, so a reviewer
 * can click from tile to tile; on narrower screens both become modal sheets with a scrim, a focus
 * trap, and focus restored on close. Escape closes the inspector in either form.
 */
export function PageLayout({
  sidebar,
  sidebarLabel,
  sidebarOpen,
  onCloseSidebar,
  inspector,
  inspectorLabel,
  onCloseInspector,
  restoreFocus,
  children,
}: {
  sidebar: ReactNode;
  sidebarLabel: string;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  /** Inspector content, or null when nothing is inspected. */
  inspector: ReactNode;
  inspectorLabel: string;
  onCloseInspector: () => void;
  /** Where focus goes when a modal inspector closes and its opener has left the page. */
  restoreFocus?: () => HTMLElement | null | undefined;
  children: ReactNode;
}) {
  const sidebarDocked = useMediaQuery(dockedSidebarQuery);
  const inspectorDocked = useMediaQuery(dockedInspectorQuery);
  const inspecting = inspector !== null && inspector !== undefined && inspector !== false;
  useEscape(onCloseInspector, inspecting && inspectorDocked);
  return (
    <div className="layout" data-inspector={inspecting && inspectorDocked ? "docked" : undefined}>
      {sidebarDocked ? (
        <nav className="sidebar" aria-label={sidebarLabel}>
          <div className="sidebar-scroll">{sidebar}</div>
        </nav>
      ) : (
        sidebarOpen && (
          <Sheet side="left" label={sidebarLabel} onClose={onCloseSidebar}>
            <div className="sheet-head">
              <span className="sheet-title">{sidebarLabel}</span>
              <CloseButton label="Close filters" onClick={onCloseSidebar} />
            </div>
            <nav className="sidebar sidebar-sheet" aria-label={sidebarLabel}>
              <div className="sidebar-scroll">{sidebar}</div>
            </nav>
          </Sheet>
        )
      )}
      <main className="main" id="main">
        {children}
      </main>
      {inspecting &&
        (inspectorDocked ? (
          <aside className="inspector-dock" aria-label={inspectorLabel}>
            {inspector}
          </aside>
        ) : (
          <Sheet
            side="right"
            label={inspectorLabel}
            onClose={onCloseInspector}
            restoreFocus={restoreFocus}
          >
            {inspector}
          </Sheet>
        ))}
    </div>
  );
}

/** A modal panel sliding in from one side, over a scrim. */
export function Sheet({
  side,
  label,
  onClose,
  restoreFocus,
  children,
}: {
  side: "left" | "right";
  label: string;
  onClose: () => void;
  restoreFocus?: () => HTMLElement | null | undefined;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, restoreFocus);
  useEscape(onClose);
  useScrollLock(true);
  return (
    <div className="layer" data-layer>
      <div className="scrim" aria-hidden="true" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`sheet sheet-${side}`}
      >
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={`${label} (Esc)`}
      onClick={onClick}
    >
      <CloseGlyph />
    </button>
  );
}

/** Drawn inline so the close control never depends on the catalogue. */
function CloseGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M18 6 6 18M6 6l12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
