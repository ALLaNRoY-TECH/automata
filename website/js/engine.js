/* Automata Lab — conversion engine.
   Pure functions, no DOM. Everything the lab shows (diagrams, tables, steps,
   string tests) is derived from what these functions return.

     NFA = { id, label, source: 'demo'|'user', states: [ids], alphabet: [symbols],
             start: id, accept: [ids], delta: { [state]: { [symbol|'ε']: [ids] } },
             pos?: { [state]: {x, y} } }            // optional drawing positions
     DFA = { states: [{ id, set:[ids], accept, start, dead }], alphabet, start,
             delta: { [dfaId]: { [symbol]: dfaId } } }   // complete: every cell filled

     parseNFA(text)          -> { nfa, errors:[{line,msg}], warnings:[msg] }
     serializeNFA(nfa)       -> text in the same format
     subsetConstruction(nfa) -> { dfa, trace } or { error } when a safety limit is hit
     runNFA / runDFA         -> step-by-step runs for the string tester

   Safety limits (documented in the lab): LIMITS below. */

(function (global) {
  const EPS = 'ε';
  const EPS_WORDS = ['ε', 'eps', 'epsilon', 'λ', 'lambda'];
  const LIMITS = { states: 40, alphabet: 12, dfaStates: 256, nameLength: 12 };

  function order(nfa, set) {
    const idx = new Map(nfa.states.map((s, i) => [s, i]));
    return [...new Set(set)].sort((a, b) => idx.get(a) - idx.get(b));
  }

  function closure(nfa, set) {
    const seen = new Set(set), stack = [...set];
    while (stack.length) {
      const q = stack.pop();
      for (const r of (nfa.delta[q] && nfa.delta[q][EPS]) || []) {
        if (!seen.has(r)) { seen.add(r); stack.push(r); }
      }
    }
    return order(nfa, seen);
  }

  function move(nfa, set, a) {
    const parts = set.map((q) => ({ q, to: order(nfa, (nfa.delta[q] && nfa.delta[q][a]) || []) }));
    return { parts, set: order(nfa, parts.flatMap((p) => p.to)) };
  }

  const keyOf = (set) => set.join('\u0001');
  const hasEps = (nfa) => Object.values(nfa.delta).some((row) => row[EPS] && row[EPS].length);

  function reachable(nfa) {
    const seen = new Set([nfa.start]), q = [nfa.start];
    while (q.length) {
      const u = q.shift();
      for (const to of Object.values(nfa.delta[u] || {})) for (const v of to) if (!seen.has(v)) { seen.add(v); q.push(v); }
    }
    return seen;
  }

  function validate(nfa) {
    const errs = [];
    const S = new Set(nfa.states);
    if (!nfa.states.length) errs.push('Add at least one state.');
    if (nfa.states.length > LIMITS.states) errs.push(`Use at most ${LIMITS.states} states (you have ${nfa.states.length}).`);
    if (!nfa.alphabet.length) errs.push('Add at least one input symbol to the alphabet.');
    if (nfa.alphabet.length > LIMITS.alphabet) errs.push(`Use at most ${LIMITS.alphabet} input symbols.`);
    if (!nfa.start) errs.push('Choose a start state.');
    else if (!S.has(nfa.start)) errs.push(`The start state ${nfa.start} is not in the list of states.`);
    for (const f of nfa.accept) if (!S.has(f)) errs.push(`Accepting state ${f} is not in the list of states.`);
    for (const [q, row] of Object.entries(nfa.delta)) {
      if (!S.has(q)) { errs.push(`A transition starts at ${q}, which is not a state.`); continue; }
      for (const [a, to] of Object.entries(row)) {
        if (a !== EPS && !nfa.alphabet.includes(a)) errs.push(`The transition from ${q} uses “${a}”, which is not in the alphabet.`);
        for (const r of to) if (!S.has(r)) errs.push(`The transition from ${q} on ${a} goes to ${r}, which is not a state.`);
      }
    }
    return errs;
  }

  /* ---------- text format ----------
     States: q0, q1, q2
     Alphabet: 0, 1
     Start: q0
     Accepting: q2
     Transitions:
     q0, 0 -> q0, q1
     q1, eps -> q2        (ε, eps, epsilon or λ mean an empty move)
     q2, 1 -> ∅           (∅, - or {} mean "no transition"; you can also just omit the line) */
  const splitList = (s) => s.replace(/[{}]/g, ' ').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  /* Supported input format (enforced here and by the drawing editor):
     - state names: letters, ASCII digits, _ and ', at most LIMITS.nameLength
       characters; not one of the reserved words below (they mean ε or "no move").
       Subscript digits are not allowed, so q1 and q₁ can never be confused.
     - input symbols: exactly one character, not whitespace and not one of the
       format's punctuation characters, and not ε/λ. */
  const RESERVED = ['none', 'empty', '∅', ...EPS_WORDS];
  const NAME_RE = /^[\p{L}0-9_']+$/u;
  const BAD_SYMBOLS = [',', ';', '{', '}', '(', ')', '#', '∅', '-', '>', '→', ':', '"'];
  const nameProblem = (n) => {
    if (!n) return 'A state needs a name.';
    if (RESERVED.includes(n.toLowerCase())) return `“${n}” is a reserved word (it means ε or “no move”), so it can't be a state name.`;
    if (!NAME_RE.test(n)) return `“${n}” is not a usable state name. Use letters, digits, _ or ' only.`;
    if ([...n].length > LIMITS.nameLength) return `State name “${n}” is longer than ${LIMITS.nameLength} characters.`;
    return null;
  };
  const symbolProblem = (a) => {
    if (EPS_WORDS.includes(a.toLowerCase())) return 'ε is not an input symbol. Leave it out of the alphabet; use it only in transitions.';
    if ([...a].length !== 1) return `Alphabet symbols must be single characters, so test strings can be read one symbol at a time. “${a}” is not.`;
    if (/\s/u.test(a) || BAD_SYMBOLS.includes(a)) return `“${a}” can't be an input symbol because the format uses it. Pick a letter or digit.`;
    return null;
  };

  function parseNFA(text) {
    const errors = [], warnings = [];
    const nfa = { id: 'user', label: 'Your NFA', source: 'user', states: [], alphabet: [], start: '', accept: [], delta: {} };
    let seen = { states: false, alphabet: false, start: false, accept: false };
    const trans = [];
    String(text).split(/\r?\n/).forEach((raw, i) => {
      const line = /^\s*#/.test(raw) ? '' : raw.trim(); // a comment is a whole line starting with #
      const ln = i + 1;
      if (!line) return;
      const head = line.match(/^([A-Za-zΣδ₀ ]+?)\s*:\s*(.*)$/);
      const key = head && head[1].trim().toLowerCase();
      if (head && !/->|→/.test(line)) {
        const val = head[2];
        const field = ['states', 'state', 'q'].includes(key) ? 'states' : ['alphabet', 'sigma', 'σ', 'symbols', 'inputs'].includes(key) ? 'alphabet'
          : ['start', 'initial', 'start state', 'q0', 'q₀'].includes(key) ? 'start' : ['accepting', 'accept', 'final', 'finals', 'f', 'accepting states', 'final states'].includes(key) ? 'accept' : null;
        if (field && seen[field]) { errors.push({ line: ln, msg: `Line ${ln}: “${head[1].trim()}” is given twice. Keep one line for it.` }); return; }
        if (['states', 'state', 'q'].includes(key)) { nfa.states = splitList(val); seen.states = true; }
        else if (['alphabet', 'sigma', 'σ', 'symbols', 'inputs'].includes(key)) { nfa.alphabet = splitList(val); seen.alphabet = true; }
        else if (['start', 'initial', 'start state', 'q0', 'q₀'].includes(key)) { nfa.start = splitList(val)[0] || ''; seen.start = true; if (splitList(val).length > 1) errors.push({ line: ln, msg: 'An NFA has exactly one start state. Use an ε-transition to reach more.' }); }
        else if (['accepting', 'accept', 'final', 'finals', 'f', 'accepting states', 'final states'].includes(key)) { nfa.accept = splitList(val); seen.accept = true; }
        else if (['transitions', 'transition', 'delta', 'δ'].includes(key)) { if (val.trim()) errors.push({ line: ln, msg: 'Put each transition on its own line under “Transitions:”.' }); }
        else errors.push({ line: ln, msg: `I don't recognise “${head[1].trim()}”. Use States, Alphabet, Start, Accepting or Transitions.` });
        return;
      }
      const m = line.match(/^(.*?)\s*(?:->|→)\s*(.*)$/);
      if (!m) { errors.push({ line: ln, msg: `Line ${ln} is not a transition. Write it like “q0, 1 -> q1, q2”.` }); return; }
      const left = splitList(m[1]);
      if (left.length !== 2) { errors.push({ line: ln, msg: `Line ${ln}: the left side needs a state and one symbol, like “q0, 1”.` }); return; }
      let [src, sym] = left;
      if (EPS_WORDS.includes(sym.toLowerCase())) sym = EPS;
      if (!m[2].trim()) { errors.push({ line: ln, msg: `Line ${ln}: nothing after the arrow. Name the target states, or write ∅ for “no move”.` }); return; }
      const dests = splitList(m[2]).filter((d) => !['∅', '-', 'none', 'empty', '{}'].includes(d.toLowerCase()));
      trans.push({ ln, src, sym, dests });
    });

    if (!seen.states) errors.push({ line: 0, msg: 'Missing a “States:” line.' });
    if (!seen.alphabet) errors.push({ line: 0, msg: 'Missing an “Alphabet:” line.' });
    if (!seen.start) errors.push({ line: 0, msg: 'Missing a “Start:” line.' });
    if (!seen.accept) warnings.push('No “Accepting:” line, so the NFA accepts nothing.');

    const dupS = nfa.states.filter((s, i) => nfa.states.indexOf(s) !== i);
    if (dupS.length) errors.push({ line: 0, msg: `State ${dupS[0]} is listed twice.` });
    nfa.states = [...new Set(nfa.states)];
    for (const s of nfa.states) { const pr = nameProblem(s); if (pr) errors.push({ line: 0, msg: pr }); }
    const dupA = nfa.alphabet.filter((a, i) => nfa.alphabet.indexOf(a) !== i);
    if (dupA.length) warnings.push(`Symbol ${dupA[0]} is listed twice in the alphabet; it is used once.`);
    nfa.alphabet = [...new Set(nfa.alphabet)];
    for (const a of nfa.alphabet) { const pr = symbolProblem(a); if (pr && !errors.some((e) => e.msg === pr)) errors.push({ line: 0, msg: pr }); }
    nfa.accept = [...new Set(nfa.accept)];
    const S = new Set(nfa.states);
    let dupT = null;
    for (const t of trans) {
      if (!S.has(t.src)) { errors.push({ line: t.ln, msg: `Line ${t.ln}: ${t.src} is not in States.` }); continue; }
      if (t.sym !== EPS && !nfa.alphabet.includes(t.sym)) { errors.push({ line: t.ln, msg: `Line ${t.ln}: “${t.sym}” is not in the alphabet.` }); continue; }
      const bad = t.dests.filter((d) => !S.has(d));
      if (bad.length) { errors.push({ line: t.ln, msg: `Line ${t.ln}: ${bad.join(', ')} ${bad.length > 1 ? 'are' : 'is'} not in States.` }); continue; }
      const row = nfa.delta[t.src] || (nfa.delta[t.src] = {});
      const again = t.dests.find((d, k) => (row[t.sym] || []).includes(d) || t.dests.indexOf(d) !== k);
      if (again && !dupT) dupT = `Line ${t.ln}: ${t.src} on ${t.sym === EPS ? 'ε' : t.sym} → ${again} appears more than once. A transition set counts it once.`;
      row[t.sym] = order(nfa, [...(row[t.sym] || []), ...t.dests]);
      if (!row[t.sym].length) delete row[t.sym];
    }
    if (dupT) warnings.push(dupT);
    if (seen.accept && !nfa.accept.length) warnings.push('No accepting states, so the NFA (and its DFA) accepts no strings.');
    for (const msg of validate(nfa)) if (!errors.some((e) => e.msg === msg)) errors.push({ line: 0, msg });
    if (!errors.length) {
      const r = reachable(nfa);
      const un = nfa.states.filter((s) => !r.has(s));
      if (un.length) warnings.push(`${un.join(', ')} cannot be reached from ${nfa.start}. ${un.length > 1 ? 'They are' : 'It is'} kept in the NFA but will not appear in any DFA state.`);
    }
    return { nfa, errors, warnings };
  }

  function serializeNFA(nfa) {
    const lines = [`States: ${nfa.states.join(', ')}`, `Alphabet: ${nfa.alphabet.join(', ')}`, `Start: ${nfa.start || ''}`, `Accepting: ${nfa.accept.join(', ')}`, 'Transitions:'];
    for (const q of nfa.states) {
      const row = nfa.delta[q] || {};
      // symbols outside Σ are written out too, never dropped, so the parser reports them instead of losing them
      const extra = Object.keys(row).filter((a) => a !== EPS && !nfa.alphabet.includes(a));
      for (const a of [...nfa.alphabet, ...extra, EPS]) if (row[a] && row[a].length) lines.push(`${q}, ${a === EPS ? 'eps' : a} -> ${row[a].join(', ')}`);
    }
    return lines.join('\n');
  }

  function clone(nfa) { return JSON.parse(JSON.stringify(nfa)); }

  function subsetConstruction(nfa) {
    const acc = new Set(nfa.accept);
    const states = [], byKey = new Map(), queue = [], marked = [], trace = [];
    const delta = {};
    let named = 0;

    function intro(set) {
      const id = set.length === 0 ? '∅' : (named < 26 ? String.fromCharCode(65 + named) : `S${named}`);
      if (set.length) named++;
      const st = { id, set, accept: set.some((q) => acc.has(q)), start: states.length === 0, dead: set.length === 0 };
      states.push(st); byKey.set(keyOf(set), st); queue.push(st); delta[id] = {};
      return st;
    }

    const startSet = closure(nfa, [nfa.start]);
    const A = intro(startSet);
    trace.push({ type: 'init', base: [nfa.start], closureSet: startSet, to: A.id, isNew: true, accept: A.accept,
      queue: queue.map((s) => s.id), marked: [], states: states.map((s) => s.id) });

    while (queue.length) {
      const S = queue.shift();
      marked.push(S.id);
      for (const a of nfa.alphabet) {
        const mv = move(nfa, S.set, a);
        const cl = closure(nfa, mv.set);
        let T = byKey.get(keyOf(cl)), isNew = false;
        if (!T) {
          if (states.length >= LIMITS.dfaStates) {
            return { error: `The DFA grew past ${LIMITS.dfaStates} states, so the lab stopped to keep your browser responsive. Subset construction can need up to 2^n states; try a smaller NFA.` };
          }
          T = intro(cl); isNew = true;
        }
        delta[S.id][a] = T.id;
        trace.push({ type: 'step', from: S.id, fromSet: S.set, symbol: a, parts: mv.parts,
          moveSet: mv.set, closureSet: cl, to: T.id, isNew, accept: T.accept, dead: T.dead,
          queue: queue.map((s) => s.id), marked: [...marked], states: states.map((s) => s.id) });
      }
    }
    trace.push({ type: 'done', queue: [], marked: [...marked], states: states.map((s) => s.id) });
    return { dfa: { states, alphabet: [...nfa.alphabet], start: A.id, delta }, trace };
  }

  function runDFA(dfa, word) {
    const path = [dfa.start];
    let cur = dfa.start;
    for (const ch of word) { cur = dfa.delta[cur][ch]; path.push(cur); }
    const st = dfa.states.find((s) => s.id === cur);
    return { path, accepted: !!(st && st.accept) };
  }

  function runNFA(nfa, word) {
    let cur = closure(nfa, [nfa.start]);
    const sets = [cur];
    for (const ch of word) { cur = closure(nfa, move(nfa, cur, ch).set); sets.push(cur); }
    return { sets, accepted: cur.some((q) => nfa.accept.includes(q)) };
  }

  /* Example automata. N₁ is the guided demonstration; the others are presets
     for the builder, each chosen to exercise one feature. */
  const SAMPLES = {
    n1: {
      id: 'n1', label: 'N₁', source: 'demo', title: 'Second-to-last symbol is 1',
      language: 'binary strings whose second-to-last symbol is 1',
      states: ['q0', 'q1', 'q2'], alphabet: ['0', '1'], start: 'q0', accept: ['q2'],
      delta: { q0: { 0: ['q0'], 1: ['q0', 'q1'] }, q1: { 0: ['q2'], 1: ['q2'] }, q2: {} },
      tests: ['', '1', '10', '11', '01', '0110', '1101', '100']
    }
  };
  const PRESETS = [
    { id: 'brief', title: 'Contains 01, then anything', note: 'nondeterministic, missing transitions',
      text: 'States: q0, q1, q2\nAlphabet: 0, 1\nStart: q0\nAccepting: q2\nTransitions:\nq0, 0 -> q0, q1\nq0, 1 -> q0\nq1, 1 -> q2\nq2, 0 -> q2\nq2, 1 -> q2' },
    { id: 'n1', title: 'Second-to-last symbol is 1', note: 'textbook classic', text: null },
    { id: 'eps', title: 'a*b*c* with ε-moves', note: 'ε-NFA',
      text: 'States: p, q, r\nAlphabet: a, b, c\nStart: p\nAccepting: r\nTransitions:\np, a -> p\np, eps -> q\nq, b -> q\nq, eps -> r\nr, c -> r' },
    { id: 'dead', title: 'Starts with 01', note: 'needs the empty set ∅',
      text: 'States: s, t, u\nAlphabet: 0, 1\nStart: s\nAccepting: u\nTransitions:\ns, 0 -> t\nt, 1 -> u\nu, 0 -> u\nu, 1 -> u' },
    { id: 'det', title: 'Even number of 0s', note: 'already deterministic',
      text: 'States: even, odd\nAlphabet: 0, 1\nStart: even\nAccepting: even\nTransitions:\neven, 0 -> odd\neven, 1 -> even\nodd, 0 -> even\nodd, 1 -> odd' },
    { id: 'multi', title: 'Contains aa or bb', note: 'two accepting states, one unreachable state',
      text: 'States: s, a1, a2, b1, b2, x\nAlphabet: a, b\nStart: s\nAccepting: a2, b2\nTransitions:\ns, a -> s, a1\ns, b -> s, b1\na1, a -> a2\nb1, b -> b2\na2, a -> a2\na2, b -> a2\nb2, a -> b2\nb2, b -> b2\nx, a -> s' }
  ];
  PRESETS.find((p) => p.id === 'n1').text = serializeNFA(SAMPLES.n1);

  global.AL = global.AL || {};
  global.AL.Engine = { version: '0.3', EPS, EPS_WORDS, LIMITS, nameProblem, symbolProblem, closure, move, validate, parseNFA, serializeNFA, clone, hasEps, reachable, subsetConstruction, runDFA, runNFA };
  global.AL.SAMPLES = SAMPLES;
  global.AL.PRESETS = PRESETS;
})(typeof window !== 'undefined' ? window : globalThis);
