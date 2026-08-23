import * as jestDom from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";

expect.extend(jestDom);
expect.extend(axeMatchers);

afterEach(() => {
  cleanup();
});
