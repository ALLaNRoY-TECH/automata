/* Unit + differential tests: the production engine (js/engine.js) against the
   independent reference (tests/lib/reference.js) and hand-computed facts.
   Run: node tests/unit.test.js        (exit code 1 on any failure) */
'use strict';
require(process.env.ENGINE || '../js/engine.js');
require('../js/verify.js');
const { Engine, Verify } = globalThis.AL;
const R = require('./lib/reference');
const { CASES, INVALID } = require('./lib/cases');
const T = require('./lib/tally')('unit');

/* ---- 1. reference self-checks on tiny hand cases (the oracle must be right) ---- */
{
  const s = { states: ['a', 'b', 'c'], alphabet: ['x'], start: 'a', accept: ['c'], trans: [['a', 'ε', 'b'], ['b', 'ε', 'c'], ['c', 'ε', 'a'], ['a', 'x', 'a']] };
  T.eq('ref closure follows an ε-cycle', R.epsClosure(s, ['a']), ['a', 'b', 'c']);
  T.eq('ref closure of empty set', R.epsClosure(s, []), []);
  T.ok('ref NFA accepts ε via ε-chain', R.nfaAccepts(s, ''));
  T.ok('ref NFA accepts x', R.nfaAccepts(s, 'x'));
  T.ok('ref NFA rejects symbol outside Σ', !R.nfaAccepts(s, 'y'));
  const ref = R.subsetConstruction(s);
  T.eq('ref subset construction of ε-cycle has 1 state', ref.states.size, 1);
}

/* ---- 2. ε-closure: engine vs reference on every case, every subset of states (≤ 6 states) ---- */
for (const c of CASES) {
  const nfa = Engine.parseNFA(c.text || R.toText(c.spec)).nfa;
  const n = c.spec.states.length;
  if (n > 6) continue;
  for (let m = 0; m < 1 << n; m++) {
    const set = c.spec.states.filter((_, i) => m & (1 << i));
    T.eq(`${c.id} closure {${set}}`, R.sortSet(Engine.closure(nfa, set)), R.epsClosure(c.spec, set), { quiet: true });
  }
}

/* ---- 3. parsing: typed text → exactly the intended NFA ---- */
for (const c of CASES) {
  for (const style of c.text ? [-1] : [0, 1, 2, 3, 4]) {
    const text = style < 0 ? c.text : R.toText(c.spec, style);
    const r = Engine.parseNFA(text);
    T.eq(`${c.id} parses without errors (style ${style})`, r.errors.map((e) => e.msg), []);
    T.eq(`${c.id} parsed NFA equals spec (style ${style})`, R.sameSpec(c.spec, R.specOfParsed(r.nfa)), []);
  }
}
/* duplicate transitions are merged and reported, not double-counted */
{
  const r = Engine.parseNFA(CASES.find((c) => c.id === 'F3').text);
  T.ok('F3 duplicate transitions produce a note', r.warnings.some((w) => /more than once/.test(w)));
}

/* ---- 4. malformed input is rejected with a clear message ---- */
for (const x of INVALID) {
  const r = Engine.parseNFA(x.text);
  T.ok(`${x.id} ${x.title}: rejected`, r.errors.length > 0, r.errors);
  T.ok(`${x.id} ${x.title}: message mentions “${x.err}”`, r.errors.some((e) => e.msg.includes(x.err)), r.errors.map((e) => e.msg));
}
{
  const many = 'States: ' + Array.from({ length: 41 }, (_, i) => 's' + i).join(', ') + '\nAlphabet: a\nStart: s0\nAccepting:\nTransitions:';
  T.ok('41 states are rejected (limit 40)', Engine.parseNFA(many).errors.some((e) => /at most 40/.test(e.msg)));
}

