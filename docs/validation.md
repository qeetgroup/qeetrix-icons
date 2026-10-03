# SVG and source validation

Phase 2B implements the gate between human-authored SVG and later generation. It validates source
organization, names, XML, a deliberately small SVG vocabulary, and repository-wide identity.
It does not draw, normalize, optimize, generate, or rewrite anything. Production artwork is still
empty, and the public package still exports only the Phase 2A foundational types.

## Run the gate

```bash
bun run check:icons
```

The command scans this repository's `icons/` directory, anchored to the script location rather
than the caller's working directory. There is no alternate-root CLI flag. An empty source root
is valid and prints `0 production icons validated.` with exit status 0. Any diagnostic is an
error, printed to stderr with exit status 1. The count is SVG source files, not unique concepts;
an outline/filled pair counts as two files.

CI and the existing release quality gates run this command alongside lint, typecheck, Vitest, and
build. Publishing triggers, versioning, and release channels are unchanged. The standalone build
still compiles public TypeScript only; it does not run a generation pipeline or replace this gate.

## Source organization and identity

The future file contract is `icons/<variant>/<category>/<name>.svg`:

- Variants come from [config/icon-system.ts](../config/icon-system.ts): `outline` and `filled`.
- Categories come only from [config/categories.ts](../config/categories.ts). They are not public
  component namespaces. The validator does not maintain a second category list.
- Filenames follow [naming.md](naming.md): lowercase ASCII kebab-case, beginning with a letter,
  with a lowercase `.svg` extension. No whitespace, underscores, or redundant `-icon` suffix.
- Draft suffixes `-alt`, `-new`, `-copy`, `-final`, and trailing integer suffixes such as `-2` fail.
  A semantic base name such as `copy` is allowed. Internal semantic numerals such as
  `layout-2-columns`, `file-3d`, and `protocol-v2` are allowed. A genuinely semantic trailing
  integer will need a deliberate future naming-policy decision, not an automatic exception now.
- Windows device filenames (`con`, `prn`, `aux`, `nul`, `com1`-`com9`, `lpt1`-`lpt9`) fail so source
  names remain portable. The initial letter requirement also ensures a valid eventual JavaScript
  identifier when converted to PascalCase plus `Icon`.
- Within a variant, canonical names are unique across the whole catalogue, not per category.
  Case-insensitive filename collisions and distinct names that become the same PascalCase-plus-
  `Icon` identifier also fail. For example, `file-3d` and `file3d` both become `File3dIcon`.
- Outline and filled counterparts are optional. When the same name exists in both, its category
  must agree. Both represent one semantic concept; no component-generation or filled-export API
  is chosen here. Differently named drawings cannot be automatically identified as synonyms.

Path functions accept repository-relative forward-slash paths; the scanner builds these paths
independently of host separators. Collision checks operate on strings, not filesystem casing
behavior. Tests therefore cover conflicts even on filesystems that cannot store both spellings.

No variant/category directories are required or created while there is no artwork. The file
contract rejects root-level sources, legacy layouts, unknown variants/categories, and nested
sources outside the defined depth. It does not validate or require empty folder hierarchies.

## Structurally enforced now

### XML and root

- Parse as XML, never HTML. Every parser warning, error, or fatal error rejects the input; malformed
  XML is not silently repaired. Documents need one unprefixed `<svg>` root with the explicit SVG
  namespace `xmlns="http://www.w3.org/2000/svg"`.
- The root `viewBox` must numerically match the configured canonical viewBox. Equivalent numeric
  spelling, comma separators, and whitespace are accepted without rewriting the source.
- Root `width` and `height` are forbidden: future consumers control rendered dimensions. Geometry
  such as a `<rect>` may and usually must specify its own width and height.
- Comments, whitespace, and an optional well-formed XML declaration are accepted. DTDs, custom
  entities, other processing instructions, CDATA, and non-whitespace text are unsupported.
- Source files must be valid UTF-8. A 1 MiB (1,048,576-byte) per-file parsing limit bounds tooling
  input, not drawing detail or visual complexity. Oversized files are rejected before reading
  them into the parser; the pure SVG function also enforces the byte limit.

### Elements and attributes

Only `svg`, `g`, `path`, `circle`, `ellipse`, `rect`, `line`, `polyline`, and `polygon` are supported.
`svg` may only be the root. Geometry must be inside that root or a `g`; primitives are not containers.

