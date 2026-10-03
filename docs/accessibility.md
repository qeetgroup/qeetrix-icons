# Accessibility contract

This is the contract for generated React icon components. The defaults are recorded in
[config/icon-system.ts](../config/icon-system.ts). Since Phase 2C it is implemented by the shared
runtime helper [resolveIconProps](../src/runtime/resolve-icon-props.ts) and tested in
[tests/runtime.test.ts](../tests/runtime.test.ts); see [generation.md](generation.md#accessibility).
`IconProps` is a public type, the Phase 3A calibration icons use this runtime, and there are no
generated titles. Every drawing selected by `variant` gets identical accessibility handling.

## Decorative by default

Most UI icons reinforce an adjacent label or the meaning of a containing control. Future components
should default to `aria-hidden="true"` and `focusable="false"`, without introducing an unnecessary
graphic role or accessible name. Decorative SVG content must not add screen-reader noise.

| Use | Accessible name belongs to | Icon behavior |
|:--|:--|:--|
| Icon beside a text label | The visible text or containing control | Decorative and hidden |
| Icon-only button | The Button/IconButton component | Decorative inside the named button |
| Icon-only link | The link | Decorative inside the named link |
| Standalone meaningful graphic | The icon itself | Explicitly named and exposed as a graphic |
| Status icon beside status text | The status text | Usually decorative; do not repeat the same announcement |

## Name the interactive owner

An icon-only Button or IconButton must have an accessible name, normally through its own
`aria-label` or `aria-labelledby`. The name describes the action, such as "Search" or "Close
dialog", not the appearance of the glyph. Do not rely on the SVG filename, component name, or a
hover-only tooltip to name the control.

The button or link owns keyboard focus, activation, disabled state, and interaction semantics.
The SVG inside it should generally remain hidden and unfocusable. Icons themselves should not
receive a `tabIndex` or act as a substitute for a semantic interactive element.

## Meaningful standalone icons

Future components must support standard ARIA attributes, particularly `aria-label` and
`aria-labelledby`. The intended behavior is:

- A nonempty accessible label or a valid labelled-by reference requests meaningful use. The
  component must not then apply its decorative `aria-hidden="true"` default; the intended role is
  `img`, with `focusable="false"` retained.
- Explicit caller-provided `aria-hidden="true"` still requests hiding. Do not combine it with a
  label when the goal is to expose a meaningful icon.
- Setting `aria-hidden="false"` alone is not a name. An exposed meaningful icon still needs a
  useful accessible name. `aria-describedby` adds description, not a replacement name.
- The caller owns meaningful label text, localization, and valid, unique referenced IDs. A
  generic automatically generated name such as "shield check icon" is not sufficient context.

The runtime treats an `undefined` prop as not provided, so a wrapper forwarding an unset
`aria-hidden` keeps the decorative default. Labelled-by references are not resolved at runtime,
because icons do not query the DOM; any non-empty value counts. There is no title-ID scheme.
Human-authored source art must not introduce a fixed accessible label that would be wrong for other
uses or languages.

## Status and color

`currentColor` inherits the surrounding UI color; it does not guarantee contrast or communicate
meaning by itself. A status must not depend on color alone. Pair a recognizable symbol with text
or another accessible description, and give meaningful graphics sufficient contrast against their
background. The surrounding component owns live announcements, loading feedback, and state changes;
an icon must not create an unsolicited live region.

## Later verification

Phase 2C tests cover unnamed decorative icons, named standalone graphics, blank labels, and
explicit ARIA overrides at the component level. When real icons exist, also test valid labelled-by
references and icons inside named buttons and links. Confirm that keyboard focus stays on the
control, labels are not announced twice, and status information survives without color. These are
future quality gates, not capabilities claimed by this phase.
