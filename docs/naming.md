# Naming and semantics

Names identify concepts, not the instructions used to draw them. Prefer `download`, `upload`,
`lock`, `unlock`, `user-plus`, `file-text`, and `database`; avoid names such as `circle-with-line`,
`square-arrow-thing`, and `two-dots-shape`. Do not expose path construction or other implementation
details in a public name.

The examples here describe the future catalogue. None is an available icon export in Phase 2A.

## Source filenames and component names

Use lowercase ASCII kebab-case with a `.svg` extension for source filenames. Use PascalCase plus
`Icon` for React component exports. Hyphens separate meaningful words, not version labels.
One converter owns this mapping, `componentNameFromFilename` in
[validate-source-path.ts](../scripts/check/validate-source-path.ts); it rejects invalid filenames
rather than producing a broken identifier. Generated components, root exports, direct-import
subpaths, and the manifest all use it.

A name identifies a concept, not a drawing. `star.svg` under `icons/outline/` and `star.svg`
under `icons/filled/` are two separately drawn masters of **one** concept, and together they
generate **one** component, `StarIcon`, selected with `variant="outline"` (the default) or
`variant="filled"`, and importable from `@qeetrix/icons/icons/star`. The variant directory
distinguishes the artwork; the filename never does. Every concept needs its outline drawing, and
the filled drawing must use the same name and category. Variant words are therefore reserved: a
source name may not end in `-filled` or `-outline`. See [api.md](api.md#one-component-per-concept).

| SVG filename | Future component name |
|:--|:--|
| `search.svg` | `SearchIcon` |
| `plus.svg` | `PlusIcon` |
| `minus.svg` | `MinusIcon` |
| `check.svg` | `CheckIcon` |
| `x.svg` | `XIcon` |
| `settings.svg` | `SettingsIcon` |
| `arrow-left.svg` | `ArrowLeftIcon` |
| `chevron-down.svg` | `ChevronDownIcon` |
| `user-plus.svg` | `UserPlusIcon` |
| `shield-check.svg` | `ShieldCheckIcon` |
| `file-text.svg` | `FileTextIcon` |
| `database.svg` | `DatabaseIcon` |

Always retain the suffix: `MapIcon`, `ImageIcon`, `RecordIcon`, and `FileIcon`, never bare `Map`,
`Image`, `Record`, or `File`. This avoids collisions with platform and global types. Familiar
operator names such as `plus`, `minus`, and `x` are useful semantic UI symbols, not arbitrary shape
descriptions.

## Canonical concepts and modifiers

- Choose one predictable name for one concept. Do not add `settings`, `setting`, `gear`, and
  `preferences` for the same meaning merely to increase discoverability.
- Use semantic modifiers when they distinguish a real action, state, or direction: `-plus`,
  `-minus`, `-check`, `-x`, `-off`, `-on`, `-open`, `-closed`, `-left`, `-right`, `-up`, `-down`.
- Do not use `-alt`, `-2`, `-new`, `-copy`, or `-final` to distinguish competing drawings. If a
  genuinely different concept exists, name and document that distinction instead.
- Keep family terms consistent so a person who knows `user-plus` can predict a related name.
- Do not encode stroke width, grid size, source category, or path implementation in the name.
- Physical directions such as `left` and `right` are not interchangeable with logical concepts
  such as `back` and `forward`. Choose the concept before deciding RTL behavior.

Outline and filled artwork for one concept are not unrelated names: they share the canonical
name and one component, and `variant` chooses between them. Search aliases and
keywords are future catalogue work, not extra exports to add now.

## Categories are organization, not names

[config/categories.ts](../config/categories.ts) defines the 20 stable category IDs, display labels,
and purposes. Array position is the canonical display order; no separate index or locale-based
sort is needed. Categories support source organization, documentation, discovery, and future
manifest metadata.

Give each concept one primary category based on purpose. A semantic name is catalogue-wide, not
unique only within its category. Moving its source organization must not rename its public
component: use `SearchIcon`, never `ActionsSearchIcon`.

When category boundaries overlap, use the concept's primary meaning:

- `identity` covers accounts and profiles; `security` covers authentication and access protection.
- `data` covers records and relationships; `observability` covers logs, metrics, and traces.
- `organization` covers teams and workplace structure, rather than an individual profile.
- `finance` covers money and payments; `commerce` covers products, orders, and purchases.
- `qeet` is for genuinely Qeet-specific concepts, not generic icons used by a Qeet product.

Do not duplicate drawings in several categories for discovery. Phase 2B defines the source layout
as `icons/<variant>/<category>/<name>.svg`, without creating empty folders or production artwork.
See [validation.md](validation.md) for enforced filename rules, collision checks, and the boundary
between semantic numerals and duplicate suffixes. The component API remains deferred.

## Stability review

Before accepting a future name, check whether someone can predict it from the concept, find it
without guessing a synonym, and understand its state without seeing the path data. Review
neighboring family names and platform collisions. Once published, renaming or removing an export
is a breaking API change. Get the semantics right before adding the drawing, rather than using
temporary names and planning a rename.
