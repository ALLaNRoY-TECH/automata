# Automata Lab: correctness audit report

Updated 2026-10-15, round 3 (in-app verification of all 10 invariants). Every number was measured by the suite in this folder and is recorded in `tests/results/*.json`. Nothing here is estimated. The suite is strong evidence of correctness for the input the lab accepts. It does not prove correctness for every possible input.

## Round 3: verification built into the app (all 10 invariants)

**Order of work: calculate first, verify independently second, visualise third.** The engine computes the DFA. Then `js/verify.js` checks it before anything is shown as complete. The verifier is a separate implementation that shares no code with the engine:

- It reads the typed text itself.
- It computes ε-closures by fixpoint over a flat edge list.
- It rebuilds the whole reachable subset graph with its own keys.
- It decides NFA acceptance by searching paths.

| # | Invariant | How it is checked in the app |
|---|---|---|
| 1 | Input integrity | The states, start state, accepting states and every transition read independently from the text equal the NFA being converted |
| 2 | Alphabet integrity | The declared Σ equals the NFA's Σ equals the DFA's Σ, in order, and every transition symbol is declared |
| 3 | Subset correctness | DFA states and the reachable subsets match one to one. The start state is ε-closure({q₀}). Names and subsets are not duplicated |
| 4 | Transition correctness | Every δ(S, x) equals the reference ε-closure(⋃ δN(q, x)) |
| 5 | Accepting states | A state is accepting exactly when its subset contains a state of F |
| 6 | Completeness | Each state has exactly one move per declared symbol, and every move points to a real state |
| 7 | Dead state | ∅ appears only if it is reachable, appears once, loops on every symbol, and is never accepting |
| 8 | Diagram = table | After drawing, the app reads the diagram's nodes, accepting marks and labelled arrows, and the table's columns, rows, marks and cells, back from the page and compares them with the DFA |
| 9 | Language equivalence | The full subset graph is matched (3–7), and every string is compared, NFA path search against DFA run, up to a length budget (for example, length 11 over {0, 1}, or all 4,095 strings) |
| 10 | Execution consistency | The result is fingerprinted when it is verified, and the fingerprint is re-checked before stage 3, before stage 4 and on every redraw |

**If any check fails:**
- No result is shown as correct.
- During conversion, the lab stays on step 1 and the later steps stay locked.
- In stage 4, the wrong diagram and table are hidden.
- A plain message names the failed check and says the fault is in the lab, not your NFA.
- The full diagnostic JSON is kept on the page, in `AL.lastFailure` and in the console.

**If every check passes,** stage 4 shows "✓ independently verified, 10 of 10 correctness checks passed" with the list of checks.

**Evidence that the gate works:**
- **Unit tests:** the verifier passes all 30 cases in every text style, and all 1,000 random NFAs. 12 different corruptions were injected, and each one was caught by the correct invariant: extra Σ symbol, inherited symbol, dropped transition, changed start, wrong subset, missing state, wrong target, flipped accept mark, missing move, unneeded ∅, accepting ∅, and a missing ε-closure. The fingerprint is also shown to detect a change made after verification.
- **Browser fault injection:** a sabotaged engine (flipped accepting mark) is blocked at step 1 with diagnostics. A sabotaged renderer (one arrow dropped from the final diagram) has its diagram hidden and gets no badge.
- **Every typed and drawn journey** now also asserts that the badge shows 10 of 10.

**Cost:** 18–38 ms for the largest cases tried (256 DFA states, and 40 NFA states × 12 symbols).

**Limit, stated plainly:** the string comparison is bounded. With 12 symbols it reaches only length 2. Language equivalence therefore rests mainly on the exact subset-graph match against the independent construction, which together with checks 3–7 implies the same language. That is a proof only if the verifier itself is correct. The verifier is in turn tested against the separate test oracle and 14 injected faults (12 in unit tests, 2 in the browser).

### Results (final code, round 3)

| Suite | Result |
|---|---|
| Original engine checks | 362 / 362 |
| Unit + differential | 904 / 904 |
| Random differential | 1,000 / 1,000 NFAs (seeds 1–5), 211,898 string checks, each also passed through the in-app verifier |
| Mutation | 13 / 13 caught |
| Browser end-to-end | 50 / 50 scenarios, 1,687 / 1,687 checks |

Animation speed was also changed in this round, to 55% of the original. That is a visual change only, and the full suite passed again after it.

## Round 2: alphabet integrity and silent input changes

