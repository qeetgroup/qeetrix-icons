import { useEffect, useState } from "react";

/**
 * The Qeet typefaces icons are calibrated against. The playground self-hosts them from
 * playground/fonts (see the @font-face rules in styles.css); nothing is fetched from a network.
 */
export const typefaces = [
  { family: "Qeet UI", variable: "--font-ui" },
  { family: "Qeet Text", variable: "--font-text" },
] as const;

/**
 * Whether a family is really available (installed locally or already loaded), by comparing text
 * width against generic fallbacks. `document.fonts.check` alone reports unknown families as
 * available, which would let us believe we calibrated against a font that never rendered.
 */
function isAvailable(family: string): boolean {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return false;
  const sample = "Qeetrix mmmmwwwwlllii 0123456789";
  return ["monospace", "serif"].some((fallback) => {
    context.font = `72px ${fallback}`;
    const width = context.measureText(sample).width;
    context.font = `72px "${family}", ${fallback}`;
    return context.measureText(sample).width !== width;
  });
}

/**
 * `undefined` until fonts have settled, then availability per family. Each family is loaded
 * explicitly first: a declared face that no rendered text uses yet has not loaded, and measuring
 * it would report the fallback. A failed load resolves too, so the check still reports it.
 */
export function useFontAvailability(): Readonly<Record<string, boolean>> | undefined {
  const [availability, setAvailability] = useState<Record<string, boolean>>();
  useEffect(() => {
    let active = true;
    const loads = typefaces.map(({ family }) =>
      document.fonts.load(`16px "${family}"`).catch(() => []),
    );
    void Promise.all(loads)
      .then(() => document.fonts.ready)
      .then(() => {
        if (active) {
          setAvailability(
            Object.fromEntries(typefaces.map(({ family }) => [family, isAvailable(family)])),
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return availability;
}
