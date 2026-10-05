import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { categories } from "../../config/categories.js";
import { iconSystem } from "../../config/icon-system.js";
import type { IconShape, IconVariant } from "../../src/types/icon.js";
import {
  type CatalogueIcon,
  formatSvgMarkup,
  importSnippets,
  mirrorsInPreview,
  shapeOptions,
  type UsageProps,
} from "./catalogue.js";
import { typefaces, useFontAvailability } from "./fonts.js";
import { CloseButton } from "./layout.js";
import { checklistFor, designValues } from "./qa.js";
import { CopyButton, Segmented, UiIcon } from "./ui.js";
import { type Direction, sizeRange } from "./url-state.js";

const { architecture, design } = iconSystem;
const smallSizes: readonly number[] = design.recommendedSizes.slice(0, 2);
const categoryLabels = new Map<string, string>(categories.map(({ id, label }) => [id, label]));
/** The showcase preview. Detail only: review sizes are the actual renderings below it. */
const heroSize = 120;

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "construction", label: "Construction" },
  { id: "context", label: "Context" },
  { id: "code", label: "Code" },
  { id: "review", label: "Review" },
] as const;

export type InspectorTab = (typeof tabs)[number]["id"];

/** Remembered across icons, so stepping through the catalogue stays on the same tab. */
let lastTab: InspectorTab = "overview";

type InspectorProps = {
  icon: CatalogueIcon;
  shape: IconShape;
  variant: IconVariant;
  size: number;
  direction: Direction;
  /** The grid's display props, echoed in the JSX snippet. */
  usage: UsageProps;
  position?: { index: number; total: number };
  onStep: (direction: 1 | -1) => void;
  onShape: (shape: IconShape) => void;
  onVariant: (variant: IconVariant) => void;
  onSize: (size: number) => void;
  onDirection: (direction: Direction) => void;
  onClose: () => void;
};

/** One rendered drawing, optionally inside the playground-only RTL mirror. */
function Glyph({
  icon,
  shape,
  variant,
  size,
  mirrored = false,
  strokeWidth,
}: {
  icon: CatalogueIcon;
  shape: IconShape;
  variant: IconVariant;
  size: number;
  mirrored?: boolean;
  strokeWidth?: number;
}) {
  return (
    <span className={mirrored ? "glyph mirrored" : "glyph"}>
      <icon.Component shape={shape} variant={variant} size={size} strokeWidth={strokeWidth} />
    </span>
  );
}

