import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { iconSystem } from "../../config/icon-system.js";
import type { IconVariant } from "../../src/types/icon.js";
import { type CatalogueIcon, importSnippets, mirrorsInPreview } from "./catalogue.js";
import { typefaces, useFontAvailability } from "./fonts.js";
import { checklistFor, provisionalValues } from "./qa.js";
import { CopyButton, Segmented, UiIcon } from "./ui.js";
import { type Direction, sizeRange } from "./url-state.js";

const { architecture, calibration } = iconSystem;
const smallSizes: readonly number[] = calibration.recommendedSizes.slice(0, 2);
/** The showcase preview. Detail only: review sizes are the actual renderings below it. */
const heroSize = 112;

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "construction", label: "Construction" },
  { id: "context", label: "In context" },
  { id: "code", label: "Code" },
  { id: "review", label: "Review" },
] as const;

export type InspectorTab = (typeof tabs)[number]["id"];

type InspectorProps = {
  icon: CatalogueIcon;
  variant: IconVariant;
  size: number;
  direction: Direction;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  onVariant: (variant: IconVariant) => void;
  onSize: (size: number) => void;
  onClose: () => void;
};

/** One rendered drawing, optionally inside the playground-only RTL mirror. */
function Glyph({
  icon,
  variant,
  size,
  mirrored = false,
}: {
  icon: CatalogueIcon;
  variant: IconVariant;
  size: number;
  mirrored?: boolean;
}) {
  return (
    <span className={mirrored ? "glyph mirrored" : "glyph"}>
      <icon.Component variant={variant} size={size} />
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
  note?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <header>
        <div>
          <h3>{title}</h3>
          {note && <p className="muted">{note}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Inspector({
  icon,
  variant,
  size,
  direction,
  tab,
  onTab,
  onVariant,
  onSize,
  onClose,
}: InspectorProps) {
  const mirrored = mirrorsInPreview(icon, direction);
  const id = useId();
  const tabRefs = useRef(new Map<InspectorTab, HTMLButtonElement>());
  // Arrow keys move between tabs (automatic activation), per the WAI-ARIA tabs pattern.
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const index = tabs.findIndex(({ id: tabId }) => tabId === tab);
    const next =
      event.key === "Home"
        ? tabs[0]
        : event.key === "End"
          ? tabs[tabs.length - 1]
          : step
            ? tabs[(index + step + tabs.length) % tabs.length]
            : undefined;
    if (!next) return;
    event.preventDefault();
    onTab(next.id);
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
      {children}
    </div>
  );

  return (
    <article className="inspector" aria-label={`${icon.componentName} inspector`}>
      <header className="inspector-head">
        <div className="inspector-title">
          <h2>{icon.name}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close inspector"
            title="Close (Esc)"
            onClick={onClose}
          >
            <UiIcon name="x" size={16} />
          </button>
        </div>
        <div className="chips">
          <span className="chip chip-code">
            <code>{icon.componentName}</code>
            <CopyButton text={icon.componentName} label="Copy component name" />
          </span>
          <span className="chip">{icon.categoryLabel}</span>
          <span className="chip" data-tone={icon.directionality === "mirror" ? "brand" : undefined}>
            {icon.directionality === "mirror" ? "Mirrors in RTL" : "Preserved in RTL"}
          </span>
        </div>
      </header>

      <section className="hero" aria-label="Preview">
        <div className="hero-stage" dir={direction}>
          <Glyph icon={icon} variant={variant} size={heroSize} mirrored={mirrored} />
        </div>
        <div className="hero-overlay">
          {mirrored ? <span className="hero-badge">RTL QA preview</span> : <span />}
          <div className="variant-control">
            {icon.variants.length === 1 && <span className="muted">only drawing</span>}
            <Segmented<IconVariant>
              label="Variant"
              value={variant}
              options={icon.variants.map((option) => ({ value: option, label: option }))}
              onChange={onVariant}
            />
          </div>
        </div>
        <span className="hero-caption">{heroSize}px preview · the stroke scales with size</span>
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
            onClick={() => onTab(tabId)}
          >
            {label}
          </button>
        ))}
      </div>

      {panel(
        "overview",
        <>
          <Section
            title="Recommended sizes"
            note="Actual source rendering. 14 and 16 px matter most."
            aside={<SizeControl size={size} onSize={onSize} />}
          >
            <div className="size-strip">
              {calibration.recommendedSizes.map((recommended) => (
                <figure
                  key={recommended}
                  className={smallSizes.includes(recommended) ? "critical" : undefined}
                >
                  <div className="size-art">
                    <Glyph icon={icon} variant={variant} size={recommended} />
                  </div>
                  <figcaption>{recommended}px</figcaption>
                </figure>
              ))}
              <figure className="custom">
                <div className="size-art">
                  <Glyph icon={icon} variant={variant} size={size} />
                </div>
                <figcaption>{size}px custom</figcaption>
              </figure>
            </div>
          </Section>
          <Section
            title="Pixel view"
            note="Rasterized at 1× device pixels, magnified 8×, so merged strokes show on any display."
          >
            <div className="pixel-strip">
              {smallSizes.map((small) => (
                <PixelPreview key={small} icon={icon} variant={variant} size={small} />
              ))}
            </div>
          </Section>
          {icon.variants.length > 1 && (
            <Section
              title="Variant comparison"
              note="Same size and color. One concept, one family."
            >
              <div className="compare">
                {icon.variants.map((option) => (
                  <figure key={option}>
                    <div className="compare-art">
                      <Glyph icon={icon} variant={option} size={24} />
                      <Glyph icon={icon} variant={option} size={48} />
                    </div>
                    <figcaption>{option}</figcaption>
                  </figure>
                ))}
              </div>
            </Section>
          )}
        </>,
      )}

      {panel(
        "construction",
        <>
          <Construction icon={icon} variant={variant} />
          {icon.variants.includes("outline") && <StrokeComparison icon={icon} />}
        </>,
      )}

      {panel(
        "context",
        <>
          <Section
            title="Surfaces and currentColor"
            note="Icons inherit color; the artwork is unchanged."
          >
            <div className="surfaces">
              {(["light", "dark"] as const).map((surface) => (
                <div key={surface} className={`surface surface-${surface}`}>
                  <span className="surface-name">{surface}</span>
                  {[16, 24, 32].map((surfaceSize) => (
                    <Glyph key={surfaceSize} icon={icon} variant={variant} size={surfaceSize} />
                  ))}
                  <span className="surface-label">Account settings</span>
                </div>
              ))}
            </div>
            <ul className="swatches">
              {[
                ["Foreground", "--foreground"],
                ["Muted", "--foreground-muted"],
                ["Brand", "--brand"],
                ["Success", "--success"],
                ["Warning", "--warning"],
                ["Danger", "--danger"],
              ].map(([label, token]) => (
                <li key={token} style={{ color: `var(${token})` }}>
                  <Glyph icon={icon} variant={variant} size={20} />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </Section>
          <Contexts icon={icon} variant={variant} direction={direction} mirrored={mirrored} />
          <Typography icon={icon} variant={variant} />
          <Section
            title="Direction"
            note={`Manifest directionality: ${icon.directionality}. Only the manifest decides; names never do.`}
          >
            <div className="compare">
              <figure>
                <div className="compare-art" dir="ltr">
                  <Glyph icon={icon} variant={variant} size={24} />
                  <Glyph icon={icon} variant={variant} size={48} />
                </div>
                <figcaption>LTR</figcaption>
              </figure>
              <figure>
                <div className="compare-art" dir="rtl">
                  <Glyph
                    icon={icon}
                    variant={variant}
                    size={24}
                    mirrored={icon.directionality === "mirror"}
                  />
                  <Glyph
                    icon={icon}
                    variant={variant}
                    size={48}
                    mirrored={icon.directionality === "mirror"}
                  />
                </div>
                <figcaption>
                  {icon.directionality === "mirror"
                    ? "RTL QA preview: mirrored by the playground only; the package does not mirror at runtime"
                    : "RTL: preserved, identical geometry"}
                </figcaption>
              </figure>
            </div>
          </Section>
        </>,
      )}

      {panel("code", <Usage icon={icon} />)}

      {panel(
        "review",
        <>
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
          </Section>
          <CalibrationStatus />
        </>,
      )}
    </article>
  );
}

/** The shareable custom inspection size, shown as the last tile of the size strip. */
function SizeControl({ size, onSize }: { size: number; onSize: (size: number) => void }) {
  return (
    <label className="size-control">
      <span>Custom</span>
      <input
        type="range"
        aria-label="Custom size"
        min={sizeRange.min}
        max={sizeRange.max}
        value={size}
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
  variant,
  size,
}: {
  icon: CatalogueIcon;
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
        <icon.Component variant={variant} size={size} />
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
      <figcaption>{size}px at 1× device pixels, magnified 8×</figcaption>
    </figure>
  );
}

function Construction({ icon, variant }: { icon: CatalogueIcon; variant: IconVariant }) {
  const [guides, setGuides] = useState({ grid: true, axes: true, safeArea: true });
  const { width, height } = architecture.grid;
  const inset = calibration.safeAreaInset;
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
          Safe area ({inset}-unit inset, calibration candidate)
        </label>
      </div>
      <div className="construction-frame">
        <div className="construction" style={{ width: width * scale, height: height * scale }}>
          <icon.Component variant={variant} size={width * scale} />
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
 * The outline drawing at each candidate stroke width. The override is a render-time CSS
 * `stroke-width` on this preview only (CSS outranks the SVG attributes), so the source and every
 * other view keep the authored width.
 */
function StrokeComparison({ icon }: { icon: CatalogueIcon }) {
  return (
    <Section
      title="Stroke calibration"
      note={`Outline drawing. Source width ${calibration.strokeWidth}; candidates are a visual calibration override, not the artwork.`}
    >
      <div className="stroke-grid">
        <figure className="source">
          <div className="compare-art">
            {[16, 24, 48].map((strokeSize) => (
              <Glyph key={strokeSize} icon={icon} variant="outline" size={strokeSize} />
            ))}
          </div>
          <figcaption>Actual source rendering</figcaption>
        </figure>
        {calibration.strokeCandidates.map((candidate) => (
          <figure
            key={candidate}
            className="stroke-override"
            style={{ "--qa-stroke": candidate } as CSSProperties}
          >
            <div className="compare-art">
              {[16, 24, 48].map((strokeSize) => (
                <Glyph key={strokeSize} icon={icon} variant="outline" size={strokeSize} />
              ))}
            </div>
            <figcaption>
              {candidate} · visual calibration override
              {candidate === calibration.strokeWidth ? " (current candidate)" : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

function Contexts({
  icon,
  variant,
  direction,
  mirrored,
}: {
  icon: CatalogueIcon;
  variant: IconVariant;
  direction: Direction;
  mirrored: boolean;
}) {
  const glyph = (size: number) => (
    <Glyph icon={icon} variant={variant} size={size} mirrored={mirrored} />
  );
  return (
    <Section
      title="Interface contexts"
      note={`Plain local HTML and CSS at real interface scale, not Qeetrix UI components. Direction: ${direction.toUpperCase()}.`}
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
                {glyph(20)}
                Overview
              </span>
              <span className="demo-nav-row">
                {glyph(20)}
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

function Typography({ icon, variant }: { icon: CatalogueIcon; variant: IconVariant }) {
  const availability = useFontAvailability();
  const missing = typefaces.filter(({ family }) => availability?.[family] === false);
  return (
    <Section
      title="Typography"
      note={
        missing.length > 0
          ? `${missing.map(({ family }) => family).join(" and ")} unavailable: these rows use the system fallback and are not a Qeet calibration.`
          : "Weight, baseline feel, alignment, and spacing beside medium-weight labels."
      }
    >
      <div className="type-samples">
        {typeSamples.map((sample) => (
          <figure key={`${sample.family}-${sample.text}-${sample.icon}`}>
            <p
              className="type-row"
              style={{ fontFamily: `var(${sample.variable})`, fontSize: sample.text }}
            >
              <Glyph icon={icon} variant={variant} size={sample.icon} />
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

function Usage({ icon }: { icon: CatalogueIcon }) {
  const snippets = importSnippets(icon);
  return (
    <>
      <Section title="Import" note="Public entry points only; generated paths are not API.">
        <Snippet label="Root import" code={snippets.root} />
        <Snippet label="Direct import" code={snippets.direct} />
      </Section>
      <Section title="Metadata" note="From the generated manifest.">
        <dl className="metadata">
          <dt>Name</dt>
          <dd>{icon.name}</dd>
          <dt>Component</dt>
          <dd>
            <code>{icon.componentName}</code>
          </dd>
          <dt>Category</dt>
          <dd>
            {icon.categoryLabel} (<code>{icon.category}</code>)
          </dd>
          <dt>Variants</dt>
          <dd>{icon.variants.join(", ")}</dd>
          <dt>Directionality</dt>
          <dd>{icon.directionality}</dd>
        </dl>
      </Section>
    </>
  );
}

function Snippet({ label, code }: { label: string; code: string }) {
  return (
    <div className="snippet">
      <div className="snippet-head">
        <span>{label}</span>
        <CopyButton text={code} label={`Copy ${label.toLowerCase()}`} showLabel />
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function CalibrationStatus() {
  return (
    <Section
      title="Calibration status"
      note={`Provisional until the Phase 3 calibration set. Default variant (${architecture.defaultVariant}) is stable API, not calibration.`}
    >
      <dl className="metadata">
        {provisionalValues().map(({ name, value }) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>
              {value} <span className="badge">Provisional</span>
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
