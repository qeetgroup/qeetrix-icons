/**
 * Brand logo sources are embedded exactly as published. Nothing here changes a file: it reads the
 * root element's sizing attributes (to know the aspect ratio) and encodes the file's bytes as a
 * lossless `data:` URI. This pipeline shares no code with the icon scripts.
 */

export class LogoSourceError extends Error {}

export const svgDataUriPrefix = "data:image/svg+xml,";

const hex = Array.from({ length: 256 }, (_, byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`);

/**
 * Bytes a `data:` URI cannot carry verbatim, plus a few that keep the URI easy to embed:
 *
 * - `%` (escape character) and `#` (would start a fragment);
 * - control bytes, including tab, LF and CR, which the URL parser strips, and DEL;
 * - every non-ASCII byte, so the URI is pure ASCII and decodes to the same bytes whatever the
 *   file's encoding;
 * - `'` and `\`, so the URI is a single-quoted string literal without escapes.
 */
const escaped = new Uint8Array(256);
for (let byte = 0; byte < 256; byte += 1) {
  if (byte < 0x20 || byte >= 0x7f) escaped[byte] = 1;
}
for (const char of "%#'\\") escaped[char.charCodeAt(0)] = 1;

const lessThan = 0x3c;
const space = 0x20;

/** `<!--` and `</script`, which would confuse an HTML `<script>` this URI were ever inlined into. */
function startsHtmlScriptHazard(bytes: Uint8Array, index: number): boolean {
  const next = (offset: number) => bytes[index + offset] ?? 0;
  if (next(1) === 0x21 && next(2) === 0x2d && next(3) === 0x2d) return true;
  if (next(1) !== 0x2f) return false;
  const word = "script";
  for (let offset = 0; offset < word.length; offset += 1) {
    if ((next(offset + 2) | 0x20) !== word.charCodeAt(offset)) return false;
  }
  return true;
}

/**
 * The file as a `data:image/svg+xml,` URI. Percent-decoding the part after the comma (as the Fetch
 * standard's data: URL processor does) yields `bytes` exactly. No `charset` parameter is added, so
 * the file's own XML declaration still decides how it is decoded, as when it is served as a file.
 */
export function svgDataUri(bytes: Uint8Array): string {
  const parts: string[] = [svgDataUriPrefix];
  let start = 0;
  const flush = (end: number) => {
    if (end > start) parts.push(Buffer.from(bytes.buffer, bytes.byteOffset + start, end - start).toString("latin1"));
  };
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index] ?? 0;
    const escape =
      escaped[byte] === 1 ||
      (byte === lessThan && startsHtmlScriptHazard(bytes, index)) ||
      // The URL parser strips trailing spaces.
      (byte === space && index === bytes.length - 1);
    if (!escape) continue;
    flush(index);
    parts.push(hex[byte] ?? "");
    start = index + 1;
  }
  flush(bytes.length);
  return parts.join("");
}

/** Percent-decodes a URI made by {@link svgDataUri} back into the file's bytes. */
export function decodeSvgDataUri(uri: string): Uint8Array {
  if (!uri.startsWith(svgDataUriPrefix)) throw new LogoSourceError("Not an SVG data URI.");
  const bytes: number[] = [];
  for (let index = svgDataUriPrefix.length; index < uri.length; index += 1) {
    const code = uri.charCodeAt(index);
    if (code === 0x25) {
      const byte = Number.parseInt(uri.slice(index + 1, index + 3), 16);
      if (!/^[0-9A-Fa-f]{2}$/.test(uri.slice(index + 1, index + 3))) {
        throw new LogoSourceError(`Invalid escape at ${index}.`);
      }
      bytes.push(byte);
      index += 2;
    } else if (code < 0x80) bytes.push(code);
    else throw new LogoSourceError(`Non-ASCII character at ${index}.`);
  }
  return Uint8Array.from(bytes);
}

// ---------------------------------------------------------------------------------------------
// Intrinsic size

/** Absolute CSS units in pixels; `em`/`ex` resolve against the 16px default font of an image. */
const lengthUnits: Readonly<Record<string, number>> = {
  "": 1,
  px: 1,
  pt: 4 / 3,
  pc: 16,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96,
  q: 96 / 101.6,
  em: 16,
  ex: 8,
};

/** A length in pixels; `undefined` for percentages, `auto`, and anything else. */
export function parseSvgLength(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(value);
  const factor = match ? lengthUnits[(match[2] ?? "").toLowerCase()] : undefined;
  if (!match || factor === undefined) return undefined;
  const length = Number(match[1]) * factor;
  return Number.isFinite(length) && length > 0 ? length : undefined;
}

/** `[minX, minY, width, height]`, or `undefined` unless it is four numbers with a positive size. */
export function parseSvgViewBox(value: string | undefined): readonly number[] | undefined {
  if (value === undefined) return undefined;
  const numbers = value.trim().split(/[\s,]+/).map(Number);
  if (numbers.length !== 4 || !numbers.every(Number.isFinite)) return undefined;
  return (numbers[2] ?? 0) > 0 && (numbers[3] ?? 0) > 0 ? numbers : undefined;
}

const predefinedEntities: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeAttribute(value: string): string {
  return value.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(\w+));/gi, (reference, hexCode, decimal, name) => {
    if (hexCode) return String.fromCodePoint(Number.parseInt(hexCode, 16));
    if (decimal) return String.fromCodePoint(Number(decimal));
    return predefinedEntities[name] ?? reference;
  });
}

export type SvgRootElement = {
  /** Namespace prefix of the root element's name, such as `svg` for `<svg:svg>`. */
  readonly prefix: string | undefined;
  readonly attributes: ReadonlyMap<string, string>;
};

/**
 * The root element's attributes, found by skipping the prolog (XML declaration, processing
 * instructions, comments, DOCTYPE with any internal subset). Read-only.
 */
export function readSvgRoot(text: string): SvgRootElement {
  let index = text.charCodeAt(0) === 0xfeff ? 1 : text.startsWith("ï»¿") ? 3 : 0;
  for (;;) {
    while (/\s/.test(text[index] ?? "")) index += 1;
    if (text.startsWith("<?", index)) index = text.indexOf("?>", index) + 2;
    else if (text.startsWith("<!--", index)) index = text.indexOf("-->", index) + 3;
    else if (/^<!DOCTYPE/i.test(text.slice(index, index + 9))) {
      let quote = "";
      let depth = 0;
      for (index += 9; index < text.length; index += 1) {
        const char = text[index];
        if (quote) {
          if (char === quote) quote = "";
        } else if (char === '"' || char === "'") quote = char;
        else if (char === "[") depth += 1;
        else if (char === "]") depth -= 1;
        else if (char === ">" && depth <= 0) break;
      }
      index += 1;
    } else break;
    if (index <= 0) throw new LogoSourceError("Unterminated markup before the root element.");
  }
  const tag = /^<([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)/.exec(text.slice(index, index + 200));
  if (!tag) throw new LogoSourceError("No root element.");
  if (tag[2] !== "svg") throw new LogoSourceError(`The root element is <${tag[0].slice(1)}>, not <svg>.`);
  const attributes = new Map<string, string>();
  const attribute = /\s*(?:([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')|(\/?>))/y;
  attribute.lastIndex = index + tag[0].length;
  for (;;) {
    const match = attribute.exec(text);
    if (!match) throw new LogoSourceError("Malformed root start tag.");
    if (match[4]) break;
    const name = match[1] ?? "";
    if (!attributes.has(name)) attributes.set(name, decodeAttribute(match[2] ?? match[3] ?? ""));
  }
  return { prefix: tag[1]?.slice(0, -1), attributes };
}

export type SvgIntrinsicSize = {
  readonly width: number;
  readonly height: number;
  /** Where the ratio comes from, as an image renderer sizes the file. */
  readonly from: "width-height" | "viewBox";
  /** The root declares the SVG namespace; without it browsers cannot show the file as an image. */
  readonly namespaced: boolean;
};

/**
 * The aspect ratio an `<img>` gives the file: its root `width` and `height` when both are absolute
 * lengths, otherwise its `viewBox` (SVG 2 sizing, which browsers implement).
 */
export function readSvgIntrinsicSize(bytes: Uint8Array): SvgIntrinsicSize {
  const text = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
  const { prefix, attributes } = readSvgRoot(text);
  const namespaced =
    attributes.get(prefix ? `xmlns:${prefix}` : "xmlns") === "http://www.w3.org/2000/svg";
  const width = parseSvgLength(attributes.get("width"));
  const height = parseSvgLength(attributes.get("height"));
  if (width !== undefined && height !== undefined) {
    return { width, height, from: "width-height", namespaced };
  }
  const viewBox = parseSvgViewBox(attributes.get("viewBox"));
  if (viewBox) return { width: viewBox[2] ?? 1, height: viewBox[3] ?? 1, from: "viewBox", namespaced };
  throw new LogoSourceError("The root has no absolute width and height and no valid viewBox, so it has no aspect ratio.");
}
