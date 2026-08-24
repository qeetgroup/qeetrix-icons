# Visual check

Renders every icon in a real browser, from `../src` — the working tree, not `dist/`
and not the published package. This is the check to run before pushing.

```bash
cd example
bun install
bun run dev
```

Then open the URL it prints (usually <http://localhost:5173>).

## Why this exists

Unit tests prove the components hold the source SVG byte for byte, that the
`variant` prop switches style, and that `<clipPath>` masks are never recoloured.
What they **cannot** prove is what a browser paints: jsdom does not resolve SVG
presentation attributes, so `color="white"` computes as black there. That is a
jsdom gap, not a bug — but it means the default colour needs a real engine to
confirm.

## What to look for

The icons ship **white** by default, matching the source artwork.

| Background | Expected |
|:--|:--|
| **dark** | Every glyph crisp and legible. This is the main check. |
| **light** | Glyphs invisible. **This is correct**, not a bug — white on white. |
| **checkerboard** | Glyphs visible against the grey squares, confirming the artwork is really there. |

Then confirm theming works:

- Type `black` or `#b45309` into **Colour override** — every icon should retint.
- Switch **Variant** to `solid`, then `both`, and check the two styles differ.
- Tick **Only single-style icons** to review the ones shipping just one style.
  Cells are annotated `· no solid` / `· outline only` so gaps are obvious.

Click any cell to copy its import.

## Feedback loop

The example resolves `@qeetrix/icons` to `../src/index.ts`, and derives the
catalogue from the filesystem with `import.meta.glob` — the component list from
`src/icons/`, and which variants exist from the `icons/` SVG tree. There is no
metadata file to keep in sync.

So after changing an SVG:

```bash
cd .. && bun run generate      # regenerate components
```

The dev server picks it up on save; just refresh.

## Not part of the package

`example/` is excluded from the published tarball (`files: ["dist"]`), from the
root `tsconfig.json` (`include: ["src", "tests", …]`), from `tsconfig.build.json`,
and from `vitest` (`include: ["tests/**"]`). It has its own `package.json` and
`node_modules`, so nothing here can affect what consumers install.
