/* Randomized differential tests: random small NFAs (with ε-moves, odd state
   names, digits and letters as symbols) are written as text, parsed by the
   production parser, converted by the production engine, and compared with
   the independent reference on subsets, transitions, acceptance and every
   string up to a length. Seeds are fixed so any failure can be replayed:
     node tests/random.test.js            (default seeds 1..5, 200 NFAs each)
     SEEDS=42 COUNT=1000 node tests/random.test.js
   A failing NFA is shrunk (transitions/states removed while it still fails)
   and printed so it can be added to tests/lib/cases.js as a regression. */
'use strict';
require(process.env.ENGINE || '../js/engine.js');
require('../js/verify.js');
const { Engine, Verify } = globalThis.AL;
const R = require('./lib/reference');
const T = require('./lib/tally')('random');

const SEEDS = (process.env.SEEDS || '1,2,3,4,5').split(',').map(Number);
const COUNT = +(process.env.COUNT || 200);

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const NAME_POOL = ['q0', 'q1', 'q2', 'q3', 'q10', 'start', 'final', 'state_A', 'A', 'B', 'x1', 'dead', 'acc', '0', '1', 'a', "p'", 'S'];
const SYM_POOL = ['0', '1', '2', 'a', 'b', 'c', 'x', 'y', 'z'];

function randomNFA(rnd) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const n = 1 + Math.floor(rnd() * 6), k = 1 + Math.floor(rnd() * 3);
  const states = shuffle(NAME_POOL).slice(0, n), alphabet = shuffle(SYM_POOL).slice(0, k);
  const density = .15 + rnd() * .45, epsRate = rnd() < .5 ? 0 : rnd() * .3;
  const trans = [];
  for (const s of states) {
    for (const a of alphabet) for (const d of states) if (rnd() < density / Math.max(1, n / 2)) trans.push([s, a, d]);
    for (const d of states) if (rnd() < epsRate / Math.max(1, n / 2)) trans.push([s, 'ε', d]);
  }
  return { states, alphabet, start: pick(states), accept: states.filter(() => rnd() < .35), trans };
}

function check(spec, style) {
  const text = R.toText(spec, style);
  const parsed = Engine.parseNFA(text);
  if (parsed.errors.length) return [`parse errors: ${parsed.errors.map((e) => e.msg).join('; ')}`];
  const d0 = R.sameSpec(spec, R.specOfParsed(parsed.nfa));
  if (d0.length) return d0.map((x) => 'parse: ' + x);
  const back = Engine.parseNFA(Engine.serializeNFA(parsed.nfa));
  if (back.errors.length || R.sameSpec(spec, R.specOfParsed(back.nfa)).length) return ['serialize → parse changed the NFA'];
  const prod = Engine.subsetConstruction(parsed.nfa);
  if (prod.error) return [`engine error: ${prod.error}`];
  const ref = R.subsetConstruction(spec);
  const diffs = R.compareDFA(spec, prod, ref);
  if (diffs.length) return diffs;
  const v = Verify.verifyConversion(text, parsed.nfa, prod.dfa);
  if (!v.ok) return ['in-app verifier: ' + v.checks.filter((k) => !k.ok).map((k) => k.id + ' ' + k.detail[0]).join(' | ')];
  const L = R.exhaustiveLength(spec.alphabet.length, 400, 5, 10);
  for (const w of R.allStrings(spec.alphabet, L)) {
    const want = R.nfaAccepts(spec, w);
    if (Engine.runDFA(prod.dfa, w).accepted !== want) return [`DFA disagrees on "${w}" (expected ${want})`];
    if (Engine.runNFA(parsed.nfa, w).accepted !== want) return [`engine NFA disagrees on "${w}"`];
    stats.strings++;
  }
  return [];
}

function shrink(spec, style) {
  let cur = spec, changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < cur.trans.length; i++) {
      const cand = { ...cur, trans: cur.trans.filter((_, j) => j !== i) };
      if (check(cand, style).length) { cur = cand; changed = true; break; }
    }
    if (changed) continue;
    for (const q of cur.states) {
      if (q === cur.start) continue;
      const cand = { ...cur, states: cur.states.filter((s) => s !== q), accept: cur.accept.filter((s) => s !== q), trans: cur.trans.filter(([s, , d]) => s !== q && d !== q) };
      if (check(cand, style).length) { cur = cand; changed = true; break; }
    }
  }
  return cur;
}

const stats = { nfas: 0, withEps: 0, strings: 0, dfaStates: 0, maxDfa: 0 };
for (const seed of SEEDS) {
  const rnd = mulberry32(seed);
  let failed = 0;
  for (let i = 0; i < COUNT; i++) {
    const spec = randomNFA(rnd), style = i % 5;
    stats.nfas++;
    if (spec.trans.some((t) => t[1] === 'ε')) stats.withEps++;
    const diffs = check(spec, style);
    if (diffs.length) {
      failed++;
      const small = shrink(spec, style);
      T.ok(`seed ${seed} #${i}`, false, { diffs: check(small, style), minimal: R.toText(small, 0) });
    } else {
      const n = Engine.subsetConstruction(Engine.parseNFA(R.toText(spec, style)).nfa).dfa.states.length;
      stats.dfaStates += n; stats.maxDfa = Math.max(stats.maxDfa, n);
      T.ok(`seed ${seed} #${i}`, true, null, { quiet: true });
    }
  }
  T.note(`seed ${seed}: ${COUNT} random NFAs, ${failed} failed`);
}
T.note(`${stats.nfas} NFAs (${stats.withEps} with ε-moves), ${stats.strings} string checks, DFA sizes up to ${stats.maxDfa} states`);
T.done({ seeds: SEEDS, count: COUNT, ...stats });
