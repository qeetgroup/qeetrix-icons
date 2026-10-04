import type { IconDirectionality, IconVariant } from "../src/types/icon.js";

/** A drawing style: round is the package root, sharp is `@qeetrix/icons/sharp`. */
export type IconStyle = "round" | "sharp";

type IconSystemConfig = {
  readonly architecture: {
    readonly sourceFormat: "svg";
    readonly grid: { readonly width: number; readonly height: number };
    readonly viewBox: `${number} ${number} ${number} ${number}`;
    readonly defaultVariant: IconVariant;
    readonly variants: readonly IconVariant[];
    readonly defaultStyle: IconStyle;
    readonly styles: readonly IconStyle[];
    readonly defaultDirectionality: IconDirectionality;
    readonly color: "currentColor";
    readonly accessibility: {
      readonly decorativeByDefault: boolean;
      readonly focusable: boolean;
    };
  };
  readonly design: {
    readonly defaultSize: number;
    readonly recommendedSizes: readonly number[];
    readonly strokeWidth: number;
    readonly strokeCandidates: readonly number[];
    readonly linecap: "butt" | "round" | "square";
    readonly linejoin: "miter" | "round" | "bevel";
    readonly safeAreaInset: number;
    readonly sharp: {
      readonly linecap: "butt" | "round" | "square";
      readonly linejoin: "miter" | "round" | "bevel";
      readonly miterLimit: number;
    };
  };
};

/**
 * Internal design contract, not a package export or a React props definition.
 * Outline artwork is Lucide's (config/lucide.json pins the release), so `design` restates Lucide's
 * own drawing rules rather than choosing new ones: a 24-unit grid, a 2-unit round stroke, and a
 * 1-unit padding. Safe-area inset measures canvas edge to painted bounds, including stroke.
 */
export const iconSystem = {
  architecture: {
    sourceFormat: "svg",
    grid: { width: 24, height: 24 },
    viewBox: "0 0 24 24",
    // Stable public API: the drawing an icon renders without a `variant` prop, and the one every
    // concept must have.
    defaultVariant: "outline",
    variants: ["outline", "filled"],
    // Source folders are `icons/<style>-<variant>/`: round-outline, round-filled, sharp-outline,
    // and sharp-filled. Every style has the same concepts and variants; round is the default.
    defaultStyle: "round",
    styles: ["round", "sharp"],
    defaultDirectionality: "preserve",
    color: "currentColor",
    accessibility: {
      decorativeByDefault: true,
      focusable: false,
    },
  },
  design: {
    defaultSize: 24,
    recommendedSizes: [14, 16, 20, 24, 32],
    strokeWidth: 2,
    // Widths compared side by side in the playground's stroke view. Callers can render any of them
    // with the `strokeWidth` prop; validation and filled derivation use `strokeWidth` only.
    strokeCandidates: [1.5, 1.75, 2],
    linecap: "round",
    linejoin: "round",
    safeAreaInset: 1,
    // The sharp style (`@qeetrix/icons/sharp`): the same geometry with square caps, mitered joins,
    // and corner roundings squared off, acute tips included. A miter limit of 4 lets joins down to
    // about 29° (a star's or triangle's tip) come to a point and bevels only sharper ones; where a
    // point would leave the canvas or run into another stroke, derivation cuts the corner flat.
    sharp: {
      linecap: "square",
      linejoin: "miter",
      miterLimit: 4,
    },
  },
} as const satisfies IconSystemConfig;
