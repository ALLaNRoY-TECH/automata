/* Automata Lab — visual NFA editor.
   Edits the same NFA object the text format produces. Every change calls
   onChange(nfa); the app turns it back into text, so both views stay in sync.
   Tools: select/move, add state, add transition, erase. Undo keeps 60 steps.
   The alphabet box is the declaration of Σ. The editor never changes Σ on its
   own: an arrow symbol outside Σ is refused with a message, a symbol still on
   an arrow cannot be removed from Σ, and a new arrow is only a draft (not part
   of the NFA) until its symbols are typed. */

(function (global) {
  const AL = global.AL;
  const { Render, Engine } = AL;
  const EPS = Engine.EPS;
  const W = 800, H = 460, R = 32;
  const splitList = (s) => s.replace(/[{}]/g, ' ').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  function GraphEditor(svg, ui) {
    let nfa = { states: [], alphabet: [], start: '', accept: [], delta: {}, pos: {} };
    let tool = 'move', sel = null, pending = null, drag = null, undo = [], draft = null;

    const tips = {
      move: 'Drag states to move them. Click a state or an arrow to edit it.',
      state: 'Click an empty spot on the paper to add a state.',
      edge: 'Click the state the arrow starts from, then the state it goes to. Click the same state twice for a loop.',
      delete: 'Click a state or an arrow to erase it.'
    };

    function snapshot() { undo.push(JSON.stringify(nfa)); if (undo.length > 60) undo.shift(); }
    function changed() { render(); ui.onChange(Engine.clone(nfa)); }
    function clamp(p) { return { x: Math.max(96, Math.min(W - 50, p.x)), y: Math.max(64, Math.min(H - 50, p.y)) }; }

    function fitPositions() {
      const missing = nfa.states.filter((q) => !nfa.pos[q]);
      if (!missing.length) return;
      if (missing.length === nfa.states.length) {
        const m = Render.nfaModel(nfa);
        const L = Render.layered(nfa.states, m.edges, nfa.start || nfa.states[0], { gapX: 170, gapY: 130 }).pos;
        const xs = Object.values(L).map((p) => p.x), ys = Object.values(L).map((p) => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        const k = Math.min(1, (W - 230) / Math.max(1, maxX - minX), (H - 170) / Math.max(1, maxY - minY));
        const ox = 130 + ((W - 230) - (maxX - minX) * k) / 2, oy = 95 + ((H - 170) - (maxY - minY) * k) / 2;
        for (const q of nfa.states) nfa.pos[q] = clamp({ x: ox + (L[q].x - minX) * k, y: oy + (L[q].y - minY) * k });
      } else {
        missing.forEach((q, i) => { nfa.pos[q] = clamp({ x: 140 + (i % 5) * 120, y: H - 80 - Math.floor(i / 5) * 90 }); });
      }
    }

    const meaning = (n) => Engine.serializeNFA(n);
    function setNFA(n) {
      const old = nfa.pos || {};
      // a different automaton replaces the old one completely: its undo history and drafts go too
      if (meaning(n) !== meaning(nfa)) { undo = []; draft = null; pending = null; }
      nfa = Engine.clone(n);
      nfa.pos = {};
      for (const q of nfa.states) if (old[q]) nfa.pos[q] = old[q];
      if (n.pos) for (const q of nfa.states) if (n.pos[q]) nfa.pos[q] = n.pos[q];
      fitPositions();
      if (sel && sel.type === 'node' && !nfa.states.includes(sel.id)) sel = null;
      if (sel && sel.type === 'edge' && !isDraft(sel.id) && !edgeSyms(...sel.id.split('>')).length) sel = null;
      ui.alpha.value = nfa.alphabet.join(', ');
      ui.alpha.removeAttribute('aria-invalid');
      render();
    }

    function render() {
      const model = Render.nfaModel(nfa);
      if (draft && !(nfa.states.includes(draft.from) && nfa.states.includes(draft.to))) draft = null;
      if (draft) model.edges.push({ from: draft.from, to: draft.to, label: '?' });
      svg.innerHTML = Render.graph(model, nfa.pos, { r: R }) + '<line class="ghost" x1="0" y1="0" x2="0" y2="0" visibility="hidden"/>';
      svg.querySelectorAll('.edge').forEach((g) => {
        const hit = g.querySelector('.edge-path').cloneNode();
        hit.setAttribute('class', 'edge-hit'); hit.removeAttribute('pathLength');
        g.insertBefore(hit, g.firstChild);
        if (sel && sel.type === 'edge' && sel.id === g.dataset.edge) g.classList.add('sel');
        if (isDraft(g.dataset.edge)) g.classList.add('draft');
      });
      svg.querySelectorAll('.node').forEach((g) => {
        if (sel && sel.type === 'node' && sel.id === g.dataset.node) g.classList.add('sel');
        if (pending === g.dataset.node) g.classList.add('pending');
      });
      if (!nfa.states.length) svg.insertAdjacentHTML('beforeend', `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" style="font-family:var(--f-hand);font-size:30px;fill:var(--ink-2)">choose “+ State” and click here to begin</text>`);
      panel();
    }

    function pt(e) {
      const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      return p.matrixTransform(svg.getScreenCTM().inverse());
    }
    function nextName() { let k = 0; while (nfa.states.includes('q' + k)) k++; return 'q' + k; }

    function addState(p) {
      snapshot();
      const id = nextName();
      nfa.states.push(id); nfa.pos[id] = clamp(p);
      if (!nfa.start) nfa.start = id;
      sel = { type: 'node', id };
      changed();
    }
    function removeState(id) {
      snapshot();
      nfa.states = nfa.states.filter((q) => q !== id);
      nfa.accept = nfa.accept.filter((q) => q !== id);
      if (nfa.start === id) nfa.start = nfa.states[0] || '';
      delete nfa.delta[id]; delete nfa.pos[id];
      for (const row of Object.values(nfa.delta)) for (const a of Object.keys(row)) { row[a] = row[a].filter((r) => r !== id); if (!row[a].length) delete row[a]; }
      sel = null; changed();
    }
    const isDraft = (id) => !!draft && id === `${draft.from}>${draft.to}`;
    function edgeSyms(from, to) { return Object.entries(nfa.delta[from] || {}).filter(([, t]) => t.includes(to)).map(([a]) => a); }
    function setEdge(from, to, syms) {
      const row = nfa.delta[from] || (nfa.delta[from] = {});
      for (const a of Object.keys(row)) { row[a] = row[a].filter((r) => r !== to); if (!row[a].length) delete row[a]; }
      for (const a of syms) { row[a] = [...new Set([...(row[a] || []), to])]; row[a].sort((x, y) => nfa.states.indexOf(x) - nfa.states.indexOf(y)); }
      if (!Object.keys(row).length) delete nfa.delta[from];
    }
    /* A new arrow is a draft: drawn dashed, not in the NFA, until symbols are typed. */
    function addEdge(from, to) {
      draft = edgeSyms(from, to).length ? null : { from, to };
      sel = { type: 'edge', id: `${from}>${to}` };
      render();
      const inp = ui.panel.querySelector('#edSyms'); if (inp) { inp.focus(); inp.select(); }
    }
    function dropDraft() { if (draft) { draft = null; return true; } return false; }
    function symbolsProblem(list) {
      for (const a of list) {
        if (a === EPS) continue;
        const pr = Engine.symbolProblem(a); if (pr) return pr;
        if (!nfa.alphabet.includes(a)) {
          return nfa.alphabet.length ? `“${a}” is not in the alphabet {${nfa.alphabet.join(', ')}}. Add it to the Alphabet box first, or use one of those symbols.`
            : `The Alphabet box is empty. Type the alphabet there first (for example a, b), then label the arrow.`;
        }
      }
      return null;
    }

    function panel() {
      const p = ui.panel;
      if (!sel) { p.hidden = true; p.innerHTML = ''; return; }
      p.hidden = false;
      if (sel.type === 'node') {
        const q = sel.id;
        p.innerHTML = `<div class="row"><label>Name <input type="text" id="edName" value="${esc(q)}" maxlength="12"></label>` +
          `<label><input type="checkbox" id="edStart" ${nfa.start === q ? 'checked' : ''}> start state</label>` +
          `<label><input type="checkbox" id="edAcc" ${nfa.accept.includes(q) ? 'checked' : ''}> accepting</label>` +
          `<button class="btn btn--quiet btn--sm" type="button" id="edDel">Erase state</button></div>`;
        p.querySelector('#edName').addEventListener('change', (e) => rename(q, e.target.value.trim(), e.target));
        p.querySelector('#edStart').addEventListener('change', (e) => { snapshot(); nfa.start = e.target.checked ? q : (nfa.start === q ? '' : nfa.start); changed(); });
        p.querySelector('#edAcc').addEventListener('change', (e) => { snapshot(); nfa.accept = e.target.checked ? [...nfa.accept, q] : nfa.accept.filter((x) => x !== q); nfa.accept.sort((a, b) => nfa.states.indexOf(a) - nfa.states.indexOf(b)); changed(); });
        p.querySelector('#edDel').addEventListener('click', () => removeState(q));
      } else {
        const [from, to] = sel.id.split('>');
        const syms = edgeSyms(from, to).map((a) => (a === EPS ? 'eps' : a));
        p.innerHTML = `<div class="row"><label>${esc(from)} → ${esc(to)} on <input type="text" id="edSyms" value="${esc(syms.join(', '))}"></label>` +
          `<span style="font-size:13.5px;color:var(--ink-2)">symbols separated by commas, <code>eps</code> for ε</span>` +
          `<button class="btn btn--quiet btn--sm" type="button" id="edDel">Erase arrow</button></div>`;
        const inp = p.querySelector('#edSyms');
        inp.addEventListener('change', () => {
          const list = [...new Set(splitList(inp.value).map((a) => (Engine.EPS_WORDS.includes(a.toLowerCase()) ? EPS : a)))];
          const bad = symbolsProblem(list);
          if (bad) { inp.setAttribute('aria-invalid', 'true'); ui.tip.textContent = bad; return; }
          inp.removeAttribute('aria-invalid');
          if (!list.length && dropDraft()) { sel = null; render(); ui.tip.textContent = 'Arrow discarded: it had no symbols.'; return; }
          snapshot();
          draft = null;
          setEdge(from, to, list);
          if (!list.length) sel = null;
          changed();
          ui.tip.textContent = tips[tool];
        });
        p.querySelector('#edDel').addEventListener('click', () => { if (dropDraft()) { sel = null; render(); return; } snapshot(); setEdge(from, to, []); sel = null; changed(); });
      }
    }

    function rename(q, n, input) {
      if (n === q) return;
      const pr = Engine.nameProblem(n);
      if (pr) { input.setAttribute('aria-invalid', 'true'); ui.tip.textContent = pr; return; }
      if (nfa.states.includes(n)) { input.setAttribute('aria-invalid', 'true'); ui.tip.textContent = `There is already a state called ${n}.`; return; }
      snapshot();
      const sw = (x) => (x === q ? n : x);
      nfa.states = nfa.states.map(sw); nfa.accept = nfa.accept.map(sw); nfa.start = sw(nfa.start);
      const d = {};
      for (const [s, row] of Object.entries(nfa.delta)) { d[sw(s)] = {}; for (const [a, t] of Object.entries(row)) d[sw(s)][a] = t.map(sw); }
      nfa.delta = d; nfa.pos[n] = nfa.pos[q]; delete nfa.pos[q];
      sel = { type: 'node', id: n };
      changed();
    }

    svg.addEventListener('pointerdown', (e) => {
      const node = e.target.closest('.node'), edge = e.target.closest('.edge');
      const p = pt(e);
      if (draft && !(edge && isDraft(edge.dataset.edge))) { draft = null; if (sel && sel.type === 'edge' && !edgeSyms(...sel.id.split('>')).length) sel = null; }
      if (tool === 'delete') {
        if (node) removeState(node.dataset.node);
        else if (edge) { if (isDraft(edge.dataset.edge)) { draft = null; sel = null; render(); return; } snapshot(); setEdge(edge.dataset.from, edge.dataset.to, []); sel = null; changed(); }
        return;
      }
      if (tool === 'state') { if (!node) addState(p); else { sel = { type: 'node', id: node.dataset.node }; render(); } return; }
      if (tool === 'edge') {
        if (!node) { pending = null; render(); ui.tip.textContent = tips.edge; return; }
        const id = node.dataset.node;
        if (!pending) { pending = id; render(); ui.tip.textContent = `From ${id}. Now click the state the arrow goes to.`; svg.setPointerCapture(e.pointerId); return; }
        const from = pending; pending = null; addEdge(from, id); ui.tip.textContent = 'Type the symbols for this arrow below, then press Enter.';
        return;
      }
      // move / select
      if (node) {
        const id = node.dataset.node;
        sel = { type: 'node', id };
        drag = { id, dx: nfa.pos[id].x - p.x, dy: nfa.pos[id].y - p.y, moved: false, snap: JSON.stringify(nfa) };
        svg.setPointerCapture(e.pointerId);
        render();
      } else if (edge) { sel = { type: 'edge', id: edge.dataset.edge }; render(); }
      else { sel = null; render(); }
    });
    svg.addEventListener('pointermove', (e) => {
      const p = pt(e);
      if (drag) {
        nfa.pos[drag.id] = clamp({ x: p.x + drag.dx, y: p.y + drag.dy });
        drag.moved = true;
        render();
      } else if (pending) {
        const g = svg.querySelector('.ghost'), a = nfa.pos[pending];
        if (g && a) { g.setAttribute('x1', a.x); g.setAttribute('y1', a.y); g.setAttribute('x2', p.x); g.setAttribute('y2', p.y); g.setAttribute('visibility', 'visible'); }
      }
    });
    svg.addEventListener('pointerup', (e) => {
      if (drag) { if (drag.moved) { undo.push(drag.snap); ui.onChange(Engine.clone(nfa)); } drag = null; }
      if (pending && tool === 'edge') {
        const el = document.elementFromPoint(e.clientX, e.clientY), node = el && el.closest && el.closest('#edSvg .node');
        if (node && node.dataset.node !== pending) { const from = pending; pending = null; addEdge(from, node.dataset.node); ui.tip.textContent = 'Type the symbols for this arrow below, then press Enter.'; }
      }
    });

    function setTool(t) {
      tool = t; pending = null;
      if (dropDraft() && sel && sel.type === 'edge' && !edgeSyms(...sel.id.split('>')).length) sel = null;
      ui.tools.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
      ui.tip.textContent = tips[t];
      render();
    }
    ui.tools.forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
    ui.undo.addEventListener('click', doUndo);
    function doUndo() {
      if (!undo.length) { ui.tip.textContent = 'Nothing to undo.'; return; }
      nfa = JSON.parse(undo.pop()); sel = null; pending = null; draft = null;
      ui.alpha.value = nfa.alphabet.join(', ');
      changed(); ui.tip.textContent = 'Undone.';
    }
    ui.alpha.addEventListener('change', () => {
      const list = [...new Set(splitList(ui.alpha.value))];
      const bad = list.map((a) => Engine.symbolProblem(a)).find(Boolean);
      // a symbol that arrows still use cannot disappear from Σ: say which arrow, change nothing
      const used = !bad && nfa.states.flatMap((q) => Object.entries(nfa.delta[q] || {}).filter(([a, t]) => a !== EPS && t.length && !list.includes(a)).map(([a, t]) => [a, q, t[0]]))[0];
      const msg = bad || (used && `“${used[0]}” is still used on the arrow ${used[1]} → ${used[2]}. Change or erase that arrow before removing “${used[0]}” from the alphabet.`);
      if (msg) { ui.alpha.setAttribute('aria-invalid', 'true'); ui.tip.textContent = msg; return; }
      ui.alpha.removeAttribute('aria-invalid');
      if (list.join() === nfa.alphabet.join()) return;
      snapshot();
      nfa.alphabet = list;
      changed();
      ui.tip.textContent = `Alphabet is now {${list.join(', ')}}.`;
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && svg.closest('[hidden]') === null && document.activeElement && !/TEXTAREA|INPUT/.test(document.activeElement.tagName)) { e.preventDefault(); doUndo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && document.activeElement === document.body && svg.closest('[hidden]') === null) {
        e.preventDefault();
        if (sel.type === 'node') removeState(sel.id); else if (dropDraft()) { sel = null; render(); } else { const [f, t] = sel.id.split('>'); snapshot(); setEdge(f, t, []); sel = null; changed(); }
      }
    });
    ui.tip.textContent = tips.move;
    return { setNFA, get nfa() { return Engine.clone(nfa); }, render };
  }

  AL.GraphEditor = GraphEditor;
})(window);
