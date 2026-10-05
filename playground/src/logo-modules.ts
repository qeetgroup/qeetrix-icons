import { type ReactElement, useEffect, useState } from "react";
import type { LogoProps } from "../../src/types/logo.js";
import { decodeLogoIndex, emptyLogoIndex, type LogoIndex } from "./logo-catalogue.js";

/**
 * Lazy access to the generated logo components and the logo index. Nothing here is loaded until a
 * card or the inspector asks: Vite turns each generated module into its own small chunk, so the
 * page only downloads the logos that are actually on screen.
 */

export type LogoComponent = (props: LogoProps) => ReactElement;
type LogoModule = Readonly<Record<string, unknown>>;

let loaders: Promise<ReadonlyMap<string, () => Promise<LogoModule>>> | undefined;
const loaderTable = () => {
  loaders ??= import("./logo-loaders.js")
    .then((module) => module.logoLoaders)
    .catch(() => new Map());
  return loaders;
};

const components = new Map<string, LogoComponent | null>();
const pending = new Map<string, Promise<LogoComponent | null>>();

/** The component a module exports for a logo: its named export, else its only `…Logo` function. */
function pick(module: LogoModule, componentName: string): LogoComponent | null {
  const named = module[componentName];
  if (typeof named === "function") return named as LogoComponent;
  const fallback = Object.entries(module).find(
    ([name, value]) => name.endsWith("Logo") && typeof value === "function",
  );
  return fallback ? (fallback[1] as LogoComponent) : null;
}

export function loadLogo(id: string, componentName: string): Promise<LogoComponent | null> {
  const known = components.get(id);
  if (known !== undefined) return Promise.resolve(known);
  const existing = pending.get(id);
  if (existing) return existing;
  const promise = loaderTable()
    .then((table) => table.get(id)?.() ?? {})
    .then((module) => pick(module, componentName))
    .catch(() => null)
    .then((component) => {
      components.set(id, component);
      pending.delete(id);
      return component;
    });
  pending.set(id, promise);
  return promise;
}

export type LogoState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly Component: LogoComponent }
  | { readonly status: "missing" };

function stateOf(id: string): LogoState {
  const component = components.get(id);
  if (component === undefined) return { status: "loading" };
  return component ? { status: "ready", Component: component } : { status: "missing" };
}

/**
 * The component for a logo, loaded after `delay` ms on screen. The delay keeps a fast scroll from
 * requesting every card it flies past; cached components render immediately.
 */
export function useLogoComponent(id: string, componentName: string, delay = 0): LogoState {
  const [state, setState] = useState<LogoState>(() => stateOf(id));
  useEffect(() => {
    let active = true;
    const current = stateOf(id);
    setState(current);
    if (current.status !== "loading") return;
    const timer = window.setTimeout(() => {
      void loadLogo(id, componentName).then(() => {
        if (active) setState(stateOf(id));
      });
    }, delay);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [id, componentName, delay]);
  return state;
}

let indexPromise: Promise<LogoIndex> | undefined;
let indexValue: LogoIndex | undefined;

/** Loads the logo index once (a separate chunk), for the Logos page and the command palette. */
export function loadLogoIndex(): Promise<LogoIndex> {
  indexPromise ??= import("virtual:qeetrix-logos")
    .then((module) => decodeLogoIndex(module.default))
    .catch(() => emptyLogoIndex)
    .then((index) => {
      indexValue = index;
      return index;
    });
  return indexPromise;
}

/** The logo index once loaded; `undefined` while loading. `enabled: false` defers the request. */
export function useLogoIndex(enabled = true): LogoIndex | undefined {
  const [index, setIndex] = useState<LogoIndex | undefined>(indexValue);
  useEffect(() => {
    if (!enabled || index) return;
    let active = true;
    void loadLogoIndex().then((loaded) => {
      if (active) setIndex(loaded);
    });
    return () => {
      active = false;
    };
  }, [enabled, index]);
  return index;
}
