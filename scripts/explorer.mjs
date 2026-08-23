/**
 * Build the icon explorer — the developer-facing surface for the catalogue.
 *
 * Reads:   icons/**, icon-metadata.json
 * Writes:  .explorer/index.html          the explorer
 *          .explorer/contact-sheet.svg    every icon on one page
 *          .explorer/small-sizes.svg      every icon at 16/20/24/32
 *
 *   bun run explorer
 *
 * ## Why one static file
 *
 * The whole catalogue exists at build time, so the explorer needs no backend, no
 * framework and no build step: it is a single self-contained HTML file with the
 * icon data inlined as JSON. That makes it openable straight off disk, trivially
 * hostable, and immune to the dependency rot a small React app would accumulate
 * for a page that renders a grid and a dialog.
 *
 * It also stays fast. All 331 icons are in the DOM, but each cell carries
 * `content-visibility: auto`, so the browser skips layout and paint for anything
 * off-screen. That is native virtualisation with no JS, and it holds at 1000+.
 *
 * ## Single source of truth
 *
 * There is no second icon list. The data comes from the same `collect()` used by
 * the generator and the package, so an icon that exists is discoverable here the
 * moment `bun run explorer` runs, and one that does not cannot be.
 *
 * ## Ranking
 *
 * The search implementation is `scripts/lib/search.mjs`, inlined below with its
 * `export` keywords stripped. The tests import that same module, so the ordering
 * the explorer shows is the ordering the suite locks down.
 *
 * The two SVG sheets are for reviewing the set *as a set*: a glyph that looks
 * fine alone but wrong beside its siblings is the most common defect, and the
 * only way to see it is a grid. `small-sizes.svg` exists because 16px is where
 * icons actually render and where they fall apart — see
 * docs/icon-design-system.md §7.
 *
 * Output goes to .explorer/, which is gitignored: it is derived data.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { byString } from "./lib/io.mjs";
import { collect, loadMetadata } from "./lib/pipeline.mjs";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(PKG, ".explorer");
const REVIEW_SIZES = [16, 20, 24, 32];
const PREVIEW_SIZES = [16, 20, 24, 32, 48, 64];

const { entries, errors } = collect({ root: PKG });
if (errors.length > 0) {
  console.error("✗ cannot build the explorer while icons are invalid:");
  for (const error of errors) console.error(`    ${error}`);
  process.exit(1);
}

const authored = loadMetadata(PKG);
const pkgJson = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));

/** Serialise a parsed node back to markup, for embedding in review artifacts. */
function markup(node) {
  const attrs = Object.entries(node.attributes)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join("");
  const children = node.children
    .filter((child) => child.type === "element")
    .map(markup)
    .join("");
  return children ? `<${node.name}${attrs}>${children}</${node.name}>` : `<${node.name}${attrs} />`;
}

const icons = [...entries].sort((a, b) => byString(a.name, b.name));
for (const icon of icons) {
  icon.inner = icon.tree.children
    .filter((child) => child.type === "element")
    .map(markup)
    .join("");
}

const SPEC =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

