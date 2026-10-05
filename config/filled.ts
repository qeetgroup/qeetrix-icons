import type { FilledRecipe } from "../scripts/lib/filled.js";
import { derived } from "./derived/index.js";

/**
 * Icons that get a filled drawing, derived from their Lucide outline by `bun run derive:filled`.
 *
 * Recipes live per category in `config/derived/<category>.ts` (with that category's sharp
 * exceptions); this is their merge. An icon is listed only when its outline derives into a clean,
 * consistent solid form, or when a reviewed override in `config/overrides/round-filled/` replaces
 * the derived drawing. See docs/filled.md.
 */
export const filledRecipes: Readonly<Record<string, FilledRecipe>> = derived.filled;
