# Releases, versioning and deprecation

What a version number means for an icon library, and how to change the catalogue without breaking the
people using it.

## Creating a changeset

Every change that affects the package needs one:

```bash
bun run changeset
```

It asks for a bump type and a summary. The summary lands in `CHANGELOG.md` verbatim, so write it for
someone deciding whether to upgrade — name the icons, not the files.

```text
✔ minor — Added file-lock, folder-lock and user-lock for restricted-access states.
✔ patch — Redrew settings: the previous glyph read as a sun rather than a cog at 16px.
✗ minor — updated some icons
```

Changes that need **no** changeset: documentation, tests, CI, the explorer, anything under `scripts/`.
None of it ships in the tarball, so none of it can affect a consumer.

## What each bump means

The hard question for an icon library is not what semver means — it is what counts as a breaking
change when the public API is a list of component names.

| Change | Bump | Why |
|:--|:--|:--|
| New icon | **minor** | Additive. Nothing that compiled stops compiling. |
| New alias or tag | **patch** | Metadata only; improves search, changes no export. |
| Visual correction to an existing icon | **patch** | The name and props are unchanged. See below. |
| New optional prop | **minor** | Additive. |
| Icon moved between categories | **patch** | Category is browse metadata; it is not in the export name. |
| Icon marked deprecated | **minor** | Additive metadata; the icon still works. |
| **Icon renamed** | **major** | A named export disappeared. Someone's build breaks. |
| **Icon removed** | **major** | Same. |
| **Prop removed or retyped** | **major** | Same. |
| **Default size, stroke or a11y behaviour changed** | **major** | Silently changes rendering everywhere. |

### Why a visual correction is only a patch

Redrawing an icon changes what renders without changing any API. A consumer who upgrades gets a better
glyph in the same place with the same props, which is exactly what a patch is for.

It is still a real change, so it needs to be visible: the visual-regression snapshot will fail, and
the diff in the PR shows precisely what moved. Never re-record snapshots to make a build go green —
review the diff, then update deliberately:

```bash
bun run test -- -u
```

Say what changed and why in the changeset. "Redrew X; the old glyph read as Y at 16px" is worth more
than a version number.

### Why renaming is expensive

An icon's component name is its public API. `import { ArrowLeft } from "@qeetrix/icons"` is a
compile-time contract, and renaming it turns every consuming build red. That cost is why
[naming.md](naming.md) is strict about getting the name right the first time, and why the catalogue
has a "Deliberate non-duplicates" table recording names that were argued about and settled.

**Do not rename an icon because a better name occurred to you.** Add an alias instead — aliases make
the better word findable in the explorer at zero cost to anyone:

```json
"trash": { "tags": ["discard"], "aliases": ["delete", "bin"], "mirror": false, "priority": "P0" }
```

That is why `delete`, `bin`, `add`, `close`, `gear` and `stop` are aliases and not icons.

## How a release happens

Releases are driven by Changesets through `.github/workflows/release.yml`:

1. A PR lands on `main` carrying one or more changeset files.
2. The workflow opens (or updates) a **version PR** that consumes the changesets, bumps the version
   and writes `CHANGELOG.md`.
3. Merging the version PR publishes to npm.

Nothing publishes from a feature branch, and nothing publishes without a changeset. The workflow is
gated on the protected `npm-publish` environment and an `NPM_TOKEN`, so it is currently inert — see
"Not yet configured" below.

Locally:

```bash
bun run changeset     # record the change
bun run version       # consume changesets, bump, write the changelog
bun run release       # build then publish (CI does this)
```

## Pre-1.0

The package is at `0.x`, which under semver means the API is not yet frozen. In practice this
repository already treats icon names as stable — nothing released has been renamed or removed — but
the `0.` prefix is honest: the API has not been proved against a real consumer yet.

**`1.0.0` should follow the first product migration**, not precede it. Until `@qeetrix/ui` actually
depends on this package, "stable" is a claim rather than an observation.

## Deprecation

An icon component is public API, so it is **never deleted in a minor release**. When an icon should
stop being used, it gets marked instead. It keeps working, keeps exporting, and disappears from
anywhere that offers choices.

### Marking one

Add a `deprecated` block in `icon-metadata.json`:

```json
"old-name": {
  "tags": ["legacy"],
  "aliases": [],
  "mirror": false,
  "priority": "P2",
  "deprecated": {
    "since": "0.2.0",
    "replacement": "new-name",
    "reason": "Renamed for consistency with the rest of the family."
  }
}
```

Then `bun run generate && bun run catalog`. Validation enforces the shape: `since` must be semver,
`reason` must be non-empty, and `replacement` must name a real icon or be `null`.

### What it does

| | |
|:--|:--|
| **The component** | Keeps working and keeps exporting. Nothing breaks. |
| **`@qeetrix/icons/metadata`** | Gains `deprecated` on that record. Absent on every supported icon, so `if (icon.deprecated)` is the whole check. |
| **The explorer** | Shows a badge on the cell and a banner in the detail view naming the replacement. |
| **The coverage matrix** | Lists it as deprecated. |

A picker should filter them out:

```ts
import { icons } from "@qeetrix/icons/metadata";

const offerable = icons.filter((icon) => !icon.deprecated);
```

### Choosing the right response

Deprecation is one tool among several, and it is usually not the right one.

| Situation | Do this | Not this |
|:--|:--|:--|
| The name is poor but the icon is right | Add an **alias** | Rename it |
| Two icons mean the same thing | Keep one, make the other's name an **alias** of it, deprecate the duplicate | Delete either |
| The glyph is wrong | **Redraw** it under the same name (patch) | New icon with a new name |
| The concept no longer exists | **Deprecate** with `replacement: null` and a reason | Remove it |
| A better icon supersedes it | **Deprecate** pointing at the replacement | Silently change the old one's artwork |

### Removal

A deprecated icon may be removed **only** in a major release, and only after it has shipped as
deprecated in at least one release. The removal needs its own changeset naming every removed icon and
its replacement, so a consumer reading the changelog can plan the upgrade.

There is deliberately no automation for removal. At this catalogue size the cost of keeping a
deprecated icon is a few hundred bytes that tree-shaking already discards for anyone not importing
it — and the cost of removing one is a broken build. The asymmetry says keep it.

## Not yet configured

`release.yml` cannot publish until two things exist outside this repository:

- a protected GitHub environment named `npm-publish`
- an `NPM_TOKEN` secret with publish rights to the `@qeetrix` scope

Until then the workflow runs, opens version PRs, and stops short of publishing. That is deliberate —
an accidental first publish is much harder to undo than a delayed one.
