import { iconSystem } from "../../config/icon-system.js";
import type { IconShape } from "../../src/types/icon.js";
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

/**
 * How a shape's outlines end and join their strokes, from the shared config: Lucide's round caps
 * and joins, or the sharp style's square caps and miters with its miter limit.
 */
export function strokeStyle(shape: IconShape): {
  readonly linecap: string;
  readonly linejoin: string;
  readonly miterLimit?: number;
} {
  const { design } = iconSystem;
  return shape === "sharp" ? design.sharp : { linecap: design.linecap, linejoin: design.linejoin };
}

/**
 * The design values every outline of a shape follows: Lucide's drawing rules, with the sharp
 * style's caps, joins, and miter limit in place of round ones. From the shared config.
 */
export function designValues(
  shape: IconShape = iconSystem.architecture.defaultStyle,
): { readonly name: string; readonly value: string }[] {
  const { design } = iconSystem;
  const { linecap, linejoin, miterLimit } = strokeStyle(shape);
  return [
    { name: "Stroke width", value: String(design.strokeWidth) },
    { name: "Stroke caps and joins", value: `${linecap} / ${linejoin}` },
    ...(miterLimit === undefined ? [] : [{ name: "Miter limit", value: String(miterLimit) }]),
    { name: "Safe-area inset", value: `${design.safeAreaInset} unit per edge` },
    { name: "Recommended sizes", value: design.recommendedSizes.join(", ") },
  ];
}