All allowed elements may carry `fill`, `stroke`, `stroke-width`, `stroke-linecap`,
`stroke-linejoin`, and `fill-rule`. A `g` carries only those presentation attributes. Additional
attributes are allowed by element, not globally:

| Element | Additional attributes |
|:--|:--|
| `svg` | `viewBox`, `xmlns` |
| `path` | `d` |
| `circle` | `cx`, `cy`, `r` |
| `ellipse` | `cx`, `cy`, `rx`, `ry` |
| `rect` | `x`, `y`, `width`, `height`, `rx`, `ry` |
| `line` | `x1`, `y1`, `x2`, `y2` |
| `polyline`, `polygon` | `points` |

Everything outside these allowlists fails. In particular:

- No scripts, styles, `foreignObject`, embedded HTML, images/raster data, media, animation, or `set`.
- No `defs`, clipping, masks, filters, gradients, patterns, symbols, `use`, or nested SVGs. There is
  no exception mechanism or ID-rewriting scheme.
- No IDs, transforms, links/references (including local fragments, `href`, and `xlink:href`),
  event handlers, arbitrary namespaces, CSS classes, inline styles, or `color` overrides.
- No `role`, `aria-*`, `tabindex`, `focusable`, `title`, or `desc`. Source represents geometry;
  meaningful accessible names, roles, decorative defaults, and focus belong to the future runtime
  and containing UI, as described in [accessibility.md](accessibility.md).

The parser does not fetch resources or expand custom entities. Allowlists additionally prevent
script execution, external content, CSS injection, global-ID collisions, and runtime semantics
from being carried into future generated components. This is a rejecting source gate, not a
general-purpose SVG sanitizer or a service for arbitrary uploaded documents.

### Paint and variants

Every `fill` and `stroke` value must be configured `currentColor` or structural `none`. Hex colors,
named colors, color functions, URLs, `inherit`, and CSS variables are rejected, including in
descendant elements and after XML entity decoding.

Outline roots explicitly declare `fill="none"`, `stroke="currentColor"`, and the configured
stroke width, cap, and join. Explicit descendant overrides must agree; otherwise those properties
inherit from the root. The current width is 1.75 and the cap/join are `round`, read directly from
the shared config. **CALIBRATION REQUIRED:** enforcing today's candidate ensures consistency; it
does not freeze it. Changing that config changes validation without another validator constant.

Filled roots declare `fill="currentColor"`. Descendants may use `currentColor` or `none`; any
optional stroke remains subject to the same color and numeric rules. No pair is required, and no
filled-specific stroke weight, corner system, occupancy, or outline-to-fill conversion is invented.
Their visual relationship remains a later calibration decision. `fill-rule` accepts `nonzero` or
`evenodd`; explicit cap/join values must be supported SVG values.

### Numeric quality, not a geometry engine

Numeric attributes must be finite unitless SVG numbers. Signs, fractions, and exponents are
accepted; NaN, Infinity, overflow, units, hexadecimal numbers, and malformed coordinates fail.
Radii, dimensions, and stroke width must be positive where they define visible geometry; rectangle
corner radii may be zero. Required primitive data must exist, and there must be at least one
supported primitive. Point lists must contain enough finite coordinate pairs.

Path checking is intentionally lexical: nonempty data, an initial moveto pair, known commands,
finite numeric tokens, and numbers following commands that need parameters. It is **not** a full
path parser: complete command arity, separator grammar, arc flags, path drawability, and geometry
are not proved. A structurally accepted path can still need correction in later geometric/visual
QA. There is no decimal-precision rule, bounds engine, path rewriting, or stroke expansion.

## Diagnostics

Each diagnostic has `code`, repository-relative `file`, `message`, and severity `error`. Results
are sorted by file, code, and message using explicit lexical comparison, never machine locale or
directory enumeration order. Filenames and embedded input values are escaped for terminal output.
XML failure stops that file's structural checks rather than interpreting a recovered document.

```text
QXI-SVG-006 "icons/outline/actions/example.svg"
  Paint "#000" is not allowed; use currentColor or none.
```