function Section({
  title,
  note,
  aside,
  children,
}: {
  title: string;
  note?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h3>{title}</h3>
          {note && <p className="panel-note">{note}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function IconInspector({
  icon,
  shape,
  variant,
  size,
  direction,
  usage,
  position,
  onStep,
  onShape,
  onVariant,
  onSize,
  onDirection,
  onClose,
}: InspectorProps) {
  const [tab, setTabState] = useState<InspectorTab>(lastTab);
  const setTab = (next: InspectorTab) => {
    lastTab = next;
    setTabState(next);
  };
  const mirrored = mirrorsInPreview(icon, direction);
  const id = useId();
  const tabRefs = useRef(new Map<InspectorTab, HTMLButtonElement>());
  const svgSource = useRef<HTMLSpanElement>(null);
  const snippets = importSnippets(icon, shape, variant, usage);
  const svgMarkup = () => formatSvgMarkup(svgSource.current?.innerHTML ?? "");

  // ← and → step through the visible icons when focus is not in a control that uses arrows.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, select, textarea, [role='tab'], [role='grid']")) return;
      event.preventDefault();
      onStep(event.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStep]);

  // Arrow keys move between tabs (automatic activation), per the WAI-ARIA tabs pattern.
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex(({ id: tabId }) => tabId === tab);
    const next =
      event.key === "Home"
        ? tabs[0]
        : event.key === "End"
          ? tabs[tabs.length - 1]
          : event.key === "ArrowRight"
            ? tabs[(index + 1) % tabs.length]
            : event.key === "ArrowLeft"
              ? tabs[(index - 1 + tabs.length) % tabs.length]
              : undefined;
    if (!next) return;
    event.preventDefault();
    setTab(next.id);
    tabRefs.current.get(next.id)?.focus();
  };
  const panel = (tabId: InspectorTab, children: ReactNode) => (
    <div
      role="tabpanel"
      id={`${id}-panel-${tabId}`}
      aria-labelledby={`${id}-tab-${tabId}`}
      className="tab-panel"
      hidden={tab !== tabId}
    >
      {tab === tabId && children}
    </div>
  );

  return (
    <article className="inspector" aria-labelledby={`${id}-title`}>
      <span ref={svgSource} hidden>
        <icon.Component
          shape={shape}
          variant={variant}
          size={usage.size}
          strokeWidth={
            variant === architecture.defaultVariant && usage.strokeWidth !== design.strokeWidth
              ? usage.strokeWidth
              : undefined
          }
          color={usage.color}
        />
      </span>
      <header className="inspector-head">
        <div className="inspector-title-row">
          <span className="inspector-thumb" aria-hidden="true">
            <icon.Component shape={shape} variant={variant} size={20} />
          </span>
          <div className="inspector-title">
            <h2 id={`${id}-title`} tabIndex={-1} data-autofocus>
              {icon.name}
            </h2>
            <p>
              <code>{icon.componentName}</code>
            </p>
          </div>
          <div className="inspector-nav">
            {position && (
              <>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Previous icon"
                  title="Previous icon (←)"
                  disabled={position.index === 0}
                  onClick={() => onStep(-1)}
                >
                  <UiIcon name="chevron-left" size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Next icon"
                  title="Next icon (→)"
                  disabled={position.index >= position.total - 1}
                  onClick={() => onStep(1)}
                >
                  <UiIcon name="chevron-right" size={16} />
                </button>
              </>
            )}
            <CloseButton label="Close inspector" onClick={onClose} />
          </div>
        </div>
        <div className="inspector-actions">
          <CopyButton
            variant="primary"
            text={snippets.usage}
            label={`Copy ${snippets.usage}`}
            toast="JSX copied"
          >
            Copy JSX
          </CopyButton>
          <CopyButton
            text={snippets.root}
            label={`Copy ${snippets.root}`}
            toast="Import copied"
            variant="button"
          >
            Import
          </CopyButton>
          <CopyButton
            text={svgMarkup}
            label="Copy the rendered SVG markup"
            toast="SVG copied"
            variant="button"
          >
            SVG
          </CopyButton>
        </div>
      </header>

      <section className="hero" aria-label="Preview">
        <div className="hero-stage" dir={direction}>
          <Glyph icon={icon} shape={shape} variant={variant} size={heroSize} mirrored={mirrored} />
        </div>
        <div className="hero-bar">
          <Segmented<IconShape>
            label="Shape"
            size="sm"
            value={shape}
            options={shapeOptions()}
            onChange={onShape}
          />
          <Segmented<IconVariant>
            label="Variant"
            size="sm"
            value={variant}
            options={architecture.variants.map((option) => ({
              value: option,
              label: option === "outline" ? "Outline" : "Filled",
              disabled: !icon.variants.includes(option),
              title: icon.variants.includes(option) ? undefined : "No filled drawing for this icon",
            }))}
            onChange={onVariant}
          />
        </div>
        {mirrored && <span className="hero-badge">RTL preview</span>}
        <span className="hero-caption">{heroSize}px</span>
      </section>

      <div role="tablist" aria-label="Inspector sections" className="tabs" onKeyDown={onTabKey}>
        {tabs.map(({ id: tabId, label }) => (
          <button
            key={tabId}
            ref={(element) => {
              if (element) tabRefs.current.set(tabId, element);
              else tabRefs.current.delete(tabId);
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${tabId}`}
            aria-selected={tab === tabId}
            aria-controls={`${id}-panel-${tabId}`}
            tabIndex={tab === tabId ? 0 : -1}
            onClick={() => setTab(tabId)}
          >
            {label}
          </button>
        ))}
      </div>

      {panel(
        "overview",
        <>
          <Section title="Shapes and variants" note="Every drawing of this concept, at 32px.">
            <fieldset className="matrix">
              <legend className="visually-hidden">Shapes and variants</legend>
              <span />
              {architecture.variants.map((option) => (
                <span key={option} className="matrix-label">
                  {option}
                </span>
              ))}
              {architecture.styles.map((style) => (
                <MatrixRow
                  key={style}
                  icon={icon}
                  shape={style}
                  current={{ shape, variant }}
                  onPick={(next) => {
                    onShape(next.shape);
                    onVariant(next.variant);
                  }}
                />
              ))}
            </fieldset>
          </Section>
          <Section
            title="Real size"
            note="Actual source rendering. 14 and 16px matter most."
            aside={<SizeControl size={size} onSize={onSize} />}
          >
            <div className="size-strip">
              {design.recommendedSizes.map((recommended) => (
                <figure
                  key={recommended}
                  className={smallSizes.includes(recommended) ? "critical" : undefined}
                >
                  <div className="size-art">
                    <Glyph icon={icon} shape={shape} variant={variant} size={recommended} />
                  </div>
                  <figcaption>{recommended}</figcaption>
                </figure>
              ))}
              <figure className="custom">
                <div className="size-art">
                  <Glyph icon={icon} shape={shape} variant={variant} size={size} />
                </div>
                <figcaption>{size} custom</figcaption>
              </figure>
            </div>
          </Section>
          <Section
            title="Pixel view"
            note="Rasterized at 1× device pixels, magnified 8×, so merged strokes show on any display."
          >
            <div className="pixel-strip">
              {smallSizes.map((small) => (
                <PixelPreview
                  key={small}
                  icon={icon}
                  shape={shape}
                  variant={variant}
                  size={small}
                />
              ))}
            </div>
          </Section>
          <Metadata icon={icon} />
        </>,
      )}

      {panel(
        "construction",
        <>
          <Construction icon={icon} shape={shape} variant={variant} />
          {icon.variants.includes("outline") && <StrokeComparison icon={icon} shape={shape} />}
          <DesignValues shape={shape} />
        </>,
      )}

      {panel(
        "context",
        <>
          <Surfaces icon={icon} shape={shape} variant={variant} />
          <Contexts
            icon={icon}
            shape={shape}
            variant={variant}
            direction={direction}
            mirrored={mirrored}
          />
          <Typography icon={icon} shape={shape} variant={variant} />
          <DirectionPreview
            icon={icon}
            shape={shape}
            variant={variant}
            direction={direction}
            onDirection={onDirection}
          />
        </>,
      )}

      {panel(
        "code",
        <>
          <Section title="Import" note="Public entry points only; generated paths are not API.">
            <Snippet label="Package root" code={snippets.root} toast="Import copied" />
            <Snippet label="Direct import" code={snippets.direct} toast="Import copied" />
          </Section>
          <Section title="Usage" note="With the shape, variant, size, stroke, and colour on show.">
            <Snippet label="JSX" code={snippets.usage} toast="JSX copied" />
            <Snippet label="Rendered SVG" code={svgMarkup} toast="SVG copied" multiline />
          </Section>
          <Accessibility icon={icon} />
        </>,
      )}

      {panel(
        "review",
        <Section title="Review checklist" note="Local to this page. Nothing is saved or scored.">
          <div className="checklist">
            {checklistFor(icon).map((group) => (
              <fieldset key={group.title}>
                <legend>{group.title}</legend>
                {group.items.map((item) => (
                  <label key={item}>
                    <input type="checkbox" />
                    <span>{item}</span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </Section>,
      )}
    </article>
  );
}

function MatrixRow({
  icon,
  shape,
  current,
  onPick,
}: {
  icon: CatalogueIcon;
  shape: IconShape;
  current: { shape: IconShape; variant: IconVariant };
  onPick: (next: { shape: IconShape; variant: IconVariant }) => void;
}) {
  return (
    <>
      <span className="matrix-label matrix-label-row">{shape}</span>
      {architecture.variants.map((option) => {
        const available = icon.variants.includes(option);
        const active = current.shape === shape && current.variant === option;
        return available ? (
          <button
            key={option}
            type="button"
            className="matrix-cell"
            aria-pressed={active}
            aria-label={`${shape} ${option}`}
            onClick={() => onPick({ shape, variant: option })}
          >
            <Glyph icon={icon} shape={shape} variant={option} size={32} />
          </button>
        ) : (
          <span key={option} className="matrix-cell matrix-cell-empty" title="No filled drawing">
            <span className="visually-hidden">
              No {shape} {option} drawing
            </span>
          </span>
        );
      })}
    </>
  );
}

function Metadata({ icon }: { icon: CatalogueIcon }) {
  return (
    <Section title="Details" note="From the generated manifest.">
      <dl className="metadata">
        <div>
          <dt>Categories</dt>
          <dd className="chip-list">
            {icon.categories.map((category) => (
              <span key={category} className="chip">
                {categoryLabels.get(category) ?? category}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>Tags</dt>
          <dd className="chip-list">
            {icon.tags.length === 0 ? (
              <span className="muted">None</span>
            ) : (
              icon.tags.map((tag) => (
                <span key={tag} className="chip chip-quiet">
                  {tag}
                </span>
              ))
            )}
          </dd>
        </div>
        <div>
          <dt>Aliases</dt>
          <dd className="chip-list">
            {icon.aliases.length === 0 ? (
              <span className="muted">None</span>
            ) : (
              icon.aliases.map((alias) => (
                <code key={alias} className="chip chip-code">
                  {alias}
                </code>
              ))
            )}
          </dd>
        </div>
        <div>
          <dt>Direction</dt>
          <dd>
            {icon.directionality === "mirror"
              ? "Mirrors in RTL layouts (manifest)"
              : "Preserved in RTL layouts"}
          </dd>
        </div>
        <div>
          <dt>Drawings</dt>
          <dd>
            {icon.shapes.join(" and ")} · {icon.variants.join(" and ")}
          </dd>
        </div>
      </dl>
    </Section>
  );
}

function Accessibility({ icon }: { icon: CatalogueIcon }) {
  return (
    <Section title="Accessibility" note="How the component behaves, and what the caller owns.">
      <ul className="notes">
        <li>
          <strong>Decorative by default.</strong> Without a label the SVG renders{" "}
          <code>aria-hidden="true"</code> and <code>focusable="false"</code>, which is right beside
          visible text.
        </li>
        <li>
          <strong>Meaningful on its own?</strong> Pass <code>aria-label</code>: the icon becomes{" "}
          <code>role="img"</code> with that name.
        </li>
        <li>
          <strong>Icon-only buttons</strong> need an accessible name on the button, such as{" "}
          <code>{`<button aria-label="Favourite"><${icon.componentName} /></button>`}</code>.
        </li>
        <li>
          <strong>Colour follows text.</strong> Icons paint with <code>currentColor</code>, so
          contrast is the surrounding text's; aim for 3:1 against the background for meaningful
          icons.
        </li>
        <li>
          <strong>Direction.</strong>{" "}
          {icon.directionality === "mirror"
            ? "This concept reads with the text direction. The package never mirrors at runtime; flip it in RTL layouts (for example with a scaleX(-1) transform under [dir=rtl])."
            : "This concept keeps its geometry in RTL layouts; do not mirror it."}
        </li>
      </ul>
    </Section>
  );
}

/** The shareable custom inspection size, shown as the last tile of the size strip. */
function SizeControl({ size, onSize }: { size: number; onSize: (size: number) => void }) {
  return (
    <label className="size-control">
      <span className="visually-hidden">Custom size</span>
      <input
        type="range"
        min={sizeRange.min}
        max={sizeRange.max}
        value={size}
        style={
          {
            "--fill": `${((size - sizeRange.min) / (sizeRange.max - sizeRange.min)) * 100}%`,
          } as CSSProperties
        }
        onChange={(event) => onSize(Number(event.target.value))}
      />
      <span className="number-field">
        <input
          type="number"
          aria-label="Custom size in pixels"
          min={sizeRange.min}
          max={sizeRange.max}
          value={size}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isInteger(next) && next >= sizeRange.min && next <= sizeRange.max) {
              onSize(next);
            }
          }}
        />
        px
      </span>
    </label>
  );
}

/**
 * A small size rasterized at one device pixel per CSS pixel, then magnified with nearest-neighbor
 * scaling, so merged strokes and blurred edges at 14 and 16 px are visible on any display.
 */
function PixelPreview({
  icon,
  shape,
  variant,
  size,
}: {
  icon: CatalogueIcon;
  shape: IconShape;
  variant: IconVariant;
  size: number;
}) {
  const source = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const svg = source.current?.querySelector("svg");
    const context = canvas.current?.getContext("2d");
    if (!source.current || !svg || !context) return;
    const copy = svg.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("color", getComputedStyle(source.current).color);
    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
  });
  return (
    <figure className="pixel">
      <span ref={source} hidden>
        <icon.Component shape={shape} variant={variant} size={size} />
      </span>
      <div className="pixel-canvas" style={{ width: size * 8, height: size * 8 }}>
        <canvas
          ref={canvas}
          width={size}
          height={size}
          role="img"
          aria-label={`${size} pixel rendering, magnified eight times`}
          style={{ width: size * 8, height: size * 8 }}
        />
      </div>
      <figcaption>{size}px at 1×, magnified 8×</figcaption>
    </figure>
  );
}

function Construction({
  icon,
  shape,
  variant,
}: {
  icon: CatalogueIcon;
  shape: IconShape;
  variant: IconVariant;
}) {
  const [guides, setGuides] = useState({ grid: true, axes: true, safeArea: true });
  const { width, height } = architecture.grid;
  const inset = design.safeAreaInset;
  const scale = 12;
  const gridUnits = Array.from({ length: width - 1 }, (_, offset) => offset + 1);
  const toggle = (key: keyof typeof guides) =>
    setGuides((current) => ({ ...current, [key]: !current[key] }));
  return (
    <Section
      title={`Construction · ${width}×${height} at ${scale}×`}
      note="Visual guides only. Mathematical center is a reference, not optical correctness."
    >
      <div className="toggle-row">
        <label className="toggle" data-guide="grid">
          <input type="checkbox" checked={guides.grid} onChange={() => toggle("grid")} />
          Unit grid
        </label>
        <label className="toggle" data-guide="axis">
          <input type="checkbox" checked={guides.axes} onChange={() => toggle("axes")} />
          Center axes
        </label>
        <label className="toggle" data-guide="safe">
          <input type="checkbox" checked={guides.safeArea} onChange={() => toggle("safeArea")} />
          Safe area ({inset}px)
        </label>
      </div>
      <div className="construction-frame">
        <div className="construction" style={{ width: width * scale, height: height * scale }}>
          <icon.Component shape={shape} variant={variant} size={width * scale} />
          <svg
            className="guides"
            viewBox={architecture.viewBox}
            width={width * scale}
            height={height * scale}
            aria-hidden="true"
          >
            {guides.grid &&
              gridUnits.map((unit) => (
                <g key={unit} className="guide-grid">
                  <line x1={unit} y1={0} x2={unit} y2={height} />
                  <line x1={0} y1={unit} x2={width} y2={unit} />
                </g>
              ))}
            {guides.safeArea && (
              <rect
                className="guide-safe"
                x={inset}
                y={inset}
                width={width - inset * 2}
                height={height - inset * 2}
              />
            )}
            {guides.axes && (
              <g className="guide-axis">
                <line x1={width / 2} y1={0} x2={width / 2} y2={height} />
                <line x1={0} y1={height / 2} x2={width} y2={height / 2} />
              </g>
            )}
            <rect className="guide-canvas" x={0} y={0} width={width} height={height} />
          </svg>
        </div>
      </div>
    </Section>
  );
}

/**
 * The outline drawing at each comparison stroke width, as a caller's `strokeWidth` prop draws it.
 * The source and every other view keep the authored width.
 */
function StrokeComparison({ icon, shape }: { icon: CatalogueIcon; shape: IconShape }) {
  return (
    <Section
      title="Stroke width"
      note={`Outline drawing. Source width ${design.strokeWidth}; the others preview the strokeWidth prop.`}
    >
      <div className="stroke-grid">
        {design.strokeCandidates.map((candidate) => (
          <figure
            key={candidate}
            className={candidate === design.strokeWidth ? "source" : undefined}
          >
            <div className="compare-art">
              {[16, 24, 48].map((strokeSize) => (
                <Glyph
                  key={strokeSize}
                  icon={icon}
                  shape={shape}
                  variant="outline"
                  size={strokeSize}
                  strokeWidth={candidate === design.strokeWidth ? undefined : candidate}
                />
              ))}
            </div>
            <figcaption>
              {candidate}
              {candidate === design.strokeWidth ? " · source" : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

function Surfaces({
  icon,
  shape,
  variant,
}: {
  icon: CatalogueIcon;
  shape: IconShape;
  variant: IconVariant;
}) {
  return (
    <Section
      title="Surfaces and currentColor"
      note="Icons inherit colour; the artwork is unchanged."
    >
      <div className="surfaces">
        {(["light", "dark"] as const).map((surface) => (
          <div key={surface} className={`surface scheme-${surface}`}>
            <span className="surface-name">{surface}</span>
            <div className="surface-glyphs">
              {[16, 24, 32].map((surfaceSize) => (
                <Glyph
                  key={surfaceSize}
                  icon={icon}
                  shape={shape}
                  variant={variant}
                  size={surfaceSize}
                />
              ))}
            </div>
            <span className="surface-label">
              <Glyph icon={icon} shape={shape} variant={variant} size={16} />
              Account settings
            </span>
          </div>
        ))}
      </div>
      <ul className="swatches">
        {(
          [
            ["Foreground", "--swatch-foreground"],
            ["Muted", "--swatch-muted"],
            ["Accent", "--swatch-accent"],
            ["Success", "--swatch-green"],
            ["Warning", "--swatch-amber"],
            ["Danger", "--swatch-red"],
          ] as const
        ).map(([label, token]) => (
          <li key={token} style={{ color: `var(${token})` }}>
            <Glyph icon={icon} shape={shape} variant={variant} size={20} />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Contexts({
  icon,
  shape,
  variant,
  direction,
  mirrored,
}: {
  icon: CatalogueIcon;
  shape: IconShape;
  variant: IconVariant;
  direction: Direction;
  mirrored: boolean;
}) {
  const glyph = (size: number) => (
    <Glyph icon={icon} shape={shape} variant={variant} size={size} mirrored={mirrored} />
  );
  return (
    <Section
      title="Interface contexts"
      note={`Plain HTML and CSS at real interface scale, not Qeetrix UI components. ${direction.toUpperCase()}.`}
    >
      <div className="contexts" dir={direction}>
        <figure>
          <div className="context-demo">
            <button type="button" className="demo-button">
              {glyph(16)}
              Save changes
            </button>
          </div>
          <figcaption>Text button</figcaption>
        </figure>
        <figure>
          <div className="context-demo">
            <button type="button" className="demo-icon-button" aria-label={`${icon.name} preview`}>
              {glyph(16)}
            </button>
          </div>
          <figcaption>Icon-only control</figcaption>
        </figure>
        <figure>
          <div className="context-demo">
            <label className="demo-input">
              {glyph(16)}
              <input type="text" placeholder="Search records" aria-label="Preview input" />
            </label>
          </div>
          <figcaption>Input prefix</figcaption>
        </figure>
        <figure>
          <div className="context-demo">
            <div className="demo-nav">
              <span className="demo-nav-row" data-active="true">
                {glyph(16)}
                Overview
              </span>
              <span className="demo-nav-row">
                {glyph(16)}
                Members
              </span>
            </div>
          </div>
          <figcaption>Sidebar row</figcaption>
        </figure>
        <figure>
          <div className="context-demo">
            <table className="demo-table">
              <tbody>
                <tr>
                  <td>INV-2041</td>
                  <td>₹48,200</td>
                  <td>
                    <button
                      type="button"
                      className="demo-icon-button"
                      aria-label="Row action preview"
                    >
                      {glyph(16)}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <figcaption>Table action</figcaption>
        </figure>
        <figure>
          <div className="context-demo">
            <p className="demo-inline">
              {glyph(14)}
              Verified 2 hours ago
            </p>
          </div>
          <figcaption>Label beside text</figcaption>
        </figure>
      </div>
    </Section>
  );
}

const typeSamples = [
  { family: "Qeet UI", variable: "--font-ui", text: 14, icon: 14 },
  { family: "Qeet UI", variable: "--font-ui", text: 14, icon: 16 },
  { family: "Qeet UI", variable: "--font-ui", text: 16, icon: 16 },
  { family: "Qeet UI", variable: "--font-ui", text: 16, icon: 20 },
  { family: "Qeet Text", variable: "--font-text", text: 14, icon: 16 },
  { family: "Qeet Text", variable: "--font-text", text: 16, icon: 20 },
] as const;

function Typography({
  icon,
  shape,
  variant,
}: {
  icon: CatalogueIcon;
  shape: IconShape;
  variant: IconVariant;
}) {
  const availability = useFontAvailability();
  const missing = typefaces.filter(({ family }) => availability?.[family] === false);
  return (
    <Section
      title="Typography"
      note={
        missing.length > 0
          ? `${missing.map(({ family }) => family).join(" and ")} unavailable: these rows use the system fallback, not Qeet typography.`
          : "Weight, baseline feel, alignment, and spacing beside Qeet UI and Qeet Text."
      }
    >
      <div className="type-samples">
        {typeSamples.map((sample) => (
          <figure key={`${sample.family}-${sample.text}-${sample.icon}`}>
            <p
              className="type-row"
              style={{ fontFamily: `var(${sample.variable})`, fontSize: sample.text }}
            >
              <Glyph icon={icon} shape={shape} variant={variant} size={sample.icon} />
              Review pending invoices
            </p>
            <figcaption>
              {sample.family} {sample.text}px · icon {sample.icon}px
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

function DirectionPreview({
  icon,
  shape,
  variant,
  direction,
  onDirection,
}: {
  icon: CatalogueIcon;
  shape: IconShape;
  variant: IconVariant;
  direction: Direction;
  onDirection: (direction: Direction) => void;
}) {
  const mirror = icon.directionality === "mirror";
  return (
    <Section
      title="Direction"
      note={`Manifest directionality: ${icon.directionality}. Only the manifest decides; names never do.`}
      aside={
        <Segmented<Direction>
          label="Preview direction"
          size="sm"
          value={direction}
          options={[
            { value: "ltr", label: "LTR" },
            { value: "rtl", label: "RTL", title: "Preview every context right-to-left" },
          ]}
          onChange={onDirection}
        />
      }
    >
      <div className="compare">
        <figure>
          <div className="compare-art" dir="ltr">
            <Glyph icon={icon} shape={shape} variant={variant} size={24} />
            <Glyph icon={icon} shape={shape} variant={variant} size={48} />
          </div>
          <figcaption>LTR</figcaption>
        </figure>
        <figure>
          <div className="compare-art" dir="rtl">
            <Glyph icon={icon} shape={shape} variant={variant} size={24} mirrored={mirror} />
            <Glyph icon={icon} shape={shape} variant={variant} size={48} mirrored={mirror} />
          </div>
          <figcaption>
            {mirror
              ? "RTL preview, mirrored by the playground; the package does not mirror at runtime"
              : "RTL: preserved, identical geometry"}
          </figcaption>
        </figure>
      </div>
    </Section>
  );
}

function Snippet({
  label,
  code,
  toast,
  multiline = false,
}: {
  label: string;
  code: string | (() => string);
  toast: string;
  multiline?: boolean;
}) {
  const [text, setText] = useState(typeof code === "string" ? code : "");
  // Rendered markup is read from the DOM after the hidden source has rendered.
  useEffect(() => {
    setText(typeof code === "string" ? code : code());
  }, [code]);
  return (
    <div className="snippet" data-multiline={multiline || undefined}>
      <div className="snippet-head">
        <span>{label}</span>
        <CopyButton text={code} label={`Copy ${label.toLowerCase()}`} toast={toast} />
      </div>
      <pre>
        <code>{text}</code>
      </pre>
    </div>
  );
}

export function DesignValues({ shape = architecture.defaultStyle }: { shape?: IconShape }) {
  return (
    <Section
      title="Design values"
      note={`Lucide's drawing rules, ${shape} shape. Default variant: ${architecture.defaultVariant}.`}
    >
      <dl className="metadata metadata-compact">
        {designValues(shape).map(({ name, value }) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
