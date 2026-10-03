# Qeetrix icon language

Qeetrix Icons is the original, shared icon system for Qeetrix and Qeet products. Its primary setting
is an enterprise interface: navigation, forms, tables, authentication, payments, operational data,
and developer tools. An icon must help someone recognize a concept while scanning a working screen.

The direction is precise, calm, geometric, human, enterprise, premium, and distinctly Qeet. In
practice, this means geometric structure with human refinement, not decorative illustration.
Phase 2A defines this contract; it contains no artwork or verified visual calibration results.

## Practical principles

| Principle | Design decision |
|:--|:--|
| Clarity before decoration | Remove a detail if recognition survives without it. |
| Meaning before novelty | Start from the user's concept and a recognizable metaphor, not an unusual shape. |
| Consistency before individual beauty | Review each drawing beside its family; an impressive outlier is still a mismatch. |
| Optical balance over mathematical rigidity | Correct apparent weight and centering even when coordinates are already symmetrical. |
| Enterprise calm | Avoid playful proportions, ornamental marks, heavy silhouettes, and attention-seeking detail. |
| Typography harmony | Match the apparent weight of medium-weight Qeet UI labels without overpowering text. |
| Minimal detail | Keep only the silhouette and internal marks needed to distinguish the concept. |
| Strong recognition at small sizes | Judge the actual 14px and 16px rendering, not only a magnified drawing. |
| Original geometry | Construct every drawing independently; familiar semantics do not justify copied paths. |
| Accessibility by default | Keep decorative icons silent and provide explicit semantics for meaningful uses. |

## Geometry identity

- Use simple exterior silhouettes, balanced proportions, and deliberate geometric construction.
- Combine controlled exterior corner radii with softer internal details and round stroke terminals.
  Round joins are the initial candidate, not a direction to round every exterior into a soft shape.
- Preserve generous negative space. Do not enlarge every icon until it touches the same canvas box.
- Prefer disciplined diagonals, especially 45 degrees when appropriate. Recognition takes priority
  over a universal angle rule.
- Judge the visual center, not just the bounding-box center. Directional mass, circles, open shapes,
  and overlays can need optical correction.

The result should be neither cartoonishly rounded nor harshly technical. Numeric geometry
candidates and practical construction guidance live in [drawing-guidelines.md](drawing-guidelines.md).

## Typography relationship

The broader Qeetrix type system uses Qeet Display, Qeet Text, Qeet UI, and Fira Code. Icons primarily
harmonize with Qeet UI and Qeet Text, particularly 13-16px interface text. Their apparent weight
should be compatible with medium-weight Qeet UI labels, not compete with those labels.

Later calibration must compare icons beside buttons, labels, inputs, menus, sidebar items, table
actions, command palettes, and headings. Compare baseline placement, perceived size, and weight
in context; do not assume a centered SVG box guarantees a balanced text/icon pair. Qeet Display
and Fira Code are contextual companions, not reasons to introduce separate icon styles.

No font files are embedded in this repository. Typography comparisons belong to later visual QA.

## Outline-first variants

`outline` is the primary language. `filled` is a selectively authored alternative for a meaningful
state: selected navigation, favorite, bookmark, notification state, rating, active state, or status
emphasis. A declared variant vocabulary does not promise both drawings for every concept.

A filled drawing must preserve the concept and optical balance; it is not an automatic fill of an
outline path. Do not add thin, light, regular, medium, bold, duotone, sharp, or round variant axes.

## Original authorship

Other systems may be studied for grid discipline, semantics, accessibility, negative space, optical
sizing, and small-size behavior. This includes Lucide, Tabler, Primer/Octicons, Carbon, Fluent,
Material Symbols, Phosphor, Heroicons, and Iconoir, but grants no permission to reuse their artwork.

Never copy, trace, import, or slightly modify SVG path data from any icon library, including
Iconsax/Vuesax. Every future Qeetrix drawing must be independently constructed for Qeet Group.
Do not use third-party paths as placeholders or test fixtures.

## Review standard

The stable architecture and provisional numbers are separated in
[config/icon-system.ts](../config/icon-system.ts). Read [naming.md](naming.md) before proposing a
concept and the drawing guidelines before constructing it. A later visual review must ask:

- Is the meaning clear without relying on color alone?
- Does it read at each recommended size, with open counters and distinguishable state marks?
- Does it belong beside neighboring icons and medium-weight UI text?
- Is each deviation from shared geometry justified by recognition or optical balance?
- Is the drawing original, with a semantic name and a deliberate directionality decision?

Visual review and the calibration set are future work; passing Phase 2A tests proves the written
and typed foundations, not the visual quality of nonexistent icons.
