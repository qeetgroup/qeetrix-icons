# Naming

An icon's filename becomes its public API. `icons/arrows/arrow-left.svg` promises
`import { ArrowLeft } from "@qeetrix/icons"` for as long as the package exists, so renaming an icon
is a breaking change. Get the name right before merging, not after.

## The rule

| | |
|:--|:--|
| **Source file** | `kebab-case.svg` — lowercase letters, digits, single hyphens |
| **Component** | `PascalCase`, derived mechanically from the filename |
| **Pattern** | `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

```text
arrow-left.svg     → ArrowLeft
arrow-right.svg    → ArrowRight
calendar-check.svg → CalendarCheck
shield-check.svg   → ShieldCheck
user-add.svg       → UserAdd
x.svg              → X
```

The mapping is deliberately dumb: split on hyphens, capitalise each part, join. There is no
normalisation pass that rescues a malformed name, because two malformed names can normalise to the
same identifier and silently shadow one another in the barrel.

## Rejected

| Name | Why |
|:--|:--|
| `icon1.svg`, `icon-2.svg` | Not semantic. A number tells a consumer nothing. |
| `arrow-final.svg`, `arrow-v2.svg`, `new-arrow.svg` | Revision state is what git is for. |
| `userIcon.svg` | camelCase. Also redundant — everything here is an icon. |
| `user_add.svg` | snake_case. Collides with `user-add.svg` on `UserAdd`. |
| `Arrow-Left.svg` | Capitals in the source name. |
| `arrow--left.svg`, `-arrow.svg`, `arrow-.svg` | Empty name segment. |
| `arrow left.svg`, `arrow.left.svg` | Space or dot. |
| `2fa-token.svg` | Leading digit — `2faToken` is not a legal JavaScript identifier. |
| `index.svg` | Would overwrite the generated `src/icons/index.ts` barrel. |
| `icon-base.svg`, `icon-metadata.svg` | Collides with an existing package export. |

Every one of these is a build error, not a review note. See `scripts/lib/naming.mjs`.

## Choosing a good name

**Name the thing, not the meaning.** `bell`, not `notifications`. `trash`, not `delete`. One glyph
serves many meanings, and meanings shift per product — the shape does not. Put the meanings in
`tags` instead, where they are searchable without being load-bearing.

**Order words from general to specific.** `arrow-left`, `arrow-right`, `arrow-up` sort together and
autocomplete together. `left-arrow` scatters them.

**A plural means "doubled", not "many".** `chevrons-left` is two chevrons; `checks` is two ticks.
Reserve the plural for that, and use it instead of stuttering (`check-check`) — a doubled glyph is not
a `<base>-<modifier>` variant and should not look like one. `users`, `files` and `messages` are the
exception that proves the rule: there the plural genuinely means *several of the thing*, and the
glyph shows several.

**Use a consistent modifier vocabulary,** so a consumer can guess a name without looking it up:

| Modifier | Means | Example |
|:--|:--|:--|
| `-check` | with a tick overlay | `shield-check` |
| `-plus` / `-minus` | with an add/remove overlay | `user-plus` |
| `-x` | with a dismiss overlay | `circle-x` |
| `-off` | struck through / disabled | `eye-off` |
| `-left` / `-right` / `-up` / `-down` | direction | `chevron-down` |

**Prefer the shorter name when both read equally well.** `settings`, not `settings-gear`.

**Never encode style, size or colour.** There is one visual style; `arrow-left-outline-24-dark`
would all be noise.

## Aliases, not renames

When a name is wrong but already published, do not rename it. Add the better name as a new icon and
keep the old one working, or record the alternative in `aliases` so search finds it:

```json
"search": { "tags": ["find", "lookup"], "aliases": ["magnifying-glass"], "mirror": true }
```

Aliases are search-only — they do not create a second export, so they cost nothing and cannot break
a consumer.

### Tags vs aliases

The distinction is load-bearing, and the validator enforces it:

| | Means | Shared? |
|:--|:--|:--|
| **tag** | "this icon is *related to* X" | Yes — `warning` describes several icons |
| **alias** | "this icon *is also called* X" | **No** — two owners make the query ambiguous |

So `warning` is a tag on both `alert-circle` and `alert-triangle`, but only `alert-triangle` claims it
as an alias. Likewise `favourite` is a tag on `bookmark`, `heart` and `star`, and an alias of `star`
alone.

Never restate an alias as a tag, or the icon's own name as either: search already covers the name and
the aliases, so the duplicate is pure maintenance.

## Categories

The category is the directory, and it never appears in the icon name — `icons/arrows/arrow-left.svg`
is `ArrowLeft`, not `ArrowsArrowLeft`. Category is metadata for browsing; the export namespace is
flat, so an icon name must be unique across the whole library.

Moving an icon between categories is therefore **not** a breaking change: the component name does
not move with it. The declared category list lives in `scripts/config/categories.json`, and a
directory not on that list is an error rather than a new category — that way `navigaton/` fails
loudly instead of quietly becoming real.
