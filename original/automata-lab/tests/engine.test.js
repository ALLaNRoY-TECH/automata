/* Run with: node tests/engine.test.js
   Checks the engine on presets and hand-written NFAs. For each machine it
   compares NFA and DFA acceptance on every string up to a length bound, and
   also against an independent brute-force NFA search. */
globalThis.window = globalThis;
require('../js/engine.js');
const { Engine, SAMPLES, PRESETS } = window.AL;
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };

// independent simulator: depth-first search over (state, position), following ε freely
function brute(nfa, w) {
  const seen = new Set();
  const go = (q, i) => {
    const k = q + '@' + i; if (seen.has(k)) return false; seen.add(k);
    if (i === w.length && nfa.accept.includes(q)) return true;
    const row = nfa.delta[q] || {};
    for (const r of row['ε'] || []) if (go(r, i)) return true;
    if (i < w.length) for (const r of row[w[i]] || []) if (go(r, i + 1)) return true;
    return false;
  };
  return go(nfa.start, 0);
}
function* words(alpha, max) { yield ''; let layer = ['']; for (let n = 1; n <= max; n++) { layer = layer.flatMap(p => alpha.map(a => p + a)); yield* layer; } }

function check(name, nfa, expect = {}) {
  const res = Engine.subsetConstruction(nfa);
  ok(!res.error, name + ' errored: ' + res.error);
  if (res.error) return;
  const { dfa, trace } = res;
  // complete and deterministic
  for (const s of dfa.states) for (const a of dfa.alphabet) ok(dfa.states.some(t => t.id === dfa.delta[s.id][a]), `${name}: missing δ'(${s.id},${a})`);
  // accept flags match sets
  for (const s of dfa.states) ok(s.accept === s.set.some(q => nfa.accept.includes(q)), `${name}: accept flag ${s.id}`);
  // unique subsets
  ok(new Set(dfa.states.map(s => s.set.join(','))).size === dfa.states.length, name + ': duplicate subsets');
  // trace covers every transition exactly once
  ok(trace.filter(t => t.type === 'step').length === dfa.states.length * dfa.alphabet.length, name + ': trace length');
  if (expect.states !== undefined) ok(dfa.states.length === expect.states, `${name}: expected ${expect.states} DFA states, got ${dfa.states.length}`);
  if (expect.dead !== undefined) ok(dfa.states.some(s => s.dead) === expect.dead, `${name}: dead state presence`);
  const max = dfa.alphabet.length <= 2 ? 10 : dfa.alphabet.length === 3 ? 7 : 5;
  let n = 0;
  for (const w of words(dfa.alphabet, max)) {
    const a = Engine.runNFA(nfa, w).accepted, b = Engine.runDFA(dfa, w).accepted, c = brute(nfa, w);
    n++; if (a !== b || a !== c) { ok(false, `${name}: disagree on "${w}" nfa=${a} dfa=${b} brute=${c}`); break; }
  }
  checks++;
  for (const [w, v] of Object.entries(expect.words || {})) ok(Engine.runDFA(dfa, w).accepted === v, `${name}: "${w}" should be ${v}`);
  console.log(`ok  ${name.padEnd(34)} NFA ${nfa.states.length} → DFA ${dfa.states.length} states, ${n} strings compared`);
}

