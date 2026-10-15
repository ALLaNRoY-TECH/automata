/* Hand-specified test NFAs, written for this audit (not the lab's presets).
   Each case has:
     spec  — the intended NFA as a transition list ("src sym dst", ε for empty moves)
     text  — optional hand-typed input text; otherwise the test writes one
     lang  — optional predicate for the intended language, written from the
             English description (a third oracle, independent of both
             converters)
     expect — optional hand-computed facts about the DFA (number of reachable
             subsets, accepting count, whether ∅ is reachable). */
'use strict';
const E = 'ε';
function spec(states, alphabet, start, accept, trans) {
  return {
    states: states.split(/\s+/).filter(Boolean), alphabet: alphabet.split(/\s+/).filter(Boolean), start,
    accept: accept.split(/\s+/).filter(Boolean),
    trans: trans.split('|').map((t) => t.trim()).filter(Boolean).flatMap((t) => {
      const [s, a, ...ds] = t.split(/\s+/);
      return ds.map((d) => [s, a === 'eps' ? E : a, d]);
    })
  };
}

const CASES = [
  // A. simple deterministic automata
  { id: 'A1', cat: 'A', title: 'single state with a self-loop',
    spec: spec('s', 'a', 's', 's', 's a s'), lang: () => true, expect: { dfaStates: 1, accepting: 1, dead: false } },
  { id: 'A2', cat: 'A', title: 'two states, one accepting (ends in 1)',
    spec: spec('p q', '0 1', 'p', 'q', 'p 0 p | p 1 q | q 0 p | q 1 q'), lang: (w) => w.endsWith('1'), expect: { dfaStates: 2, accepting: 1, dead: false } },
  { id: 'A3', cat: 'A', title: 'no accepting states',
    spec: spec('p q', 'a b', 'p', '', 'p a q | q b p'), lang: () => false, expect: { dfaStates: 3, accepting: 0, dead: true } },
  { id: 'A4', cat: 'A', title: 'start state accepting (even number of a)',
    spec: spec('e o', 'a b', 'e', 'e', 'e a o | o a e | e b e | o b o'), lang: (w) => [...w].filter((c) => c === 'a').length % 2 === 0, expect: { dfaStates: 2, accepting: 1, dead: false } },
  // B. nondeterminism
  { id: 'B1', cat: 'B', title: 'two destinations on one symbol (ends in 01)',
    spec: spec('q0 q1 q2', '0 1', 'q0', 'q2', 'q0 0 q0 q1 | q0 1 q0 | q1 1 q2'), lang: (w) => w.endsWith('01'), expect: { dfaStates: 3, accepting: 1, dead: false } },
  { id: 'B2', cat: 'B', title: 'two paths reaching the same state (exactly ab)',
    spec: spec('s x y t', 'a b', 's', 't', 's a x y | x b t | y b t'), lang: (w) => w === 'ab', expect: { dfaStates: 4, accepting: 1, dead: true } },
  { id: 'B3', cat: 'B', title: 'two accepting states (contains aa or bb)',
    spec: spec('start a1 final_a b1 final_b', 'a b', 'start', 'final_a final_b',
      'start a start a1 | start b start b1 | a1 a final_a | b1 b final_b | final_a a final_a | final_a b final_a | final_b a final_b | final_b b final_b'),
    lang: (w) => w.includes('aa') || w.includes('bb') },
  { id: 'B4', cat: 'B', title: 'branches that merge (01 then 0*)',
    spec: spec('s l r m', '0 1', 's', 'm', 's 0 l r | l 1 m | r 1 m | m 0 m'), lang: (w) => /^010*$/.test(w), expect: { dfaStates: 4, accepting: 1, dead: true } },
  { id: 'B5', cat: 'B', title: 'cycle + nondeterminism (third from last is a)',
    spec: spec('q0 q1 q2 q3', 'a b', 'q0', 'q3', 'q0 a q0 q1 | q0 b q0 | q1 a q2 | q1 b q2 | q2 a q3 | q2 b q3'),
    lang: (w) => w.length >= 3 && w[w.length - 3] === 'a', expect: { dfaStates: 8, accepting: 4, dead: false } },
  // C. missing transitions and dead states
  { id: 'C1', cat: 'C', title: 'many missing transitions (exactly abc)',
    spec: spec('s t u v', 'a b c', 's', 'v', 's a t | t b u | u c v'), lang: (w) => w === 'abc', expect: { dfaStates: 5, accepting: 1, dead: true } },
  { id: 'C2', cat: 'C', title: 'one symbol never used (a+ over {a,b})',
    spec: spec('p q', 'a b', 'p', 'q', 'p a p q | q a q'), lang: (w) => /^a+$/.test(w), expect: { dfaStates: 3, accepting: 1, dead: true } },
  { id: 'C3', cat: 'C', title: 'empty subset reachable (starts with 1)',
    spec: spec('s f', '0 1', 's', 'f', 's 1 f | f 0 f | f 1 f'), lang: (w) => w.startsWith('1'), expect: { dfaStates: 3, accepting: 1, dead: true } },
  { id: 'C4', cat: 'C', title: 'empty subset never reached (contains 1)',
    spec: spec('s f', '0 1', 's', 'f', 's 0 s | s 1 s f | f 0 f | f 1 f'), lang: (w) => w.includes('1'), expect: { dfaStates: 2, accepting: 1, dead: false } },
  { id: 'C5', cat: 'C', title: 'accepting start + dead state must reject ((ab)*)',
    spec: spec('s t', 'a b', 's', 's', 's a t | t b s'), lang: (w) => /^(ab)*$/.test(w), expect: { dfaStates: 3, accepting: 1, dead: true } },
  // D. alphabets and names
  { id: 'D1', cat: 'D', title: 'single-symbol alphabet with ε (length divisible by 2 or 3)',
    spec: spec('s a0 a1 b0 b1 b2', 'x', 's', 'a0 b0', 's eps a0 b0 | a0 x a1 | a1 x a0 | b0 x b1 | b1 x b2 | b2 x b0'),
    lang: (w) => w.length % 2 === 0 || w.length % 3 === 0, expect: { dfaStates: 7, accepting: 5, dead: false } },
  { id: 'D2', cat: 'D', title: 'letters x y z (contains zy)',
    spec: spec('p q r', 'x y z', 'p', 'r', 'p x p | p y p | p z p q | q y r | r x r | r y r | r z r'), lang: (w) => w.includes('zy') },
  { id: 'D3', cat: 'D', title: 'digit alphabet 0-3 (a 0 somewhere before a final 3)',
    spec: spec('s t f', '0 1 2 3', 's', 'f', 's 0 s t | s 1 s | s 2 s | s 3 s | t 0 t | t 1 t | t 2 t | t 3 t f'),
    lang: (w) => w.endsWith('3') && w.slice(0, -1).includes('0') },
  { id: 'D4', cat: 'D', title: 'multi-character names start, state_A, q10, final',
    spec: spec('start state_A q10 final', 'a b', 'start', 'final', 'start a state_A | state_A b q10 | q10 a q10 | q10 b q10 final'),
    lang: (w) => /^ab[ab]*b$/.test(w) },
  { id: 'D5', cat: 'D', title: 'state names that look like symbols (0, 1, 10, a)',
    spec: spec('0 1 10 a', '0 1 a', '0', '10', '0 1 1 | 1 0 10 | 10 0 10 | 10 1 10 | 10 a 10 | 0 a a | a a a'),
    lang: (w) => w.startsWith('10') },
  // E. ε-transitions
  { id: 'E1', cat: 'E', title: 'simple ε (a*b*)',
    spec: spec('p q', 'a b', 'p', 'q', 'p a p | p eps q | q b q'), lang: (w) => /^a*b*$/.test(w), expect: { dfaStates: 3, accepting: 2, dead: true } },
  { id: 'E2', cat: 'E', title: 'consecutive ε from the start (c*)',
    spec: spec('s t u v', 'c', 's', 'v', 's eps t | t eps u | u eps v | v c v'), lang: () => true, expect: { dfaStates: 2, accepting: 2, dead: false } },
  { id: 'E3', cat: 'E', title: 'ε-cycle (a* b)',
    spec: spec('x y z w', 'a b', 'x', 'w', 'x eps y | y eps z | z eps x | x a y | z b w'), lang: (w) => /^a*b$/.test(w), expect: { dfaStates: 3, accepting: 1, dead: true } },
  { id: 'E4', cat: 'E', title: 'ε into an accepting state (exactly 0)',
    spec: spec('s t f', '0', 's', 'f', 's 0 t | t eps f'), lang: (w) => w === '0', expect: { dfaStates: 3, accepting: 1, dead: true } },
  { id: 'E5', cat: 'E', title: 'ε mixed with nondeterministic symbol moves',
    spec: spec('q0 q1 q2 q3', 'a b', 'q0', 'q3', 'q0 eps q1 | q1 a q1 q2 | q2 b q0 | q2 eps q3') },
  { id: 'E6', cat: 'E', title: 'Sipser-style ε-NFA (hand-computed: 6 DFA states, 2 accepting, ∅ reachable)',
    spec: spec('1 2 3', 'a b', '1', '1', '1 b 2 | 1 eps 3 | 2 a 2 3 | 2 b 3 | 3 a 1'), expect: { dfaStates: 6, accepting: 2, dead: true } },
  // F. edge cases
  { id: 'F1', cat: 'F', title: 'no transitions at all (only ε accepted)',
    spec: spec('p q', 'a', 'p', 'p', ''), lang: (w) => w === '', expect: { dfaStates: 2, accepting: 1, dead: true } },
  { id: 'F2', cat: 'F', title: 'disconnected state and unreachable accepting state',
    spec: spec('s t island', 'a b', 's', 't island', 's a t | island b island | island a s'), lang: (w) => w === 'a', expect: { dfaStates: 3, accepting: 1, dead: true } },
  { id: 'F3', cat: 'F', title: 'duplicate transitions typed twice (same as B1)',
    spec: spec('q0 q1 q2', '0 1', 'q0', 'q2', 'q0 0 q0 q1 | q0 1 q0 | q1 1 q2'), lang: (w) => w.endsWith('01'),
    text: 'States: q0, q1, q2\nAlphabet: 0, 1\nStart: q0\nAccepting: q2\nTransitions:\nq0, 0 -> q0, q1\nq0, 0 -> q1\nq0, 1 -> q0\nq0, 1 -> q0, q0\nq1, 1 -> q2' },
  { id: 'F4', cat: 'F', title: 'hand-typed with braces, ∅, λ and a comment',
    spec: spec('A B C', 'x y', 'A', 'C', 'A x A B | A eps C | B y C | C x C'),
    text: '# typed the way a student might\nstates: {A, B, C}\nalphabet: {x, y}\nstart: A\naccepting: {C}\ntransitions:\nA, x -> {A, B}\nA, λ -> C\nA, y -> ∅\nB, y -> C\nC, x -> {C}\nC, y -> -' },
  { id: 'F5', cat: 'F', title: 'everything accepting, ε and nondeterminism (sanity)',
    spec: spec('m n', '1 2', 'm', 'm n', 'm 1 m n | n 2 m | n eps m'), lang: (w) => !w.startsWith('2') && !w.includes('22') }
];

