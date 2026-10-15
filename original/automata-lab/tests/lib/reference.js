/* Independent reference implementation (test oracle).
   Written separately from js/engine.js and deliberately uses different
   methods, so one bug cannot hide in both:
     - NFAs are plain transition LISTS [src, sym, dst], never the engine's maps.
     - ε-closure is a naive fixpoint over the whole list (engine: DFS stack).
     - NFA acceptance is a path search over (state, position) configurations,
       following one move at a time (engine: set simulation with closures).
     - Subset construction keys sets by sorted name strings (engine: state order).
   Nothing here imports production code. */
'use strict';

const EPS = 'ε';
const key = (set) => [...set].sort().join('\u0002');
const sortSet = (set) => [...new Set(set)].sort();

/* ε-closure by fixpoint iteration: keep sweeping all ε-edges until nothing changes. */
function epsClosure(spec, set) {
  const out = new Set(set);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [s, a, d] of spec.trans) if (a === EPS && out.has(s) && !out.has(d)) { out.add(d); changed = true; }
  }
  return sortSet(out);
}

/* NFA acceptance by explicit search over configurations (state, i). */
function nfaAccepts(spec, word) {
  const w = [...word];
  const acc = new Set(spec.accept);
  const seen = new Set(), stack = [[spec.start, 0]];
  while (stack.length) {
    const [q, i] = stack.pop();
    const k = q + '\u0003' + i;
    if (seen.has(k)) continue;
    seen.add(k);
    if (i === w.length && acc.has(q)) return true;
    for (const [s, a, d] of spec.trans) {
      if (s !== q) continue;
      if (a === EPS) stack.push([d, i]);
      else if (i < w.length && a === w[i]) stack.push([d, i + 1]);
    }
  }
  return false;
}

/* The set of states the NFA can be in after each prefix (for checking the
   tester's "NFA could be in" column). Uses closure + one symbol at a time. */
function nfaSets(spec, word) {
  let cur = epsClosure(spec, [spec.start]);
  const sets = [cur];
  for (const ch of word) {
    const moved = spec.trans.filter(([s, a]) => a === ch && cur.includes(s)).map(([, , d]) => d);
    cur = epsClosure(spec, moved);
    sets.push(cur);
  }
  return sets;
}

/* Reference subset construction. Returns sets keyed by key(set). */
function subsetConstruction(spec) {
  const start = epsClosure(spec, [spec.start]);
  const states = new Map([[key(start), start]]);
  const delta = new Map();
  const todo = [start];
  let guard = 0;
  while (todo.length) {
    if (++guard > 100000) throw new Error('reference construction did not terminate');
    const S = todo.shift(), kS = key(S);
    const row = new Map();
    for (const x of spec.alphabet) {
      const U = spec.trans.filter(([s, a]) => a === x && S.includes(s)).map(([, , d]) => d);
      const T = epsClosure(spec, U), kT = key(T);
      if (!states.has(kT)) { states.set(kT, T); todo.push(T); }
      row.set(x, kT);
    }
    delta.set(kS, row);
  }
  const acc = new Set(spec.accept);
  const accepting = new Set([...states].filter(([, set]) => set.some((q) => acc.has(q))).map(([k]) => k));
  return { startKey: key(start), states, delta, accepting };
}

function dfaAccepts(ref, word) {
  let k = ref.startKey;
  for (const ch of word) {
    const row = ref.delta.get(k);
    if (!row || !row.has(ch)) throw new Error(`reference DFA has no move on ${ch}`);
    k = row.get(ch);
  }
  return ref.accepting.has(k);
}

/* All strings over the alphabet up to length L (inclusive), shortest first. */
function allStrings(alphabet, L) {
  const out = [''];
  let layer = [''];
  for (let n = 1; n <= L; n++) { layer = layer.flatMap((p) => alphabet.map((a) => p + a)); out.push(...layer); }
  return out;
}
/* Longest L (at least `min`) whose string count stays under `budget`. */
function exhaustiveLength(k, budget = 2000, min = 5, max = 12) {
  let L = 0, total = 1, pow = 1;
  while (L < max) { const next = total + pow * k; if (next > budget && L >= min) break; pow *= k; total = next; L++; }
  return L;
}

/* Compare the production engine's result with the reference, returning a
   list of human-readable differences (empty when they agree). */
