import type { ComponentType, SVGProps } from "react";

/**
 * Whether an icon is drawn as strokes or as filled shapes.
 *
 * One of the two independent style axes; the other is {@link IconShape}. Source
 * artwork lives in `icons/<shape>-<variant>/`, so the two combine freely.
 */
export type IconVariant = "outline" | "solid";

/**
 * Whether corners are rounded or squared off.
 *
 * `"sharp"` is reserved: the directories exist but the artwork has not landed
 * yet, so today every icon narrows `shape` to `"round"` and passing `"sharp"` is
 * a type error. It becomes available per icon as the SVGs are added.
 */
export type IconShape = "round" | "sharp";

/**
 * Props accepted by every Qeetrix icon component.
 *
 * A thin extension of `SVGProps<SVGSVGElement>`: anything valid on an `<svg>`
 * element is valid here — `className`, `style`, `width`, `height`, `color`,
 * every `aria-*` attribute and every event handler. Props spread onto the root
 * `<svg>` last, so they override the defaults baked into the component.
 *
 * ## Colour
 *
 * Icons are drawn in white by default, matching the source artwork, and all
 * visible geometry paints `currentColor`. The root carries `color="white"` as
 * the default, so a single knob retints the whole glyph:
 *
 * ```tsx
 * <Activity />                                    // white, as drawn
 * <Activity color="black" />                      // any CSS colour
 * <Activity className="text-red-500" />           // a utility class
 * <Activity className="text-black dark:text-white" />   // dark / light mode
 * <Activity color="currentColor" />               // inherit surrounding text
 * ```
 *
 * `color` is a presentation attribute, which CSS outranks — so a `className` or
 * stylesheet rule beats the white default without needing `!important`.
 *
 * Note that `fill` is *not* the knob to reach for: visible paths carry their own
 * `fill="currentColor"`, and an explicit fill on a child beats an inherited one
 * from the root, so setting `fill` on the icon has no effect on the artwork.
 *
 * ## Style
 *
 * Two independent axes, so adding sharp artwork never renames anything:
 *
 * ```tsx
 * <Activity />                                 // round + outline
 * <Activity variant="solid" />                 // round + solid
 * <Activity shape="sharp" variant="solid" />   // sharp + solid, once it lands
 * ```
 *
 * Individual components narrow **both** unions to what they actually ship, so a
 * solid-only icon rejects `variant="outline"` at the type level, and `"sharp"` is
 * a type error until that icon has sharp artwork.
 *
 * > **This is a reference type, not a component type.** Because every icon
 * > narrows both axes, no icon is assignable to `ComponentType<QeetrixIconProps>`
 * > — props are contravariant, so a component accepting only `shape="round"`
 * > cannot stand in for one accepting `"round" | "sharp"`. To hold an arbitrary
 * > icon in a variable or prop, use {@link QeetrixIcon}.
 */
export type QeetrixIconProps = SVGProps<SVGSVGElement> & {
  /** Strokes or filled shapes. Defaults to `"outline"` where one exists. */
  variant?: IconVariant;
  /** Rounded or squared corners. Defaults to `"round"`. */
  shape?: IconShape;
};

/**
 * Any icon component, for wrappers and registries.
 *
 * ```tsx
 * import type { QeetrixIcon } from "@qeetrix/icons";
 * import { ShieldTick, Trash } from "@qeetrix/icons";
 *
 * function IconButton({ icon: Icon, label }: { icon: QeetrixIcon; label: string }) {
 *   return (
 *     <button type="button" aria-label={label}>
 *       <Icon width={20} height={20} color="currentColor" aria-hidden="true" />
 *     </button>
 *   );
 * }
 *
 * const registry: Record<string, QeetrixIcon> = { verify: ShieldTick, delete: Trash };
 * ```
 *
 * Deliberately omits `variant` and `shape`. A type that accepted every icon
 * *and* let you pass any variant cannot exist: the whole point of the per-icon
 * narrowing is that a solid-only icon has no outline to ask for. If a wrapper
 * needs to forward a style axis, make it generic over that icon's own props:
 *
 * ```tsx
 * function Styled<P extends { variant?: string }>(
 *   { icon: Icon, ...rest }: { icon: ComponentType<P> } & P,
 * ) {
 *   return <Icon {...(rest as P)} />;
 * }
 * ```
 */
export type QeetrixIcon = ComponentType<SVGProps<SVGSVGElement>>;
