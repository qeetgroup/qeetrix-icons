import { moduleId } from "./catalogue.js";

/**
 * One lazy loader per generated logo module. Its own chunk, imported on first use: the table of
 * 7,400 loaders is itself sizeable, so the icon page never pays for it.
 */
export const logoLoaders: ReadonlyMap<string, () => Promise<Readonly<Record<string, unknown>>>> =
  new Map(
    Object.entries(
      import.meta.glob<Readonly<Record<string, unknown>>>("../../src/generated/logos/*.ts"),
    ).map(([path, load]) => [moduleId(path), load]),
  );
