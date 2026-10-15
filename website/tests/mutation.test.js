/* Mutation check: inject known bugs into a COPY of the engine and confirm the
   unit and random suites catch every one. Proves the tests can fail.
   Run: node tests/mutation.test.js */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const T = require('./lib/tally')('mutation');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');
const MUTANTS = [
  ['no ε-closure after a move', 'const cl = closure(nfa, mv.set);', 'const cl = mv.set;'],
  ['start state without ε-closure', 'const startSet = closure(nfa, [nfa.start]);', 'const startSet = [nfa.start];'],
  ['accepting needs ALL states accepting', 'accept: set.some((q) => acc.has(q))', 'accept: set.length > 0 && set.every((q) => acc.has(q))'],
  ['dead state accepts', 'accept: set.some((q) => acc.has(q))', 'accept: set.length === 0 || set.some((q) => acc.has(q))'],
  ['move ignores all but the first state', 'const parts = set.map((q) =>', 'const parts = set.slice(0, 1).map((q) =>'],
  ['closure stops after one ε-step', 'if (!seen.has(r)) { seen.add(r); stack.push(r); }', 'if (!seen.has(r)) { seen.add(r); }'],
  ['parser drops the second target', 'row[t.sym] = order(nfa, [...(row[t.sym] || []), ...t.dests]);', 'row[t.sym] = order(nfa, [...(row[t.sym] || []), ...t.dests.slice(0, 1)]);'],
  ['parser keeps only the last line per state/symbol', 'row[t.sym] = order(nfa, [...(row[t.sym] || []), ...t.dests]);', 'row[t.sym] = order(nfa, [...t.dests]);'],
  ['parser silently adds undeclared symbols to Σ', "if (t.sym !== EPS && !nfa.alphabet.includes(t.sym)) { errors.push(", "if (t.sym !== EPS && !nfa.alphabet.includes(t.sym)) { nfa.alphabet.push(t.sym); } if (false) { errors.push("],
  ['parser guesses Σ when the Alphabet line is missing', "if (!seen.alphabet) errors.push(", "if (!seen.alphabet) nfa.alphabet = [...new Set(trans.map((t) => t.sym).filter((x) => x !== EPS))]; if (false) errors.push("],
  ['serializer drops symbols outside Σ', 'for (const a of [...nfa.alphabet, ...extra, EPS])', 'for (const a of [...nfa.alphabet, EPS])'],
  ['DFA alphabet gains a default 0/1', 'alphabet: [...nfa.alphabet], start: A.id', "alphabet: [...new Set([...nfa.alphabet, '0', '1'])], start: A.id"],
  ['dead state added even when unreachable', "trace.push({ type: 'done'", "if (!byKey.has('')) intro([]); trace.push({ type: 'done'"]
];
for (const [name, from, to] of MUTANTS) {
  if (!src.includes(from)) { T.ok(`mutant “${name}” applies`, false, 'pattern not found'); continue; }
  const file = path.join(os.tmpdir(), `engine-mutant-${MUTANTS.findIndex((m) => m[0] === name)}.js`);
  fs.writeFileSync(file, src.replace(from, to));
  const env = { ...process.env, ENGINE: file, SEEDS: '1', COUNT: '120', NO_RESULTS: '1' };
  const u = spawnSync('node', [path.join(__dirname, 'unit.test.js')], { env, encoding: 'utf8' });
  const r = spawnSync('node', [path.join(__dirname, 'random.test.js')], { env, encoding: 'utf8' });
  T.ok(`mutant “${name}” is caught`, u.status !== 0 || r.status !== 0, { unit: u.status, random: r.status });
  fs.unlinkSync(file);
}
T.done({ mutants: MUTANTS.length });
