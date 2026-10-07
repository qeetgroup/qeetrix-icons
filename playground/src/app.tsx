import meta from "virtual:qeetrix-meta";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Catalogue, emptyFilter, filterIcons } from "./catalogue.js";
import { CommandPalette } from "./command-palette.js";
import { IconsPage } from "./icons-page.js";
import { emptyLogoFilter, filterLogos } from "./logo-catalogue.js";
import { loadLogoIndex } from "./logo-modules.js";
import { LogosPage } from "./logos-page.js";
import {
  formatCount,
  Kbd,
  modKey,
  Segmented,
  ToastProvider,
  UiIcon,
  UiIconProvider,
} from "./ui.js";
import {
  type AppState,
  defaultIconsState,
  defaultLogosState,
  type IconsState,
  type LogosState,
  mergeNavigation,
  type Page,
  parseAppState,
  serializeAppState,
  type Theme,
} from "./url-state.js";

const themeKey = "qeetrix-playground-theme";

/** URL state, with the theme falling back to the last one chosen on this machine. */
function initialState(): AppState {
  const state = parseAppState(window.location.search);
  if (new URLSearchParams(window.location.search).has("theme")) return state;
  const stored = window.localStorage.getItem(themeKey);
  return stored === "light" || stored === "dark" ? { ...state, theme: stored } : state;
}

