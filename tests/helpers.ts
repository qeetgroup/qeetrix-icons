import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { iconSystem } from "../config/icon-system.js";

export function syntheticSvg(
  attributes: Record<string, string | undefined> = {},
  content = '<path d="M 5 7 L 11 13"/>',
): string {
  const serialized = Object.entries({
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: iconSystem.architecture.viewBox,
    fill: "none",
    stroke: iconSystem.architecture.color,
    "stroke-width": String(iconSystem.calibration.strokeWidth),
    "stroke-linecap": iconSystem.calibration.linecap,
    "stroke-linejoin": iconSystem.calibration.linejoin,
    ...attributes,
  })
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}="${value}"`)
    .join(" ");
  return `<svg ${serialized}>${content}</svg>`;
}

export function writeFixture(root: string, file: string, source: string | Uint8Array): void {
  const absolute = join(root, file);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, source);
}

export function createRepositoryFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "qeetrix-icons-test-"));
  writeFixture(root, "icons/.gitkeep", "");
  return root;
}
