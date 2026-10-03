import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { iconSystem } from "../../config/icon-system.js";
import type { IconVariant } from "../../src/types/icon.js";
import { type CatalogueIcon, importSnippets, mirrorsInPreview } from "./catalogue.js";
import { typefaces, useFontAvailability } from "./fonts.js";
import { checklistFor, provisionalValues } from "./qa.js";
import { type Direction, sizeRange } from "./url-state.js";

const { architecture, calibration } = iconSystem;
const smallSizes: readonly number[] = calibration.recommendedSizes.slice(0, 2);

type InspectorProps = {
  icon: CatalogueIcon;
  variant: IconVariant;
  size: number;
  direction: Direction;
  onVariant: (variant: IconVariant) => void;
  onSize: (size: number) => void;
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

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="panel">
      <header>
        <h3>{title}</h3>
        {note && <p className="muted">{note}</p>}
      </header>
      {children}
    </section>
  );
}

export function Inspector({ icon, variant, size, direction, onVariant, onSize }: InspectorProps) {
  const mirrored = mirrorsInPreview(icon, direction);
  return (
    <article className="inspector" aria-label={`${icon.componentName} inspector`}>
      <header className="inspector-header">
        <div>
          <h2>{icon.name}</h2>
          <p className="muted">
            <code>{icon.componentName}</code> · {icon.categoryLabel} · {icon.directionality}
          </p>
        </div>
        <fieldset className="segmented">
          <legend>Variant</legend>
          {icon.variants.map((option) => (
            <label key={option}>
              <input
                type="radio"
                name="variant"
                value={option}
                checked={option === variant}
                onChange={() => onVariant(option)}
              />
              {option}
            </label>
          ))}
          {icon.variants.length === 1 && <span className="muted">only drawing</span>}
        </fieldset>
        <label className="size-control">
          Custom size
          <input
            type="range"
            min={sizeRange.min}
            max={sizeRange.max}
            value={size}
            onChange={(event) => onSize(Number(event.target.value))}
          />
          <input
            type="number"
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
        </label>
      </header>

      <Section title="Recommended sizes" note="Actual source rendering. 14 and 16 px matter most.">
        <div className="size-strip">
          {calibration.recommendedSizes.map((recommended) => (
            <figure
              key={recommended}
              className={smallSizes.includes(recommended) ? "critical" : ""}
            >
              <Glyph icon={icon} variant={variant} size={recommended} />
              <figcaption>{recommended}px</figcaption>
            </figure>
          ))}
          <figure className="custom">
            <Glyph icon={icon} variant={variant} size={size} />
            <figcaption>{size}px custom</figcaption>
          </figure>
        </div>
        <div className="pixel-strip">
          {smallSizes.map((small) => (
            <PixelPreview key={small} icon={icon} variant={variant} size={small} />
          ))}
        </div>
      </Section>

      <Construction icon={icon} variant={variant} />

      {icon.variants.includes("outline") && <StrokeComparison icon={icon} />}

      {icon.variants.length > 1 && (
        <Section title="Variant comparison" note="Same size and color. One concept, one family.">
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
              <span>Account settings</span>
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

      <Usage icon={icon} />

      <Section title="Review checklist" note="Local to this page. Nothing is saved or scored.">
        <div className="checklist">
          {checklistFor(icon).map((group) => (
            <fieldset key={group.title}>
              <legend>{group.title}</legend>
              {group.items.map((item) => (
                <label key={item}>
                  <input type="checkbox" />
                  {item}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </Section>

      <CalibrationStatus />
    </article>
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
      <canvas
        ref={canvas}
        width={size}
        height={size}
        role="img"
        aria-label={`${size} pixel rendering, magnified eight times`}
        style={{ width: size * 8, height: size * 8 }}
      />
      <figcaption>{size}px at 1× device pixels, magnified 8×</figcaption>
    </figure>
  );
}

function Construction({ icon, variant }: { icon: CatalogueIcon; variant: IconVariant }) {
  const [guides, setGuides] = useState({ grid: true, axes: true, safeArea: true });
  const { width, height } = architecture.grid;
  const inset = calibration.safeAreaInset;
  const scale = 10;
  const gridUnits = Array.from({ length: width - 1 }, (_, offset) => offset + 1);
  const toggle = (key: keyof typeof guides) =>
    setGuides((current) => ({ ...current, [key]: !current[key] }));
  return (
    <Section
      title={`Construction · ${width}×${height} at ${scale}×`}
      note="Visual guides only. Mathematical center is a reference, not optical correctness."
    >
      <div className="construction-controls">
        <label>
          <input type="checkbox" checked={guides.grid} onChange={() => toggle("grid")} />
          Unit grid
        </label>
        <label>
          <input type="checkbox" checked={guides.axes} onChange={() => toggle("axes")} />
          Center axes
        </label>
        <label>
          <input type="checkbox" checked={guides.safeArea} onChange={() => toggle("safeArea")} />
          Safe area ({inset}-unit inset, calibration candidate)
        </label>
      </div>
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
          <button type="button" className="demo-button">
            {glyph(16)}
            Save changes
          </button>
          <figcaption>Text button</figcaption>
        </figure>
        <figure>
          <button type="button" className="demo-icon-button" aria-label={`${icon.name} preview`}>
            {glyph(16)}
          </button>
          <figcaption>Icon-only control</figcaption>
        </figure>
        <figure>
          <label className="demo-input">
            {glyph(16)}
            <input type="text" placeholder="Search records" aria-label="Preview input" />
          </label>
          <figcaption>Input prefix</figcaption>
        </figure>
        <figure>
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
          <figcaption>Sidebar row</figcaption>
        </figure>
        <figure>
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
          <figcaption>Table action</figcaption>
        </figure>
        <figure>
          <p className="demo-inline">
            {glyph(14)}
            Verified 2 hours ago
          </p>
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
    <Section title="Usage and metadata">
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
      <Snippet label="Root import" code={snippets.root} />
      <Snippet label="Direct import" code={snippets.direct} />
    </Section>
  );
}

function Snippet({ label, code }: { label: string; code: string }) {
  const [status, setStatus] = useState("");
  return (
    <div className="snippet">
      <span className="muted">{label}</span>
      <code>{code}</code>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard.writeText(code).then(
            () => setStatus("Copied"),
            () => setStatus("Copy unavailable"),
          )
        }
      >
        Copy
      </button>
      <span role="status">{status}</span>
    </div>
  );
}

export function CalibrationStatus() {
  return (
    <section className="panel">
      <header>
        <h3>Calibration status</h3>
        <p className="muted">
          Provisional until the Phase 3 calibration set. Default variant (
          {architecture.defaultVariant}) is stable API, not calibration.
        </p>
      </header>
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
    </section>
  );
}
