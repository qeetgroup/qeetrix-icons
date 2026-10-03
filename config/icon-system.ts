import type { IconDirectionality, IconVariant } from "../src/types/icon.js";

type IconSystemConfig = {
  readonly architecture: {
    readonly sourceFormat: "svg";
    readonly grid: { readonly width: number; readonly height: number };
    readonly viewBox: `${number} ${number} ${number} ${number}`;
    readonly defaultVariant: IconVariant;
    readonly variants: readonly IconVariant[];
    readonly defaultDirectionality: IconDirectionality;
    readonly color: "currentColor";
    readonly accessibility: {
      readonly decorativeByDefault: boolean;
      readonly focusable: boolean;
    };
  };
  readonly calibration: {
    readonly defaultSize: number;
    readonly recommendedSizes: readonly number[];
    readonly strokeWidth: number;
    readonly strokeCandidates: readonly number[];
    readonly linecap: "butt" | "round" | "square";
    readonly linejoin: "miter" | "round" | "bevel";
    readonly safeAreaInset: number;
  };
};

/**
 * Internal design contract, not a package export or a React props definition.
 * Architecture is stable. All calibration values are CALIBRATION REQUIRED.
 * Safe-area inset measures canvas edge to painted bounds, including stroke.
 */
export const iconSystem = {
  architecture: {
    sourceFormat: "svg",
    grid: { width: 24, height: 24 },
    viewBox: "0 0 24 24",
    // Stable public API, not calibration: the drawing an icon renders without a `variant` prop,
    // and the one every concept must have.
    defaultVariant: "outline",
    variants: ["outline", "filled"],
    defaultDirectionality: "preserve",
    color: "currentColor",
    accessibility: {
      decorativeByDefault: true,
      focusable: false,
    },
  },
  calibration: {
    defaultSize: 24,
    recommendedSizes: [14, 16, 20, 24, 32],
    strokeWidth: 1.75,
    // Widths compared side by side in the playground's stroke calibration view. Internal QA
    // input only: validation and generation use `strokeWidth`, never these.
    strokeCandidates: [1.5, 1.75, 2],
    linecap: "round",
    linejoin: "round",
    safeAreaInset: 2,
  },
} as const satisfies IconSystemConfig;
