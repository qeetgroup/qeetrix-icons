# RTL directionality contract

Directionality belongs to an icon's meaning, not its category, a filename substring, or whether
the drawing contains an arrow. The foundational public type in
[src/types/icon.ts](../src/types/icon.ts) is `IconDirectionality = "mirror" | "preserve"`.

Future manifest metadata should record `directionality` explicitly for each concept:

- `mirror`: a logical action follows reading direction and may need horizontal mirroring in RTL.
- `preserve`: the authored orientation carries fixed meaning and remains unchanged in RTL.

Phase 2A defines that vocabulary only. There is no manifest, direction detection, CSS mirroring,
React direction prop, or runtime implementation yet.

## Logical versus physical direction

Back and forward in a reading-order workflow can reverse with direction. Physical left and right,
vertical movement, time, and conventional media symbols normally do not. Do not treat a fixed
`arrow-left` as a synonym for logical `arrow-back`; select the correct semantic concept at the
call site rather than mirroring every horizontal arrow.

| Concept that may mirror | Reason to review |
|:--|:--|
| `arrow-back`, `arrow-forward` | Logical navigation through a reading-order sequence |
| `reply`, `forward` | Conversation direction; `forward` here means forwarding a message |
| `indent`, `outdent` | Text-relative indentation follows reading direction |
| `panel-open`, `panel-close` | A panel attached to logical start/end can move sides |

These are semantic review examples, not blanket rules for all drawings with those names. A panel
attached to a fixed physical edge may need a preserve-oriented concept instead. A media
fast-forward symbol does not inherit the mirroring policy of message forwarding.

## Preserve normal orientation

`download`, `upload`, `clock`, `calendar`, `search`, `check`, `play`, `database`, and `lock` normally
preserve their authored orientation. Do not reverse clock movement, flip a check simply because
it is asymmetric, or reverse a familiar play symbol with text direction. Logos, embedded text,
and other fixed-world marks also need explicit preservation rather than automatic mirroring.

Start with preservation unless there is a clear reading-direction reason to mirror. Review both
members of a directional family together and assign policy deliberately; do not infer it from
category membership or a regular expression.

## Future consumer behavior and review

The eventual consumer layer should resolve effective UI direction, including locally overridden
direction, rather than guessing solely from language or locale. Apply any required mirroring
once to the icon, not to its containing text or entire control. Keep the canonical SVG master
unchanged. Accessible names must continue to describe the action in context, not merely its
current arrow orientation.

Later visual QA must compare logical navigation, conversations, indentation, and panels in LTR
and RTL, while verifying that preserve-oriented icons remain unchanged. Check compound marks,
optical balance, and alignment after mirroring. How direction is passed or detected and how
transforms are applied remain implementation decisions for later phases.
