# Qeetrix Icons

The Qeet Group icon library, published as `@qeetrix/icons`.

> [!IMPORTANT]
> **`@qeetrix/icons` is undergoing a major redesign as Qeetrix Icons 2.0.**
>
> - The legacy 1.x icon artwork has been removed from this repository.
> - New, original Qeetrix-designed icons will be introduced incrementally.
> - Consumers should not rely on the 1.x catalogue — its icon names, props, types or import paths —
>   for the upcoming major release.

## Current state

The repository is a clean baseline for 2.0 and contains no icons:

- The `@qeetrix/icons` entry point exports nothing.
- The 1.x deep-import subpath, `@qeetrix/icons/icons/*`, has been removed.
- `icons/` is reserved for 2.0 source artwork and is currently empty.

The 2.0 source format, naming, categories, generation pipeline and component API have not been
defined yet. They will be documented here as they land.

Versions already published to npm are not affected by this reset.

## Develop

Bun only — never npm, pnpm or yarn.

```bash
bun install
bun run typecheck   # tsc, strict
bun run lint        # Biome: lint and format check
bun run format      # Biome, applying fixes
bun run test        # Vitest
bun run build       # dist/
```

See [docs/contributing.md](./docs/contributing.md) for conventions and CI.

## Releases

Merging to `main` publishes the version in `package.json`. Read
[docs/releases.md](./docs/releases.md) before this reset goes anywhere near `main`: as things stand, it
would ship as a 1.x patch release.

## License

MIT © Qeet Group. See [LICENSE](./LICENSE).

```
qeetrix-icons
├─ .npmrc
├─ CHANGELOG.md
├─ LICENSE
├─ README.md
├─ biome.json
├─ bun.lock
├─ docs
│  ├─ README.md
│  ├─ contributing.md
│  └─ releases.md
├─ icons
├─ package.json
├─ src
│  └─ index.ts
├─ tests
│  └─ repository.test.ts
├─ tsconfig.build.json
├─ tsconfig.json
└─ vitest.config.ts

```