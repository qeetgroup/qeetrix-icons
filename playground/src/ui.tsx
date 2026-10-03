import { createContext, type ReactNode, useContext, useEffect, useId, useState } from "react";
import type { IconComponent } from "./catalogue.js";

/**
 * Playground chrome is drawn with the catalogue's own icons, looked up by id. A missing concept
 * renders nothing, so the chrome still works with an empty or partial catalogue.
 */
const UiIconContext = createContext<(id: string) => IconComponent | undefined>(() => undefined);

export const UiIconProvider = UiIconContext.Provider;

export function UiIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Component = useContext(UiIconContext)(name);
  return Component ? <Component size={size} /> : null;
}

export type SegmentedOption<T extends string> = {
  readonly value: T;
  readonly label: ReactNode;
  readonly title?: string;
};

/** A labelled radio group drawn as a segmented control (or a stacked list). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  layout = "inline",
}: {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  layout?: "inline" | "stack";
}) {
  const name = useId();
  return (
    <fieldset className={`segmented segmented-${layout}`}>
      <legend className="visually-hidden">{label}</legend>
      {options.map((option) => (
        <label key={option.value} title={option.title}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Copies `text`, then confirms in place and through a polite live region. */
export function CopyButton({
  text,
  label,
  showLabel = false,
}: {
  text: string;
  label: string;
  showLabel?: boolean;
}) {
  const [status, setStatus] = useState<"" | "Copied" | "Copy unavailable">("");
  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(""), 1600);
    return () => window.clearTimeout(timer);
  }, [status]);
  return (
    <>
      <button
        type="button"
        className={showLabel ? "button button-ghost" : "icon-button"}
        data-status={status || undefined}
        aria-label={showLabel ? undefined : label}
        title={label}
        onClick={() =>
          navigator.clipboard.writeText(text).then(
            () => setStatus("Copied"),
            () => setStatus("Copy unavailable"),
          )
        }
      >
        <UiIcon name={status === "Copied" ? "check" : "copy"} size={14} />
        {showLabel && <span>{status || "Copy"}</span>}
      </button>
      <span className="visually-hidden" role="status">
        {status}
      </span>
    </>
  );
}