### Root cause
Every silent change was in the drawing editor (`js/editor.js`), not in the conversion engine. The text parser already rejected undeclared symbols. The editor, however, quietly rewrote the NFA it handed to the rest of the pipeline. All four defects below were reproduced in the real page with Playwright before they were fixed.

| # | Defect (reproduced) | Effect | Fix |
|---|---|---|---|
| 1 | The drawing editor added any arrow symbol to Σ without telling you | Erasing the default example and drawing an a/b machine gave **Σ = {0, 1, a, b}**, so the tables and DFA had extra 0/1 columns leading to ∅ | An arrow symbol outside Σ is now refused with a message naming Σ. The editor never changes Σ by itself. |
| 2 | A new arrow got a symbol nobody typed (the first free symbol, or an invented `0` when Σ was empty) | Transitions, and even Σ = {0}, appeared out of nowhere | A new arrow is a dashed draft marked "?" and is not part of the NFA until its symbols are typed. Leaving it unlabelled discards it. |
| 3 | Removing a symbol from the Alphabet box silently deleted every arrow that used it | Transitions vanished | The change is refused, and the message names the arrow that still uses the symbol. |
| 4 | The editor's undo history survived loading a different problem, and its starting Σ was hard-coded as {0, 1} | Undo could bring back the previous problem's automaton | A different automaton now replaces the old one completely, undo history included. The starting Σ is empty. A **Blank page** button resets the drawing and the text together. |

There were also two defensive fixes in `js/engine.js`:

- **Serializer:** it used to drop any transition whose symbol was outside Σ. It now writes the transition out, so the parser rejects it instead of losing it.
- **Empty arrow line:** a transition line with nothing after the arrow was silently read as "no move". It is now an error asking for an explicit ∅.

### Single source of truth (verified)
The pipeline is: text box (from typing, drawing or an example) → `parseNFA` → validate → one NFA object → NFA table → `subsetConstruction` → DFA table → DFA diagram → tester.

The drawing editor writes into the text box through `serializeNFA`. Stages 2–4 read only the object built when you press Continue.

- **Round-trip checks:** serialize→parse returns the identical NFA for all 30 hand cases and all 1,000 random NFAs.
- **Browser checks:** these read every Σ-dependent output from the page and require exactly the declared Σ:
  - the NFA table columns
  - the growing DFA table and diagram labels in stage 3
  - the DFA table columns
  - the tester's "Σ = {…}" label

### New regression tests

**Browser (5 new scenarios):**
1. Erase the {0, 1} example and draw an {a, b} machine. The arrow is refused until Σ is declared, Σ is never expanded, and the full conversion is then verified.
2. A new arrow is a draft. With Σ empty nothing is invented, and an unlabelled arrow is discarded.
3. A symbol still on an arrow cannot be dropped. An unused declared symbol keeps its column, and its moves go to ∅.
4. All 6 examples, loaded forwards then backwards. The drawing, both tables and Undo show only the current problem.
5. Six conversions in a row with alphabets {a}, {0,1,2,3}, {x,y,z}, {a,b}, {c} and {a,b}. Each is fully verified.

**Unit:**
- 30 problems parsed back to back for 3 rounds, with no carry-over.
- The DFA alphabet equals the declared Σ, in order.
- The serializer keeps an out-of-Σ transition, and the parser rejects it.
- An unused symbol leads to ∅ with self-loops, and ∅ is never accepting.
- There is no ∅ when no move reaches it.
- DFA labels are distinct and each maps to a distinct subset.

**New invalid inputs:**
- X26: nothing after the arrow.
- X27: letters used when only digits are declared.
- X28: no Alphabet line, which is never guessed from the transitions.

**New mutants:** 5 bugs planted in a copy of the engine, all caught:
- Σ silently expanded by the parser.
- Σ guessed when the Alphabet line is missing.
- The serializer drops out-of-Σ symbols.
- The DFA alphabet gains a default 0/1.
- A dead state is added even when unreachable.

**Proof the tests can fail:** the three editor regressions were run against the old `editor.js`, and all three failed (9 failing checks). They pass on the fixed code.

### Results (final code)

| Suite | Result |
|---|---|
| Original engine checks | 362 / 362 |
| Unit + differential | 890 / 890 (26,192 string checks over 30 NFAs) |
| Random differential | 1,000 / 1,000 NFAs, seeds 1–5 (240 with ε), 211,898 string checks, with the serialize round trip |
| Mutation | 13 / 13 caught |
| Browser end-to-end | 48 / 48 scenarios, 1,580 / 1,580 checks, 356 strings typed into the real tester |

