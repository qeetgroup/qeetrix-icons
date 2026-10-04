import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { type Catalogue, iconSearchFields } from "./catalogue.js";
import { LogoArt } from "./logo-art.js";
import { type LogoEntry, logoSearchFields, pickVariant } from "./logo-catalogue.js";
import { useLogoIndex } from "./logo-modules.js";
import { normalize, rankBy, scoreFields } from "./search.js";
import { formatCount, Kbd, UiIcon, useEscape, useFocusTrap, useScrollLock } from "./ui.js";
import type { Page, Theme } from "./url-state.js";

/**
 * ⌘K / Ctrl-K: one search across pages, icons, logos, and a few actions. A combobox with a
 * grouped listbox (WAI-ARIA combobox pattern): focus stays in the input, ↑ and ↓ move the active
 * option, Enter runs it, Escape closes and returns focus to where it was.
 */

type Command = {
  readonly id: string;
  readonly group: "Pages" | "Icons" | "Logos" | "Actions";
  readonly title: string;
  readonly subtitle?: string;
  readonly hint?: string;
  readonly art: ReactNode;
  /** Logos sit on a light chip: most files are drawn for light backgrounds. */
  readonly artBackdrop?: "light";
  readonly keywords?: readonly string[];
  readonly run: () => void;
};

const groupOrder: readonly Command["group"][] = ["Pages", "Icons", "Logos", "Actions"];
const resultLimit = 6;

