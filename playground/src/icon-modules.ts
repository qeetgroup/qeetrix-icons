import { type IconModule, moduleId } from "./catalogue.js";

/**
 * Development-only enumeration of the generated icon modules, for browsing. A Vite feature that
 * exists only inside the playground: the package exports no registry, and consumers import icons
 * statically. With zero icons the glob is simply empty.
 */
const modules = import.meta.glob<IconModule>("../../src/generated/icons/*.tsx", { eager: true });

export const iconModules: ReadonlyMap<string, IconModule> = new Map(
  Object.entries(modules).map(([path, module]) => [moduleId(path), module]),
);
