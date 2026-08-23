/**
 * Runtime proof, run inside the throwaway consumer by
 * scripts/verify-package.mjs.
 *
 * Types compiling says nothing about whether a component executes. This renders
 * through `react-dom/server` and asserts the SVG attributes the design system
 * promises, plus the accessibility contract's two branches. It prints
 * `RENDER_OK` on success, which is what the verifier greps for.
 */

import { ArrowLeft, Search, ShieldCheck } from "@qeetrix/icons";
import { icons } from "@qeetrix/icons/metadata";
import { renderToStaticMarkup } from "react-dom/server";

const problems: string[] = [];
const check = (condition: boolean, message: string) => {
  if (!condition) problems.push(message);
};

// ── the visual contract ───────────────────────────────────────────────────
const plain = renderToStaticMarkup(<Search />);
check(plain.includes('viewBox="0 0 24 24"'), "missing the 24x24 viewBox");
check(plain.includes('stroke="currentColor"'), "does not inherit colour");
check(plain.includes('fill="none"'), "is not fill:none");
check(plain.includes('stroke-width="2"'), "wrong default stroke width");
check(plain.includes('stroke-linecap="round"'), "wrong linecap");
check(plain.includes('width="24"') && plain.includes('height="24"'), "wrong default size");
check(/<(path|circle|rect|line|polyline|polygon|ellipse)/.test(plain), "drew no geometry");

// ── props ─────────────────────────────────────────────────────────────────
const sized = renderToStaticMarkup(<ArrowLeft size={16} strokeWidth={1.5} className="x" />);
check(sized.includes('width="16"') && sized.includes('height="16"'), "size prop ignored");
check(sized.includes('stroke-width="1.5"'), "strokeWidth prop ignored");
check(sized.includes('class="x"'), "className not forwarded");

// ── the accessibility contract, both branches ─────────────────────────────
const decorative = renderToStaticMarkup(<ShieldCheck />);
check(decorative.includes('aria-hidden="true"'), "not decorative by default");
check(!decorative.includes('role="img"'), "decorative icon should have no role");

const named = renderToStaticMarkup(<ShieldCheck aria-label="Verified" />);
check(named.includes('role="img"'), "labelled icon is missing role=img");
check(named.includes('aria-label="Verified"'), "aria-label not forwarded");
check(!named.includes("aria-hidden"), "labelled icon must not also be aria-hidden");

// ── the metadata entry point ──────────────────────────────────────────────
check(icons.length > 300, `metadata has only ${icons.length} entries`);
check(
  icons.every((i) => typeof i.name === "string" && typeof i.mirror === "boolean"),
  "metadata records are malformed",
);

if (problems.length > 0) {
  console.error(`RENDER_FAILED\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`RENDER_OK — ${icons.length} icons, server-rendered, contracts hold`);
