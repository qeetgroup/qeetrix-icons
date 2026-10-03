import { iconSystem } from "../../config/icon-system.js";
import type { IconManifestEntry } from "../../src/types/icon-manifest.js";

/**
 * Review content shown in the inspector. Human judgment only: nothing here scores an icon, and
 * ticked items are local to the page, never saved as repository state.
 */

export type ChecklistGroup = { readonly title: string; readonly items: readonly string[] };

export function checklistFor(icon: IconManifestEntry): ChecklistGroup[] {
  return [
    {
      title: "Meaning",
      items: ["Recognizable as its concept, not just as a shape"],
    },
    {
      title: "Sizes",
      items: [
        "14px: still clear, no merged strokes",
        "16px: clear at the most common UI size",
        "20px: balanced",
        "24px: canonical appearance",
        "32px: scales without looking empty or heavy",
      ],
    },
    {
      title: "Construction",
      items: [
        "Optically centered (mathematical center is only a guide)",
        "Generous negative space; painted bounds inside the safe area",
        "Stroke weight consistent with the family",
        "Corners, curves, and diagonals deliberate and clean",
        "Internal spacing survives at small sizes",
      ],
    },
    {
      title: "Color and theme",
      items: ["Reads on light and dark surfaces", "Follows currentColor in every foreground token"],
    },
    {
      title: "Typography",
      items: [
        "Supports Qeet UI labels without overpowering them",
        "Sits comfortably beside Qeet Text",
      ],
    },
    {
      title: "Direction",
      items: [
        `Directionality "${icon.directionality}" matches the concept's meaning`,
        ...(icon.directionality === "mirror" ? ["Mirrored RTL preview still reads correctly"] : []),
      ],
    },
    ...(icon.variants.length > 1
      ? [{ title: "Variants", items: ["Outline and filled read as one concept and family"] }]
      : []),
  ];
}

/** Design values still awaiting the Phase 3 calibration set; none is locked yet. */
export function provisionalValues(): { readonly name: string; readonly value: string }[] {
  const { calibration } = iconSystem;
  return [
    { name: "Stroke width", value: String(calibration.strokeWidth) },
    { name: "Stroke caps and joins", value: `${calibration.linecap} / ${calibration.linejoin}` },
    { name: "Safe-area inset", value: `${calibration.safeAreaInset} units per edge` },
    { name: "Recommended sizes", value: calibration.recommendedSizes.join(", ") },
    { name: "Corner treatment", value: "Not specified yet" },
    { name: "Small-size optical corrections", value: "Not specified yet" },
  ];
}
