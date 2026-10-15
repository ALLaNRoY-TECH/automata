/* Automata Lab — diagram renderer.
   Turns a small graph model into SVG markup. Used by the story stage and by
   all lab views, so NFA and DFA always share one visual language.
     model = { nodes:[{id,label,sub,accept,start}], edges:[{from,to,label}] }
   Positions come from layered() (BFS depth columns) or an explicit map. */

(function (global) {
  const SUBS = '₀₁₂₃₄₅₆₇₈₉';
  const pretty = (id) => id.replace(/(\D+)(\d+)/, (_, a, d) => a + [...d].map((c) => SUBS[+c]).join(''));
  const setLabel = (set) => (set.length ? `{${set.map(pretty).join(', ')}}` : '∅');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function nfaModel(nfa) {
    const edges = [];
    for (const q of nfa.states) {
      const byTarget = new Map();
      for (const [a, to] of Object.entries(nfa.delta[q] || {})) {
        for (const r of to) { if (!byTarget.has(r)) byTarget.set(r, []); byTarget.get(r).push(a); }
      }
      for (const [r, syms] of byTarget) edges.push({ from: q, to: r, label: syms.join(', ') });
    }
    return {
      nodes: nfa.states.map((q) => ({ id: q, label: q.length > 5 ? q : pretty(q), accept: nfa.accept.includes(q), start: q === nfa.start })),
      edges
    };
  }

  function dfaModel(dfa, visibleStates, visibleEdges) {
    const vis = visibleStates ? new Set(visibleStates) : null;
    const nodes = dfa.states.filter((s) => !vis || vis.has(s.id))
      .map((s) => ({ id: s.id, label: s.id, sub: s.dead ? 'dead' : setLabel(s.set), accept: s.accept, start: s.start, dead: s.dead }));
    const edges = [];
    for (const s of dfa.states) {
      const byTarget = new Map();
      for (const a of dfa.alphabet) {
        const t = dfa.delta[s.id][a];
        if (t === undefined) continue;
        if (visibleEdges && !visibleEdges.has(`${s.id}|${a}`)) continue;
        if (!byTarget.has(t)) byTarget.set(t, []);
        byTarget.get(t).push(a);
      }
      for (const [t, syms] of byTarget) edges.push({ from: s.id, to: t, label: syms.join(', '), syms });
    }
    return { nodes, edges };
  }

  /* Layered layout: column = BFS depth from start, rows in discovery order. */
  function layered(ids, edges, start, opts = {}) {
    const gapX = opts.gapX || 170, gapY = opts.gapY || 150;
    const depth = new Map([[start, 0]]), q = [start];
    const adj = new Map(ids.map((i) => [i, []]));
    for (const e of edges) if (adj.has(e.from)) adj.get(e.from).push(e.to);
    while (q.length) {
      const u = q.shift();
      for (const v of adj.get(u) || []) if (!depth.has(v)) { depth.set(v, depth.get(u) + 1); q.push(v); }
    }
    ids.forEach((i) => { if (!depth.has(i)) depth.set(i, Math.max(0, ...depth.values()) + 1); });
    const cols = new Map();
    ids.forEach((i) => { const d = depth.get(i); if (!cols.has(d)) cols.set(d, []); cols.get(d).push(i); });
    const maxRows = Math.max(...[...cols.values()].map((c) => c.length));
    const pos = {};
    for (const [d, col] of cols) {
      col.forEach((id, r) => {
        pos[id] = { x: d * gapX, y: (r - (col.length - 1) / 2) * gapY, d };
      });
    }
    return { pos, rows: maxRows, cols: cols.size };
  }

  function bounds(pos, r, pad) {
    const xs = Object.values(pos).map((p) => p.x), ys = Object.values(pos).map((p) => p.y);
    const x0 = Math.min(...xs) - r - pad.l, x1 = Math.max(...xs) + r + pad.r;
    const y0 = Math.min(...ys) - r - pad.t, y1 = Math.max(...ys) + r + pad.b;
    return `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;
  }

  const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  function head(tx, ty, dx, dy, size = 11) {
    const [ux, uy] = unit(dx, dy), px = -uy, py = ux;
    const bx = tx - ux * size, by = ty - uy * size;
    return `M${tx},${ty} L${bx + px * size * .48},${by + py * size * .48} L${bx - px * size * .48},${by - py * size * .48} Z`;
  }

  function graph(model, pos, opts = {}) {
    const r = opts.r || 40;
    const cy = Object.values(pos).reduce((s, p) => s + p.y, 0) / (Object.keys(pos).length || 1);
    const has = new Set(model.edges.map((e) => `${e.from}>${e.to}`));
    const hi = opts.hiEdges || new Set(), hiN = opts.hiNodes || new Set(), hot = opts.hotNodes || new Set();
    let edges = '', nodes = '';
    const loopUp = new Set(); // nodes whose self-loop sits above them: their tag goes below

    for (const e of model.edges) {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) continue;
      let d, hd, lx, ly;
      if (e.from === e.to) {
        const s = a.y > cy + 1 ? 1 : -1; // loops point away from the drawing's centre
        if (s < 0) loopUp.add(e.from);
        const y0 = a.y + s * (r - 3), yc = a.y + s * (r + 58);
        const p1 = [a.x - 15, y0], p2 = [a.x + 15, y0];
        d = `M${p1[0]},${p1[1]} C${a.x - 44},${yc} ${a.x + 44},${yc} ${p2[0]},${p2[1]}`;
        hd = head(p2[0], p2[1], p2[0] - (a.x + 44), p2[1] - yc);
        lx = a.x; ly = a.y + s * (r + 52);
      } else {
        const rev = has.has(`${e.to}>${e.from}`);
        const skip = Math.abs((a.d ?? 0) - (b.d ?? 0)) > 1;
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
        const bend = rev || skip ? (opts.bend || .2) * L * (skip && !rev ? 1.25 : 1) : 0;
        const [px, py] = unit(dy, -dx);
        const cx = (a.x + b.x) / 2 + px * bend, cyy = (a.y + b.y) / 2 + py * bend;
        const [sx, sy] = unit(cx - a.x, cyy - a.y), [ex, ey] = unit(cx - b.x, cyy - b.y);
        const P1 = [a.x + sx * r, a.y + sy * r], P2 = [b.x + ex * (r + 2), b.y + ey * (r + 2)];
        d = bend ? `M${P1} Q${cx},${cyy} ${P2}` : `M${P1} L${P2}`;
        hd = head(P2[0], P2[1], P2[0] - cx, P2[1] - cyy);
        lx = .25 * P1[0] + .5 * cx + .25 * P2[0];
        ly = .25 * P1[1] + .5 * cyy + .25 * P2[1];
        if (!bend) { lx += px * 14; ly += py * 14; } else { lx += px * 8; ly += py * 8; }
      }
      const key = `${e.from}>${e.to}`;
      const w = e.label.length * 8.4 + 14;
      edges += `<g class="edge${hi.has(key) ? ' is-hi' : ''}${(opts.freshEdges && opts.freshEdges.has(key)) ? ' fresh' : ''}" data-edge="${key}" data-from="${e.from}" data-to="${e.to}">` +
        `<path class="edge-path" d="${d}" pathLength="1"/><path class="edge-head" d="${hd}"/>` +
        `<g class="edge-label"><rect x="${lx - w / 2}" y="${ly - 11}" width="${w}" height="22" rx="2"/>` +
        `<text x="${lx}" y="${ly + 4.5}" text-anchor="middle">${esc(e.label)}</text></g></g>`;
    }

    for (const n of model.nodes) {
      const p = pos[n.id];
      if (!p) continue;
      const done = opts.doneNodes || new Set(), tags = opts.tags || {}, freshN = opts.freshNodes || new Set();
      const cls = ['node', n.accept ? 'is-accept' : '', n.start ? 'is-start' : '', n.dead ? 'is-dead' : '', done.has(n.id) ? 'is-done' : '', hiN.has(n.id) ? 'is-hi' : '', hot.has(n.id) ? 'is-hot' : '', freshN.has(n.id) ? 'fresh' : ''].join(' ');
      nodes += `<g class="${cls}" data-node="${n.id}" transform="translate(${p.x},${p.y})">` +
        `<circle class="node-c" r="${r}"/>` + (n.accept ? `<circle class="node-acc" r="${r - 6}"/>` : '') +
        `<text class="node-label" y="${n.sub ? -2 : 7}" text-anchor="middle"${n.label.length > 4 ? ` textLength="${Math.min(2 * r - 16, n.label.length * 11)}" lengthAdjust="spacingAndGlyphs"` : ''}>${esc(n.label)}</text>` +
        (n.sub ? `<text class="node-sub" y="17" text-anchor="middle"${n.sub.length > 10 ? ` textLength="${Math.min(2 * r - 14, n.sub.length * 6.6)}" lengthAdjust="spacingAndGlyphs"` : ''}>${esc(n.sub)}</text>` : '') +
        (hiN.has(n.id) ? `<ellipse class="ring" rx="${r + 11}" ry="${r + 7}" transform="rotate(-14)" pathLength="1"/>` : '') +
        (done.has(n.id) && !hiN.has(n.id) && !hot.has(n.id) ? `<text class="tick" x="${r * .62}" y="${-r * .62}">✓</text>` : '') +
        (tags[n.id] ? `<text class="newtag" y="${loopUp.has(n.id) ? r + 30 : -r - 16}" text-anchor="middle">${esc(tags[n.id])}</text>` : '') + `</g>`;
      if (n.start) {
        const sx = p.x - r - 52;
        nodes += `<g class="start-arrow"><path d="M${sx},${p.y} L${p.x - r - 3},${p.y}" pathLength="1"/>` +
          `<path class="edge-head" d="${head(p.x - r - 2, p.y, 1, 0, 12)}"/>` +
          `<text x="${sx - 6}" y="${p.y + 4}" text-anchor="end">start</text></g>`;
      }
    }
    return `<g class="g-edges">${edges}</g><g class="g-nodes">${nodes}</g>`;
  }

  global.AL = global.AL || {};
  global.AL.Render = { pretty, setLabel, nfaModel, dfaModel, layered, graph, bounds };
})(window);