function compareDFA(spec, prod, ref) {
  const diffs = [];
  const { dfa } = prod;
  const idSet = new Map(dfa.states.map((s) => [s.id, s.set]));
  const idKey = (id) => key(idSet.get(id));
  // identities: no two DFA states share a subset
  const keys = dfa.states.map((s) => key(s.set));
  if (new Set(keys).size !== keys.length) diffs.push('two DFA states stand for the same subset');
  const prodKeys = new Set(keys), refKeys = new Set(ref.states.keys());
  for (const k of refKeys) if (!prodKeys.has(k)) diffs.push(`missing reachable subset {${ref.states.get(k).join(',')}}`);
  for (const k of prodKeys) if (!refKeys.has(k)) diffs.push(`extra subset {${k.split('\u0002').join(',')}}`);
  if (idKey(dfa.start) !== ref.startKey) diffs.push(`start is {${idSet.get(dfa.start)}}, expected {${ref.states.get(ref.startKey)}}`);
  for (const s of dfa.states) {
    const k = key(s.set);
    if (s.accept !== ref.accepting.has(k)) diffs.push(`acceptance of {${s.set}} is ${s.accept}`);
    if (s.dead !== (s.set.length === 0)) diffs.push(`dead flag wrong on ${s.id}`);
    const row = dfa.delta[s.id] || {};
    const syms = Object.keys(row);
    if (syms.length !== spec.alphabet.length || spec.alphabet.some((a) => !(a in row))) diffs.push(`state ${s.id} is not complete over the alphabet`);
    for (const a of spec.alphabet) {
      if (!(a in row)) continue;
      if (!idSet.has(row[a])) { diffs.push(`δ(${s.id},${a}) points to unknown ${row[a]}`); continue; }
      const want = ref.delta.get(k) && ref.delta.get(k).get(a);
      if (idKey(row[a]) !== want) diffs.push(`δ({${s.set}},${a}) = {${idSet.get(row[a])}}, expected {${(ref.states.get(want) || []).join(',')}}`);
    }
  }
  return diffs;
}

/* Independent text writer for the lab's input format (used to type random
   NFAs into the parser/UI). `style` varies spacing, braces and ε spelling. */
function toText(spec, style = 0) {
  const sep = style % 3 === 0 ? ', ' : style % 3 === 1 ? ',' : ' , ';
  const epsWord = ['eps', 'ε', 'epsilon', 'λ'][style % 4];
  const lines = [`States: ${spec.states.join(sep)}`, `Alphabet: ${spec.alphabet.join(sep)}`, `Start: ${spec.start}`, `Accepting: ${spec.accept.join(sep)}`, 'Transitions:'];
  const groups = new Map();
  for (const [s, a, d] of spec.trans) { const k = s + '\u0001' + a; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); }
  for (const [k, ds] of groups) {
    const [s, a] = k.split('\u0001');
    const rhs = style % 2 ? `{${ds.join(sep)}}` : ds.join(sep);
    lines.push(`${s}${sep}${a === EPS ? epsWord : a} -> ${rhs}`);
  }
  if (style % 5 === 4) lines.splice(1, 0, '# a comment line');
  return lines.join('\n');
}

/* Normalise a parsed NFA (engine shape) to a comparable spec. */
function specOfParsed(nfa) {
  const trans = [];
  for (const [s, row] of Object.entries(nfa.delta)) for (const [a, ds] of Object.entries(row)) for (const d of ds) trans.push([s, a, d]);
  return { states: [...nfa.states], alphabet: [...nfa.alphabet], start: nfa.start, accept: [...nfa.accept], trans };
}
const transKey = (t) => t.join('\u0001');
function sameSpec(a, b) {
  const d = [];
  const eqList = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
  if (!eqList(a.states, b.states)) d.push(`states ${a.states} vs ${b.states}`);
  if (!eqList(a.alphabet, b.alphabet)) d.push(`alphabet ${a.alphabet} vs ${b.alphabet}`);
  if (a.start !== b.start) d.push(`start ${a.start} vs ${b.start}`);
  if (!eqList(sortSet(a.accept), sortSet(b.accept))) d.push(`accept ${a.accept} vs ${b.accept}`);
  const ta = new Set(a.trans.map(transKey)), tb = new Set(b.trans.map(transKey));
  for (const t of ta) if (!tb.has(t)) d.push(`missing transition ${t.split('\u0001').join(' ')}`);
  for (const t of tb) if (!ta.has(t)) d.push(`extra transition ${t.split('\u0001').join(' ')}`);
  return d;
}

module.exports = { EPS, key, sortSet, epsClosure, nfaAccepts, nfaSets, subsetConstruction, dfaAccepts, allStrings, exhaustiveLength, compareDFA, toText, specOfParsed, sameSpec };
