# The Qeetrix icon design system

Two icons can both be 24 × 24 with a 2px round-capped stroke and still look like they came from
different libraries. The technical spec in [icon-guidelines.md](icon-guidelines.md) is what the
validator enforces; **this** document is the visual language that makes the set cohere — the shared
measurements and motifs every Qeetrix icon is built from.

When drawing a new icon, the question is never "is this valid?" (the validator answers that). It is
"does this belong to the same family as its neighbours?" These are the rules that make the answer yes.

---

## 1. The grid

```text
0 ────────────────────────── 24
│  ┌────────────────────┐    2   bleed edge  — full-width strokes only
│  │  ┌──────────────┐  │    3   live area   — where glyphs live
│  │  │              │  │
│  │  │      12      │  │   12   optical centre
│  │  │              │  │
│  │  └──────────────┘  │   21   live area
│  └────────────────────┘   22   bleed edge
24
```

| Band | Range | Use |
|:--|:--|:--|
| **Live area** | `3 → 21` (18 × 18) | Almost everything. Containers, glyph bodies, silhouettes. |
| **Bleed** | `2 → 22` (20 × 20) | Only single strokes that must span the full width: `menu`, `minus`, `arrow-left`. |
| **Never** | `< 2` or `> 22` | A 2px stroke centred at 2 already reaches the canvas edge. Past that it clips. |

A 2px stroke is centred on its path, so a centreline at `3` occupies `2 → 4`. Every number in this
document is a **centreline**, not an edge.

---

## 2. Stroke and density

One stroke weight: **2**. There is no light or bold family.

The consequence that actually governs drawing: **two parallel strokes need ≥ 3 units between
centrelines.** At 2 units they leave a 0-unit gap and merge into a single thick bar at 16px. At 3
they leave 1 unit of daylight, which survives.

```text
✗  y=12, y=14   →  strokes occupy 11–13 and 13–15. Touching.
✓  y=12, y=15   →  strokes occupy 11–13 and 14–16. 1 unit of light.
✓  y=6, y=12, y=18  →  the `menu` rhythm. 6 units apart, unmistakable at 16px.
```

Three parallel strokes is the practical maximum inside the live area. Four (`list` with four rows)
crowds; use three and let it read as "a list".

**Stroke count budget.** An icon should read at 16px, which caps complexity:

| Complexity | Strokes / subpaths | Example |
|:--|:--|:--|
| Simple | 1–2 | `minus`, `check`, `arrow-left` |
| Typical | 2–4 | `user`, `lock`, `mail` |
| Complex | 5–6 | `settings`, `sliders` |
| **Too complex** | 7+ | Redraw it. Something must go. |

---

## 3. Optical centring

Centre by **visual mass**, not bounding box.

- **Symmetric glyphs** (`plus`, `x`, `circle`) sit on the geometric centre, `12, 12`.
- **Asymmetric glyphs** get nudged. A triangle centred by its box looks left-heavy because its mass
  is in the left edge; shift it right by ~0.5.
- **Glyphs with a tail or handle** (`search`, `paperclip`) balance the whole silhouette, not the body.
  `search` puts its circle at `10, 10` — not `12, 12` — precisely so the handle at `15 15 → 21 21`
  does not drag the whole icon down-right.
- **Bodies with an appendage above** (`user`, `calendar`, `file`) push the body down. `user`'s head is
  at `cy=8`, its shoulders start at `13`; the body is low so the head has room.

---

## 4. Corners and curves

| Shape | Radius | Why |
|:--|:--|:--|
| Large container (`rect` ≥ 12 wide) | `rx="2"` | Matches the family's soft-but-not-round feel. |
| Small container (`rect` < 12 wide) | `rx="1"` | 2 on a small rect eats the whole side. |
| Arc joins inside a path | `a2 2 0 0 1` | The `2`-unit arc is the house corner. |
| Deliberately sharp | none | Only where sharpness is the meaning: `alert-triangle`. |

**One radius per icon.** Mixing `rx="1"` and `rx="2"` in one glyph reads as a mistake.

Circles use a small set of radii so they look related across the set:

| Radius | Use |
|:--|:--|
| `r="9"` | Full-bleed badge ring — `check-circle`, `alert-circle`, `user-circle`. **Always 9.** |
| `r="7"` | Contained circle with room around it — `search`'s lens. |
| `r="4"` | A head — `user`, `user-check`. |
| `r="3.5"` | A hub — `settings`. |
| `r="1"` | A dot — `more-horizontal`, `circle-dot`. |

The `r="9"` rule matters more than it looks. Nine badge icons share that ring, and one drawn at `8.5`
is visible the moment they sit in a row.

---

## 5. Diagonals

**45° only.** A diagonal that is not 45° looks like an error next to one that is.

At 45° a horizontal run equals its vertical run, which makes arrowheads and chevrons mechanical:

```text
chevron-right   M9 6 l6 6 -6 6      6 across, 6 down. 45°.
arrow-up-right  M7 17 L17 7         10 and 10. 45°.
x               M18 6 L6 18         12 and 12. 45°.
```

Where a true 45° is impossible (the teeth of `settings` at r=5 → r=8), compute the real coordinate
rather than eyeballing it: `12 ± 5/√2 = 8.46 / 15.54`. Decimals are fine; wrong angles are not.

---

## 6. Shared motifs

This is what most makes the set feel like one system. **Reuse these exactly** rather than redrawing.

### The badge ring — `status`, `user-circle`

```svg
<circle cx="12" cy="12" r="9" />
```