/* ---- 4b. the input is never silently changed ---- */
{
  // each parse is independent: no alphabet, state or transition carries over from an earlier problem
  const texts = CASES.map((c) => R.toText(c.spec));
  const solo = texts.map((t) => Engine.parseNFA(t).nfa);
  const bad = [];
  for (let round = 0; round < 3; round++) texts.forEach((t, i) => {
    const again = Engine.parseNFA(t).nfa;
    if (JSON.stringify(again) !== JSON.stringify(solo[i])) bad.push(CASES[i].id);
    const res = Engine.subsetConstruction(again);
    if (res.dfa.alphabet.join('\u0001') !== CASES[i].spec.alphabet.join('\u0001')) bad.push(CASES[i].id + ' DFA Σ');
  });
  T.eq('parsing 30 problems back to back, 3 rounds: each result depends only on its own text', bad, []);
  T.ok('every DFA alphabet is exactly the declared Σ, in order', CASES.every((c) => Engine.subsetConstruction(Engine.parseNFA(R.toText(c.spec)).nfa).dfa.alphabet.join('\u0001') === c.spec.alphabet.join('\u0001')));
  // serialize → parse round trip keeps the exact meaning (the drawing editor relies on it)
  T.eq('serialize then parse returns the same NFA for all 30 cases', CASES.filter((c) => {
    const n = Engine.parseNFA(R.toText(c.spec)).nfa, back = Engine.parseNFA(Engine.serializeNFA(n));
    return back.errors.length || R.sameSpec(c.spec, R.specOfParsed(back.nfa)).length;
  }).map((c) => c.id), []);
  // a transition on a symbol outside Σ is never dropped silently: it is written out and then rejected
  const n = Engine.parseNFA('States: p, q\nAlphabet: a\nStart: p\nAccepting: q\nTransitions:\np, a -> q').nfa;
  n.delta.p.z = ['q'];
  const txt = Engine.serializeNFA(n);
  T.ok('serializer keeps a transition whose symbol is outside Σ', /^p, z -> q$/m.test(txt), txt);
  T.ok('…and the parser then rejects it with a message', Engine.parseNFA(txt).errors.some((e) => /“z” is not in the alphabet/.test(e.msg)));
  // an unused symbol of Σ is kept, and its moves go to ∅ in the complete DFA
  const u = Engine.subsetConstruction(Engine.parseNFA('States: p\nAlphabet: a, b\nStart: p\nAccepting: p\nTransitions:\np, a -> p').nfa).dfa;
  T.eq('unused symbol b stays in the DFA alphabet', u.alphabet, ['a', 'b']);
  T.ok('δ(A, b) = ∅ and ∅ loops on every symbol', u.delta.A.b === '∅' && u.delta['∅'].a === '∅' && u.delta['∅'].b === '∅');
  T.ok('∅ is never accepting', !u.states.find((s) => s.dead).accept);
  // no ∅ unless some move really reaches it
  const full = Engine.subsetConstruction(Engine.parseNFA('States: p\nAlphabet: a\nStart: p\nAccepting:\nTransitions:\np, a -> p').nfa).dfa;
  T.ok('no dead state when every move lands on a non-empty set', !full.states.some((s) => s.dead));
  // DFA labels come from discovery order, never from a fixed table
  const lbl = Engine.subsetConstruction(Engine.parseNFA(R.toText(CASES.find((c) => c.id === 'B5').spec)).nfa).dfa.states;
  T.ok('DFA state names are distinct and map to distinct subsets', new Set(lbl.map((s) => s.id)).size === lbl.length && new Set(lbl.map((s) => s.set.join())).size === lbl.length);
}

