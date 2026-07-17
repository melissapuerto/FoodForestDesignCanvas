// Bundle budget gate (ETHICAL_CONSTRAINTS.md R11): the 2G persona pays for
// every kilobyte, so the first-paint set is a hard limit, not a dashboard.
// Run after `npm run build`. Exits 1 when over budget — CI fails.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DIST = 'dist';
const ASSETS = join(DIST, 'assets');
const FIRST_PAINT_BUDGET = 100 * 1024; // gzipped bytes
const ENTRY_BUDGET = 50 * 1024;

const gz = (p) => gzipSync(readFileSync(p)).length;
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

// The entry script + stylesheet come from index.html; the app shell and the
// Svelte client are the two dynamic chunks fetched before anything renders.
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const entryJs = html.match(/src="\/assets\/(index-[^"]+\.js)"/)?.[1];
const entryCss = html.match(/href="\/assets\/(index-[^"]+\.css)"/)?.[1];
if (!entryJs) {
  console.error('budget: could not find the entry chunk in dist/index.html');
  process.exit(1);
}

const files = readdirSync(ASSETS);
const appJs = files.find((f) => /^App-.*\.js$/.test(f));
const appCss = files.find((f) => /^App-.*\.css$/.test(f));
const client = files.find((f) => /^index-client-.*\.js$/.test(f));

const firstPaint = [entryJs, entryCss, appJs, appCss, client].filter(Boolean);
let total = 0;
console.log('First-paint set (gzipped):');
for (const f of firstPaint) {
  const size = gz(join(ASSETS, f));
  total += size;
  console.log(`  ${kb(size).padStart(9)}  ${f}`);
}
const entrySize = gz(join(ASSETS, entryJs));
console.log(`  ${'-'.repeat(30)}\n  ${kb(total).padStart(9)}  total (budget ${kb(FIRST_PAINT_BUDGET)})`);

// Context, not gated: the whole dist so growth elsewhere stays visible.
const allJs = files.filter((f) => f.endsWith('.js'));
const allTotal = allJs.reduce((a, f) => a + gz(join(ASSETS, f)), 0);
console.log(`\nAll JS chunks: ${allJs.length} files, ${kb(allTotal)} gzipped total`);
console.log(`dist/: ${kb(dirSize(DIST))} raw (includes WASM + precache)`);

function dirSize(dir) {
  let n = 0;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    n += st.isDirectory() ? dirSize(p) : st.size;
  }
  return n;
}

let failed = false;
if (entrySize > ENTRY_BUDGET) {
  console.error(`\n✗ entry chunk ${kb(entrySize)} exceeds ${kb(ENTRY_BUDGET)}`);
  failed = true;
}
if (total > FIRST_PAINT_BUDGET) {
  console.error(`\n✗ first-paint set ${kb(total)} exceeds ${kb(FIRST_PAINT_BUDGET)}`);
  failed = true;
}
if (failed) process.exit(1);
console.log('\n✓ within budget');
