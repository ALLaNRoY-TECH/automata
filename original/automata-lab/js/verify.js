/* Automata Lab — independent verifier.
   Checks a finished conversion before the lab shows it as complete. It shares
   no code with engine.js: it reads the typed text itself, computes ε-closures
   by fixpoint over a flat edge list, rebuilds the subset construction with its
   own keys, and decides acceptance by searching NFA paths. Runs in the browser
   and in Node.

     verifyConversion(text, nfa, dfa) -> { ok, checks: [{ id, name, ok, detail }], stats }

   Invariants (numbered as in the project brief):
     1 input integrity      2 alphabet integrity   3 subset correctness
     4 transition correctness  5 accepting states  6 completeness
     7 dead state           9 language equivalence
   8 (diagram = table) is checked on the drawn page by the app, and
   10 (nothing changes the result later) by fingerprint(). */

(function (global) {
  const EPS_IN = ['ε', 'eps', 'epsilon', 'λ', 'lambda'];
  const NO_MOVE = ['∅', '-', 'none', 'empty', '{}'];
  const HEADS = {
    states: ['states', 'state', 'q'], alphabet: ['alphabet', 'sigma', 'σ', 'symbols', 'inputs'],
    start: ['start', 'initial', 'start state', 'q0', 'q₀'],
    accept: ['accepting', 'accept', 'final', 'finals', 'f', 'accepting states', 'final states']
  };
  const items = (s) => s.split(/[\s,;{}]+/).filter((x) => x.length);
  const sorted = (a) => [...new Set(a)].sort();
  const setKey = (a) => JSON.stringify(sorted(a));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* A deliberately separate reading of the text format. */
  function readText(text) {
    const out = { states: [], alphabet: [], start: '', accept: [], edges: [] };
    for (const raw of String(text).split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const arrow = line.includes('->') ? '->' : line.includes('→') ? '→' : null;
      if (arrow) {
        const at = line.indexOf(arrow);
        const [src, sym] = items(line.slice(0, at));
        const s = EPS_IN.includes(String(sym).toLowerCase()) ? 'ε' : sym;
        for (const d of items(line.slice(at + arrow.length))) if (!NO_MOVE.includes(d.toLowerCase())) out.edges.push([src, s, d]);
        continue;
      }
      const c = line.indexOf(':'); if (c < 0) continue;
      const head = line.slice(0, c).trim().toLowerCase(), val = line.slice(c + 1);
      if (HEADS.states.includes(head)) out.states = items(val);
      else if (HEADS.alphabet.includes(head)) out.alphabet = items(val);
      else if (HEADS.start.includes(head)) out.start = items(val)[0] || '';
      else if (HEADS.accept.includes(head)) out.accept = items(val);
    }
    return out;
  }

  function edgesOf(nfa) {
    const e = [];
    for (const q of Object.keys(nfa.delta)) for (const a of Object.keys(nfa.delta[q])) for (const r of nfa.delta[q][a]) e.push([q, a, r]);
    return e;
  }
  function closure(edges, set) {
    let cur = new Set(set), grew = true;
    while (grew) { grew = false; for (const [p, a, r] of edges) if (a === 'ε' && cur.has(p) && !cur.has(r)) { cur.add(r); grew = true; } }
    return sorted([...cur]);
  }
  const step = (edges, set, x) => closure(edges, edges.filter(([p, a]) => a === x && set.includes(p)).map((t) => t[2]));

  /* NFA acceptance by depth-first search over (state, position) configurations. */
  function nfaAccepts(edges, start, acc, w) {
    const seen = new Set(), stack = [[start, 0]];
    while (stack.length) {
      const [q, i] = stack.pop(), k = q + '\u0000' + i;
      if (seen.has(k)) continue; seen.add(k);
      if (i === w.length && acc.has(q)) return true;
      for (const [p, a, r] of edges) if (p === q) { if (a === 'ε') stack.push([r, i]); else if (i < w.length && a === w[i]) stack.push([r, i + 1]); }
    }
    return false;
  }

  function verifyConversion(text, nfa, dfa) {
    const checks = [];
    const add = (id, name, problems) => checks.push({ id, name, ok: !problems.length, detail: problems.slice(0, 8) });
    const stats = { subsets: 0, transitions: 0, strings: 0, length: 0 };

    // 1. input integrity: the NFA used is exactly what the text says
    const t = readText(text), p1 = [];
    if (!same(t.states, nfa.states)) p1.push(`states: text has {${t.states}}, NFA has {${nfa.states}}`);
    if (t.start !== nfa.start) p1.push(`start: text has ${t.start}, NFA has ${nfa.start}`);
    if (!same(sorted(t.accept), sorted(nfa.accept))) p1.push(`accepting: text has {${t.accept}}, NFA has {${nfa.accept}}`);
    const tE = sorted(t.edges.map((e) => e.join(' '))), nE = sorted(edgesOf(nfa).map((e) => e.join(' ')));
    if (!same(tE, nE)) p1.push(`transitions differ: only in text [${tE.filter((x) => !nE.includes(x)).join('; ')}], only in NFA [${nE.filter((x) => !tE.includes(x)).join('; ')}]`);
    add(1, 'Input integrity: states, start, accepting states and transitions match the input', p1);

    // 2. alphabet integrity
    const p2 = [];
    if (!same(sorted(t.alphabet), nfa.alphabet.slice().sort()) || new Set(t.alphabet).size !== nfa.alphabet.length) p2.push(`text declares {${t.alphabet}}, NFA uses {${nfa.alphabet}}`);
    if (!same(dfa.alphabet, nfa.alphabet)) p2.push(`DFA alphabet {${dfa.alphabet}} is not the NFA alphabet {${nfa.alphabet}}`);
    for (const [, a] of edgesOf(nfa)) if (a !== 'ε' && !nfa.alphabet.includes(a)) p2.push(`transition symbol ${a} is not declared`);
    add(2, 'Alphabet integrity: nothing added, removed or inherited', p2);

    // independent subset construction
    const E = edgesOf(nfa), sigma = nfa.alphabet;
    const startSet = closure(E, [nfa.start]);
    const ref = new Map([[setKey(startSet), startSet]]), refDelta = new Map(), todo = [startSet];
    while (todo.length) {
      const S = todo.shift(), row = {};
      for (const x of sigma) {
        const T = step(E, S, x), k = setKey(T); row[x] = k;
        if (!ref.has(k)) { ref.set(k, T); todo.push(T); }
      }
      refDelta.set(setKey(S), row);
      if (ref.size > 4096) break;
    }
    stats.subsets = ref.size;

    // 3. subsets: a one-to-one match between DFA states and reachable subsets
    const p3 = [], idToKey = new Map(), keyToId = new Map();
    for (const s of dfa.states) {
      const k = setKey(s.set);
      if (idToKey.has(s.id)) p3.push(`state name ${s.id} is used twice`);
      if (keyToId.has(k)) p3.push(`subset ${k} appears as both ${keyToId.get(k)} and ${s.id}`);
      idToKey.set(s.id, k); keyToId.set(k, s.id);
      if (!ref.has(k)) p3.push(`${s.id} = ${k} is not a reachable subset`);
    }
    for (const k of ref.keys()) if (!keyToId.has(k)) p3.push(`reachable subset ${k} is missing from the DFA`);
    const startState = dfa.states.find((s) => s.id === dfa.start);
    if (!startState || setKey(startState.set) !== setKey(startSet)) p3.push(`start state should be ε-closure({${nfa.start}}) = ${setKey(startSet)}`);
    if (dfa.states.filter((s) => s.start).length !== 1 || !(startState && startState.start)) p3.push('exactly one state must be marked as the start');
    add(3, 'Subset correctness: each DFA state is a correct, distinct reachable subset', p3);

    // 4 + 6. transitions and completeness
    const p4 = [], p6 = [];
    for (const s of dfa.states) {
      const row = dfa.delta[s.id] || {}, keys = Object.keys(row);
      if (keys.length !== sigma.length || !sigma.every((x) => keys.includes(x))) p6.push(`${s.id} has moves on {${keys}}, expected exactly {${sigma}}`);
      const want = refDelta.get(idToKey.get(s.id));
      for (const x of sigma) {
        stats.transitions++;
        if (!idToKey.has(row[x])) { p6.push(`δ(${s.id}, ${x}) = ${row[x]} is not a DFA state`); continue; }
        if (want && idToKey.get(row[x]) !== want[x]) p4.push(`δ(${s.id}, ${x}) = ${row[x]} ${idToKey.get(row[x])}, should be ${want[x]}`);
      }
    }
    add(4, 'Transition correctness: every move is the ε-closure of the union of NFA moves', p4);

    // 5. accepting iff the subset contains an accepting NFA state
    const acc = new Set(nfa.accept), p5 = [];
    for (const s of dfa.states) { const want = s.set.some((q) => acc.has(q)); if (!!s.accept !== want) p5.push(`${s.id} ${setKey(s.set)} is marked ${s.accept ? '' : 'not '}accepting`); }
    add(5, 'Accepting states: accepting exactly when the subset contains a state of F', p5);
    add(6, 'Completeness: one move per state per declared symbol', p6);

    // 7. dead state only when reachable, loops to itself, never accepting
    const p7 = [], dead = dfa.states.filter((s) => s.dead || s.set.length === 0);
    const deadReachable = ref.has('[]');
    if (deadReachable && dead.length !== 1) p7.push('∅ is reachable but not shown exactly once');
    if (!deadReachable && dead.length) p7.push('∅ is shown but no move reaches it');
    for (const d of dead) {
      if (d.set.length) p7.push(`${d.id} is marked dead but is not empty`);
      if (d.accept) p7.push('∅ is marked accepting');
      for (const x of sigma) if ((dfa.delta[d.id] || {})[x] !== d.id) p7.push(`∅ on ${x} should loop to ∅`);
    }
    add(7, 'Dead state: ∅ only when reachable, looping on every symbol', p7);

    // 9. language: every string up to a length, NFA path search vs DFA run
    const p9 = [];
    let L = 0, count = 1;
    while (L < 12 && count * sigma.length <= 3000 / Math.max(1, nfa.states.length / 4)) { L++; count *= sigma.length; }
    stats.length = L;
    let layer = [''];
    for (let len = 0; len <= L && p9.length < 5; len++) {
      for (const w of layer) {
        let cur = dfa.start;
        for (const ch of w) cur = (dfa.delta[cur] || {})[ch];
        const st = dfa.states.find((s) => s.id === cur);
        const d = !!(st && st.accept), n = nfaAccepts(E, nfa.start, acc, w);
        stats.strings++;
        if (d !== n) { p9.push(`“${w}”: NFA ${n ? 'accepts' : 'rejects'}, DFA ${d ? 'accepts' : 'rejects'}`); if (p9.length >= 5) break; }
      }
      if (len < L) layer = layer.flatMap((w) => sigma.map((x) => w + x));
    }
    add(9, `Language equivalence: NFA and DFA agree on every string up to length ${L}`, p9);

    return { ok: checks.every((c) => c.ok), checks, stats };
  }

  /* 10: a fingerprint of the computed result; it must not change while the result is shown. */
  const fingerprint = (nfa, dfa) => JSON.stringify([nfa.states, nfa.alphabet, nfa.start, nfa.accept, nfa.delta, dfa.states, dfa.alphabet, dfa.start, dfa.delta]);

  global.AL = global.AL || {};
  global.AL.Verify = { verifyConversion, fingerprint, readText };
})(typeof window !== 'undefined' ? window : globalThis);
