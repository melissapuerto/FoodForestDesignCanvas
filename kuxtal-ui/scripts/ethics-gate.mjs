#!/usr/bin/env node
/**
 * Release ethics-gate — a NAMED, automated walk of ETHICAL_CONSTRAINTS.md before
 * tagging a release. Fails (exit 1) if a hard constraint is violated. The full
 * gate (including the manual items this can't check) is docs/RELEASE_ETHICS_GATE.md.
 *
 * Run: npm run ethics-gate
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

let failed = 0;
const results = [];
function check(id, label, ok, detail = '') {
  results.push({ id, label, ok, detail });
  if (!ok) failed++;
}
function read(p) { try { return readFileSync(p, 'utf8'); } catch { return ''; } }
function grepSrc(re) {
  try {
    return execSync(`grep -rInE ${JSON.stringify(re)} src 2>/dev/null || true`, { encoding: 'utf8' }).trim();
  } catch { return ''; }
}

const pkg = JSON.parse(read('package.json') || '{}');
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const depNames = Object.keys(deps).join(' ');

// R5 — no generative-AI components (deps or code)
const AI = /(^|[@/\s])(openai|anthropic|langchain|cohere|replicate|@?google[^\s]*genai|gpt-?[0-9]|llama|huggingface|@xenova)/i;
check('R5a', 'No generative-AI runtime/dev dependency', !AI.test(depNames), depNames.match(AI)?.[0]);
const aiCode = grepSrc('chat\\.completions|generateText\\(|openai|anthropic\\.messages|new OpenAI');
check('R5b', 'No generative-AI calls in src/', aiCode === '', aiCode.split('\n')[0]);

// R1 — no telemetry / analytics / engagement beacons
const tel = grepSrc('google-analytics|googletagmanager|gtag\\(|mixpanel|posthog|amplitude|segment\\.(io|com)|hotjar|fullstory|sentry|sendBeacon');
check('R1', 'No telemetry / analytics / tracking beacons in src/', tel === '', tel.split('\n')[0]);

// R6 — FOSS licence present and copyleft
const lic = read('LICENSE');
check('R6a', 'LICENSE present and AGPL', /AGPL/i.test(lic));
check('R6b', 'package.json license is AGPL-3.0-only', /AGPL-3\.0/i.test(pkg.license || ''), pkg.license || '(none)');

// R10 / Code of Conduct present in repo AND in-app
check('CoC1', 'CODE_OF_CONDUCT.md present', existsSync('CODE_OF_CONDUCT.md'));
const es = read('src/lib/i18n/es.ts'); const en = read('src/lib/i18n/en.ts');
check('CoC2', 'In-app Code of Conduct text present (es + en)',
  /comm_coc_text/.test(es) && /comm_coc_text/.test(en));

// Process docs that make the refusals auditable
for (const f of ['ETHICAL_CONSTRAINTS.md', 'DECISIONS.md', 'ENERGY.md', 'SIMPLIFICATION_PATH.md', 'FEEDBACK_LOOP.md', 'MAINTENANCE.md']) {
  check('doc', `Process doc present: ${f}`, existsSync(f));
}

// R11 — the bundle budget script exists (its pass/fail is a separate CI gate)
check('R11', 'Bundle-budget gate present (scripts/budget.mjs)', existsSync('scripts/budget.mjs'));

// i18n parity signal (build enforces it via types; this is a fast smell check)
const esKeys = (es.match(/^\s{2}\w+:/gm) || []).length;
const enKeys = (en.match(/^\s{2}\w+:/gm) || []).length;
check('i18n', `ES/EN key counts close (${esKeys}/${enKeys})`, Math.abs(esKeys - enKeys) <= 2, `${esKeys} vs ${enKeys}`);

// ---- report ----
console.log('\n  Kuxtal — Release Ethics Gate\n  ' + '─'.repeat(40));
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'}  [${r.id}] ${r.label}${r.detail ? '  → ' + r.detail : ''}`);
}
console.log('  ' + '─'.repeat(40));
if (failed) {
  console.log(`  ✗ ${failed} constraint check(s) FAILED — do not tag this release.\n`);
  process.exit(1);
}
console.log('  ✓ All automated ethics-gate checks passed.');
console.log('  Now complete the manual items in docs/RELEASE_ETHICS_GATE.md before tagging.\n');