check('sample N1', SAMPLES.n1, { states: 4, dead: false, words: { '': false, '10': true, '0110': true, '1101': false } });
for (const p of PRESETS) {
  const r = Engine.parseNFA(p.text);
  ok(!r.errors.length, p.id + ' parse: ' + JSON.stringify(r.errors));
  check('preset ' + p.id, r.nfa);
}
const P = (t) => Engine.parseNFA(t);
check('eps: empty string via ε', P('States: a,b\nAlphabet: x\nStart: a\nAccepting: b\nTransitions:\na, eps -> b').nfa, { words: { '': true, x: false } });
check('eps chain + loop', P('States: 0,1,2,3\nAlphabet: a,b\nStart: 0\nAccepting: 3\nTransitions:\n0,eps->1\n1,eps->2\n2,eps->0\n2,a->3\n3,eps->1\n1,b->1').nfa);
check('dead state required', P(PRESETS.find(p => p.id === 'dead').text).nfa, { dead: true, words: { '01': true, '1': false, '0101': true } });
check('deterministic stays same size', P(PRESETS.find(p => p.id === 'det').text).nfa, { states: 2 });
check('no accepting states', P('States: a\nAlphabet: 0\nStart: a\nAccepting:\nTransitions:\na,0->a').nfa, { words: { '': false, '000': false } });
check('no transitions at all', P('States: a\nAlphabet: 0,1\nStart: a\nAccepting: a\nTransitions:').nfa, { states: 2, dead: true, words: { '': true, '0': false } });
check('blowup (n-th from last is 1, n=5)', (() => {
  let t = 'States: ' + [0,1,2,3,4,5].map(i => 'q' + i).join(',') + '\nAlphabet: 0,1\nStart: q0\nAccepting: q5\nTransitions:\nq0,0->q0\nq0,1->q0,q1\n';
  for (let i = 1; i < 5; i++) t += `q${i},0->q${i+1}\nq${i},1->q${i+1}\n`;
  return P(t).nfa;
})(), { states: 32 });
check('multi-char state names, symbols', P('States: start, mid_1, END\nAlphabet: x, y, z\nStart: start\nAccepting: END, mid_1\nTransitions:\nstart, x -> mid_1, END\nmid_1, y -> start\nEND, z -> END, start').nfa);
check('braces and ∅ in input', P('States: {a, b}\nAlphabet: {0,1}\nStart: a\nAccepting: b\nTransitions:\na, 0 -> {a, b}\na, 1 -> ∅\nb, 1 -> -').nfa);

// invalid inputs must produce errors, never a DFA
const bad = {
  'missing states': 'Alphabet: 0\nStart: a\nAccepting: a',
  'unknown start': 'States: a\nAlphabet: 0\nStart: z\nAccepting: a',
  'unknown dest': 'States: a\nAlphabet: 0\nStart: a\nAccepting: a\nTransitions:\na,0->b',
  'symbol not in alphabet': 'States: a\nAlphabet: 0\nStart: a\nAccepting: a\nTransitions:\na,2->a',
  'eps in alphabet': 'States: a\nAlphabet: 0, eps\nStart: a\nAccepting: a',
  'multi-char symbol': 'States: a\nAlphabet: ab\nStart: a\nAccepting: a',
  'garbage line': 'States: a\nAlphabet: 0\nStart: a\nAccepting: a\nhello world',
  'two start states': 'States: a,b\nAlphabet: 0\nStart: a, b\nAccepting: a',
  'too many states': 'States: ' + Array.from({ length: 41 }, (_, i) => 's' + i).join(',') + '\nAlphabet: 0\nStart: s0\nAccepting: s0',
  'empty input': ''
};
for (const [k, t] of Object.entries(bad)) { const r = P(t); ok(r.errors.length > 0, 'should reject: ' + k); console.log(`ok  rejects ${k.padEnd(26)} → ${r.errors[0] && r.errors[0].msg}`); }
// warnings
ok(P(PRESETS.find(p => p.id === 'multi').text).warnings.some(w => w.includes('x')), 'unreachable warning');

// safety limit: n-th from last with n=9 needs 512 DFA states > 256
let t = 'States: ' + Array.from({ length: 10 }, (_, i) => 'q' + i).join(',') + '\nAlphabet: 0,1\nStart: q0\nAccepting: q9\nTransitions:\nq0,0->q0\nq0,1->q0,q1\n';
for (let i = 1; i < 9; i++) t += `q${i},0->q${i+1}\nq${i},1->q${i+1}\n`;
const big = Engine.subsetConstruction(P(t).nfa);
ok(!!big.error, 'limit should trigger'); console.log('ok  limit:', big.error && big.error.slice(0, 60) + '…');

// serialize round trip
for (const p of PRESETS) { const a = P(p.text).nfa, b = P(Engine.serializeNFA(a)).nfa; ok(Engine.serializeNFA(a) === Engine.serializeNFA(b) && Engine.subsetConstruction(a).dfa.states.length === Engine.subsetConstruction(b).dfa.states.length, 'roundtrip ' + p.id); }

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
