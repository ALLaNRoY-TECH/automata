/* Automata Lab — conversion player and diagram pan/zoom.
   AL.Player(host, nfa, result, opts) shows ONE step of the subset
   construction at a time: the set being expanded, the symbol read, the set it
   leads to, one sentence on why, and both diagrams. Everything comes from the
   engine's trace, so the animation can never disagree with the tables.
   The working (formula, to-do list, partial table) sits in a closed <details>.
   AL.PanZoom(frame, svg, viewBox) adds zoom buttons and drag-to-pan. */

(function (global) {
  const AL = global.AL;
  const { Render, Engine } = AL;
  const P = Render.pretty, SL = Render.setLabel;
  const reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const byId = Object.fromEntries(AL.cast.map((c) => [c.id, c]));
  const bust = (id) => `<div class="bust">${AL.figureSVG(byId[id], { crop: 'bust' })}</div>`;

  function PanZoom(frame, svg, vb) {
    let [x, y, w, h] = vb.split(' ').map(Number);
    const base = { x, y, w, h };
    frame.classList.add('pan');
    const ui = document.createElement('div');
    ui.className = 'zoom';
    ui.innerHTML = '<button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">−</button><button type="button" data-z="fit" aria-label="Fit diagram">⤢</button>';
    frame.appendChild(ui);
    const apply = () => svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    const zoom = (k) => { const cx = x + w / 2, cy = y + h / 2; w = Math.min(base.w * 2.5, Math.max(base.w / 6, w * k)); h = w * base.h / base.w; x = cx - w / 2; y = cy - h / 2; apply(); };
    ui.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.z === 'in') zoom(.75); else if (b.dataset.z === 'out') zoom(1.33); else { ({ x, y, w, h } = base); apply(); }
    });
    let drag = null;
    svg.addEventListener('pointerdown', (e) => { if (e.button) return; drag = { sx: e.clientX, sy: e.clientY, x, y, k: w / svg.getBoundingClientRect().width }; svg.setPointerCapture(e.pointerId); });
    svg.addEventListener('pointermove', (e) => { if (!drag) return; x = drag.x - (e.clientX - drag.sx) * drag.k; y = drag.y - (e.clientY - drag.sy) * drag.k; apply(); });
    const end = () => { drag = null; };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoom(e.deltaY > 0 ? 1.12 : .89); }, { passive: false });
    apply();
    return { reset: (nvb) => { [x, y, w, h] = nvb.split(' ').map(Number); Object.assign(base, { x, y, w, h }); apply(); } };
  }

  function layoutFor(nfa) {
    const nm = Render.nfaModel(nfa);
    let pos;
    if (nfa.pos && nfa.states.every((q) => nfa.pos[q])) {
      pos = {}; nfa.states.forEach((q) => { pos[q] = { ...nfa.pos[q], d: 0 }; });
    } else pos = Render.layered(nfa.states, nm.edges, nfa.start, { gapX: 170, gapY: 140 }).pos;
    return { model: nm, pos, vb: Render.bounds(pos, 40, { l: 104, r: 30, t: 112, b: 100 }) };
  }
  function dfaLayout(dfa) {
    const full = Render.dfaModel(dfa);
    const pos = Render.layered(dfa.states.map((s) => s.id), full.edges, dfa.start, { gapX: 190, gapY: 160 }).pos;
    return { pos, vb: Render.bounds(pos, 40, { l: 104, r: 40, t: 112, b: 112 }) };
  }
  /* Keep small diagrams from being blown up to fill a wide frame. */
  function fit(svg, vb, maxScale = 1.15) {
    const w = +vb.split(' ')[2];
    svg.style.maxWidth = Math.round(w * maxScale) + 'px';
  }

  function Player(host, nfa, res, opts = {}) {
    const { dfa, trace } = res;
    const nl = layoutFor(nfa), dl = dfaLayout(dfa);
    let i = 0, timer = null, prev = -1;
    host.innerHTML = `<div class="player">
      <div class="pl-bar" role="group" aria-label="Conversion controls">
        <button class="btn btn--sm" data-a="reset" type="button" title="Back to step 1">⟲ Reset</button>
        <button class="btn btn--sm" data-a="prev" type="button">← Previous</button>
        <button class="btn btn--brass btn--sm" data-a="play" type="button">▶ Play</button>
        <button class="btn btn--sm" data-a="next" type="button">Next →</button>
        <button class="btn btn--quiet btn--sm" data-a="skip" type="button">Skip to result ⇥</button>
        <span class="pl-count" aria-live="polite"></span>
      </div>
      <div class="pl-ticks" aria-label="Jump to a step"></div>
      <div class="now" aria-live="polite"></div>
      <div class="pl-diagrams">
        <div class="dg-frame grid-paper f-nfa"><span class="dg-cap">your NFA</span><svg class="dg" role="img" aria-label="NFA with the current step highlighted"></svg></div>
        <div class="dg-frame grid-paper f-dfa"><span class="dg-cap">the DFA, so far</span><svg class="dg" role="img" aria-label="DFA built so far"></svg></div>
      </div>
      <div class="legend"><span><i class="l-hi"></i>brass ring: set being expanded</span><span><i class="l-hot"></i>green: where it leads</span><span><i class="l-acc"></i>double circle: accepting</span><span><i class="l-dead"></i>dashed: dead state ∅</span></div>
      <div class="pl-done" hidden></div>
      <details class="pl-more"><summary>Show the working: formula, to-do list, table so far</summary>
        <div class="more-grid"><div class="eq"></div>
          <div class="lists"><div><h4>still to expand</h4><div class="chips c-q"></div></div><div><h4>expanded</h4><div class="chips c-m"></div></div></div>
          <div class="tt-wrap"><table class="tt c-t"></table></div></div>
      </details>
    </div>`;
    const $ = (s) => host.querySelector(s);
    const nfaSvg = $('.f-nfa svg'), dfaSvg = $('.f-dfa svg');
    fit(nfaSvg, nl.vb, 1); fit(dfaSvg, dl.vb, 1.1);
    PanZoom($('.f-nfa'), nfaSvg, nl.vb); PanZoom($('.f-dfa'), dfaSvg, dl.vb);
    $('.pl-ticks').innerHTML = trace.map((t, k) => `<button type="button" data-i="${k}" aria-label="Step ${k + 1}"></button>`).join('');
    const st = (id) => dfa.states.find((s) => s.id === id);
    const tok = (id, cls = '') => `<span class="tok ${cls}"><b>${id}</b><span>${id === '∅' ? 'empty set' : SL(st(id).set)}</span></span>`;

    function epsEdges(set) {
      const keys = new Set(), inS = new Set(set);
      for (const q of set) for (const r of ((nfa.delta[q] || {})['ε'] || [])) if (inS.has(r)) keys.add(`${q}>${r}`);
      return keys;
    }

    function render() {
      const t = trace[i], last = i === trace.length - 1;
      const known = new Set();
      trace.slice(0, i + 1).forEach((s) => { if (s.type === 'step') known.add(`${s.from}|${s.symbol}`); });
      const forward = i === prev + 1 && !reduce;

      /* NFA: the states we expand (brass) and where they lead (green) */
      const nHi = new Set(), nHot = new Set(), nE = new Set();
      if (t.type === 'init') { t.closureSet.forEach((q) => nHot.add(q)); epsEdges(t.closureSet).forEach((k) => nE.add(k)); }
      if (t.type === 'step') {
        t.fromSet.forEach((q) => nHi.add(q));
        t.closureSet.forEach((q) => nHot.add(q));
        t.parts.forEach((p) => p.to.forEach((r) => nE.add(`${p.q}>${r}`)));
        if (t.closureSet.length > t.moveSet.length) epsEdges(t.closureSet).forEach((k) => nE.add(k));
      }
      nfaSvg.innerHTML = Render.graph(nl.model, nl.pos, { r: 40, hiNodes: nHi, hotNodes: nHot, hiEdges: nE });

      /* DFA so far: positions come from the FINAL layout, so nothing jumps */
      const dHi = new Set(), dHot = new Set(), dE = new Set(), tags = {}, fN = new Set(), fE = new Set();
      if (t.type === 'init') { dHot.add(t.to); tags[t.to] = 'start!'; if (forward) fN.add(t.to); }
      if (t.type === 'step') {
        dHi.add(t.from); dHot.add(t.to); dE.add(`${t.from}>${t.to}`);
        tags[t.to] = t.isNew ? (t.dead ? 'dead end' : 'new!') : 'seen it';
        if (t.isNew && forward) fN.add(t.to);
        if (forward) fE.add(`${t.from}>${t.to}`);
      }
      const doneN = new Set(t.marked.filter((id) => !(t.type === 'step' && id === t.from)));
      if (t.type === 'done') dfa.states.forEach((s) => doneN.add(s.id));
      dfaSvg.innerHTML = Render.graph(Render.dfaModel(dfa, t.states, known), dl.pos, { r: 40, hiNodes: dHi, hotNodes: dHot, hiEdges: dE, doneNodes: doneN, tags, freshNodes: fN, freshEdges: fE });
      if (t.type === 'step' && !t.isNew && forward) { const n = dfaSvg.querySelector(`[data-node="${CSS.escape(t.to)}"]`); if (n) n.classList.add('revisit'); }

      /* the one-line story of this step */
      let row = '', who = 'pranet', say = '', eq = '';
      if (t.type === 'init') {
        const grew = t.closureSet.length > 1;
        row = `<span class="tok tok-q0"><b>start</b><span>${P(nfa.start)}</span></span><span class="reads">${grew ? 'add ε-moves' : 'begin'}</span><span class="arrow" aria-hidden="true">→</span>${tok(t.to, 'is-new')}<span class="verdict new">start state</span>`;
        who = 'abhinesh';
        say = grew ? `We start at ${P(nfa.start)} and add everything its ε-moves reach for free, so the DFA's first state ${t.to} is ${SL(t.closureSet)}.`
          : `We start at ${P(nfa.start)}. It has no ε-moves, so the DFA's first state ${t.to} is just ${SL(t.closureSet)}.`;
        eq = `q′₀ = ε-closure({${P(nfa.start)}}) = <span class="res">${SL(t.closureSet)}</span> = ${t.to}`;
      } else if (t.type === 'step') {
        const grew = t.closureSet.length > t.moveSet.length;
        const v = t.dead && t.isNew ? '<span class="verdict dead">dead state</span>' : t.isNew ? '<span class="verdict new">new state!</span>' : '<span class="verdict old">already known</span>';
        row = tok(t.from, 'is-from') + `<span class="reads">reads <kbd>${t.symbol}</kbd></span><span class="arrow" aria-hidden="true">→</span>` + tok(t.to, t.isNew ? 'is-new' : 'is-old') + v;
        const moved = t.moveSet.length ? `On ${t.symbol}, the states of ${SL(t.fromSet)} go to ${SL(t.moveSet)}` : `No state in ${SL(t.fromSet)} has a move on ${t.symbol}`;
        if (t.dead && t.isNew) { who = 'allan'; say = `${moved}, so nothing is left. A DFA must always move somewhere, so ∅ becomes a dead state.`; }
        else if (grew) { who = 'neha'; say = `${moved}, and ε-moves add ${SL(t.closureSet.filter((q) => !t.moveSet.includes(q)))}. ${t.isNew ? `That set is new, so it becomes ${t.to}.` : `That set is already ${t.to}, so no new state.`}`; }
        else if (!t.isNew) { who = 'pranet'; say = `${moved}. We already have that set as ${t.to}, so we only add the arrow ${t.from} → ${t.to}.`; }
        else if (t.accept) { who = 'haritha'; say = `${moved}. That set is new, so it becomes ${t.to}, and it contains an accepting NFA state, so ${t.to} accepts.`; }
        else { who = 'allan'; say = `${moved}. We haven't seen that set before, so it becomes new state ${t.to}.`; }
        const parts = t.parts.map((p) => `δ(${P(p.q)},${t.symbol})`).join(' ∪ ') || '∅';
        const vals = t.parts.map((p) => SL(p.to)).join(' ∪ ') || '∅';
        eq = `δ′(${t.from}, ${t.symbol}) = ε-closure( ${parts} )<br><span class="dim">= ε-closure( ${vals} )</span><br>` +
          (grew ? `<span class="dim">= ε-closure( ${SL(t.moveSet)} )</span><br>` : '') + `= <span class="res">${SL(t.closureSet)}</span> = ${t.to}`;
      } else {
        const acc = dfa.states.filter((s) => s.accept).map((s) => s.id);
        row = `<span class="done-line">Every state has a move on every symbol.</span><span class="verdict done">done ✓</span>`;
        who = 'haritha';
        say = `Nothing is left to expand. The accepting DFA states are the sets that contain an accepting NFA state${acc.length ? `: ${acc.join(', ')}` : ', and here there are none'}.`;
        eq = `${dfa.states.length} DFA states · F′ = {${acc.join(', ')}}`;
      }
      const w = byId[who];
      $('.now').innerHTML = `<div class="now-row">${row}</div><div class="now-say">${bust(who)}<p><span class="who">${w.name}</span> ${say}</p></div>`;
      if (forward) { $('.now').classList.remove('pop'); void $('.now').offsetWidth; $('.now').classList.add('pop'); }

      /* the working, for anyone who opens it */
      $('.eq').innerHTML = eq;
      const chip = (id, cls) => `<span class="chip ${cls}"><b>${id}</b> ${id === '∅' ? '' : SL(st(id).set)}</span>`;
      $('.c-q').innerHTML = t.queue.length ? t.queue.map((id) => chip(id, 'pend')).join('') : '<span class="empty">nothing left</span>';
      $('.c-m').innerHTML = t.marked.length ? t.marked.map((id) => chip(id, t.type === 'step' && id === t.from ? 'cur' : 'doneC')).join('') : '<span class="empty">none yet</span>';
      const rows = t.states.map((id) => {
        const s = st(id);
        const cells = dfa.alphabet.map((a) => {
          const cur = t.type === 'step' && t.from === id && t.symbol === a;
          return known.has(`${id}|${a}`) ? `<td class="cell${cur ? ' cur' : ''}">${dfa.delta[id][a]}</td>` : '<td class="cell pending">·</td>';
        }).join('');
        return `<tr><td class="mk">${s.start ? '→' : ''}${s.accept ? '*' : ''}</td><td>${id}</td><td class="set">${id === '∅' ? '∅' : SL(s.set)}</td>${cells}</tr>`;
      }).join('');
      $('.c-t').innerHTML = `<thead><tr><th></th><th>DFA</th><th>NFA set</th>${dfa.alphabet.map((a) => `<th class="sym">${a}</th>`).join('')}</tr></thead><tbody>${rows}</tbody>`;

      $('.pl-count').textContent = `step ${i + 1} of ${trace.length}`;
      $('[data-a="prev"]').disabled = i === 0;
      $('[data-a="next"]').disabled = last;
      host.querySelectorAll('.pl-ticks button').forEach((b, k) => { b.classList.toggle('is-on', k === i); b.classList.toggle('done', k < i); });
      const done = $('.pl-done');
      done.hidden = !last;
      if (last) {
        done.innerHTML = `<div><span class="hand">it works!</span><strong>The DFA is complete: ${dfa.states.length} state${dfa.states.length === 1 ? '' : 's'}.</strong></div><button class="btn btn--brass" type="button" data-a="final">View final DFA →</button>`;
        stop();
      }
      prev = i;
    }
    function go(k) { i = Math.max(0, Math.min(trace.length - 1, k)); render(); }
    function stop() { clearInterval(timer); timer = null; const b = $('[data-a="play"]'); b.innerHTML = '▶ Play'; b.setAttribute('aria-pressed', 'false'); }
    function play() {
      if (timer) { stop(); return; }
      if (i >= trace.length - 1) go(0);
      const b = $('[data-a="play"]'); b.innerHTML = '❚❚ Pause'; b.setAttribute('aria-pressed', 'true');
      timer = setInterval(() => go(i + 1), opts.speed || 3100);
    }
    host.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b || !host.contains(b)) return;
      const a = b.dataset.a;
      if (a === 'play') return play();
      stop();
      if (a === 'prev') go(i - 1);
      if (a === 'next') go(i + 1);
      if (a === 'reset') go(0);
      if ((a === 'skip' || a === 'final') && opts.onFinish) opts.onFinish();
    });
    $('.pl-ticks').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { stop(); go(+b.dataset.i); } });
    const api = { go, step: (d) => { stop(); go(i + d); }, stop, play, get i() { return i; }, host };
    render();
    return api;
  }

  AL.Player = Player;
  AL.PanZoom = PanZoom;
  AL.layoutFor = layoutFor;
  AL.dfaLayout = dfaLayout;
  AL.fitSvg = fit;
})(window);