export function CommandPalette({
  catalogue,
  page,
  theme,
  onClose,
  onPage,
  onIcon,
  onLogo,
  onTheme,
  onToggleShape,
  shape,
}: {
  catalogue: Catalogue;
  page: Page;
  theme: Theme;
  shape: string;
  onClose: () => void;
  onPage: (page: Page) => void;
  onIcon: (id: string) => void;
  onLogo: (id: string) => void;
  onTheme: (theme: Theme) => void;
  onToggleShape: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const logoIndex = useLogoIndex();
  useFocusTrap(panel, true);
  useEscape(onClose);
  useScrollLock(true);

  const run = (command: Command) => {
    onClose();
    command.run();
  };

  const statics = useMemo<Command[]>(
    () => [
      {
        id: "page-icons",
        group: "Pages",
        title: "Icons",
        subtitle: `${formatCount(catalogue.icons.length)} Lucide icons`,
        hint: page === "icons" ? "Current" : undefined,
        art: <UiIcon name="shapes" size={16} />,
        keywords: ["lucide", "glyphs"],
        run: () => onPage("icons"),
      },
      {
        id: "page-logos",
        group: "Pages",
        title: "Logos",
        subtitle: logoIndex ? `${formatCount(logoIndex.logos.length)} brand logos` : "Brand logos",
        hint: page === "logos" ? "Current" : undefined,
        art: <UiIcon name="badge-check" size={16} />,
        keywords: ["brands", "thesvg", "trademarks"],
        run: () => onPage("logos"),
      },
      ...(["light", "dark", "system"] as const).map(
        (option): Command => ({
          id: `theme-${option}`,
          group: "Actions",
          title: `Theme: ${option === "system" ? "match system" : option}`,
          hint: theme === option ? "Current" : undefined,
          art: (
            <UiIcon
              name={option === "light" ? "sun" : option === "dark" ? "moon" : "monitor"}
              size={16}
            />
          ),
          keywords: ["appearance", "mode", "colour"],
          run: () => onTheme(option),
        }),
      ),
      {
        id: "shape-toggle",
        group: "Actions",
        title: `Shape: switch to ${shape === "sharp" ? "round" : "sharp"}`,
        art: <UiIcon name={shape === "sharp" ? "circle" : "square"} size={16} />,
        keywords: ["round", "sharp", "corners", "caps"],
        run: onToggleShape,
      },
    ],
    [catalogue, logoIndex, page, theme, shape, onPage, onTheme, onToggleShape],
  );

  const commands = useMemo<Command[]>(() => {
    const trimmed = query.trim();
    const staticMatches = trimmed
      ? rankBy(statics, trimmed, (command) => ({
          primary: [command.title],
          keywords: command.keywords ?? [],
        }))
      : statics;
    if (!trimmed) return staticMatches;
    const icons = rankBy(catalogue.icons, trimmed, iconSearchFields, resultLimit).map(
      (icon): Command => ({
        id: `icon-${icon.id}`,
        group: "Icons",
        title: icon.name,
        subtitle: icon.componentName,
        hint: icon.categoryLabel,
        art: <icon.Component size={18} />,
        run: () => onIcon(icon.id),
      }),
    );
    const logos = logoIndex
      ? rankBy(logoIndex.logos, trimmed, logoSearchFields, resultLimit).map(
          (logo: LogoEntry): Command => ({
            id: `logo-${logo.id}`,
            group: "Logos",
            title: logo.title,
            subtitle: logo.componentName,
            hint: logoIndex.collections.find(({ id: c }) => c === logo.collection)?.label,
            art: <LogoArt logo={logo} variant={pickVariant(logo, "light").name} height={18} />,
            artBackdrop: "light",
            run: () => onLogo(logo.id),
          }),
        )
      : [];
    // Whichever kind holds the best match comes first: "git" leads with icons, "github" with logos.
    const normalized = normalize(trimmed);
    const topIcon = rankBy(catalogue.icons, trimmed, iconSearchFields, 1)[0];
    const topLogo = logoIndex
      ? rankBy(logoIndex.logos, trimmed, logoSearchFields, 1)[0]
      : undefined;
    const logosFirst =
      topLogo !== undefined &&
      scoreFields(logoSearchFields(topLogo), normalized) >
        (topIcon ? scoreFields(iconSearchFields(topIcon), normalized) : 0);
    const pages = staticMatches.filter((command) => command.group === "Pages");
    const actions = staticMatches.filter((command) => command.group === "Actions");
    return [...pages, ...(logosFirst ? [...logos, ...icons] : [...icons, ...logos]), ...actions];
  }, [query, statics, catalogue, logoIndex, onIcon, onLogo]);

  useEffect(() => {
    list.current
      ?.querySelector(`[data-command-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Groups in the order their first command appears, so relevance ordering carries through.
  const grouped = groupOrder
    .map((group) => ({ group, items: commands.filter((command) => command.group === group) }))
    .filter(({ items }) => items.length > 0)
    .sort((a, b) => commands.indexOf(a.items[0]) - commands.indexOf(b.items[0]));
  // The WAI-ARIA combobox pattern: options inside a listbox stay unfocusable because the input
  // owns focus and points at the active option with aria-activedescendant; <select> cannot hold
  // rich options, and fieldset is not allowed inside a listbox.
  // biome-ignore-start lint/a11y/useSemanticElements: see above.
  // biome-ignore-start lint/a11y/useFocusableInteractive: see above.
  const optionId = (index: number) => `${id}-option-${index}`;
  let running = -1;

  return (
    <div className="layer layer-palette" data-layer>
      <div className="scrim scrim-soft" aria-hidden="true" onClick={onClose} />
      <div
        ref={panel}
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabIndex={-1}
      >
        <div className="palette-input">
          <UiIcon name="search" size={18} />
          <input
            data-autofocus
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={commands.length > 0 ? optionId(active) : undefined}
            aria-autocomplete="list"
            aria-label="Search icons, logos, pages, and actions"
            placeholder="Search icons, logos, and actions…"
            spellCheck={false}
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (commands.length === 0) return;
                const step = event.key === "ArrowDown" ? 1 : -1;
                setActive((current) => (current + step + commands.length) % commands.length);
              } else if (event.key === "Enter") {
                event.preventDefault();
                const command = commands[active];
                if (command) run(command);
              }
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div
          ref={list}
          className="palette-list"
          id={`${id}-list`}
          role="listbox"
          aria-label="Results"
        >
          {grouped.map(({ group, items }) => (
            <div
              key={group}
              role="group"
              aria-labelledby={`${id}-${group}`}
              className="palette-group"
            >
              <div className="palette-group-label" id={`${id}-${group}`} role="presentation">
                {group}
              </div>
              {items.map((command) => {
                running += 1;
                const index = running;
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input handles keys (aria-activedescendant).
                  <div
                    key={command.id}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    data-command-index={index}
                    className="palette-option"
                    onPointerMove={() => setActive(index)}
                    onClick={() => run(command)}
                  >
                    <span
                      className={command.artBackdrop ? "palette-art backdrop-light" : "palette-art"}
                      aria-hidden="true"
                    >
                      {command.art}
                    </span>
                    <span className="palette-text">
                      <span className="palette-title">{command.title}</span>
                      {command.subtitle && (
                        <span className="palette-subtitle">{command.subtitle}</span>
                      )}
                    </span>
                    {command.hint && <span className="palette-hint">{command.hint}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {query.trim() && !logoIndex && (
            <p className="palette-status" role="status">
              Loading logos…
            </p>
          )}
          {query.trim() && commands.length === 0 && logoIndex && (
            <div className="palette-empty" role="status">
              <UiIcon name="search-x" size={20} />
              <p>
                Nothing matches “{query.trim()}”. Try a shorter name, a tag such as “delete”, or a
                brand.
              </p>
            </div>
          )}
        </div>
        <footer className="palette-footer" aria-hidden="true">
          <span className="palette-key-hint">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="palette-key-hint">
            <Kbd>↵</Kbd> open
          </span>
          <span className="palette-key-hint">
            <Kbd>Esc</Kbd> close
          </span>
        </footer>
      </div>
    </div>
  );
  // biome-ignore-end lint/a11y/useFocusableInteractive: see above.
  // biome-ignore-end lint/a11y/useSemanticElements: see above.
}
