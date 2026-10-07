# Releases and versioning

What a version number means for an icon library, how a release happens, and how to undo one.

## 2.0 and `main`

> [!WARNING]
> This branch holds the unreleased 2.0: the 1.x catalogue is gone, and the root exports the 1,863
> Lucide-based icons, the Qeet logo and wordmark, and the public types. `package.json` still
> carries a 1.x version. Merged to `main` through the flow below, this could publish the
> incompatible 2.0 work as a **1.x patch release** on `latest`, and consumers on a `^1` range could
> receive it on their next install.
>
> Keep 2.0 off `main` until it is ready to ship, and set `version` to `2.0.0` by hand when it is.
> `release.yml` has no pre-release channel — it always publishes with the default dist-tag — so
> shipping 2.0 pre-releases would first need a change to that workflow.

## How a release happens

Three workflows, and you drive all of it by opening a PR.

| Workflow | Trigger | What it does |
|:--|:--|:--|
| `version.yml` | PR opened or pushed | Bumps the patch version on your branch |
| `release.yml` | Merge to `main` | Publishes to npm, then tags the commit |
| `rollback.yml` | Manual | Points `latest` back at an older version |

### 1. Open a PR

`version.yml` bumps the patch version in `package.json` and commits it to your branch, so **the
version you are about to ship is visible in the PR diff** rather than decided later by a bot.

Want a minor or major instead? Edit `version` in `package.json` yourself. The workflow only acts when
the PR's version still equals `main`'s, so a manual bump is left alone rather than bumped twice.

It skips fork PRs (their token is read-only) and never reacts to its own commit.

### 2. Merge to main

`release.yml` publishes that version and **then** pushes the matching `vX.Y.Z` tag and opens a GitHub
Release. The tag comes last on purpose: every `v*` tag is a version that really shipped, the same
property `qeet-id-server`'s deploy workflow maintains.

Before publishing it runs the full gate: `lint`, `typecheck`, `test`, `check:icons`,
`check:filled`, `check:sharp`, `check:generated`, `check:brands`, `check:logos`, `build`. A merge
that does not change the version publishes nothing and succeeds, so re-running is always safe.

There is no `bun run release`. Releasing is merging.

### 3. If it was a bad release

Run **Actions → Rollback → Run workflow** and give it the version to go back to.

npm will not let a published version be replaced, and unpublishing breaks every lockfile that already
pins it. So a rollback moves the `latest` dist-tag to a known-good version instead:

- anyone installing fresh gets the good version
- anyone who pinned the bad version explicitly keeps working

To go forward again, either release normally or run the rollback with the newer version.

## What each bump means

The hard question for an icon library is not what semver means — it is what counts as a breaking
change when the public API is a list of component names.

| Change | Bump | Why |
|:--|:--|:--|
| New icon, filled drawing, logo, or logo variant | **minor** | Additive. Nothing that compiled stops compiling. |
| Visual change to an existing icon or logo file | **patch** | The name and props are unchanged. |
| **Icon or logo renamed** | **major** | A named export disappeared. Someone's build breaks. |
| **Icon, filled drawing, the sharp shape, logo, or logo variant removed** | **major** | Same. |
| **Prop removed or retyped** | **major** | Same. |

A visual change is only a patch because it changes what renders without changing any API — the
consumer gets a different glyph in the same place with the same props. It is still a real change,
so say what moved and why in the PR: "Lucide 1.53 redrew X; Y's filled and sharp drawings
re-derived" is worth more than a version number.

### Lucide upgrades

Most of what changes between releases comes from Lucide ([lucide.md](lucide.md#upgrading-lucide)).
The sync's summary and the diff show which rows of the table above apply. New Lucide icons are a
minor release and redrawn ones a patch, but a Lucide release that removes or renames an icon is a
major release here: Lucide keeps the old name as an alias, and this package records aliases in the
manifest without exporting them.

### Why renaming is expensive

An icon's component name is its public API. `import { ArrowLeftIcon } from "@qeetrix/icons"` is a
compile-time contract, and renaming it would turn consuming builds red. Removing a filled drawing
breaks `variant="filled"` the same way. [api.md](api.md#versioning) lists which changes are major.

Names are Lucide's, so this package never renames an icon on its own initiative. Upstream renames
are the cost to plan for: batch them into a major release rather than shipping them as they come.

### Logo updates

Logos are edited by hand ([logos.md](logos.md#files)). Added logos and variants are minor;
removed or renamed slugs and variants are major, because their exports or variant names
disappear. A redrawn file under the same name is a patch.

## Publishing setup

`@qeetrix/icons` is already published; registry versions are separate from this branch's
unreleased 2.0.

The following describes the release automation, not local development commands. Its registry
lookup, publication, and rollback steps still use the npm CLI. Reconciling release tooling with
Bun-only development and defining 2.0 release readiness are separate release tasks; do not publish
2.0 to test the flow.

Publishing needs one of these, and `release.yml` checks before trying:

**A token.** An `NPM_TOKEN` secret with publish rights to the `@qeetrix` scope.

**Trusted publishing (OIDC).** Configure a trusted publisher for `@qeetrix/icons` on npmjs.com
pointing at this repository and the `Release` workflow, then set the repository variable
`QEETRIX_NPM_TRUSTED_PUBLISHING` to `true`. It needs **npm ≥ 11.5**, which is why the workflow pins
`node-version: 24` — on Node 20 (npm 10) the OIDC path cannot work even with the registry configured.

**When publishing is not configured the job succeeds with a warning** and writes the missing steps
into the run summary, and **no tag is created**. That is deliberate: a permanently red workflow trains
people to ignore it, and a tag with nothing published behind it is worse than no tag.

A protected `npm-publish` environment is referenced by both `release.yml` and `rollback.yml`. If it
does not exist GitHub creates it unprotected, so add required reviewers there if a human should
approve each publish.
