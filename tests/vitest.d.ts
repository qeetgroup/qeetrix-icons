/**
 * Matcher type augmentation.
 *
 * `expect.extend` registers matchers at runtime but tells TypeScript nothing, so
 * jest-dom's matchers need declaring here or `bun run typecheck` fails on a
 * suite that passes.
 *
 * Vitest 4 removed the legacy global `Vi` namespace that jest-dom still
 * documents, so the augmentation targets `vitest`'s own `Assertion` interface
 * directly. See tests/setup.ts for the matching runtime registration.
 */

import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "vitest" {
  interface Assertion<T = unknown> extends TestingLibraryMatchers<T, void> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, void> {}
}
