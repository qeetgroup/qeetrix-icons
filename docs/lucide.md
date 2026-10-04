# Lucide

The outline artwork is [Lucide](https://lucide.dev)'s, verbatim. This repository does not draw
outline icons: it syncs them from one pinned Lucide release, derives the filled variants from them
([filled.md](filled.md)), and generates React components and a manifest
([generation.md](generation.md)). Lucide is not a package dependency; the artwork is copied into
`icons/outline/` by the sync and committed.

## What comes from Lucide

[config/lucide.json](../config/lucide.json) pins the release (`version`, currently `1.52.0`) and
records everything else taken from it:

- `categories`: Lucide's 42 categories, each with its id and label.
- `icons`: for every synced icon, Lucide's `categories` (in Lucide's order), `tags` (search
  keywords), and `aliases` (earlier names, such as `trash-2` for `trash`).

The sync writes 1,863 outline icons, each to `icons/outline/<category>/<name>.svg`, where the
folder is the first category Lucide lists for it. It also generates
[config/categories.ts](../config/categories.ts), the 42 categories in id order, which validation,
generation, and the playground read. [config/icon-metadata.ts](../config/icon-metadata.ts) builds
each icon's manifest metadata from `config/lucide.json`, adding only the RTL policy
([rtl.md](rtl.md)).

Each SVG is rewritten in this repository's source format without changing its geometry: the root
keeps `xmlns`, `viewBox`, and its paint and stroke attributes in a fixed order, and loses `width`
and `height`, which the runtime controls; each geometry element is written on its own line with
its attributes as Lucide wrote them. Element order and every coordinate are unchanged.

Upstream icons marked deprecated are skipped. In 1.52.0 these are `badge-swiss-franc`,
`receipt-swiss-franc`, and `swiss-franc`.

Never edit `icons/outline/`, `config/lucide.json`, or `config/categories.ts` by hand: the next sync
rewrites them. A problem in an outline belongs upstream, in Lucide. What this repository owns is
the filled list ([config/filled.ts](../config/filled.ts)), the RTL list in
[config/icon-metadata.ts](../config/icon-metadata.ts), and the design values in
[config/icon-system.ts](../config/icon-system.ts), which restate Lucide's ([design.md](design.md)).

## Sync

```bash
bun run sync:lucide            # re-sync the pinned version
bun run sync:lucide 1.53.0     # move to another release
```

[sync-lucide.ts](../scripts/sync/sync-lucide.ts), with the helpers in
[scripts/lib/lucide.ts](../scripts/lib/lucide.ts):

1. Downloads the tag's tarball from GitHub
   (`codeload.github.com/lucide-icons/lucide/tar.gz/refs/tags/<version>`). The version must be
   `x.y.z`; the command needs network access.
2. Reads `icons/<name>.svg` and `icons/<name>.json` for every icon and `categories/<id>.json` for
   every category. It skips deprecated icons, and fails on an icon with no category, an unknown
   category, or nested SVG elements.
3. Deletes `icons/outline/` and writes every icon into its first category's folder.
4. Rewrites `config/lucide.json` and `config/categories.ts`, formatted with Biome.
5. Prints how many icons and categories it synced, how many were added and removed since the
   previous version, the skipped deprecated icons, and the removed names.
6. Runs `bun run derive:filled`, then `bun run generate`.

Re-syncing the pinned version should change nothing. If a step fails, the later steps do not run;
fix the cause and run the remaining commands yourself.

## Upgrading Lucide

1. Run `bun run sync:lucide <new version>`.
2. If `derive:filled` failed, fix [config/filled.ts](../config/filled.ts): remove or rename entries
   for icons Lucide removed or renamed, and fix recipes whose role indices no longer exist. If
   `generate` failed with `QXI-META-001`, a name in the RTL list of
   [config/icon-metadata.ts](../config/icon-metadata.ts) no longer exists; update it. Then run
   `bun run derive:filled` and `bun run generate`.
3. Review the diff:
   - `icons/outline/`: added, removed, redrawn, and moved icons. A move means Lucide changed the
     icon's first category.
   - `config/lucide.json`: categories, tags, and aliases. A renamed icon appears as a removal and an
     addition, with the old name in the new icon's `aliases`.
   - `icons/filled/`: every filled drawing that changed, and every one that failed. Review each
     changed one in the playground beside its outline, as for a new one
     ([filled.md](filled.md#adding-a-filled-drawing)).
4. Re-check the `roles` overrides in `config/filled.ts` for every icon whose outline changed. Roles
   are keyed by element index, so a redrawn outline can shift indices and an override then applies
   to the wrong element, sometimes without failing.
5. Check whether new Lucide icons belong in the RTL list ([rtl.md](rtl.md)) or the filled list.
6. Run `bun run check:icons`, `bun run check:filled`, `bun run check:generated`,
   `bun run typecheck`, `bun run lint`, and `bun run test`.
7. Compare Lucide's `LICENSE` at the new tag with the third-party section of
   [LICENSE](../LICENSE), and update the release number and text there if they changed.
8. Decide the release type. A removed or renamed icon removes an export, so it is a major release.
   New icons are minor; redrawn icons are patch; category, tag, and alias changes are not breaking
   ([api.md](api.md#versioning)).

## Renamed icons

Lucide 1.x renamed some icons; `trash-2` is now `trash`. Former names are kept as `aliases` in
`config/lucide.json` and in the manifest, so search and migration tooling can find an icon by its
old name. They are not exported: there is no `Trash2Icon` and no `@qeetrix/icons/icons/trash-2`. See
[naming.md](naming.md).

## Licensing

Lucide is licensed under the ISC License, © Lucide Icons and Contributors. Some Lucide icons are
derived from [Feather](https://feathericons.com) and are also under the MIT License, © Cole Bemis;
Lucide's license file lists them. [LICENSE](../LICENSE) contains this package's MIT License for its
own code, followed by Lucide's license verbatim, including the Feather list and Feather's license.

The Lucide terms apply to the outline SVGs in `icons/outline/`, the filled drawings derived from
them in `icons/filled/`, and the components generated from both, in `src/generated/` and the
published `dist/`. `package.json` therefore declares `"license": "MIT AND ISC"`. `LICENSE` must
stay at the repository root: npm packs it with the package whatever `files` lists, which is how the
notice reaches consumers.
