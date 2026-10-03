# RTL directionality contract

Directionality belongs to an icon's meaning, not its category, a filename substring, or whether
the drawing contains an arrow. The foundational public type in
[src/types/icon.ts](../src/types/icon.ts) is `IconDirectionality = "mirror" | "preserve"`.

The generated manifest records `directionality` for every drawing:

- `mirror`: a logical action follows reading direction and may need horizontal mirroring in RTL.
- `preserve`: the authored orientation carries fixed meaning and remains unchanged in RTL.

Every concept is `preserve` unless [config/icon-metadata.ts](../config/icon-metadata.ts) lists it,
for example `"arrow-back": { directionality: "mirror" }`. One entry covers the concept's outline
and filled drawings. Directionality is never inferred from a filename, and an entry for a name with
no source fails validation. The manifest exposes the value through `@qeetrix/icons/manifest`; there
is still no direction detection, CSS mirroring, React direction prop, or runtime mirroring.

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

Visual QA must compare logical navigation, conversations, indentation, and panels in LTR and RTL,
while verifying that preserve-oriented icons remain unchanged. Check compound marks, optical
balance, and alignment after mirroring. The playground shows LTR beside an **RTL QA preview**
driven only by manifest directionality; its mirroring is a CSS preview and is not package
behavior. See [visual-qa.md](visual-qa.md#rtl). How the runtime passes or detects direction and
applies transforms remains an implementation decision for a later phase.
