/** Build-time data modules provided by the playground's Vite config (see vite.config.ts). */

declare module "virtual:qeetrix-meta" {
  const meta: {
    readonly packageVersion: string | null;
    readonly lucideVersion: string | null;
    readonly logos: {
      readonly count: number;
    } | null;
  };
  export default meta;
}

declare module "virtual:qeetrix-logos" {
  import type { EncodedLogoIndex } from "./logo-catalogue.js";

  const index: EncodedLogoIndex;
  export default index;
}