/* ---- 5. subset construction: engine vs reference, hand facts, trace, simulators ---- */
let strings = 0;
const distinct = new Set();
for (const c of CASES) {
  const nfa = Engine.parseNFA(c.text || R.toText(c.spec)).nfa;
  const prod = Engine.subsetConstruction(nfa), ref = R.subsetConstruction(c.spec);
  T.eq(`${c.id} ${c.title}: DFA equals reference`, R.compareDFA(c.spec, prod, ref), []);
  if (c.expect) {
    T.eq(`${c.id} hand count of DFA states`, prod.dfa.states.length, c.expect.dfaStates);
    T.eq(`${c.id} hand count of accepting DFA states`, prod.dfa.states.filter((s) => s.accept).length, c.expect.accepting);
    T.eq(`${c.id} hand: ∅ reachable`, prod.dfa.states.some((s) => s.dead), c.expect.dead);
  }
  // the trace: one init, |states|×|Σ| steps, one done; each step's result is the reference transition
  const { trace, dfa } = prod;
  T.eq(`${c.id} trace length`, trace.length, 2 + dfa.states.length * dfa.alphabet.length);
  const seen = new Set();
  let traceOk = true;
  for (const t of trace) {
    if (t.type === 'init') { seen.add(t.to); if (R.key(t.closureSet) !== ref.startKey) traceOk = false; }
    if (t.type === 'step') {
      const want = ref.delta.get(R.key(t.fromSet)).get(t.symbol);
      if (R.key(t.closureSet) !== want) traceOk = false;
      if (t.isNew === seen.has(t.to)) traceOk = false;
      seen.add(t.to);
    }
  }
  T.ok(`${c.id} every trace step matches the reference`, traceOk);
  // strings: exhaustive up to a length, plus engine simulators vs reference simulators and the language
  const L = R.exhaustiveLength(c.spec.alphabet.length);
  let bad = [];
  for (const w of R.allStrings(c.spec.alphabet, L)) {
    strings++; distinct.add(c.id + '|' + w);
    const nRef = R.nfaAccepts(c.spec, w), dRef = R.dfaAccepts(ref, w);
    const nProd = Engine.runNFA(nfa, w), dProd = Engine.runDFA(dfa, w);
    const sets = R.nfaSets(c.spec, w);
    if (nRef !== dRef) bad.push(`ref NFA/DFA disagree on "${w}"`);
    if (nProd.accepted !== nRef) bad.push(`engine NFA wrong on "${w}"`);
    if (dProd.accepted !== nRef) bad.push(`engine DFA wrong on "${w}"`);
    if (c.lang && c.lang(w) !== nRef) bad.push(`language predicate says ${c.lang(w)} on "${w}"`);
    if (nProd.sets.some((s, i) => R.key(s) !== R.key(sets[i]))) bad.push(`engine NFA state sets differ on "${w}"`);
    if (dProd.path.some((id, i) => R.key(dfa.states.find((s) => s.id === id).set) !== R.key(sets[i]))) bad.push(`DFA path sets differ on "${w}"`);
    if (bad.length > 5) break;
  }
  T.eq(`${c.id} all strings up to length ${L} agree (NFA, DFA, reference, language)`, bad, []);
}