**One environmental failure, disclosed.** In the first full run, 1 browser check failed. Its "no script errors" check caught a Google Fonts request blocked by this sandbox's network proxy (`ERR_TUNNEL_CONNECTION_FAILED`). All the mathematical checks in that scenario passed. The browser suite was re-run unchanged and passed 1,580 / 1,580. The check was not loosened.

---

# Round 1 report (earlier the same day)

## 1. How to re-run it

```
cd automata-lab
npm install                          # once (Playwright)
NODE_PATH=$(npm root -g) npm test    # full suite, exits 1 on any failure
npm run test:fast                    # no browser
SEEDS=42 COUNT=1000 node tests/random.test.js   # replay or extend the random run
```

## 2. Results at a glance

| Suite | Result | What it covers |
|---|---|---|
| Original engine checks | 362 / 362 | Presets plus a brute-force simulator |
| Unit and differential tests | 874 / 874 | 30 hand-specified NFAs: closures, parsing, every step, tables, and 26,192 string checks |
| Random differential tests | 1,000 / 1,000 NFAs | Seeds 1–5 with 200 each; 240 had ε-moves; 211,898 string checks; DFAs up to 24 states |
| Mutation tests | 8 / 8 caught | Proves the tests can fail |
| Browser end-to-end tests | 43 / 43 scenarios, 1,253 checks | Real typing, clicks and canvas drawing in Chromium; 323 strings typed into the tester |

## 3. The independent oracle

`tests/lib/reference.js` shares no code with `js/engine.js` and is built differently:

- ε-closure is computed by fixpoint iteration over a flat transition list.
- NFA acceptance is decided by searching (state, position) paths.
- DFA subsets are keyed by sorted state names.

Before the oracle is used, it is checked on hand-solved cases, including an ε-cycle.

## 4. Test NFAs (30 hand-specified, categories A–F)

| Category | Cases |
|---|---|
| A: basics | A1 single self-loop, A2 ends in 1, A3 no accepting states, A4 accepting start |
| B: nondeterminism | B1–B5: two targets on one symbol, merging paths, two accepting states, cycles, third-from-last |
| C: missing transitions / ∅ | C1–C5: ∅ reachable, ∅ never reached, an unused symbol, a dead state that must reject |
| D: alphabets and names | D1–D5: one-letter alphabet, x/y/z, digits 0–3, long names, names that look like symbols |
| E: ε-moves | E1–E6: simple ε, chains, ε-cycles, ε into accept, mixed, a Sipser-style ε-NFA |
| F: edge cases | F1–F5: no transitions, unreachable states, duplicate lines, braces/∅/λ/comments, everything accepting |

Each case carries its intended language as a predicate. Where practical it also has a hand-computed DFA state count, accepting count and ∅ status.

For every case the suite checks:

- **Parsing** in 5 text styles.
- **ε-closure** of every subset of states.
- **Every conversion step** (from-set, symbol, result, and new or known) against the oracle.
- **DFA completeness:** one transition per state per symbol, with ∅ present only when it is reachable.
- **Accepting states.**
- **Termination:** the trace length is exactly 2 + |states|·|Σ|.
- **Every string** up to length 5–12, comparing the NFA, the DFA, the oracle and the language predicate.

## 5. Malformed input (25 cases, X1–X25)

All 25 are rejected, and each error message is checked for the expected wording. The cases are:

- **Missing or empty parts:** States line, state set, start, alphabet, completely empty input.
- **Undefined names:** transition source or target, accepting state not declared.
- **Bad symbols:** symbol not in the alphabet, multi-character symbol, ε in the alphabet, # as a symbol.
- **Bad structure:** two starts, no arrow, missing symbol, duplicate state, duplicate or unknown header.
- **Bad names:** reserved words, punctuation, too long, subscripts, `>`.
- **Limits:** 41 states are refused (the limit is 40). A conversion that would pass 256 DFA states stops with a message instead of freezing.

In the browser, error messages were verified to be visible at desktop width and at 390 px.

## 6. Randomized testing

- **Generator:** `tests/random.test.js` uses the mulberry32 generator with a fixed seed. Each NFA has 1–6 states drawn from awkward names (`0`, `a`, `p'`, `state_A`, `q10`) and 1–3 symbols. Density varies, and about half the NFAs get ε-moves.
- **Pipeline:** each NFA goes through all of these:
  1. Written out as text in one of 5 styles.
  2. Parsed.
  3. Checked to be exactly the intended NFA.
  4. Converted.
  5. Compared with the oracle state by state.
  6. Run on every string up to length 5–10.