// ── review sheets ─────────────────────────────────────────────────────────
function contactSheet() {
  const cols = 10;
  const cell = 72;
  const label = 16;
  const rows = Math.ceil(icons.length / cols);
  const w = cols * cell;
  const h = rows * (cell + label);
  const body = icons
    .map((icon, i) => {
      const x = (i % cols) * cell;
      const y = Math.floor(i / cols) * (cell + label);
      return (
        `<svg x="${x + 20}" y="${y + 18}" width="32" height="32" viewBox="0 0 24 24" ${SPEC}>${icon.inner}</svg>` +
        `<text x="${x + cell / 2}" y="${y + cell + 8}" font-family="ui-monospace,monospace" font-size="7" fill="#71717a" text-anchor="middle">${icon.name}</text>`
      );
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff" /><g stroke="#18181b" fill="none">${body}</g></svg>`;
}

function smallSizeSheet() {
  const nameCol = 170;
  const rowH = 44;
  const gap = 24;
  const w = nameCol + REVIEW_SIZES.reduce((sum, s) => sum + s + gap, 0);
  const h = icons.length * rowH + 26;
  const header = REVIEW_SIZES.map((size, j) => {
    const x =
      nameCol + REVIEW_SIZES.slice(0, j).reduce((sum, s) => sum + s + gap, 0) + (size + gap) / 2;
    return `<text x="${x}" y="16" font-family="ui-monospace,monospace" font-size="9" fill="#a1a1aa" text-anchor="middle">${size}px</text>`;
  }).join("");
  const body = icons
    .map((icon, i) => {
      const y = 26 + i * rowH;
      const cells = REVIEW_SIZES.map((size, j) => {
        const x = nameCol + REVIEW_SIZES.slice(0, j).reduce((sum, s) => sum + s + gap, 0) + gap / 2;
        return `<svg x="${x}" y="${y + (rowH - size) / 2}" width="${size}" height="${size}" viewBox="0 0 24 24" ${SPEC}>${icon.inner}</svg>`;
      }).join("");
      return (
        `<text x="10" y="${y + rowH / 2 + 4}" font-family="ui-monospace,monospace" font-size="11" fill="#3f3f46">${icon.name}</text>` +
        cells
      );
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff" />${header}<g stroke="#18181b" fill="none">${body}</g></svg>`;
}

// ── the explorer ──────────────────────────────────────────────────────────
/** The search module's source, ready to drop into a `<script>`. */
function inlineSearchModule() {
  const source = readFileSync(join(PKG, "scripts/lib/search.mjs"), "utf8");
  return source.replace(/^export /gm, "");
}

function html() {
  const categories = [...new Set(icons.map((icon) => icon.category))].sort(byString);
  const data = JSON.stringify(
    icons.map((icon) => {
      const meta = authored[icon.name] ?? {};
      const record = {
        name: icon.name,
        component: icon.component,
        category: icon.category,
        tags: icon.tags,
        aliases: icon.aliases,
        mirror: icon.mirror,
        priority: meta.priority ?? "",
        svg: icon.inner,
      };
      if (icon.deprecated) record.deprecated = icon.deprecated;
      return record;
    }),
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Qeetrix Icons — explorer</title>
<style>
  :root {
    --bg: #fff; --fg: #18181b; --muted: #52525b; --line: #d4d4d8;
    --card: #f4f4f5; --accent: #b45309; --focus: #0369a1;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #09090b; --fg: #fafafa; --muted: #a1a1aa; --line: #3f3f46;
            --card: #18181b; --accent: #fbbf24; --focus: #7dd3fc; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg);
         font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
  .skip { position: absolute; left: -9999px; }
  .skip:focus { left: 8px; top: 8px; z-index: 10; padding: 8px 12px;
                background: var(--bg); border: 1px solid var(--line); border-radius: 6px; }
  header { position: sticky; top: 0; z-index: 3; background: var(--bg);
           border-bottom: 1px solid var(--line); padding: 14px 20px; }
  h1 { margin: 0; font-size: 15px; letter-spacing: -0.01em; }
  .sub { color: var(--muted); font-size: 12px; margin-top: 2px; }
  form { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; align-items: center; }
  label.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  input[type=search] { flex: 1 1 240px; min-width: 180px; padding: 8px 12px; font: inherit;
    color: var(--fg); background: var(--card); border: 1px solid var(--line); border-radius: 8px; }
  select, button { padding: 8px 10px; font: inherit; color: var(--fg); background: var(--card);
    border: 1px solid var(--line); border-radius: 8px; cursor: pointer; }
  button[aria-pressed=true] { border-color: var(--accent); color: var(--accent); }
  main { padding: 18px 20px 72px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 6px;
          list-style: none; margin: 0; padding: 0; }
  .grid > li { display: flex; content-visibility: auto; contain-intrinsic-size: auto 92px; }
  .grid.list { grid-template-columns: 1fr; gap: 2px; }
  .cell { display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 14px 6px; border: 1px solid transparent; border-radius: 10px; cursor: pointer;
    text-align: center; background: none; color: inherit; font: inherit; width: 100%;
    }
  .grid > li { content-visibility: auto; contain-intrinsic-size: auto 92px; }
  .grid.list .cell { flex-direction: row; gap: 14px; padding: 8px 12px; text-align: left;
    contain-intrinsic-size: 44px; }
  .grid.list .cell .nm { flex: 0 0 220px; }
  .grid.list .cell .cm { color: var(--muted); font-size: 11px; }
  .cell:hover { border-color: var(--line); background: var(--card); }
  .cell svg { display: block; flex: none; }
  .nm { font-size: 10.5px; color: var(--muted); word-break: break-all;
        font-family: ui-monospace, monospace; }
  .cm { display: none; font-family: ui-monospace, monospace; }
  .grid.list .cm { display: block; }
  .dep { color: var(--accent); font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
  /* Preview backgrounds. The icons never change colour - currentColor does the
     work, which is exactly what these two swatches are here to demonstrate. */
  .on-light { background: #fff; color: #18181b; }
  .on-dark  { background: #09090b; color: #fafafa; }
  .empty { color: var(--muted); padding: 48px 0; text-align: center; }
  dialog { border: 1px solid var(--line); border-radius: 12px; background: var(--bg);
    color: var(--fg); padding: 0; max-width: 520px; width: 92vw; }
  dialog::backdrop { background: rgba(0,0,0,.5); }
  .dh { display: flex; gap: 18px; align-items: flex-end; padding: 20px 20px 16px;
        border-bottom: 1px solid var(--line); }
  .dh figure { margin: 0; text-align: center; }
  .dh figcaption { font-size: 9px; color: var(--muted); margin-top: 5px; }
  .db { padding: 18px 20px 22px; display: grid; gap: 12px; }
  .row { display: grid; grid-template-columns: 92px 1fr; gap: 12px; font-size: 12.5px; }
  .row > span:first-child { color: var(--muted); }
  .snip { display: flex; gap: 8px; align-items: stretch; }
  .snip pre { flex: 1; margin: 0; padding: 9px 11px; background: var(--card);
    border: 1px solid var(--line); border-radius: 8px; font-size: 11.5px; overflow-x: auto;
    font-family: ui-monospace, monospace; }
  .snip button { flex: none; }
  .tag { display: inline-block; padding: 1px 8px; margin: 0 3px 3px 0; font-size: 11.5px;
         border: 1px solid var(--line); border-radius: 999px; color: var(--muted);
         background: none; cursor: pointer; }
  .tag:hover { color: var(--fg); border-color: var(--fg); }
  .warn { padding: 9px 11px; border: 1px solid var(--accent); border-radius: 8px;
          color: var(--accent); font-size: 12px; }
  .close { position: absolute; top: 10px; right: 10px; }
  #live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
</head>
<body>
<a class="skip" href="#grid">Skip to icons</a>
<header>
  <h1>Qeetrix Icons</h1>
  <div class="sub">
    v${pkgJson.version} &middot; <span id="total">${icons.length}</span> icons &middot;
    ${categories.length} categories &middot; <span id="mirrorcount"></span> mirror under RTL
  </div>
  <form id="controls" role="search" aria-label="Filter icons" onsubmit="return false">
    <label class="sr" for="q">Search icons by name, tag or alias</label>
    <input type="search" id="q" placeholder="Search name, tag or alias&hellip;  ( / to focus )" autocomplete="off" />
    <label class="sr" for="cat">Category</label>
    <select id="cat">
      <option value="">All categories</option>
      ${categories.map((c) => `<option value="${c}">${c}</option>`).join("\n      ")}
    </select>
    <label class="sr" for="pri">Priority</label>
    <select id="pri">
      <option value="">Any priority</option>
      <option value="P0">P0 &mdash; essential</option>
      <option value="P1">P1 &mdash; highly useful</option>
      <option value="P2">P2 &mdash; specialised</option>
      <option value="P3">P3 &mdash; optional</option>
    </select>
    <label class="sr" for="size">Preview size</label>
    <select id="size">
      ${PREVIEW_SIZES.map((s) => `<option value="${s}"${s === 24 ? " selected" : ""}>${s}px</option>`).join("\n      ")}
    </select>
    <button type="button" id="view" aria-pressed="false">List view</button>
    <button type="button" id="mirror" aria-pressed="false">Mirror only</button>
    <button type="button" id="bg" aria-pressed="false">Dark preview</button>
    <button type="button" id="reset">Reset</button>
  </form>
</header>

<main>
  <ul class="grid" id="grid" aria-label="Icons"></ul>
  <p class="empty" id="empty" hidden>No icons match. Try a tag or an alias &mdash; <code>delete</code> finds <code>trash</code>.</p>
</main>

<dialog id="d" aria-labelledby="dcomp">
  <button class="close" id="dclose" aria-label="Close details">&times;</button>
  <div class="dh" id="dsizes"></div>
  <div class="db">
    <div><strong id="dcomp"></strong> <span class="nm" id="dname"></span></div>
    <div id="dwarn"></div>
    <div class="row"><span>Category</span><div id="dcat"></div></div>
    <div class="row"><span>Priority</span><div id="dpri"></div></div>
    <div class="row"><span>RTL</span><div id="dmirror"></div></div>
    <div class="row"><span>Tags</span><div id="dtags"></div></div>
    <div class="row"><span>Aliases</span><div id="dalias"></div></div>
    <div class="snip"><pre id="dimport"></pre><button type="button" data-copy="dimport">Copy import</button></div>
    <div class="snip"><pre id="dusage"></pre><button type="button" data-copy="dusage">Copy JSX</button></div>
    <div class="snip"><pre id="dcname"></pre><button type="button" data-copy="dcname">Copy name</button></div>
  </div>
</dialog>
<div id="live" role="status" aria-live="polite"></div>

<script>
// ── search + ranking: inlined from scripts/lib/search.mjs ──────────────────
${inlineSearchModule()}

// ── data ──────────────────────────────────────────────────────────────────
const ICONS = ${data};
const SPEC = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const PREVIEW_SIZES = ${JSON.stringify(PREVIEW_SIZES)};
const el = (id) => document.getElementById(id);
const svgFor = (i, s) =>
  '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' + SPEC +
  ' aria-hidden="true">' + i.svg + '</svg>';

let listView = false;
let mirrorOnly = false;
let darkPreview = false;
let lastFocus = null;

// ── URL state ─────────────────────────────────────────────────────────────
// Hash rather than pathname, so the same file works opened from disk, served
// statically, or behind any prefix — and every view stays linkable.
function readHash() {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  el('q').value = p.get('q') || '';
  el('cat').value = p.get('category') || '';
  el('pri').value = p.get('priority') || '';
  el('size').value = PREVIEW_SIZES.includes(+p.get('size')) ? p.get('size') : '24';
  listView = p.get('view') === 'list';
  mirrorOnly = p.get('mirror') === '1';
  darkPreview = p.get('bg') === 'dark';
  syncToggles();
  return p.get('icon') || '';
}

function writeHash(iconName) {
  const p = new URLSearchParams();
  if (el('q').value.trim()) p.set('q', el('q').value.trim());
  if (el('cat').value) p.set('category', el('cat').value);
  if (el('pri').value) p.set('priority', el('pri').value);
  if (el('size').value !== '24') p.set('size', el('size').value);
  if (listView) p.set('view', 'list');
  if (mirrorOnly) p.set('mirror', '1');
  if (darkPreview) p.set('bg', 'dark');
  if (iconName) p.set('icon', iconName);
  const next = '#' + p.toString();
  if (next !== location.hash) history.replaceState(null, '', next || '#');
}

function syncToggles() {
  el('view').setAttribute('aria-pressed', String(listView));
  el('view').textContent = listView ? 'Grid view' : 'List view';
  el('mirror').setAttribute('aria-pressed', String(mirrorOnly));
  el('bg').setAttribute('aria-pressed', String(darkPreview));
  el('bg').textContent = darkPreview ? 'Light preview' : 'Dark preview';
}

// ── render ────────────────────────────────────────────────────────────────
function visible() {
  return filterIcons({
    icons: ICONS,
    query: el('q').value,
    category: el('cat').value,
    priority: el('pri').value,
    mirrorOnly: mirrorOnly,
  });
}

function render() {
  const size = +el('size').value;
  const list = visible();
  const grid = el('grid');
  grid.className = 'grid' + (listView ? ' list' : '') + (darkPreview ? ' on-dark' : ' on-light');
  grid.innerHTML = list
    .map(
      (i) =>
        '<li><button type="button" class="cell" data-name="' + i.name + '"' +
        ' aria-label="' + i.component + (i.deprecated ? ', deprecated' : '') + '">' +
        svgFor(i, size) +
        '<span class="nm">' + i.name + (i.deprecated ? ' <span class="dep">deprecated</span>' : '') + '</span>' +
        '<span class="cm">' + i.component + '</span></button></li>',
    )
    .join('');
  el('empty').hidden = list.length > 0;
  el('total').textContent = list.length;
  el('live').textContent = list.length + ' icons match';
  writeHash(el('d').open ? el('dname').textContent : '');
}

// ── detail dialog ─────────────────────────────────────────────────────────
function open(icon) {
  lastFocus = document.activeElement;
  el('dsizes').innerHTML = PREVIEW_SIZES
    .map((s) => '<figure>' + svgFor(icon, s) + '<figcaption>' + s + '</figcaption></figure>')
    .join('');
  el('dsizes').className = 'dh ' + (darkPreview ? 'on-dark' : 'on-light');
  el('dcomp').textContent = icon.component;
  el('dname').textContent = icon.name;
  el('dcat').textContent = icon.category;
  el('dpri').textContent = icon.priority || '—';
  el('dmirror').textContent = icon.mirror
    ? 'Mirrors — flip under dir="rtl"'
    : 'Does not mirror';
  el('dwarn').innerHTML = icon.deprecated
    ? '<p class="warn"><strong>Deprecated</strong> since ' + icon.deprecated.since + '. ' +
      icon.deprecated.reason +
      (icon.deprecated.replacement ? ' Use <code>' + icon.deprecated.replacement + '</code>.' : '') +
      '</p>'
    : '';
  el('dtags').innerHTML =
    icon.tags.map((t) => '<button type="button" class="tag" data-term="' + t + '">' + t + '</button>').join('') ||
    '<span>—</span>';
  el('dalias').innerHTML =
    icon.aliases.map((a) => '<button type="button" class="tag" data-term="' + a + '">' + a + '</button>').join('') ||
    '<span>—</span>';
  el('dimport').textContent = 'import { ' + icon.component + ' } from "@qeetrix/icons";';
  el('dusage').textContent = '<' + icon.component + ' size={20} aria-hidden="true" />';
  el('dcname').textContent = icon.component;
  el('d').showModal();
  writeHash(icon.name);
  el('dclose').focus();
}

function close() {
  el('d').close();
}

el('d').addEventListener('close', () => {
  writeHash('');
  if (lastFocus && lastFocus.isConnected) lastFocus.focus();
});

// ── copy ──────────────────────────────────────────────────────────────────
async function copy(button, text) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied';
  } catch {
    // file:// and insecure origins have no clipboard. Select the text so the
    // developer can still copy it, rather than silently doing nothing.
    const pre = button.previousElementSibling;
    if (pre) {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    button.textContent = 'Selected — press ⌘C';
  }
  el('live').textContent = button.textContent;
  setTimeout(() => { button.textContent = original; }, 1600);
}

// ── events ────────────────────────────────────────────────────────────────
el('grid').addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const icon = ICONS.find((i) => i.name === cell.dataset.name);
  if (icon) open(icon);
});

el('d').addEventListener('click', (e) => {
  const copyTarget = e.target.closest('[data-copy]');
  if (copyTarget) {
    copy(copyTarget, el(copyTarget.dataset.copy).textContent);
    return;
  }
  const term = e.target.closest('[data-term]');
  if (term) {
    el('q').value = term.dataset.term;
    close();
    render();
  }
});

el('dclose').addEventListener('click', close);

for (const id of ['q', 'cat', 'pri', 'size']) {
  el(id).addEventListener('input', () => render());
}
el('view').addEventListener('click', () => { listView = !listView; syncToggles(); render(); });
el('mirror').addEventListener('click', () => { mirrorOnly = !mirrorOnly; syncToggles(); render(); });
el('bg').addEventListener('click', () => { darkPreview = !darkPreview; syncToggles(); render(); });
el('reset').addEventListener('click', () => {
  el('q').value = '';
  el('cat').value = '';
  el('pri').value = '';
  el('size').value = '24';
  listView = false; mirrorOnly = false; darkPreview = false;
  syncToggles(); render(); el('q').focus();
});

// The slash key focuses search, the convention every developer tool uses.
// Escape inside the dialog is handled natively by <dialog>.
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== el('q') && !el('d').open) {
    e.preventDefault();
    el('q').focus();
    el('q').select();
  }
});

// Arrow keys move between cells. Every cell is a real <button>, so Tab, Enter
// and Space already work without any help.
el('grid').addEventListener('keydown', (e) => {
  if (!e.key.startsWith('Arrow')) return;
  const cells = [...el('grid').querySelectorAll('.cell')];
  const at = cells.indexOf(document.activeElement);
  if (at < 0) return;
  const perRow = listView
    ? 1
    : Math.max(1, Math.round(el('grid').clientWidth / (cells[0].parentElement.offsetWidth || 1)));
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: perRow, ArrowUp: -perRow }[e.key];
  if (step === undefined) return;
  const next = cells[at + step];
  if (next) { e.preventDefault(); next.focus(); }
});

window.addEventListener('hashchange', () => {
  const wanted = readHash();
  render();
  if (wanted) {
    const icon = ICONS.find((i) => i.name === wanted);
    if (icon && !el('d').open) open(icon);
  } else if (el('d').open) {
    close();
  }
});

// ── boot ──────────────────────────────────────────────────────────────────
el('mirrorcount').textContent = ICONS.filter((i) => i.mirror).length;
const deepLinked = readHash();
render();
if (deepLinked) {
  const icon = ICONS.find((i) => i.name === deepLinked);
  if (icon) open(icon);
}
</script>
</body>
</html>
`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "index.html"), html());
writeFileSync(join(OUT, "contact-sheet.svg"), contactSheet());
writeFileSync(join(OUT, "small-sizes.svg"), smallSizeSheet());

console.log(`✔ generated .explorer/index.html (${icons.length} icons)`);
console.log("✔ generated .explorer/contact-sheet.svg");
console.log("✔ generated .explorer/small-sizes.svg");
console.log("\n  open .explorer/index.html");
