/* Tiny assertion tally shared by the test files. Prints failures, writes a
   JSON summary to tests/results/<name>.json and exits non-zero on failure. */
'use strict';
const fs = require('fs'), path = require('path');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

module.exports = function tally(name) {
  let pass = 0, fail = 0;
  const failures = [], notes = [];
  const record = (label, ok, detail, quiet) => {
    if (ok) { pass++; if (!quiet && process.env.VERBOSE) console.log('  ok  ' + label); return true; }
    fail++; failures.push({ label, detail });
    console.log('  FAIL ' + label + (detail !== undefined ? '\n       ' + JSON.stringify(detail).slice(0, 600) : ''));
    return false;
  };
  return {
    ok: (label, cond, detail, opts = {}) => record(label, !!cond, cond ? undefined : detail, opts.quiet),
    eq: (label, got, want, opts = {}) => record(label, same(got, want), same(got, want) ? undefined : { got, want }, opts.quiet),
    note: (s) => { notes.push(s); console.log('  · ' + s); },
    get counts() { return { pass, fail }; },
    done(extra = {}) {
      console.log(`\n${name}: ${pass} passed, ${fail} failed`);
      process.exitCode = fail ? 1 : 0;
      if (process.env.NO_RESULTS) return; // mutation runs must not overwrite real results
      const dir = path.join(__dirname, '..', 'results');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ name, pass, fail, failures, notes, ...extra, at: new Date().toISOString() }, null, 2));
    }
  };
};
