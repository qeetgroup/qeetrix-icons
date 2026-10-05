import type { LogoEntry } from "./logo-catalogue.js";
import { useLogoComponent } from "./logo-modules.js";

/**
 * One logo variant through its generated component, at a height, never stretched or cropped: the
 * component sizes the image from the file's own aspect ratio and CSS only ever scales it down
 * (`max-width`, `height: auto`). The box around it has a fixed size, so loading never shifts the
 * layout; a quiet placeholder holds the space meanwhile.
 */
export function LogoArt({
  logo,
  variant,
  height,
  delay = 0,
  label,
}: {
  logo: LogoEntry;
  variant: string;
  height: number;
  /** Milliseconds on screen before loading (fast scrolling skips cards it flies past). */
  delay?: number;
  /** Accessible name; decorative when omitted. */
  label?: string;
}) {
  const state = useLogoComponent(logo.id, logo.componentName, delay);
  if (state.status === "ready") {
    const { Component } = state;
    return (
      <Component
        className="logo-img"
        variant={variant}
        height={height}
        alt={label ?? ""}
        decoding="async"
        draggable={false}
        style={{ maxHeight: height }}
      />
    );
  }
  if (state.status === "missing") {
    return (
      <span className="logo-missing" title="No generated component. Run bun run generate:logos.">
        Not generated
      </span>
    );
  }
  return (
    <span
      className="logo-placeholder"
      style={{ height: Math.min(height, 40) }}
      aria-hidden="true"
    />
  );
}
