# Derived drawing configuration

The round outline icons come from Lucide unchanged. Three more drawings are derived from each one:
round filled (`icons/round-filled/`), sharp outline (`icons/sharp-outline/`), and sharp filled
(`icons/sharp-filled/`). This folder says how, one file per source category, so each category can be
reviewed and corrected on its own. `index.ts` merges the files; a name listed by two categories is an
error.

Each `<category>.ts` exports `derivations` with three tables:

| Table | Effect |
|:--|:--|
| `filled` | Icons that get a filled drawing. `roles` overrides the inferred role of an outline element by its 0-based index (see [docs/filled.md](../../docs/filled.md)). |
| `keepRound` | Outline elements the sharp style keeps round, by index: figurative circles, organic curves, and figurative dots (eyes, spots), which keep round caps. See [docs/sharp.md](../../docs/sharp.md#kept-round). |
| `sharpFilledRoles` | Roles for the sharp filled drawing that differ from the round filled drawing's. |
| `tipHeight` | Optional. Letterform elements whose sharp apex is cut flat at the round outline's height, so a sharp A stays level with the letters beside it. See [docs/sharp.md](../../docs/sharp.md#letter-heights). |

When derivation cannot produce a clean drawing, a hand-drawn override replaces it:
`config/overrides/<round-filled|sharp-outline|sharp-filled>/<category>/<name>.svg` is copied to the
matching `icons/` file byte for byte. Each override records the outline it was drawn against and that
outline's SHA-256 (`bun run stamp:override <file>`); when a Lucide upgrade changes the outline, the
override becomes an error until someone reviews and re-stamps it.

After a change, regenerate one category with `bun run derive:filled --category <id>` and
`bun run derive:sharp --category <id>`, or everything without `--category`.