| Rule | Purpose | Severity |
|:--|:--|:--|
| `QXI-XML-001` | Malformed XML/parser warning or input-size limit | Error |
| `QXI-XML-002` | Unsupported non-geometric XML content | Error |
| `QXI-SVG-001` | Root element and SVG namespace | Error |
| `QXI-SVG-002` | Canonical viewBox | Error |
| `QXI-SVG-003` | Root rendering dimensions | Error |
| `QXI-SVG-004` | Element allowlist, namespace, and hierarchy | Error |
| `QXI-SVG-005` | Context-aware attribute allowlist | Error |
| `QXI-SVG-006` | Inherited-color paint contract | Error |
| `QXI-SVG-007` | Variant presentation and enumerated values | Error |
| `QXI-SVG-008` | Primitive data, numbers, points, and path tokens | Error |
| `QXI-NAME-001` | Canonical, portable filenames | Error |
| `QXI-PATH-001` | Source-root layout and path depth | Error |
| `QXI-PATH-002` | Configured category | Error |
| `QXI-PATH-003` | Configured variant | Error |
| `QXI-DUP-001` | Duplicate canonical name within a variant | Error |
| `QXI-DUP-002` | Case-insensitive filename collision | Error |
| `QXI-DUP-003` | Normalized component-name collision | Error |
| `QXI-DUP-004` | Cross-variant category disagreement | Error |
| `QXI-IO-001` | Unreadable/invalid UTF-8 input, invalid root, symlink, or unexpected file | Error |

## API and fixture isolation

[validate-source-path.ts](../scripts/check/validate-source-path.ts) exposes `validateIconName` and
`validateSourcePath`. [validate-svg.ts](../scripts/check/validate-svg.ts) exposes `validateSvg`.
[validate-repository.ts](../scripts/check/validate-repository.ts) provides pure `validateSources`
and the filesystem adapter `validateRepository`. The small CLI only anchors the root, formats
diagnostics, and sets the exit status. These are repository-internal APIs, not package exports.

The scanner visits only `icons/`, rejects symlinks without following them, and accepts only SVG
files plus the root `.gitkeep` placeholder. Filesystem or decoding failures are diagnostics, not
silent skips. It does not search `tests/`, `dist/`, or the whole workspace for SVGs.

[tests/validation.test.ts](../tests/validation.test.ts) constructs basic synthetic geometry in
memory. Scanner tests use temporary repository roots and remove them after each test. Those
temporary roots may contain `tests/fixtures/` to prove isolation. There are no checked-in SVG
fixtures, production drawings, copied paths, or generated components. The production empty-source
guard remains in [tests/repository.test.ts](../tests/repository.test.ts).

The build includes only `src/`, and the package publishes only `dist/`. Config, validation code,
the parser dependency, and fixtures do not become consumer runtime exports. Future generation
must consume validated production sources; it must not broaden discovery to test fixtures.

## Parser decision

Reviewed on 2026-10-03: Bun 1.3.14 has no built-in `DOMParser`; an HTML parser would not enforce
XML well-formedness. A hand-written regex XML parser would add fragile security-critical code.
We use the maintained [@xmldom/xmldom](https://github.com/xmldom/xmldom) package, pinned to `0.9.12`
as a development dependency: MIT, bundled TypeScript declarations, zero transitive dependencies,
and [440,251 unpacked bytes](https://registry.npmjs.org/@xmldom/xmldom/0.9.12).

The project's [security policy](https://github.com/xmldom/xmldom/security) documents supported
versions and advisories. This version includes fixes for
[malformed end tags](https://github.com/xmldom/xmldom/security/advisories/GHSA-6h8r-xr42-gp59),
[attribute deduplication](https://github.com/xmldom/xmldom/security/advisories/GHSA-8344-3jmq-59r6),
and [processing-instruction backtracking](https://github.com/xmldom/xmldom/security/advisories/GHSA-g53g-w8rj-fmg7).
We use `onWarningStopParsing`, because the default parser can recover from malformed input.
The smaller `saxes` alternative was considered but its upstream repository was archived in 2025.
No SVGO, optimization, rendering, or generation dependency is added.

## Visually calibrated later

Structural success does not prove optical centering, perceived weight, generous negative space,
semantic recognizability, small-size legibility, curve quality, or appropriate filled emphasis.
Painted bounds and the candidate 2-unit inset are not enforced: path/stroke bounds and optical
overshoot need a dedicated geometric/visual phase. Stroke calibration, corner treatment, and
small-size optical corrections remain **CALIBRATION REQUIRED** in
[drawing-guidelines.md](drawing-guidelines.md). No geometry engine or renderer is implemented.
