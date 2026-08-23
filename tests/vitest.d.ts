/**
 * Matcher type augmentation.
 *
 * `expect.extend` registers matchers at runtime but tells TypeScript nothing, so
 * both matcher sets need declaring here or `bun run typecheck` fails on a suite
 * that passes.
 *
 * Vitest 4 removed the legacy global `Vi` namespace that both libraries still
 * document, so the augmentation targets `vitest`'s own `Assertion` interface
 * directly. See tests/setup.ts for the matching runtime registration.
 */

import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  interface Assertion<T = unknown> extends TestingLibraryMatchers<T, void>, AxeMatchers {}
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, void>,
      AxeMatchers {}
}
