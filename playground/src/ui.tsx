import {
  createContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { IconComponent } from "./catalogue.js";

/**
 * Playground chrome: small, dependency-free primitives. The chrome is drawn with the catalogue's
 * own icons, looked up by id; a missing concept renders nothing, so the chrome still works with an
 * empty or partial catalogue.
 */

const UiIconContext = createContext<(id: string) => IconComponent | undefined>(() => undefined);

export const UiIconProvider = UiIconContext.Provider;

export function UiIcon({
  name,
  size = 16,
  strokeWidth,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
}) {
  const Component = useContext(UiIconContext)(name);
  return Component ? <Component size={size} strokeWidth={strokeWidth} /> : null;
}

const numberFormat = new Intl.NumberFormat("en");
export const formatCount = (value: number) => numberFormat.format(value);

/* Media queries */

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** Below this width, drawers and the sidebar are modal sheets instead of docked panels. */
export const dockedInspectorQuery = "(min-width: 1280px)";
export const dockedSidebarQuery = "(min-width: 960px)";

/* Overlays: Escape stacking, focus trapping, scroll locking */

const escapeStack: (() => void)[] = [];

function onDocumentKey(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  // An open native popover takes this Escape for itself.
  if (document.querySelector(":popover-open")) return;
  const top = escapeStack.at(-1);
  if (top) {
    event.preventDefault();
    top();
  }
}

/** Calls `onEscape` when Escape is pressed and this is the top-most open layer. */
export function useEscape(onEscape: () => void, active = true) {
  const handler = useRef(onEscape);
  handler.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const entry = () => handler.current();
    if (escapeStack.length === 0) document.addEventListener("keydown", onDocumentKey);
    escapeStack.push(entry);
    return () => {
      escapeStack.splice(escapeStack.indexOf(entry), 1);
      if (escapeStack.length === 0) document.removeEventListener("keydown", onDocumentKey);
    };
  }, [active]);
}

const focusable =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="radio"]), input[type="radio"]:checked:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function tabbables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(focusable)].filter(
    (element) => !element.closest("[hidden], [inert]") && element.getClientRects().length > 0,
  );
}

/**
 * Keeps keyboard focus inside `ref` while active: focus moves in on open (to `[data-autofocus]`,
 * else the container), Tab cycles within, and on close focus goes to `restore()` (the item now
 * inspected) or, failing that, back to where it was.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  restore?: () => HTMLElement | null | undefined,
) {
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  useEffect(() => {
    const container = ref.current;
    if (!active || !container) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initial = container.querySelector<HTMLElement>("[data-autofocus]") ?? container;
    initial.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = tabbables(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null;
      // Another layer above this one (the command palette) keeps its own focus.
      if (target && !container.contains(target) && !(target as Element).closest?.("[data-layer]")) {
        container.focus({ preventScroll: true });
      }
    };
    container.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      container.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      // The current item (after stepping through several) wins over the original opener.
      const preferred = restoreRef.current?.();
      const target =
        preferred && document.contains(preferred)
          ? preferred
          : previous && document.contains(previous)
            ? previous
            : null;
      target?.focus({ preventScroll: true });
    };
  }, [active, ref]);
}

/** Locks page scrolling while a modal layer is open. The scrollbar gutter is reserved in CSS. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const count = Number(root.dataset.scrollLocks ?? 0) + 1;
    root.dataset.scrollLocks = String(count);
    return () => {
      const remaining = Number(root.dataset.scrollLocks ?? 1) - 1;
      if (remaining <= 0) delete root.dataset.scrollLocks;
      else root.dataset.scrollLocks = String(remaining);
    };
  }, [active]);
}

/* Toasts */

type Toast = { id: number; message: string; tone: "success" | "error" };
const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const counter = useRef(0);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const show = useCallback((message: string, tone: Toast["tone"] = "success") => {
    counter.current += 1;
    setToast({ id: counter.current, message, tone });
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast" data-tone={toast.tone}>
            <UiIcon name={toast.tone === "success" ? "circle-check" : "circle-alert"} size={16} />
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

/** Copies `text` and confirms with a toast and a brief check mark in place. */
export function CopyButton({
  text,
  label,
  toast,
  children,
  variant = "icon",
}: {
  /** Text to copy, or a function producing it at click time. */
  text: string | (() => string);
  /** Accessible name and tooltip. */
  label: string;
  /** Toast message on success. */
  toast?: string;
  children?: ReactNode;
  variant?: "icon" | "button" | "primary";
}) {
  const notify = useToast();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = () => {
    const value = typeof text === "function" ? text() : text;
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true);
        notify(toast ?? "Copied to clipboard");
      },
      () => notify("Clipboard unavailable in this context", "error"),
    );
  };
  if (variant === "icon") {
    return (
      <button
        type="button"
        className="icon-button"
        aria-label={label}
        title={label}
        data-copied={copied || undefined}
        onClick={copy}
      >
        <UiIcon name={copied ? "check" : "copy"} size={14} />
      </button>
    );
  }
  return (
    <button
      type="button"
      className={variant === "primary" ? "button button-primary" : "button"}
      data-copied={copied || undefined}
      title={label}
      onClick={copy}
    >
      <UiIcon name={copied ? "check" : "copy"} size={14} />
      {children ?? "Copy"}
    </button>
  );
}

/* Form controls */

export type SegmentedOption<T extends string> = {
  readonly value: T;
  readonly label: ReactNode;
  /** Accessible name when the label is an icon. */
  readonly ariaLabel?: string;
  readonly title?: string;
  readonly disabled?: boolean;
};

/** A labelled radio group drawn as a segmented control. Arrow keys move between options. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
  className,
}: {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={["segmented", `segmented-${size}`, className].filter(Boolean).join(" ")}>
      <legend className="visually-hidden">{label}</legend>
      {options.map((option) => (
        <label key={option.value} title={option.title} data-disabled={option.disabled || undefined}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            disabled={option.disabled}
            aria-label={option.ariaLabel}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** A collapsible sidebar section with a real button and `aria-expanded`. */
export function Disclosure({
  title,
  children,
  defaultOpen = true,
  aside,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  aside?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="disclosure" data-open={open || undefined}>
      <div className="disclosure-head">
        <button
          type="button"
          className="disclosure-toggle"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((current) => !current)}
        >
          <UiIcon name="chevron-right" size={14} />
          <span>{title}</span>
        </button>
        {aside}
      </div>
      <div id={id} className="disclosure-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}

/**
 * Up and Down (and Home and End) move focus between the buttons of a vertical list, so a long
 * list such as the categories is one Tab stop away from the next control, not forty.
 */
export function useListKeys() {
  return useMemo(
    () => ({
      onKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
        const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
        if (!keys.includes(event.key)) return;
        const items = [
          ...event.currentTarget.querySelectorAll<HTMLElement>("[data-list-item]:not(:disabled)"),
        ];
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (index === -1) return;
        event.preventDefault();
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : Math.min(
                  items.length - 1,
                  Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)),
                );
        items[next]?.focus();
      },
    }),
    [],
  );
}

/**
 * A sticky page toolbar. Its height is published as `--toolbar-h`, so `scroll-padding-top` and
 * keyboard scrolling in the grids keep items clear of it even when its controls wrap.
 */
export function Toolbar({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--toolbar-h", `${element.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="toolbar" role="toolbar" aria-label={label}>
      {children}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/** ⌘ on Apple platforms, Ctrl elsewhere. */
export const modKey =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
