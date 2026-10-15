/* Runs the whole suite in order and exits non-zero if anything fails.
     npm test            (from automata-lab/)
     node tests/run-all.js --no-browser   skips the Playwright tests (reported as NOT RUN) */
'use strict';
const { spawnSync } = require('child_process'), path = require('path'), fs = require('fs');
const skipBrowser = process.argv.includes('--no-browser');
const SUITES = [
  ['legacy engine checks', 'engine.test.js'],
  ['unit + differential', 'unit.test.js'],
  ['randomized differential', 'random.test.js'],
  ['mutation check', 'mutation.test.js'],
  ['end-to-end browser', 'e2e.test.js', true]
];
let failed = 0;
const rows = [];
for (const [name, file, browser] of SUITES) {
  if (browser && skipBrowser) { rows.push([name, 'NOT RUN']); continue; }
  const r = spawnSync('node', [path.join(__dirname, file)], { stdio: 'inherit', env: process.env });
  const ok = r.status === 0;
  if (!ok) failed++;
  rows.push([name, ok ? 'passed' : `FAILED (exit ${r.status})`]);
}
console.log('\n==== Automata Lab test suite ====');
for (const [n, s] of rows) console.log(`${n.padEnd(26)} ${s}`);
const dir = path.join(__dirname, 'results');
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) { const j = JSON.parse(fs.readFileSync(path.join(dir, f))); console.log(`  ${j.name.padEnd(10)} ${j.pass} checks passed, ${j.fail} failed`); }
process.exit(failed ? 1 : 0);
