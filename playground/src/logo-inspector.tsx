import { useEffect, useId, useState } from "react";
import { CloseButton } from "./layout.js";
import { LogoArt } from "./logo-art.js";
import {
  defaultLogoVariant,
  type LogoBackground,
  type LogoEntry,
  type LogoVariant,
  licenseInfo,
  logoSnippets,
} from "./logo-catalogue.js";
import { CopyButton, formatCount, Segmented, UiIcon } from "./ui.js";

const heights = [16, 24, 32, 48, 64] as const;
/** Remembered across logos, so stepping through keeps the chosen preview height. */
let lastHeight = 32;

const backgroundLabels: Record<LogoBackground, string> = {
  light: "For light backgrounds",
  dark: "For dark backgrounds",
  any: "Works on any background",
};

export function LogoInspector({
  logo,
  collectionLabel,
  position,
  onStep,
  onClose,
}: {
  logo: LogoEntry;
  collectionLabel: string;
  position?: { index: number; total: number };
  onStep: (direction: 1 | -1) => void;
  onClose: () => void;
}) {
  const [height, setHeightState] = useState(lastHeight);
  const setHeight = (next: number) => {
    lastHeight = next;
    setHeightState(next);
  };
  const id = useId();
  const license = licenseInfo(logo.licenseClass);
  const snippets = logoSnippets(logo, undefined, height);
  const primary = defaultLogoVariant(logo);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
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

  return (
    <article className="inspector" aria-labelledby={`${id}-title`}>
      <header className="inspector-head">
        <div className="inspector-title-row">
          <span className="inspector-thumb inspector-thumb-logo" aria-hidden="true">
            <LogoArt logo={logo} variant={primary.name} height={20} />
          </span>
          <div className="inspector-title">
            <h2 id={`${id}-title`} tabIndex={-1} data-autofocus>
              {logo.title}
            </h2>
            <p>
              <code>{logo.componentName}</code>
            </p>
          </div>
          <div className="inspector-nav">
            {position && (
              <>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Previous logo"
                  title="Previous logo (←)"
                  disabled={position.index === 0}
                  onClick={() => onStep(-1)}
                >
                  <UiIcon name="chevron-left" size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Next logo"
                  title="Next logo (→)"
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
        <div className="chip-list">
          <span className="chip">{collectionLabel}</span>
          <span className="license-badge" data-tone={license.tone}>
            {license.tone === "warning" ? (
              <UiIcon name="triangle-alert" size={12} />
            ) : license.tone === "safe" ? (
              <UiIcon name="shield-check" size={12} />
            ) : (
              <UiIcon name="info" size={12} />
            )}
            {license.label}
          </span>
          <span className="chip chip-quiet">
            {logo.variants.length} {logo.variants.length === 1 ? "variant" : "variants"}
          </span>
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
            variant="button"
            text={snippets.import}
            label={`Copy ${snippets.import}`}
            toast="Import copied"
          >
            Import
          </CopyButton>
          <CopyButton
            variant="button"
            text={logo.id}
            label="Copy the logo slug"
            toast="Slug copied"
          >
            Slug
          </CopyButton>
        </div>
      </header>

      {license.tone === "warning" && (
        <div className="callout callout-warning" role="note">
          <UiIcon name="triangle-alert" size={16} />
          <div>
            <p className="callout-title">{license.label} licence: review before use</p>
            <p>{license.summary}</p>
          </div>
        </div>
      )}

      <section className="panel">
        <header className="panel-head">
          <div>
            <h3>Variants</h3>
            <p className="panel-note">
              Each file on the background it is drawn for, at its true aspect ratio.
            </p>
          </div>
          <Segmented<string>
            label="Preview height in pixels"
            size="sm"
            value={String(height)}
            options={heights.map((value) => ({ value: String(value), label: String(value) }))}
            onChange={(value) => setHeight(Number(value))}
          />
        </header>
        <div className="variant-list">
          {[primary, ...logo.variants.filter((variant) => variant !== primary)].map((variant) => (
            <VariantCard
              key={variant.name}
              logo={logo}
              variant={variant}
              height={height}
              isDefault={variant.name === logo.defaultVariant}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h3>Licence</h3>
            <p className="panel-note">As recorded upstream. Not legal advice.</p>
          </div>
        </header>
        <dl className="metadata">
          <div>
            <dt>Class</dt>
            <dd>
              <span className="license-badge" data-tone={license.tone}>
                {license.label}
              </span>
              <p className="dd-note">{license.summary}</p>
            </dd>
          </div>
          <div>
            <dt>Licence</dt>
            <dd>
              <code className="wrap">{logo.license}</code>
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h3>Brand</h3>
          </div>
        </header>
        <dl className="metadata">
          <div>
            <dt>Colour</dt>
            <dd>
              {logo.hex ? (
                <span className="hex-row">
                  <span className="swatch swatch-lg" style={{ background: `#${logo.hex}` }} />
                  <code>#{logo.hex}</code>
                  <CopyButton
                    text={`#${logo.hex}`}
                    label={`Copy #${logo.hex}`}
                    toast="Colour copied"
                  />
                </span>
              ) : (
                <span className="muted">Not recorded</span>
              )}
            </dd>
          </div>
          {logo.categories.length > 0 && (
            <div>
              <dt>Categories</dt>
              <dd className="chip-list">
                {logo.categories.map((category) => (
                  <span key={category} className="chip chip-quiet">
                    {category}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {logo.aliases.length > 0 && (
            <div>
              <dt>Aliases</dt>
              <dd className="chip-list">
                {logo.aliases.map((alias) => (
                  <span key={alias} className="chip chip-quiet">
                    {alias}
                  </span>
                ))}
              </dd>
            </div>
          )}
          <div>
            <dt>Slug</dt>
            <dd>
              <code>{logo.id}</code>
            </dd>
          </div>
          <div>
            <dt>Links</dt>
            <dd className="link-list">
              {logo.website && <ExternalLink href={logo.website}>Website</ExternalLink>}
              {logo.guidelines && (
                <ExternalLink href={logo.guidelines}>Brand guidelines</ExternalLink>
              )}
              {logo.source && <ExternalLink href={logo.source}>Source</ExternalLink>}
              {!logo.website && !logo.guidelines && !logo.source && (
                <span className="muted">None recorded</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <p className="trademark-notice">
        <UiIcon name="info" size={14} />
        <span>
          {logo.title} and its logo are trademarks of their owner, shown here for identification
          only. Inclusion does not imply endorsement. Follow the brand's guidelines when you use it.
        </span>
      </p>
    </article>
  );
}

function VariantCard({
  logo,
  variant,
  height,
  isDefault,
}: {
  logo: LogoEntry;
  variant: LogoVariant;
  height: number;
  isDefault: boolean;
}) {
  const snippet = logoSnippets(logo, variant.name, height).usage;
  const surfaces: ("light" | "dark")[] =
    variant.background === "any" ? ["light", "dark"] : [variant.background];
  return (
    <figure className="variant-card">
      <figcaption className="variant-head">
        <code className="variant-name">{variant.name}</code>
        {isDefault && <span className="chip chip-accent">Default</span>}
        <span className="variant-bg" data-background={variant.background}>
          {backgroundLabels[variant.background]}
        </span>
        <CopyButton text={snippet} label={`Copy ${snippet}`} toast="JSX copied" />
      </figcaption>
      <div className="variant-panes" data-count={surfaces.length}>
        {surfaces.map((surface) => (
          <div key={surface} className={`variant-pane scheme-${surface} backdrop-${surface}`}>
            <LogoArt
              logo={logo}
              variant={variant.name}
              height={height}
              label={`${logo.title}, ${variant.name}`}
            />
          </div>
        ))}
      </div>
      {variant.colors.length > 0 && (
        <ul className="color-list" aria-label={`Colours in ${variant.name}`}>
          {variant.colors.slice(0, 8).map((color) => (
            <li key={color} title={color}>
              <span
                className="swatch swatch-sm"
                style={{ background: /^#|^rgb|^hsl/i.test(color) ? color : "transparent" }}
                data-current={color === "currentColor" || undefined}
              />
              <code>{color}</code>
            </li>
          ))}
          {variant.colors.length > 8 && (
            <li className="muted">+{formatCount(variant.colors.length - 8)}</li>
          )}
        </ul>
      )}
    </figure>
  );
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  let host = href;
  try {
    host = new URL(href).host.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (!/^https?:$/.test(new URL(href).protocol)) return null;
  return (
    <a className="external-link" href={href} target="_blank" rel="noopener noreferrer">
      <span>{children}</span>
      <span className="external-host">{host}</span>
      <UiIcon name="arrow-up-right" size={13} />
      <span className="visually-hidden">(opens in a new tab)</span>
    </a>
  );
}
