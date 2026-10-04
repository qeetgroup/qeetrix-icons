# RTL directionality contract

Directionality belongs to an icon's meaning, not its category, a filename substring, or whether
the drawing contains an arrow. The public type in [src/types/icon.ts](../src/types/icon.ts) is
`IconDirectionality = "mirror" | "preserve"`.

The generated manifest records `directionality` for every concept:

- `mirror`: a logical action follows reading direction and may need horizontal mirroring in RTL.
- `preserve`: the drawn orientation carries fixed meaning and remains unchanged in RTL.

Lucide has no directionality data, so this is the one piece of icon metadata this repository
authors. Every concept is `preserve` unless the `mirrored` list in
[config/icon-metadata.ts](../config/icon-metadata.ts) names it. One entry covers the concept's
outline and filled drawings. Directionality is never inferred from a filename, and a listed name
with no source fails validation (`QXI-META-001`), for example after a Lucide rename. The manifest
exposes the value through `@qeetrix/icons/manifest`; there is no direction detection, CSS
mirroring, React direction prop, or runtime mirroring.

## Logical versus physical direction

Back and forward in a reading-order workflow can reverse with direction. Physical left and right,
vertical movement, time, and conventional media symbols normally do not. Select the semantic
concept at the call site rather than mirroring every horizontal arrow.

**Decision.** Mirrored, as semantic reading-direction concepts:

| Concepts | Reason |
|:--|:--|
| `undo`, `undo-2`, `undo-dot`, `redo`, `redo-2`, `redo-dot` | History steps follow reading order |
| `reply`, `reply-all`, `message-square-reply` | Conversation direction |
| `forward` | Forwarding a message, not media fast-forward |
| `send`, `send-horizontal` | Sending moves toward the reading end |
| `log-in`, `log-out` | Entering and leaving through the reading-start or -end side |
| `list-indent-increase`, `list-indent-decrease` | Indentation is text-relative |
| `text-align-start`, `text-align-end` | Start and end alignment follow reading direction |

Everything else is `preserve`, including the physical directions: `arrow-left`, `arrow-right`, and
the other plain arrows, `chevron-*`, `corner-*`, `panel-left-*` and `panel-right-*`, `rotate-ccw`
and `rotate-cw`, and media transport such as `fast-forward` and `skip-forward`.

Lucide has no semantic back or forward arrow. Where a product uses `arrow-left` or `chevron-left`
to mean "back", it is using a physical icon for a logical action, and mirroring it in RTL is that
product's decision, made at the call site. A media fast-forward symbol does not inherit the
mirroring policy of message forwarding.

## Preserve normal orientation

`download`, `upload`, `clock`, `calendar`, `search`, `check`, `play`, `database`, and `lock`
preserve their drawn orientation. Do not reverse clock movement, flip a check simply because it is
asymmetric, or reverse a familiar play symbol with text direction. Logos, embedded text, and other
fixed-world marks also stay as drawn.

Start with preservation unless there is a clear reading-direction reason to mirror. Review both
members of a directional family together, and check new icons after each Lucide upgrade
([lucide.md](lucide.md#upgrading-lucide)); do not infer policy from category membership or a regular
expression.

## Consumer behavior and review

A consumer layer should resolve effective UI direction, including locally overridden direction,
rather than guessing solely from language or locale. Apply any required mirroring once, to the
icon, not to its containing text or entire control. Keep the source SVG unchanged. Accessible names
must continue to describe the action in context, not its current arrow orientation.

Visual QA compares logical navigation, conversations, indentation, and alignment in LTR and RTL,
and verifies that `preserve` icons remain unchanged. Check compound marks, optical balance, and
alignment after mirroring. The playground shows LTR beside an **RTL QA preview** driven only by
manifest directionality; its mirroring is a CSS preview, not package behavior. See
[visual-qa.md](visual-qa.md#rtl). How a runtime would pass or detect direction and apply transforms
is not decided.