export function App({ catalogue }: { catalogue: Catalogue }) {
  const [state, setState] = useState<AppState>(initialState);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Bumped when a selection arrives from outside a grid, so that grid scrolls to it.
  const [revealKey, setRevealKey] = useState(0);
  const historyMode = useRef<"push" | "replace">("replace");
  const lookup = useMemo(() => (id: string) => catalogue.byId.get(id)?.Component, [catalogue]);

  const navigate = useCallback(
    (recipe: (current: AppState) => AppState, mode: "push" | "replace" = "replace") => {
      if (mode === "push") historyMode.current = "push";
      setState(recipe);
    },
    [],
  );
  const updateIcons = useCallback(
    (change: Partial<IconsState>, mode?: "push" | "replace") =>
      navigate((current) => ({ ...current, icons: { ...current.icons, ...change } }), mode),
    [navigate],
  );
  const updateLogos = useCallback(
    (change: Partial<LogosState>, mode?: "push" | "replace") =>
      navigate((current) => ({ ...current, logos: { ...current.logos, ...change } }), mode),
    [navigate],
  );
  const goTo = useCallback(
    (page: Page) => {
      navigate((current) => ({ ...current, page }), "push");
      window.scrollTo({ top: 0 });
    },
    [navigate],
  );

  // The URL follows state: pushed for navigation (pages, selections, filters), replaced for
  // typing and display tweaks, so Back steps through meaningful places only.
  useEffect(() => {
    const url = `${window.location.pathname}${serializeAppState(state)}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (url !== current) {
      if (historyMode.current === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    }
    historyMode.current = "replace";
  }, [state]);
  useEffect(() => {
    const onPop = () => {
      setState((current) => mergeNavigation(current, parseAppState(window.location.search)));
      setRevealKey((key) => key + 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Theme: applied before paint (index.html sets it even earlier), remembered locally.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    if (state.theme === "system") window.localStorage.removeItem(themeKey);
    else window.localStorage.setItem(themeKey, state.theme);
  }, [state.theme]);

  useEffect(() => {
    document.title = `${state.page === "logos" ? "Logos" : "Icons"} · Qeetrix playground`;
  }, [state.page]);

  // ⌘K / Ctrl-K toggles the palette from anywhere, including text fields.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Warm the logo index after first paint, so the palette and the Logos tab feel instant.
  useEffect(() => {
    const idle =
      window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 1200));
    idle(() => void loadLogoIndex());
  }, []);

  const openIcon = useCallback(
    (id: string) => {
      navigate((current) => {
        const icon = catalogue.byId.get(id);
        const filter = {
          query: current.icons.q,
          category: current.icons.category,
          variant: current.icons.variants,
          directionality: current.icons.directionality,
        };
        const shown = icon && filterIcons([icon], filter).length > 0;
        const icons = shown
          ? current.icons
          : {
              ...current.icons,
              q: emptyFilter.query,
              category: "",
              variants: emptyFilter.variant,
              directionality: emptyFilter.directionality,
            };
        return { ...current, page: "icons", icons: { ...icons, icon: id } };
      }, "push");
      setRevealKey((key) => key + 1);
    },
    [catalogue, navigate],
  );
  const openLogo = useCallback(
    (id: string) => {
      void loadLogoIndex().then((index) => {
        navigate((current) => {
          const logo = index.logos.find((entry) => entry.id === id);
          const filter = {
            query: current.logos.q,
            collection: current.logos.collection,
            licenses: current.logos.licenses,
            kinds: current.logos.kinds,
          };
          const shown = logo && filterLogos([logo], filter).length > 0;
          const logos = shown
            ? current.logos
            : { ...current.logos, ...emptyLogoFilter, q: "", collection: "" };
          return { ...current, page: "logos", logos: { ...logos, logo: id } };
        }, "push");
        setRevealKey((key) => key + 1);
      });
    },
    [navigate],
  );
  const searchOther = useCallback(
    (page: Page, q: string) => {
      navigate(
        (current) =>
          page === "logos"
            ? { ...current, page, logos: { ...defaultLogosState, bg: current.logos.bg, q } }
            : {
                ...current,
                page,
                icons: { ...current.icons, ...defaultIconsState, shape: current.icons.shape, q },
              },
        "push",
      );
      window.scrollTo({ top: 0 });
    },
    [navigate],
  );

  const pageLink = (page: Page) => (page === "logos" ? "?page=logos" : "?");
  const onPageLink = (page: Page) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    goTo(page);
  };

  return (
    <UiIconProvider value={lookup}>
      <ToastProvider>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="topbar">
          <a
            className="brand"
            href="?"
            onClick={onPageLink("icons")}
            aria-label="Qeetrix playground, Icons"
          >
            <span className="brand-mark" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3.5a8.5 8.5 0 0 0 6 8.5 8.5 8.5 0 0 0-6 8.5 8.5 8.5 0 0 0-6-8.5 8.5 8.5 0 0 0 6-8.5Z"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="brand-name">Qeetrix</span>
            <span className="brand-divider" aria-hidden="true" />
            <span className="brand-product">Playground</span>
          </a>
          <nav className="topnav" aria-label="Library">
            {(
              [
                ["icons", "Icons", catalogue.icons.length],
                ["logos", "Logos", meta.logos?.count ?? 0],
              ] as const
            ).map(([page, label, count]) => (
              <a
                key={page}
                href={pageLink(page)}
                className="topnav-link"
                aria-current={state.page === page ? "page" : undefined}
                onClick={onPageLink(page)}
              >
                {label}
                {count > 0 && <span className="topnav-count">{formatCount(count)}</span>}
              </a>
            ))}
          </nav>
          <div className="topbar-end">
            <button
              type="button"
              className="search-trigger"
              aria-keyshortcuts="Meta+K Control+K"
              aria-haspopup="dialog"
              onClick={() => setPaletteOpen(true)}
            >
              <UiIcon name="search" size={15} />
              <span className="search-trigger-label">Search icons and logos</span>
              <span className="search-trigger-keys">
                <Kbd>{modKey}</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
            <VersionStamp />
            <Segmented<Theme>
              label="Theme"
              size="sm"
              className="theme-switch"
              value={state.theme}
              options={[
                {
                  value: "light",
                  label: <UiIcon name="sun" size={15} />,
                  ariaLabel: "Light theme",
                  title: "Light",
                },
                {
                  value: "system",
                  label: <UiIcon name="monitor" size={15} />,
                  ariaLabel: "System theme",
                  title: "Match system",
                },
                {
                  value: "dark",
                  label: <UiIcon name="moon" size={15} />,
                  ariaLabel: "Dark theme",
                  title: "Dark",
                },
              ]}
              onChange={(theme) => navigate((current) => ({ ...current, theme }))}
            />
          </div>
        </header>

        {state.page === "logos" ? (
          <LogosPage
            state={state.logos}
            update={updateLogos}
            revealKey={revealKey}
            onSearchIcons={(q) => searchOther("icons", q)}
            countIcons={(q) => filterIcons(catalogue.icons, { ...emptyFilter, query: q }).length}
          />
        ) : (
          <IconsPage
            catalogue={catalogue}
            state={state.icons}
            update={updateIcons}
            revealKey={revealKey}
            onSearchLogos={(q) => searchOther("logos", q)}
          />
        )}

        {paletteOpen && (
          <CommandPalette
            catalogue={catalogue}
            page={state.page}
            theme={state.theme}
            shape={state.icons.shape}
            onClose={() => setPaletteOpen(false)}
            onPage={goTo}
            onIcon={openIcon}
            onLogo={openLogo}
            onTheme={(theme) => navigate((current) => ({ ...current, theme }))}
            onToggleShape={() =>
              updateIcons({ shape: state.icons.shape === "sharp" ? "round" : "sharp" })
            }
          />
        )}
      </ToastProvider>
    </UiIconProvider>
  );
}

function VersionStamp() {
  const parts = [
    meta.packageVersion && `v${meta.packageVersion}`,
    meta.lucideVersion && `Lucide ${meta.lucideVersion}`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  const detail = [
    meta.packageVersion && `@qeetrix/icons ${meta.packageVersion}`,
    meta.lucideVersion && `Lucide ${meta.lucideVersion}`,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <p className="version-stamp" title={detail}>
      {parts.join(" · ")}
    </p>
  );
}
