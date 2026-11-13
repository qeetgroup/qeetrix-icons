# 🔁 Coming from lucide-react

The artwork is Lucide's, so most screens move over with an import change:

| `lucide-react` | `@qeetrix/icons` |
|:--|:--|
| `import { Star } from "lucide-react"` | `import { StarIcon } from "@qeetrix/icons"` |
| `<Star size={20} strokeWidth={1.5} />` | `<StarIcon size={20} strokeWidth={1.5} />` (same props) |
| `<Star className="text-amber-500" />` | `<StarIcon className="text-amber-500" />` (same `currentColor`) |
| Outline only | Add `variant="filled"` where a filled drawing exists |
| Round only | Add `shape="sharp"` for the sharp style |
| No logos | `QeetLogo` and `QeetWordmarkLogo` from the same package |

Names follow Lucide 1.52.0, so a few older lucide-react names differ (`Trash2` is `TrashIcon`
here); the catalogue's `aliases` field maps them. `absoluteStrokeWidth` is not supported.

---

[← Qeetrix Icons](../README.md)
