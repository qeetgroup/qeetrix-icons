import type { FilledRecipe, FilledRole } from "./filled.js";

/**
 * How one category's filled and sharp drawings are derived from its Lucide outlines. One file per
 * category in `config/derived/<category>.ts`, so each category can be reviewed and corrected on its
 * own; `config/derived/index.ts` merges them.
 */
export type CategoryDerivations = {
  /** Icons that get a filled drawing. An empty recipe infers every element's role. */
  readonly filled: Readonly<Record<string, FilledRecipe>>;
  /** Outline elements the sharp style keeps round (figurative circles, organic curves), by index. */
  readonly keepRound: Readonly<Record<string, readonly number[]>>;
  /**
   * Roles for the sharp filled drawing that differ from the round one, by outline element index.
   * The sharp filled drawing otherwise plays every element in the role the round one does.
   */
  readonly sharpFilledRoles: Readonly<Record<string, Readonly<Record<number, FilledRole>>>>;
  /**
   * Outline elements whose acute tips the sharp style cuts flat at the round outline's extent
   * instead of bringing to a point, by index: letterforms whose pointed apex would tower over the
   * letters beside them (an A beside a B).
   */
  readonly tipHeight?: Readonly<Record<string, readonly number[]>>;
};

/** Merges per-category derivations, failing on a name listed by two categories. */
export function mergeDerivations(
  byCategory: Readonly<Record<string, CategoryDerivations>>,
): CategoryDerivations & { readonly categoryOf: ReadonlyMap<string, string> } {
  const filled: Record<string, FilledRecipe> = {};
  const keepRound: Record<string, readonly number[]> = {};
  const sharpFilledRoles: Record<string, Readonly<Record<number, FilledRole>>> = {};
  const tipHeight: Record<string, readonly number[]> = {};
  const categoryOf = new Map<string, string>();
  for (const [category, derivations] of Object.entries(byCategory)) {
    for (const [table, target] of [
      [derivations.filled, filled],
      [derivations.keepRound, keepRound],
      [derivations.sharpFilledRoles, sharpFilledRoles],
      [derivations.tipHeight ?? {}, tipHeight],
    ] as const) {
      for (const [name, value] of Object.entries(table)) {
        const owner = categoryOf.get(name);
        if (owner !== undefined && owner !== category) {
          throw new Error(`config/derived: ${name} is listed by both ${owner} and ${category}.`);
        }
        categoryOf.set(name, category);
        (target as Record<string, unknown>)[name] = value;
      }
    }
  }
  return { filled, keepRound, sharpFilledRoles, tipHeight, categoryOf };
}