/* Inputs that must be REJECTED with a visible message (substring expected). */
const INVALID = [
  { id: 'X1', title: 'missing States line', text: 'Alphabet: a\nStart: p\nAccepting: p\nTransitions:', err: 'Missing a “States:” line' },
  { id: 'X2', title: 'empty state set', text: 'States:\nAlphabet: a\nStart: p\nAccepting:\nTransitions:', err: 'Add at least one state' },
  { id: 'X3', title: 'missing start state', text: 'States: p, q\nAlphabet: a\nAccepting: q\nTransitions:\np, a -> q', err: 'Missing a “Start:” line' },
  { id: 'X4', title: 'start not a state', text: 'States: p\nAlphabet: a\nStart: z\nAccepting: p\nTransitions:', err: 'start state z is not in the list' },
  { id: 'X5', title: 'undefined transition target', text: 'States: p\nAlphabet: a\nStart: p\nAccepting: p\nTransitions:\np, a -> ghost', err: 'ghost is not in States' },
  { id: 'X6', title: 'undefined transition source', text: 'States: p\nAlphabet: a\nStart: p\nAccepting: p\nTransitions:\nghost, a -> p', err: 'ghost is not in States' },
  { id: 'X7', title: 'symbol not in alphabet', text: 'States: p\nAlphabet: a\nStart: p\nAccepting: p\nTransitions:\np, b -> p', err: '“b” is not in the alphabet' },
  { id: 'X8', title: 'multi-character symbol', text: 'States: p\nAlphabet: ab\nStart: p\nAccepting: p\nTransitions:', err: 'single characters' },
  { id: 'X9', title: 'ε inside the alphabet', text: 'States: p\nAlphabet: a, eps\nStart: p\nAccepting: p\nTransitions:', err: 'ε is not an input symbol' },
  { id: 'X10', title: 'two start states', text: 'States: p, q\nAlphabet: a\nStart: p, q\nAccepting: p\nTransitions:', err: 'exactly one start state' },
  { id: 'X11', title: 'transition without an arrow', text: 'States: p\nAlphabet: a\nStart: p\nAccepting: p\nTransitions:\np a p', err: 'is not a transition' },
  { id: 'X12', title: 'left side missing the symbol', text: 'States: p\nAlphabet: a\nStart: p\nAccepting: p\nTransitions:\np -> p', err: 'needs a state and one symbol' },
  { id: 'X13', title: 'state listed twice', text: 'States: p, p\nAlphabet: a\nStart: p\nAccepting: p\nTransitions:', err: 'listed twice' },
  { id: 'X14', title: 'reserved word as a state name', text: 'States: p, none\nAlphabet: a\nStart: p\nAccepting: none\nTransitions:\np, a -> none', err: 'reserved word' },
  { id: 'X15', title: 'punctuation in a state name', text: 'States: q-1\nAlphabet: a\nStart: q-1\nAccepting: q-1\nTransitions:', err: 'not a usable state name' },
  { id: 'X16', title: '# as an input symbol', text: 'States: p\nAlphabet: a, #\nStart: p\nAccepting: p\nTransitions:', err: 'can\'t be an input symbol' },
  { id: 'X17', title: 'header given twice', text: 'States: p\nStates: q\nAlphabet: a\nStart: p\nAccepting: p\nTransitions:', err: 'given twice' },
  { id: 'X18', title: 'unknown header', text: 'States: p\nAlphabet: a\nBegin: p\nAccepting: p\nTransitions:', err: 'I don\'t recognise' },
  { id: 'X19', title: 'empty alphabet', text: 'States: p\nAlphabet:\nStart: p\nAccepting: p\nTransitions:', err: 'at least one input symbol' },
  { id: 'X20', title: 'accepting state not declared', text: 'States: p\nAlphabet: a\nStart: p\nAccepting: z\nTransitions:', err: 'Accepting state z is not in the list' },
  { id: 'X21', title: 'state name too long', text: 'States: averyveryverylongname\nAlphabet: a\nStart: averyveryverylongname\nAccepting:\nTransitions:', err: 'longer than 12' },
  { id: 'X22', title: 'completely empty input', text: '', err: 'Missing a “States:” line' },
  // regressions: each of these was silently accepted (and mis-parsed or ambiguous) before the audit
  { id: 'X23', title: 'subscript digit in a name (q1 vs q₁ would look identical)', text: 'States: q1, q₁\nAlphabet: a\nStart: q1\nAccepting: q₁\nTransitions:\nq1, a -> q₁', err: 'not a usable state name' },
  { id: 'X24', title: '> inside a name (broke drawn arrows)', text: 'States: a>b, c\nAlphabet: x\nStart: c\nAccepting: a>b\nTransitions:\nc, x -> a>b', err: 'not a usable state name' },
  { id: 'X25', title: 'reserved word “empty” as a target', text: 'States: p, empty\nAlphabet: a\nStart: p\nAccepting: empty\nTransitions:\np, a -> empty', err: 'reserved word' },
  { id: 'X26', title: 'nothing after the arrow (ambiguous)', text: 'States: p, q\nAlphabet: a\nStart: p\nAccepting: q\nTransitions:\np, a ->', err: 'nothing after the arrow' },
  { id: 'X27', title: 'letters used but only digits declared', text: 'States: p, q\nAlphabet: 0, 1\nStart: p\nAccepting: q\nTransitions:\np, a -> q\nq, b -> q', err: '“a” is not in the alphabet' },
  { id: 'X28', title: 'no Alphabet line (never guessed from the transitions)', text: 'States: p, q\nStart: p\nAccepting: q\nTransitions:\np, a -> q', err: 'Missing an “Alphabet:” line' }
];

module.exports = { CASES, INVALID, spec };
