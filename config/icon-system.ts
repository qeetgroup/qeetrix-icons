import type { IconVariant } from "../src/types/icon.js";

type IconSystemConfig = {
  readonly architecture: {
    readonly sourceFormat: "svg";
    readonly grid: { readonly width: number; readonly height: number };
    readonly viewBox: `${number} ${number} ${number} ${number}`;
    readonly defaultVariant: IconVariant;
    readonly variants: readonly IconVariant[];
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
    defaultVariant: "outline",
    variants: ["outline", "filled"],
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
    linecap: "round",
    linejoin: "round",
    safeAreaInset: 2,
  },
} as const satisfies IconSystemConfig;
