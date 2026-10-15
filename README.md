# Automata Lab

An interactive NFA → DFA conversion lab for a Formal Languages and Automata course.

## Overview

- **The Story:** A scroll-driven introduction where six characters (Allan $Q$, Aadhi $\Sigma$, Pranet $\delta$, Abhinesh $q_0$, Haritha $F$, Neha $\varepsilon$) each sketch one part of a finite automaton.
- **The Lab:** 
  1. **Stage 1 (Your NFA):** Type, draw, or load an NFA with live SVG preview and alphabet declaration.
  2. **Stage 2 (NFA Table):** Transition table display with state mapping.
  3. **Stage 3 (Convert):** Step-by-step interactive subset construction player with animated graph visualization.
  4. **Stage 4 (Final DFA):** The complete equivalent DFA diagram, transition table, string tester, and 10-invariant independent verification badge.

## Repository Layout

- [`website/`](./website/) — Production-ready, fully responsive web application.
- [`automata-lab.zip`](./automata-lab.zip) — Pristine, untouched original project archive.
- [`original/`](./original/) — Protected reference copy of the extracted original project.

## Running Locally

Run a static server from the `website/` directory:

```bash
cd website
python -m http.server 8080
# Or using Node:
# npx serve .
```

Then visit [http://localhost:8080](http://localhost:8080) in your web browser.

## Running Tests

From the `website/` folder:

```bash
cd website
npm test               # Runs unit, randomized, differential, and mutation suites
npm run test:fast      # Fast mode without browser tests
```
