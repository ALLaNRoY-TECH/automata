# Automata Lab: test suite

## Running it

From the `automata-lab/` folder:

```
npm install            # once; installs Playwright as a dev dependency
npm test               # full suite; exits 1 if anything fails
npm run test:fast      # skips the browser tests and reports them as NOT RUN
```

If Playwright is installed globally instead of locally, set `NODE_PATH` before running:

```
NODE_PATH=$(npm root -g) npm test
```

Measured results are written to `tests/results/*.json`.

## The test files

| File | What it checks |
|---|---|
| `lib/reference.js` | An independent reference converter, used as the oracle. It shares no code with `js/engine.js` and works differently: ε-closure by fixpoint over a transition list, NFA acceptance by searching paths, and subsets keyed by sorted names. |
| `../js/verify.js` | The verifier that runs inside the app. It is independent of the engine and checks invariants 1–7 and 9 before any result is shown. The app adds 8 (diagram = table, read from the page) and 10 (fingerprint). Unit, random and browser tests all exercise it, including fault injection. |
| `lib/cases.js` | 30 hand-specified NFAs (categories A–F), each with its intended language as a predicate and hand-computed DFA facts where practical. It also holds 28 malformed inputs that must be rejected. |
| `engine.test.js` | The original engine checks: the presets, plus the brute-force simulator. |
| `unit.test.js` | Compares engine and reference on every case: ε-closure of every subset, parsing (5 text styles), each conversion step, DFA tables, and every string up to a length (at least 5). Also checks validation messages and the 256-state safety limit. |
| `random.test.js` | 1,000 random NFAs (seeds 1–5, 200 each), with ε-moves, odd names, and digit or letter symbols. Each is written as text, parsed, converted, and compared with the reference, including every short string. A failing NFA is shrunk to a minimal regression. Replay any run with `SEEDS=… COUNT=… node tests/random.test.js`. |
| `mutation.test.js` | Plants 13 known bugs in a copy of the engine (including a silently expanded Σ, a guessed Σ, a default 0/1 and an unneeded dead state) and confirms the suite catches each one. This shows the tests can actually fail. |
| `e2e.test.js` | Playwright tests in Chromium that use only real controls: typing, canvas clicks and buttons. They read the tables, diagrams, step cards and tester output from the page and compare them with the reference. |

## Supported input (enforced with an error message)

- **State names:** letters, ASCII digits, `_` and `'`, at most 12 characters. The words `none`, `empty`, `∅`, `eps`, `ε`, `epsilon`, `λ` and `lambda` are reserved.
- **Input symbols:** exactly one character. A symbol cannot be whitespace or any of `, ; { } ( ) # ∅ - > → : "`, and cannot be ε or λ.
- **The alphabet is always declared, never guessed.** Text input needs an `Alphabet:` line, and a transition on any other symbol is an error. In the drawing, the Alphabet box is the declaration. An arrow symbol outside it is refused with a message, a symbol still used on an arrow can't be removed, and a new arrow stays a dashed draft (not part of the NFA) until its symbols are typed. Declared symbols with no transitions are kept; their moves go to ∅ in the DFA.
- **A new problem replaces the old one.** Loading an example, *Start blank* and *Blank page* replace the whole automaton, its undo history included.
- **Ambiguous lines are errors:** a transition with nothing after the arrow must say ∅ explicitly.
- **Format:** one `States:`, `Alphabet:`, `Start:` and `Accepting:` line each. A header that appears twice is an error. A line starting with `#` is a comment.
- **Size limits:** at most 40 NFA states, 12 symbols and 256 DFA states. A conversion that grows past 256 DFA states stops with a message.
- **The DFA is complete:** the empty set ∅ appears as a dead state only when some transition actually reaches it.
- **No persistence:** the lab does not save between reloads.
