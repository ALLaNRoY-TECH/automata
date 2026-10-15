# Automata Lab

An interactive NFA → DFA conversion lab for a Formal Languages and Automata course. It is a plain static site with no build step: open `index.html` in a browser.

- **Story:** a scroll-driven introduction where six friends (Allan Q, Aadhi Σ, Pranet δ, Abhinesh q₀, Haritha F, Neha ε) each sketch one part of an NFA.
- **Lab:** four stages.
  1. Type, draw or load an NFA.
  2. See the NFA transition table.
  3. Watch the subset construction step by step.
  4. Get the final DFA, with a string tester.

## Run it

```
# just open it
open index.html            # or double-click it; any static server also works: npx serve .

# tests (Node 18+)
npm install                # installs Playwright for the browser tests
npx playwright install chromium
npm test                   # full suite, exits 1 on any failure
npm run test:fast          # without the browser tests
```

## Project layout

| Path | What it is |
|---|---|
| `index.html` | All markup and CSS (pencil-on-paper theme) |
| `js/characters.js` | The six illustrated characters |
| `js/engine.js` | Parser, validation, ε-closure, subset construction, simulators (pure, runs in Node too) |
| `js/verify.js` | **Independent** verifier that gates every result shown in the app (shares no code with the engine) |
| `js/render.js` | SVG diagram renderer |
| `js/player.js` | Stage 3 step-by-step conversion player |
| `js/editor.js` | Stage 1 drawing editor |
| `js/app.js` | Story, stage flow, tables, tester |
| `tests/` | Test suite; see `tests/README.md` and `tests/AUDIT-REPORT.md` |

Scripts must load in this order: characters, engine, verify, render, player, editor, app.

## Rules to keep (read before changing anything)

1. **Mathematical correctness comes first.** Every conversion is computed by `engine.js`, then checked by `verify.js` against 10 invariants before it is shown:
   - input integrity, alphabet integrity
   - subsets, transitions, accepting states
   - completeness, dead state
   - diagram = table, language equivalence
   - nothing changes the result afterwards

   A failed check blocks the result and shows diagnostics. Never weaken this gate.
2. **The alphabet is always declared, never guessed or expanded.** A symbol outside Σ is an error. The drawing editor refuses undeclared arrow symbols, and new arrows are drafts until they are labelled. Never reintroduce a default {0, 1}.
3. **The DFA is complete.** ∅ appears only when some move reaches it. The DFA is not minimised.
4. **Limits:** 40 NFA states, 12 single-character symbols, 256 DFA states. A conversion that hits the limit is stopped with a message, not shown partially.
5. **Design:**
   - Parchment palette: #F5F0E6 #FFFCF5 #E7DCC8 #302F2A #526B52 #AD8954 #B8735C #DCE4D5. No neon, purple or glassmorphism.
   - Fonts: Fraunces, Atkinson Hyperlegible, IBM Plex Mono, and Caveat for handwriting.
   - Animations run at 55% of their original speed.
   - `prefers-reduced-motion` must keep working.
6. **Testing:**
   - Never skip, loosen or "update to match" a failing test. Find the root cause, fix it and add a regression test.
   - `tests/lib/reference.js` is an independent oracle, so keep it independent.
   - The browser tests load Google Fonts. Offline, the "no script errors" check can fail on the font request alone.