- **Shrinking:** a failure is automatically shrunk to a minimal NFA for use as a regression.
- **Result:** 0 failures across seeds 1–5.

## 7. Mutation testing

Eight bugs were planted, one at a time, in a copy of the engine. The suite caught all eight:

1. No ε-closure after a move.
2. No ε-closure of the start state.
3. A subset accepts only if all of its states accept.
4. The dead state accepts.
5. Move uses only the first state of a subset.
6. Closure stops after one ε-step.
7. The parser drops the second target.
8. The parser keeps only the last line per state and symbol.

## 8. Browser testing: typed input

All 30 cases were typed into the real text box. For each one:

- The stage 2 NFA table was read back.
- Every conversion step was walked through.
- The final DFA table and diagram were read from the page and compared with the oracle.
- Strings were typed into the tester.

Controls:

- **Same result three ways:** stepping, playing to the end and Skip to result give an identical table (checked on B5).
- **Player controls:** Prev, Next, Play, Pause and Reset; arrow-key stepping checked on E3.
- **Editing:** repeated conversions, editing after converting, and switching text → drawing → text.
- **Reload:** the lab starts clean, because nothing is saved by design.
- **Story:** the scroll story with motion on, through "Enter the lab" to a conversion.
- **Phone width:** two full journeys at 390 px.

## 9. Browser testing: the drawing canvas

These were done with real mouse clicks on the SVG canvas:

- Add states, rename, set the start, toggle accepting.
- Self-loops, nondeterministic edges and ε-edges.
- Edit an edge label, erase, undo.
- Hand the drawing to the conversion.
- A drawn "ends with ab" NFA was checked to produce the same NFA and DFA as the typed version.

## 10. Bugs found and fixed

Each bug is now covered by a regression test that fails on the old engine (`ENGINE=<old copy>`).

1. **A state named `none` or `empty`:** transitions to it silently vanished, because the word was read as "no target". These words are now reserved, with a clear error (X14, X25).
2. **`#` in the alphabet:** inline comment stripping silently deleted it. Only whole-line comments are allowed now, and `#` as a symbol gives an error (X16).
3. **A header given twice:** the second silently replaced the first. This is now an error (X17).
4. **`q1` and `q₁`:** both were accepted but look identical in the tables. Subscript digits are now rejected (X23).
5. **A `>` inside a state name:** it broke the drawing editor's arrows. Names are now limited to letters, digits, `_` and `'` (X24).

There were also display defects, found from screenshots and fixed. None changed any result:

- Straight arrows were invisible because of the pencil filter.
- The descenders of the hero title were clipped.
- Long subset labels overflowed their circles.
- Tags collided with self-loops.
- The drawing canvas was taller than a laptop screen.

Two expectations in the test specifications were mine and were wrong: D1 (now 7 states, 5 accepting) and the F5 predicate. I corrected them by recomputing by hand and checking against the oracle, not by copying the engine's output.

## 11. Limitations (known, not hidden)

- **Not a proof:** testing covers 30 hand cases and 1,000 random NFAs with up to 6 states. Larger NFAs were tested only up to the 256-state guard.
- **No minimisation:** the DFA is the reachable subset DFA, which may not be minimal.
- **Input limits:** single-character symbols; at most 40 NFA states, 12 symbols and 256 DFA states.
- **Large diagrams:** DFAs of roughly 15 or more states get crowded. Pan and zoom help, and the table stays exact.
- **Phones:** the drawing canvas works on a phone but is cramped. Typing is the better input there.
- **Reloads:** there is no persistence, so a reload clears the lab.
- **Gate Vidyalay:** the reference HTML was not in the project folder, so it was not used.
- **Not tested:** browsers other than Chromium, and screen readers. Reduced motion was checked only by switching the setting on and confirming the page works.

## 12. Acceptance criteria status

| Criterion | Status |
|---|---|
| Real text-input workflow tested | Done, 30 NFAs typed |
| Drawing canvas tested | Done, 2 scenarios including text/drawing equivalence |
| ε-NFAs tested | Done: 6 hand cases plus 240 random |
| Independent oracle | Done |
| Exhaustive strings to length ≥ 5 | Done, 5–12 depending on alphabet size |
| Randomized with seeds, plus shrinking | Done, seeds 1–5 |
| Malformed inputs show clear errors | Done, 28 cases |
| Step, play and skip give the same result | Done |
| Bugs fixed with regression tests | Done, 5 parser bugs |
| Permanent suite with a non-zero exit on failure | Done (`npm test`) |
| Claim of 100% accuracy | Not made. See §11. |