/* ---- 5b. the in-app verifier: passes on every correct result, catches every kind of corruption ---- */
{
  const fails = [];
  for (const c of CASES) for (const style of c.text ? [-1] : [0, 1, 2, 3, 4]) {
    const text = style < 0 ? c.text : R.toText(c.spec, style);
    const nfa = Engine.parseNFA(text).nfa, v = Verify.verifyConversion(text, nfa, Engine.subsetConstruction(nfa).dfa);
    if (!v.ok) fails.push(`${c.id}/${style}: ` + v.checks.filter((k) => !k.ok).map((k) => k.id + ' ' + k.detail[0]).join(' | '));
  }
  T.eq('in-app verifier accepts every correct conversion (30 cases × all text styles)', fails, []);
  // fault injection: each corruption must be caught by the right invariant
  const base = (id) => { const c = CASES.find((x) => x.id === id), text = R.toText(c.spec), nfa = Engine.parseNFA(text).nfa; return { text, nfa, dfa: JSON.parse(JSON.stringify(Engine.subsetConstruction(nfa).dfa)) }; };
  const caught = (name, id, mutate, inv) => {
    const b = base(id); mutate(b);
    const v = Verify.verifyConversion(b.text, b.nfa, b.dfa);
    T.ok(`verifier catches: ${name}`, !v.ok && v.checks.some((k) => k.id === inv && !k.ok), v.checks.filter((k) => !k.ok).map((k) => k.id));
  };
  caught('an extra symbol in the DFA alphabet', 'A2', (b) => { b.dfa.alphabet.push('z'); }, 2);
  caught('a symbol inherited by the NFA', 'A2', (b) => { b.nfa.alphabet = [...b.nfa.alphabet, 'a']; }, 2);
  caught('a dropped NFA transition', 'B1', (b) => { const q = Object.keys(b.nfa.delta)[0]; const a = Object.keys(b.nfa.delta[q])[0]; b.nfa.delta[q][a] = b.nfa.delta[q][a].slice(1); }, 1);
  caught('a changed start state', 'B1', (b) => { b.nfa.start = b.nfa.states[1]; }, 1);
  caught('a wrong subset for a state', 'B5', (b) => { b.dfa.states[1].set = b.dfa.states[1].set.slice(1); }, 3);
  caught('a missing DFA state', 'B5', (b) => { const gone = b.dfa.states.pop(); delete b.dfa.delta[gone.id]; }, 3);
  caught('a wrong transition target', 'B5', (b) => { const s = b.dfa.states[0], a = b.dfa.alphabet[0]; b.dfa.delta[s.id][a] = b.dfa.states.find((x) => x.id !== b.dfa.delta[s.id][a]).id; }, 4);
  caught('a flipped accepting mark', 'B3', (b) => { b.dfa.states[0].accept = !b.dfa.states[0].accept; }, 5);
  caught('a missing move', 'C3', (b) => { delete b.dfa.delta[b.dfa.states[0].id][b.dfa.alphabet[0]]; }, 6);
  caught('an unneeded dead state', 'C4', (b) => { b.dfa.states.push({ id: '∅', set: [], accept: false, start: false, dead: true }); b.dfa.delta['∅'] = Object.fromEntries(b.dfa.alphabet.map((a) => [a, '∅'])); }, 7);
  caught('an accepting dead state', 'C3', (b) => { b.dfa.states.find((s) => s.dead).accept = true; }, 9);
  caught('a missing ε-closure in a transition', 'E1', (b) => { const s = b.dfa.states[0]; s.set = s.set.slice(0, 1); }, 3);
  const fp = (b) => Verify.fingerprint(b.nfa, b.dfa), b = base('B5'), f0 = fp(b);
  b.dfa.delta[b.dfa.start][b.dfa.alphabet[0]] = '∅';
  T.ok('the fingerprint changes when the result changes after verification', fp(b) !== f0);
}

/* ---- 6. DFA simulator: exactly one move per symbol ---- */
{
  const nfa = Engine.parseNFA(R.toText(CASES.find((c) => c.id === 'B5').spec)).nfa;
  const { dfa } = Engine.subsetConstruction(nfa);
  const run = Engine.runDFA(dfa, 'abba');
  T.eq('DFA path has one state per symbol plus start', run.path.length, 5);
  T.ok('every DFA path step is a real transition', run.path.every((id, i) => i === 0 || dfa.delta[run.path[i - 1]]['abba'[i - 1]] === id));
}

/* ---- 7. safety limit fires instead of freezing ---- */
{
  const n = 9, states = Array.from({ length: n + 1 }, (_, i) => 'q' + i);
  const trans = ['q0, a -> q0, q1', 'q0, b -> q0', ...states.slice(1, -1).map((q, i) => `${q}, a -> q${i + 2}\n${q}, b -> q${i + 2}`)];
  const text = `States: ${states.join(', ')}\nAlphabet: a, b\nStart: q0\nAccepting: q${n}\nTransitions:\n${trans.join('\n')}`;
  const res = Engine.subsetConstruction(Engine.parseNFA(text).nfa);
  T.ok('2^9 = 512 subsets trips the 256-state limit with a message', !!res.error);
}

T.note(`strings checked: ${strings} (${distinct.size} distinct case/string pairs) over ${CASES.length} hand-specified NFAs`);
T.done({ strings, nfas: CASES.length });
