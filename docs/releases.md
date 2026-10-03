# Releases and versioning

What a version number means for an icon library, how a release happens, and how to undo one.

## The 2.0 foundations and `main`

> [!WARNING]
> The repository is in Qeetrix Icons 2.0 foundational development: the 1.x catalogue is gone and
> the root exports only `IconVariant` and `IconDirectionality` types, with no runtime values or
> icons. `package.json` still carries a 1.x version. Merged to `main` through the flow below, this
> could publish the foundation-only package as a **1.x patch release** on `latest`, and consumers
> on a `^1` range could receive an incompatible package on their next install.
>
> Keep the reset off `main` until 2.0 is ready to ship, and set `version` to `2.0.0` by hand when it
> is. `release.yml` has no pre-release channel — it always publishes with the default dist-tag — so
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

Before publishing it runs the full gate: `lint`, `typecheck`, `test`, `check:icons`, `build`. A
merge that does not change the version publishes nothing and succeeds, so re-running is always safe.

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
| New icon | **minor** | Additive. Nothing that compiled stops compiling. |
| Visual correction to an existing icon | **patch** | The name and props are unchanged. |
| **Icon renamed** | **major** | A named export disappeared. Someone's build breaks. |
| **Icon removed** | **major** | Same. |
| **Prop removed or retyped** | **major** | Same. |

A visual correction is only a patch because it changes what renders without changing any API — the
consumer gets a better glyph in the same place with the same props. It is still a real change, so say
what moved and why in the PR: "redrew X; the old glyph read as Y at 16px" is worth more than a version
number.

### Why renaming is expensive

An icon's component name is its public API. The future
`import { ArrowLeftIcon } from "@qeetrix/icons"` will be a compile-time contract, and renaming it
would turn consuming builds red. No such component exists in Phase 2B.

**Do not rename an icon because a better name occurred to you.** Renaming is a major release, so get
the name right when the icon lands. Removing an icon carries the same cost.

## Publishing setup

`@qeetrix/icons` is already published; registry versions are separate from this branch's
foundation-only implementation.

The following describes pre-existing release automation, not local development commands. Its
registry lookup, publication, and rollback steps still use the npm CLI. Phase 2B adds only the
source-validation quality gate; it does not run publishing or change its behavior. Reconciling
release tooling with Bun-only development and defining 2.0 release readiness are separate release
tasks; do not publish these foundations to test the flow.

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