Contents are drawn at ~60% of the standalone glyph, centred in the ring:

```text
check-circle   <circle r="9" /> + M8.5 12.5 l2.5 2.5 5-5
x-circle       <circle r="9" /> + M15 9 l-6 6   +  M9 9 l6 6
alert-circle   <circle r="9" /> + M12 8 v4  +  M12 16 h.01
```

### The overlay badge — `-plus`, `-check`, `-x`, `-minus`

A modifier on a base glyph always goes **bottom-right**, drawn small, in the same place every time:

```text
plus overlay   M17 18 h5      M19.5 15.5 v5      (crosshair centred 19.5, 18)
check overlay  M17 18 l2 2 3.5-3.5
x overlay      M17.5 16.5 l4 4    M21.5 16.5 l-4 4
```

`user-plus`, `file-plus`, `folder-plus` and `calendar-plus` all use the identical plus overlay. That
repetition is the point — a consumer learns the vocabulary once.

### The document body — `files`

```svg
<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
<path d="M14 3v5h5" />
```

The folded corner is always 5 × 5 at the top right. Every `file-*` icon inherits this silhouette.

### The container — `devices`, `data`

```svg
<rect x="3" y="4" width="18" height="13" rx="2" />
```

### The shrink-and-badge pattern — `mail-*`, `credit-card-*`, `user-*`

When a base glyph fills the live area, a modifier cannot simply be laid on top. The base **shrinks
and shifts** to open a corner, and the badge occupies it with at least 1.5 units of clearance:

```text
mail          rect 3 5 18 14           full width
mail-plus     rect 2 7 12 10.5   +  badge centred 18.5, 6.5
credit-card   rect 2 5 20 14           full width
credit-card-plus  rect 2 8 15 12  +  badge centred 19, 5
user          head cx 12         +  body 2 → 20
user-plus     head cx 10         +  body 2 → 18  +  badge centred 19, 8
```

The clearance is the whole point. At 1.0 units the badge and the base touch at 16px and the icon
reads as damaged rather than modified — that failure is exactly what a first pass at `mail-plus`
looked like.

### The slash — `-off` states

Every "off" variant is its base glyph plus one 45° stroke, corner to corner, in the same direction:

```svg
<path d="M3 3 21 21" />
```

`eye-off`, `mic-off`, `bell-off`, `volume-off`, `cloud-off`, `shield-off`, `key-off` and
`video-off` all use it. Never draw a different slash angle.

**One exception, and the reason for it.** `phone-off` uses the mirrored `M21 3 3 21`, because the
handset glyph itself sweeps top-left to bottom-right — on that base the standard slash lies parallel
to the artwork and the two merge into a single stroke. The test is whether the slash *crosses* the
glyph; if a future base runs along the same diagonal, mirror the slash for that icon too and say so
here.

---

## 7. Small-size behaviour

Design at 24. **Decide at 16.** 16px is where most product UI actually renders icons, and it is where
a glyph that looked fine falls apart.

At 16px the 24-unit grid is scaled by 0.667, so a 2px stroke renders at 1.33px and a 1-unit gap
renders at 0.67px — below one device pixel on a non-retina screen.

| Symptom at 16px | Cause | Fix |
|:--|:--|:--|
| Two strokes merge into a bar | Centrelines < 3 apart | Move to 3+, or drop one |
| An intersection turns into a blob | Three strokes meeting at a point | Offset one, or simplify |
| Interior detail vanishes | Feature smaller than ~3 units | Remove it — it was never legible |
| Icon looks lighter than neighbours | Fewer/shorter strokes than the family | Extend to the live-area edges |
| Icon looks heavier | Too many subpaths | Cut to the stroke budget in §2 |
| Silhouette is ambiguous | Outline too close to a sibling's | Exaggerate the distinguishing feature |

**Check `-plus`/`-check`/`-x` overlay families first.** The overlay is the smallest thing in the set
and the first to turn to mud.

Use `bun run explorer` and look at the 16px row. The explorer renders every icon at 16, 20, 24 and 32
side by side for exactly this reason.

---

## 8. Silhouette distinctness

An icon is recognised by its outline before any interior detail resolves. Two icons with the same
silhouette are the same icon to a user, whatever the interior says.

The set therefore keeps distinct outer shapes for distinct meanings:

```text
circle       status badges, avatars
rounded rect containers, devices, cards
document     files (folded corner)
folder       folders (stepped tab)
shield       security
bell         notifications
```

Before adding an icon, ask what its silhouette is and whether that silhouette is taken. If it is, the
new icon probably belongs as an overlay variant of the existing one rather than as a new glyph.

---

## 9. Consistency checklist

Before opening a PR, for each new icon:

- [ ] Centrelines inside `3 → 21`, or `2 → 22` for a deliberate full-bleed stroke
- [ ] Parallel strokes ≥ 3 units apart
- [ ] Within the stroke budget (≤ 6 subpaths)
- [ ] Every diagonal is exactly 45°, or a computed exact value
- [ ] One corner radius throughout; `rx="2"` for large, `rx="1"` for small
- [ ] Badge rings are `r="9"`; heads `r="4"`; dots `r="1"`
- [ ] Reuses the shared motif (§6) if one applies, unchanged
- [ ] `-off` variants use the standard `M3 3 21 21` slash
- [ ] Optically centred, not box-centred
- [ ] Legible at 16px in the explorer
- [ ] Silhouette is not already taken by a different meaning
- [ ] Sits in a row with its category neighbours without looking out of place

The last item is the one that catches most problems. Always look at the new icon **next to its
siblings**, never on its own.
