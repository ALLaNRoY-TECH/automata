/* Automata Lab — page controller.
   Story: hero lineup, cast pairs, the scroll-built N₁ stage, the power-set
   spread, the iris into the lab.
   Lab: four stages, one at a time — input, NFA table, conversion, final DFA
   (with an optional string tester). Every table, diagram and sentence in the
   lab is derived from Engine.subsetConstruction(nfa) for the submitted NFA. */

(function () {
  const AL = window.AL;
  const { cast, figureSVG, figureDefs, Engine, SAMPLES, PRESETS, Render } = AL;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const byId = Object.fromEntries(cast.map((c) => [c.id, c]));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SL = Render.setLabel;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const bust = (id) => `<div class="bust">${figureSVG(byId[id], { crop: 'bust' })}</div>`;
  const smooth = reduce ? 'auto' : 'smooth';

  $('#defs').innerHTML = figureDefs;
  if (!reduce && 'IntersectionObserver' in window) document.documentElement.classList.add('js-motion');

  /* ---------------- A. hero lineup ---------------- */
  const lineup = $('#lineup');
  if (!reduce) lineup.classList.add('idle');
  lineup.innerHTML = cast.map((c) =>
    `<button class="mate" type="button" data-id="${c.id}" aria-label="${c.name}, ${c.symbol}, ${c.role}. Say hi.">` +
    `<span class="bubble" aria-hidden="true">${c.note}</span>` +
    `<div class="fig-wrap">${figureSVG(c)}</div>` +
    `<span class="mate-tag"><span class="hand">${c.name}</span><span class="math">${c.symbol}</span></span></button>`).join('');
  const lit = (id, on) => { const s = $(`#tuple [data-sym="${id}"]`); if (s) s.classList.toggle('is-lit', on); };
  $$('.mate').forEach((m) => {
    ['mouseenter', 'focus'].forEach((e) => m.addEventListener(e, () => lit(m.dataset.id, true)));
    ['mouseleave', 'blur'].forEach((e) => m.addEventListener(e, () => lit(m.dataset.id, false)));
    m.addEventListener('click', () => {
      $$('.mate.talk').forEach((x) => x !== m && x.classList.remove('talk'));
      m.classList.remove('hop'); void m.offsetWidth; m.classList.add('hop', 'talk');
      clearTimeout(m._t); m._t = setTimeout(() => m.classList.remove('talk'), 2600);
    });
  });

  /* ---------------- B. cast pairs ---------------- */
  const GROUPS = [
    { title: 'the ones who build the world', tag: 'Q · Σ' },
    { title: 'the ones who move through it', tag: 'δ · ε' },
    { title: 'the one who begins, and the one who decides', tag: 'q₀ · F' }
  ];
  $('#groups').innerHTML = GROUPS.map((g, gi) => `<div class="group group--${gi}"><div class="group-head"><h3><span class="mark">${g.title}</span></h3><span class="math">${g.tag}</span></div>` +
    cast.filter((c) => c.group === gi).map((c, i) => `<article class="member rv${i ? ' d1' : ''}" id="m-${c.id}" tabindex="0" aria-label="${c.name}, ${c.role}">` +
      `<div class="member-fig">${figureSVG(c)}</div>` +
      `<div class="member-text"><span class="member-sym">${c.symbol}</span><h4 class="member-name">${c.name}</h4><span class="label member-role">${c.symbol} · ${c.role}</span>` +
      `<p class="member-line">${c.line}</p><p class="member-why">${c.why}</p><span class="member-def">${c.def}</span><br><span class="member-note">${c.note}</span></div></article>`).join('') + `</div>`).join('');
  $('#credits').innerHTML = cast.map((c) => `<div><span class="hand">${c.name}</span><span class="math">${c.symbol}</span> · ${c.role}</div>`).join('');

  /* eyes follow the pointer */
  let eyeRaf = 0, px = 0, py = 0;
  window.addEventListener('pointermove', (e) => {
    px = e.clientX; py = e.clientY;
    if (eyeRaf || reduce || $('#story').hidden) return;
    eyeRaf = requestAnimationFrame(() => {
      eyeRaf = 0;
      $$('.mate .fig, .member .fig').forEach((svg) => {
        const r = svg.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const cx = r.left + r.width * .5, cy = r.top + r.height * .17;
        const dx = Math.max(-1, Math.min(1, (px - cx) / 260)), dy = Math.max(-1, Math.min(1, (py - cy) / 260));
        svg.querySelectorAll('.fig-body .eyes').forEach((g) => { g.style.transform = `translate(${dx * 2.4}px, ${dy * 1.8}px)`; });
      });
    });
  }, { passive: true });

  /* ---------------- C. the stage: cast → N₁ ---------------- */
  const N1 = SAMPLES.n1;
  const stageSvg = $('#stageSvg');
  const SP = { q0: { x: 150, y: 240, d: 0 }, q1: { x: 380, y: 240, d: 1 }, q2: { x: 610, y: 240, d: 2 } };
  const FLOOR = 340, FIG_S = .425; // figures 25% larger than the original .34 (user request)
  const rowX = [100, 212, 324, 436, 548, 660];
  const target = ['q0', 'q0', 'q1', 'q1', 'q2', 'q2'];
  const stageOrder = ['allan', 'aadhi', 'pranet', 'abhinesh', 'haritha', 'neha'];
  stageSvg.innerHTML =
    `<g class="sigma" transform="translate(40 34)"><text x="0" y="26">Σ =</text><rect x="52" y="0" width="36" height="36" rx="3"/><text class="chip" x="70" y="25" text-anchor="middle">0</text><rect x="98" y="0" width="36" height="36" rx="3"/><text class="chip" x="116" y="25" text-anchor="middle">1</text></g>` +
    Render.graph(Render.nfaModel(N1), SP, { r: 44 }) +
    `<g class="nd-note"><path d="M150 296 C152 330 160 350 200 352 L340 352 C372 350 378 330 380 296"/><text x="265" y="384" text-anchor="middle">one “1”, two places to be</text></g>` +
    `<g class="eps-note"><path d="M520 74 C478 84 446 116 424 168"/><text x="530" y="66">no ε-arrows in N₁,</text><text x="530" y="92">so each ε-closure</text><text x="530" y="118">is the set itself</text></g>` +
    `<g class="lang"><text class="big" x="380" y="410" text-anchor="middle">L(N₁) = { w ∈ {0,1}* :</text><text class="big" x="380" y="440" text-anchor="middle">the second-to-last symbol of w is 1 }</text></g>` +
    `<g class="actors">${stageOrder.map((id, i) => `<g class="actor" data-i="${i}">${AL.drawStudent(byId[id])}</g>`).join('')}</g>`;
  $$('.node-c, .node-acc', stageSvg).forEach((c) => c.setAttribute('pathLength', '1'));
  const actors = $$('.actor', stageSvg);
  const narrow = window.matchMedia('(max-width: 900px)');
  const fitStage = () => stageSvg.setAttribute('viewBox', narrow.matches ? '28 20 664 440' : '0 0 760 460');
  fitStage();
  if (narrow.addEventListener) narrow.addEventListener('change', fitStage);
  function placeActors(collapsed) {
    actors.forEach((g, i) => {
      if (!collapsed) { g.style.transform = `translate(${rowX[i] - 120 * FIG_S}px, ${FLOOR - 500 * FIG_S}px) scale(${FIG_S})`; g.style.opacity = 1; }
      else { const p = SP[target[i]], s = .03; g.style.transform = `translate(${p.x - 120 * s}px, ${p.y - 260 * s}px) scale(${s})`; g.style.opacity = 0; }
    });
  }
  const CAPS = [
    { who: null, text: 'Six friends stand on a line. Nothing is defined yet. Keep scrolling, and each of us draws one piece of the machine.', formal: 'M = ( ?, ?, ?, ?, ? )' },
    { who: 'allan', text: 'Allan counts the places the machine can be, and the six of us fold into three states. That list is Q.', formal: 'Q = {q₀, q₁, q₂}' },
    { who: 'aadhi', text: 'Aadhi hands out the only symbols this world can read. Nothing else is allowed on the tape. That set is Σ.', formal: 'Σ = {0, 1}' },
    { who: 'pranet', text: 'Pranet draws the arrows. δ tells each state where to go on each symbol, and from q₀ a single 1 leads to two places.', formal: 'δ(q₀,0) = {q₀}   δ(q₀,1) = {q₀,q₁}   δ(q₁,0) = δ(q₁,1) = {q₂}' },
    { who: 'abhinesh', text: 'Abhinesh walks in first. Every run of the machine starts at q₀, the state with the arrow marked start.', formal: 'start state: q₀' },
    { who: 'haritha', text: 'Haritha draws the second circle. If the input ends while we are in q₂, the string is accepted. That set is F.', formal: 'F = {q₂}' },
    { who: 'neha', text: 'Neha moves without reading anything: an ε-move. N₁ has none, so its nondeterminism comes only from δ(q₀, 1) having two answers.', formal: 'ε-closure({q₀}) = {q₀}' },
    { who: null, text: 'That is N₁, sketched by all six of us. To run it deterministically, we follow every state it could be in at once. That is the trick on the next page.', formal: 'N₁ = ({q₀,q₁,q₂}, {0,1}, δ, q₀, {q₂})' }
  ];
  $('#caption').innerHTML = CAPS.map((c, i) => {
    const w = c.who && byId[c.who];
    return `<div class="cap" data-i="${i}">` +
      (w ? `<div class="cap-who">${bust(c.who)}<span class="hand">${w.name}</span><span class="math">${w.symbol}</span></div>`
        : `<div class="cap-who"><span class="hand">${i ? 'all six of us' : 'before'}</span></div>`) +
      `<p>${c.text}</p><span class="formal">${c.formal}</span></div>`;
  }).join('');
  $('#stageSteps').innerHTML = CAPS.map((_, i) => `<li><button type="button" data-i="${i}" aria-label="Step ${i + 1}">${i + 1}</button></li>`).join('');
  let stageStep = -1;
  function setStage(i) {
    if (i === stageStep) return;
    stageStep = i;
    for (let k = 1; k < CAPS.length; k++) stageSvg.classList.toggle('s' + k, k <= i);
    placeActors(i >= 1);
    ['q0>q0', 'q0>q1'].forEach((k) => { const e = $(`[data-edge="${k}"]`, stageSvg); if (e) e.classList.toggle('is-hi', i === 6); });
    $$('.cap').forEach((c) => c.classList.toggle('is-on', +c.dataset.i === i));
    $$('#stageSteps button').forEach((b) => { b.classList.toggle('is-on', +b.dataset.i === i); b.classList.toggle('is-done', +b.dataset.i < i); });
  }
  const stage = $('#machine');
  const stageProgress = () => { const r = stage.getBoundingClientRect(); return Math.min(1, Math.max(0, -r.top / (stage.offsetHeight - innerHeight))); };
  $('#stageSteps').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const i = +b.dataset.i;
    window.scrollTo({ top: stage.offsetTop + (stage.offsetHeight - innerHeight) * ((i + .5) / CAPS.length), behavior: smooth });
    setStage(i);
  });

  /* ---------------- D. power-set spread (computed from N₁) ---------------- */
  const n1res = Engine.subsetConstruction(N1);
  (function lattice() {
    const Q = N1.states, n = Q.length;
    const subsets = [];
    for (let m = 0; m < 1 << n; m++) subsets.push(Q.filter((_, k) => m & (1 << k)));
    const byLevel = {};
    subsets.forEach((s) => (byLevel[s.length] = byLevel[s.length] || []).push(s));
    const pos = {};
    Object.entries(byLevel).forEach(([k, list]) => list.forEach((s, j) => { pos[s.join(',')] = { x: 280 + (j - (list.length - 1) / 2) * 180, y: 350 - k * 98 }; }));
    const reach = new Map(n1res.dfa.states.map((st) => [st.set.join(','), st.id]));
    let links = '', boxes = '';
    subsets.forEach((a) => subsets.forEach((b) => {
      if (b.length === a.length + 1 && a.every((q) => b.includes(q))) { const p = pos[a.join(',')], q = pos[b.join(',')]; links += `<line class="lk" pathLength="1" style="--d:${((a.length * .3 + .25) / .55).toFixed(2)}s" x1="${p.x}" y1="${p.y - 20}" x2="${q.x}" y2="${q.y + 20}"/>`; }
    }));
    subsets.forEach((s) => {
      const p = pos[s.join(',')], id = reach.get(s.join(','));
      const w = s.length >= 2 ? 34 + s.length * 30 : 64;
      boxes += `<g class="lb${id ? ' reach' : ''}" style="--d:${(s.length * .3 / .55).toFixed(2)}s"><rect class="ln-box" x="${p.x - w / 2}" y="${p.y - 20}" width="${w}" height="40" rx="20"/>` +
        `<text class="ln-t" x="${p.x}" y="${p.y + 5}" text-anchor="middle">${SL(s)}</text>` + (id ? `<text class="ln-id" x="${p.x + w / 2 + 8}" y="${p.y + 6}">${id}</text>` : '') + `</g>`;
    });
    $('#lattice').innerHTML = links + boxes + `<text class="cap-t" x="0" y="404">all ${subsets.length} subsets of Q, joined by ⊆</text><text class="cap-t" x="560" y="404" text-anchor="end">green: reachable from {q₀}</text>`;
    const r = n1res.dfa.states.length;
    $('#facts').innerHTML =
      `<div class="fact"><span class="label">Rabin and Scott, 1959</span><p><strong>Same power.</strong>Every language an NFA accepts is accepted by some DFA. Nondeterminism adds convenience, never new languages.</p></div>` +
      `<div class="fact"><span class="label">The price</span><p><strong>Up to 2ⁿ.</strong>An NFA with n states can need as many as 2ⁿ DFA states. We only build the ones we can reach.</p></div>` +
      `<div class="fact"><span class="label">For N₁, computed</span><p><strong>${subsets.length} → ${r}.</strong>Q has ${n} states, so there are ${subsets.length} subsets. Starting from {q₀}, exactly ${r} are reachable.</p></div>`;
  })();

  /* ---------------- reveals, nav, progress ---------------- */
  if (document.documentElement.classList.contains('js-motion')) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .14 });
    $$('.rv, .spread').forEach((el) => io.observe(el));
    const mo = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('on'); mo.unobserve(e.target); } }), { threshold: 1, rootMargin: '0px 0px -12% 0px' });
    $$('#story .mark').forEach((el) => mo.observe(el));
  }
  const nav = $('#nav'), bar = $('#progress');
  const heroTitle = $('.hero-title'), heroTuple = $('#tuple'), heroLine = $('#lineup'), enterSec = $('#enter'), enterRing = $('.enter-ring');
  let lastY = scrollY, ticking = false;
  function onScroll() {
    ticking = false;
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    if (Math.abs(y - lastY) > 6) { nav.classList.toggle('is-hidden', y > lastY && y > 240 && $('#lab').hidden); lastY = y; }
    if (!$('#story').hidden) {
      setStage(Math.min(CAPS.length - 1, Math.floor(stageProgress() * CAPS.length)));
      let on = null;
      ['cast', 'machine', 'reveal'].forEach((id) => { const r = $('#' + id).getBoundingClientRect(); if (r.top < innerHeight * .5 && r.bottom > innerHeight * .5) on = id; });
      $$('#navLinks a[data-sec]').forEach((a) => a.classList.toggle('is-on', a.dataset.sec === on));
      if (!reduce) {
        if (y < innerHeight * 1.3) { /* restrained parallax: title drifts up, cast drifts down */
          heroTitle.style.transform = `translateY(${(-y * .07).toFixed(1)}px)`;
          heroTuple.style.transform = `translateY(${(y * .12).toFixed(1)}px)`;
          heroLine.style.transform = `translateY(${(y * .05).toFixed(1)}px)`;
        }
        const er = enterSec.getBoundingClientRect();
        enterRing.style.setProperty('--p', Math.min(1, Math.max(0, (innerHeight - er.top) / (innerHeight * .85))).toFixed(3));
      }
    }
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);

  /* ---------------- views + iris ---------------- */
  const iris = $('#iris'), dot = $('i', iris);
  let labBooted = false;
  function show(view) {
    $('#story').hidden = view !== 'story';
    $('#lab').hidden = view !== 'lab';
    document.body.classList.toggle('in-lab', view === 'lab');
    if (view === 'lab' && !labBooted) { labBooted = true; bootLab(); }
    try { history.replaceState(null, '', view === 'lab' ? '#lab' : '#top'); } catch (e) { /* sandboxed */ }
  }
  function go(view, from) {
    const land = () => { window.scrollTo(0, view === 'story' && from ? $('#enter').offsetTop : 0); onScroll(); };
    if (reduce || !from) { show(view); land(); return; }
    const r = from.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    iris.className = 'iris'; dot.style.left = x + 'px'; dot.style.top = y + 'px'; dot.style.transform = 'scale(0)';
    void dot.offsetWidth;
    iris.classList.add('go'); dot.style.transform = `scale(${(R * 2) / 20 + 2})`;
    setTimeout(() => {
      show(view); land();
      iris.classList.add('out');
      setTimeout(() => { iris.className = 'iris'; dot.style.transform = 'scale(0)'; }, 1270);
    }, 1560);
  }
  $('#enterBtn').addEventListener('click', (e) => go('lab', e.currentTarget));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-go]'); if (!a || a.id === 'enterBtn') return;
    e.preventDefault();
    const v = a.dataset.go;
    if (v === 'story' && !$('#story').hidden) { scrollTo({ top: 0, behavior: smooth }); return; }
    if (v === 'lab' && !$('#lab').hidden) { scrollTo({ top: 0, behavior: smooth }); return; }
    go(v, a);
  });
  /* ================= LAB =================
     Four stages, one visible at a time:
       1 input (type / draw / example) with a live preview
       2 the NFA's transition table
       3 the subset construction, step by step
       4 the final DFA, its table, and an optional string tester
     Every table and diagram is computed from the NFA submitted in stage 1. */
  let editor = null, current = null, editorPos = null, reached = 1, stageNow = 1, player = null;

  function drawInto(svg, html, vb, animate) {
    svg.setAttribute('viewBox', vb);
    svg.innerHTML = html;
    if (animate && !reduce) {
      svg.classList.remove('draw-in'); void svg.getBoundingClientRect(); svg.classList.add('draw-in');
      const nodes = $$('.node', svg), edges = $$('.edge', svg);
      nodes.forEach((n, k) => n.style.setProperty('--d', `${(k * .14 / .55).toFixed(3)}s`));
      edges.forEach((g, k) => g.style.setProperty('--d', `${((Math.min(nodes.length, 8) * .14 + k * .08) / .55).toFixed(3)}s`));
    }
  }
  const rowGroups = (table) => $$('tbody tr', table).forEach((tr, k) => tr.style.setProperty('--g', Math.floor(k / 3)));

  /* ---------- stage switching ---------- */
  function setReached(n) {
    reached = n;
    $$('#stepper button').forEach((b) => { b.disabled = +b.dataset.s > reached; });
  }
  function goStage(n, opts = {}) {
    if (n > reached) return;
    if (stageNow === 3 && n !== 3 && player) player.stop();
    stageNow = n;
    $$('.lab-stage').forEach((s) => { s.hidden = +s.dataset.stage !== n; s.classList.remove('arrive'); });
    const el = $('#s' + n);
    if (!reduce) { void el.offsetWidth; el.classList.add('arrive'); }
    $$('#stepper button').forEach((b) => {
      const s = +b.dataset.s;
      if (s === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('is-done', s < n || (s < reached && s !== n));
    });
    if (opts.scroll !== false) {
      const top = $('#lab').getBoundingClientRect().top + scrollY;
      if (scrollY > top + 10) scrollTo({ top, behavior: smooth });
    }
    $('h2', el).setAttribute('tabindex', '-1');
    $('h2', el).focus({ preventScroll: true });
  }

  function bootLab() {
    $('#stepper').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.disabled) goStage(+b.dataset.s); });
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-to]'); if (b) goStage(+b.dataset.to); });
    $('#toTable').addEventListener('click', submitNFA);
    $('#toConvert').addEventListener('click', () => { setReached(Math.max(reached, 3)); renderConversion(); goStage(3); });
    $('#another').addEventListener('click', () => { goStage(1); $('#nfaText').focus({ preventScroll: true }); });
    bootInput();
  }

  /* ---------- stage 1: input ---------- */
  function bootInput() {
    const ta = $('#nfaText');
    $('#examples').innerHTML = PRESETS.map((p) => {
      const r = Engine.parseNFA(p.text);
      return `<button class="ex" type="button" data-p="${p.id}"><b>${esc(p.title)}</b><small>${esc(p.note)}</small>` +
        `<span class="mono">${r.nfa.states.length} states · Σ = {${r.nfa.alphabet.map(esc).join(', ')}}</span></button>`;
    }).join('');
    $('#examples').addEventListener('click', (e) => {
      const b = e.target.closest('.ex'); if (!b) return;
      ta.value = PRESETS.find((p) => p.id === b.dataset.p).text; editorPos = null;
      setMode('type'); onText(true); invalidate();
      ta.focus({ preventScroll: true });
    });
    ta.value = PRESETS[0].text;
    let t = 0;
    ta.addEventListener('input', () => { invalidate(); clearTimeout(t); t = setTimeout(() => onText(false), 250); });
    /* Start blank / Blank page: a new problem replaces the old one entirely, in the text and the drawing */
    const BLANK = 'States: \nAlphabet: \nStart: \nAccepting: \nTransitions:\n';
    const blank = () => { ta.value = BLANK; editorPos = null; invalidate(); const r = onText(true); editor.setNFA(r.nfa); return r; };
    $('#clearBtn').addEventListener('click', () => { blank(); ta.focus(); ta.setSelectionRange(8, 8); });
    $('#edBlank').addEventListener('click', () => { blank(); $('#edTip').textContent = 'Blank page. Type the alphabet first (for example a, b), then add states.'; $('#edAlpha').focus(); });
    editor = AL.GraphEditor($('#edSvg'), {
      tools: $$('.tool[data-tool]'), undo: $('#undoBtn'), alpha: $('#edAlpha'), tip: $('#edTip'), panel: $('#edPanel'),
      onChange: (n) => { editorPos = n.pos; ta.value = Engine.serializeNFA(n); invalidate(); onText(false, true); }
    });
    $('#modeType').addEventListener('click', () => setMode('type'));
    $('#modeDraw').addEventListener('click', () => setMode('draw'));
    $('#modeEx').addEventListener('click', () => setMode('ex'));
    $('.modes').addEventListener('keydown', (e) => {
      if (!/Arrow(Left|Right|Up|Down)/.test(e.key)) return;
      const tabs = $$('.mode'), k = tabs.indexOf(document.activeElement); if (k < 0) return;
      e.preventDefault(); const nx = tabs[(k + (/Right|Down/.test(e.key) ? 1 : tabs.length - 1)) % tabs.length]; nx.focus(); nx.click();
    });
    onText(true);
  }
  function setMode(m) {
    if (m === 'draw') {
      const r = Engine.parseNFA($('#nfaText').value);
      if (r.errors.length && r.nfa.states.length) { msgs(r, 'Fix the text first, then the drawing can show it.'); return; }
      editor.setNFA({ ...r.nfa, pos: editorPos || undefined });
    }
    const ids = { type: 'modeType', draw: 'modeDraw', ex: 'modeEx' };
    Object.entries(ids).forEach(([k, id]) => { $('#' + id).setAttribute('aria-selected', String(k === m)); $('#' + id).tabIndex = k === m ? 0 : -1; });
    $('#paneType').hidden = m !== 'type'; $('#paneDraw').hidden = m !== 'draw'; $('#paneEx').hidden = m !== 'ex';
    $('.in-grid').classList.toggle('drawing', m === 'draw');
  }
  /* any edit makes the later stages stale until Continue is pressed again */
  function invalidate() { if (reached > 1) { setReached(1); current = null; $$('#stepper button').forEach((b) => b.classList.remove('is-done')); } }

  function msgs(r, extra) {
    const errs = r.errors.map((e) => `<div class="msg err">${esc(e.msg)}</div>`).join('');
    const warns = r.warnings.map((w) => `<div class="msg warn">${esc(w)}</div>`).join('');
    const ok = !r.errors.length ? `<div class="msg okay">Looks good: ${r.nfa.states.length} states, ${r.nfa.alphabet.length} symbols${Engine.hasEps(r.nfa) ? ', with ε-moves' : ''}.</div>` : '';
    $('#msgs').innerHTML = (extra ? `<div class="msg err">${esc(extra)}</div>` : '') + errs + warns + ok;
    $('#nfaText').setAttribute('aria-invalid', r.errors.length ? 'true' : 'false');
  }
  let lastPreview = '';
  function onText(syncEditor, fromEditor) {
    const r = Engine.parseNFA($('#nfaText').value);
    msgs(r);
    if (!r.errors.length && editor && !fromEditor && (syncEditor || !$('#paneDraw').hidden)) editor.setNFA({ ...r.nfa, pos: editorPos || undefined });
    const frame = $('#previewFrame'), svg = $('#previewSvg');
    const ok = !r.errors.length && r.nfa.states.length;
    frame.classList.toggle('stale', !ok && !!lastPreview);
    $('.pv-stale', frame).hidden = ok || !lastPreview;
    if (ok) {
      const nfa = { ...r.nfa, pos: editorPos && r.nfa.states.every((q) => editorPos[q]) ? editorPos : undefined };
      const L = AL.layoutFor(nfa), key = Engine.serializeNFA(r.nfa);
      if (key !== lastPreview) { drawInto(svg, Render.graph(L.model, L.pos, { r: 40 }), L.vb, key.split('\n')[0] !== lastPreview.split('\n')[0]); AL.fitSvg(svg, L.vb, 1); lastPreview = key; }
    }
    $('#toTable').disabled = !!r.errors.length || !r.nfa.states.length;
    return r;
  }

  function submitNFA() {
    const r = onText(false);
    if (r.errors.length) { $('#msgs').scrollIntoView({ behavior: smooth, block: 'center' }); return; }
    const nfa = r.nfa;
    if (editorPos && nfa.states.every((q) => editorPos[q])) nfa.pos = editorPos;
    const res = Engine.subsetConstruction(nfa);
    if (res.error) { $('#msgs').insertAdjacentHTML('afterbegin', `<div class="msg err">${esc(res.error)}</div>`); return; }
    // calculate first, verify independently second, visualise third
    const text = $('#nfaText').value;
    const ver = AL.Verify.verifyConversion(text, nfa, res.dfa);
    if (!ver.ok) { showFailure($('#msgs'), 'conversion', { text, ver, nfa, dfa: res.dfa }); return; }
    current = { nfa, res, warnings: r.warnings, ver, fp: AL.Verify.fingerprint(nfa, res.dfa) };
    setReached(2);
    renderNFATable();
    goStage(2);
  }

  /* ---------- verification failures: never shown as a correct result ---------- */
  function showFailure(host, where, diag) {
    AL.lastFailure = { where, at: new Date().toISOString(), ...diag };
    console.error('[Automata Lab] internal consistency check failed', AL.lastFailure);
    const failed = diag.ver ? diag.ver.checks.filter((c) => !c.ok) : [];
    host.insertAdjacentHTML('afterbegin', `<div class="verify-fail" id="verifyFail"><div class="msg err">The lab's independent check disagreed with ${where === 'diagram' ? 'the drawn diagram' : where === 'changed' ? 'a result that changed after it was computed' : 'this conversion'}, so the result is not shown as correct. This is a fault in the lab, not in your NFA.${failed.length ? ' Failed: ' + failed.map((c) => esc(c.name.split(':')[0])).join(', ') + '.' : ''}</div>` +
      `<details><summary>Diagnostic details (for fixing the lab)</summary><pre>${esc(JSON.stringify(AL.lastFailure, null, 1).slice(0, 20000))}</pre></details></div>`);
  }
  /* 10: the computed result must be unchanged whenever a later stage shows it */
  function intact(host) {
    if (AL.Verify.fingerprint(current.nfa, current.res.dfa) === current.fp) return true;
    host.innerHTML = ''; showFailure(host, 'changed', { nfa: current.nfa, dfa: current.res.dfa });
    return false;
  }

  /* ---------- stage 2: NFA table ---------- */
  function renderNFATable() {
    const { nfa, warnings } = current;
    const eps = Engine.hasEps(nfa);
    const syms = [...nfa.alphabet, ...(eps ? ['ε'] : [])];
    $('#s2Body').innerHTML =
      `<ul class="summary"><li><span class="k">Q</span>${esc(SL(nfa.states))}<small>${nfa.states.length} states</small></li>` +
      `<li><span class="k">Σ</span>{${nfa.alphabet.map(esc).join(', ')}}</li><li><span class="k">q₀</span>${esc(Render.pretty(nfa.start))}</li>` +
      `<li><span class="k">F</span>${esc(SL(nfa.accept))}</li>${eps ? '<li><span class="k">ε</span><small>has ε-moves (own column)</small></li>' : ''}</ul>` +
      warnings.map((w) => `<div class="msg warn" style="margin-bottom:12px">${esc(w)}</div>`).join('') +
      `<div class="t2"><div><div class="tt-wrap"><table class="tt rows-in" id="nfaTable"><thead><tr><th></th><th>state</th>${syms.map((a) => `<th class="sym">${esc(a)}</th>`).join('')}</tr></thead><tbody>` +
      nfa.states.map((q) => `<tr><td class="mk">${q === nfa.start ? '→' : ''}${nfa.accept.includes(q) ? '*' : ''}</td><td>${esc(Render.pretty(q))}</td>` +
        syms.map((a) => { const t = (nfa.delta[q] || {})[a]; return t && t.length ? `<td>${esc(SL(t))}</td>` : '<td class="none">∅</td>'; }).join('') + `</tr>`).join('') +
      `</tbody></table></div><div class="tt-key"><span>→ start state</span><span>* accepting state</span></div></div>` +
      `<details class="mini" open><summary>NFA diagram</summary><div class="dg-frame grid-paper" id="s2Frame"><svg class="dg" id="s2Svg" role="img" aria-label="Your NFA"></svg></div></details></div>`;
    if (reduce) $('#nfaTable').classList.remove('rows-in'); else rowGroups($('#nfaTable'));
    const L = AL.layoutFor(nfa);
    drawInto($('#s2Svg'), Render.graph(L.model, L.pos, { r: 40 }), L.vb, true);
    AL.fitSvg($('#s2Svg'), L.vb, 1);
    if (innerWidth < 1000) $('.mini').open = false;
  }

  /* ---------- stage 3: conversion ---------- */
  function renderConversion() {
    const { nfa, res } = current;
    if (!intact($('#s3Body'))) return;
    player = AL.Player($('#s3Body'), nfa, res, {
      speed: 3100,
      onFinish: () => { setReached(4); renderFinal(); goStage(4); }
    });
    AL.activePlayer = player;
  }
  document.addEventListener('keydown', (e) => {
    if ($('#lab').hidden || stageNow !== 3 || !player || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); player.step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); player.step(-1); }
  });

  /* ---------- stage 4: final DFA ---------- */
  function renderFinal() {
    const { nfa, res } = current, { dfa } = res;
    if (!intact($('#s4Body'))) return;
    const acc = dfa.states.filter((s) => s.accept), dead = dfa.states.find((s) => s.dead);
    const n = nfa.states.length, possible = n <= 30 ? (2 ** n).toLocaleString() : `2^${n}`;
    $('#s4Body').innerHTML =
      `<div class="facts4">` +
      `<div><b>${dfa.states.length}</b>reachable DFA state${dfa.states.length === 1 ? '' : 's'}, out of ${possible} possible subsets</div>` +
      `<div><b>${acc.length}</b>accepting: ${acc.length ? acc.map((s) => s.id).join(', ') : 'none (no set contains a state of F)'}</div>` +
      `<div><b>${dead ? 'yes' : 'no'}</b>${dead ? 'dead state ∅ is reachable, so it is kept to make every move defined' : 'no dead state needed: every move already lands on a non-empty set'}</div>` +
      `<div><b>${n} → ${dfa.states.length}</b>computed by subset construction from the NFA you entered</div></div>` +
      `<div id="verifySlot"></div>` +
      `<div class="dg-frame grid-paper final-dg" id="s4Frame"><svg class="dg" id="s4Svg" role="img" aria-label="The final DFA"></svg><span class="dg-hint">drag to pan · + and − to zoom</span></div>` +
      `<div class="final-row"><div class="legend" style="margin:0"><span><i></i>state</span><span><i class="l-acc"></i>accepting</span><span><i class="l-dead"></i>dead state ∅</span><span>→ start</span></div>` +
      `<button class="btn btn--quiet btn--sm" type="button" id="redraw">✎ Sketch it again</button></div>` +
      `<div class="s4-table"><h3>DFA transition table</h3><div class="tt-wrap"><table class="tt rows-in" id="dfaTable"><thead><tr><th></th><th>DFA state</th><th>set of NFA states</th>${dfa.alphabet.map((a) => `<th class="sym">${esc(a)}</th>`).join('')}</tr></thead><tbody>` +
      dfa.states.map((s) => `<tr${s.dead ? ' class="dead-row"' : ''}><td class="mk">${s.start ? '→' : ''}${s.accept ? '*' : ''}</td><td><strong>${s.id}</strong></td><td class="set">${s.dead ? '∅ (dead)' : esc(SL(s.set))}</td>` +
        dfa.alphabet.map((a) => `<td>${dfa.delta[s.id][a]}</td>`).join('') + `</tr>`).join('') +
      `</tbody></table></div><div class="tt-key"><span>→ start state</span><span>* accepting (its set contains a state of F)</span></div></div>` +
      `<details class="tester-box" id="testerBox"><summary>Test a string on both machines</summary><div id="testBody"></div></details>`;
    if (reduce) $('#dfaTable').classList.remove('rows-in'); else rowGroups($('#dfaTable'));
    const DL = AL.dfaLayout(dfa);
    const drawDFA = () => drawInto($('#s4Svg'), Render.graph(Render.dfaModel(dfa), DL.pos, { r: 40 }), DL.vb, true);
    drawDFA(); AL.fitSvg($('#s4Svg'), DL.vb, 1.2);
    const pz = AL.PanZoom($('#s4Frame'), $('#s4Svg'), DL.vb);
    showVerified();
    $('#redraw').addEventListener('click', () => { pz.reset(DL.vb); drawDFA(); showVerified(); });
    let tested = false;
    $('#testerBox').addEventListener('toggle', () => { if ($('#testerBox').open && !tested) { tested = true; renderTester(); } });
  }

  /* 8: read the drawn diagram and the table back from the page and compare them with the DFA */
  function pageMatchesDFA(dfa) {
    const p = [], ids = new Set(dfa.states.map((s) => s.id));
    const svg = $('#s4Svg'), nodes = $$('.node', svg).map((n) => n.dataset.node);
    if (nodes.length !== ids.size || !nodes.every((n) => ids.has(n))) p.push(`diagram nodes {${nodes}} differ from DFA states {${[...ids]}}`);
    const accD = new Set($$('.node.is-accept', svg).map((n) => n.dataset.node));
    for (const s of dfa.states) if (accD.has(s.id) !== !!s.accept) p.push(`diagram ${s.accept ? 'misses' : 'wrongly marks'} accepting state ${s.id}`);
    const drawn = new Map();
    for (const g of $$('.edge', svg)) for (const a of $('.edge-label text', g).textContent.split(',').map((x) => x.trim())) {
      const k = g.dataset.from + '|' + a; if (drawn.has(k)) p.push(`two arrows for ${k}`); drawn.set(k, g.dataset.to);
    }
    let cells = 0;
    for (const s of dfa.states) for (const a of dfa.alphabet) { cells++; if (drawn.get(s.id + '|' + a) !== dfa.delta[s.id][a]) p.push(`diagram arrow ${s.id} --${a}--> ${drawn.get(s.id + '|' + a)} but δ says ${dfa.delta[s.id][a]}`); }
    if (drawn.size !== cells) p.push(`diagram has ${drawn.size} labelled moves, DFA has ${cells}`);
    const head = $$('#dfaTable thead th.sym').map((th) => th.textContent);
    if (head.join('\u0001') !== dfa.alphabet.join('\u0001')) p.push(`table columns {${head}} differ from Σ {${dfa.alphabet}}`);
    $$('#dfaTable tbody tr').forEach((tr, i) => {
      const s = dfa.states[i], c = [...tr.cells].map((td) => td.textContent);
      if (!s || c[1] !== s.id) { p.push(`table row ${i + 1} is not ${s && s.id}`); return; }
      if (c[0] !== (s.start ? '→' : '') + (s.accept ? '*' : '')) p.push(`table marks for ${s.id} are “${c[0]}”`);
      dfa.alphabet.forEach((a, j) => { if (c[3 + j] !== dfa.delta[s.id][a]) p.push(`table cell ${s.id},${a} shows ${c[3 + j]}`); });
    });
    if ($$('#dfaTable tbody tr').length !== dfa.states.length) p.push('table row count differs from the DFA');
    return p;
  }
  function showVerified() {
    const { ver, res } = current, slot = $('#verifySlot');
    const p8 = pageMatchesDFA(res.dfa), p10 = AL.Verify.fingerprint(current.nfa, res.dfa) === current.fp ? [] : ['the result changed after it was computed'];
    const all = [...ver.checks, { id: 8, name: 'Diagram and table: the drawn DFA and its table show exactly the computed automaton', ok: !p8.length, detail: p8 },
      { id: 10, name: 'Consistency: the result is unchanged since it was computed and verified', ok: !p10.length, detail: p10 }].sort((a, b) => a.id - b.id);
    if (all.some((c) => !c.ok)) {
      slot.innerHTML = '';
      $('#s4Frame').hidden = true; $('.s4-table').hidden = true;
      showFailure(slot, p8.length ? 'diagram' : 'changed', { ver: { ok: false, checks: all }, nfa: current.nfa, dfa: res.dfa });
      return;
    }
    slot.innerHTML = `<details class="verified" id="verified"><summary><span class="vt">✓ independently verified</span>${all.length} of ${all.length} correctness checks passed · ${ver.stats.subsets} subsets rebuilt · ${ver.stats.strings.toLocaleString()} strings compared</summary>` +
      `<ol>${all.map((c) => `<li><b>✓</b> ${esc(c.name)}</li>`).join('')}</ol></details>`;
  }

  /* ---------- tester (inside stage 4) ---------- */
  function sampleWords(dfa, want = 4) {
    const acc = [], rej = [], q = [['', dfa.start]];
    while (q.length && (acc.length < want || rej.length < want)) {
      const [w, s] = q.shift();
      const list = dfa.states.find((x) => x.id === s).accept ? acc : rej;
      if (list.length < want) list.push(w);
      if (w.length < 7) for (const a of dfa.alphabet) q.push([w + a, dfa.delta[s][a]]);
      if (q.length > 20000) break;
    }
    return { acc, rej };
  }

  function renderTester() {
    const { nfa, res } = current, { dfa } = res;
    const sw = sampleWords(dfa);
    let maxLen = 0, total = 1;
    while (maxLen < 14 && total * dfa.alphabet.length <= 30000) { maxLen++; total *= dfa.alphabet.length; }
    const first = sw.acc.find((w) => w.length > 1) ?? sw.acc[0] ?? sw.rej[1] ?? '';
    $('#testBody').innerHTML = `<div class="tester"><div>
        <label class="field-label" for="probe">A string over Σ = {${nfa.alphabet.map(esc).join(', ')}}. Leave it empty to test ε.</label>
        <form class="tester-row" id="probeForm" autocomplete="off"><input type="text" id="probe" spellcheck="false" value="${esc(first)}" aria-describedby="probeOut"><button class="btn btn--brass" type="submit">Run both ▶</button></form>
        <div class="quick" aria-label="Try these strings"><span class="hand" style="font-size:21px">try:</span>${[...sw.acc, ...sw.rej].map((w) => `<button type="button" data-w="${esc(w)}">${w === '' ? 'ε' : esc(w)}</button>`).join('')}</div>
        <div id="probeOut" aria-live="polite"></div>
      </div>
      <div class="dg-frame grid-paper" id="tFrame"><span class="dg-cap">the DFA, live</span><svg class="dg" id="tSvg" role="img" aria-label="DFA with the current state highlighted"></svg></div></div>
      <div class="exh"><button class="btn btn--sm" type="button" id="exhBtn">Check every string up to length ${maxLen}</button><span id="exhOut"></span></div>`;
    const DL = AL.dfaLayout(dfa);
    const drawT = (hot, hiE) => { $('#tSvg').innerHTML = Render.graph(Render.dfaModel(dfa), DL.pos, { r: 40, hotNodes: new Set(hot ? [hot] : []), hiEdges: new Set(hiE ? [hiE] : []) }); };
    $('#tSvg').setAttribute('viewBox', DL.vb); drawT(dfa.start); AL.fitSvg($('#tSvg'), DL.vb, 1);
    AL.PanZoom($('#tFrame'), $('#tSvg'), DL.vb);
    let anim = 0;
    function run(w) {
      clearInterval(anim);
      const out = $('#probeOut');
      const bad = [...w].filter((c) => !nfa.alphabet.includes(c));
      $('#probe').setAttribute('aria-invalid', bad.length ? 'true' : 'false');
      if (bad.length) { out.innerHTML = `<div class="msg err" style="margin-top:12px">“${esc(bad[0])}” is not in the alphabet. Use only ${nfa.alphabet.map(esc).join(', ')}.</div>`; return; }
      const n = Engine.runNFA(nfa, w), d = Engine.runDFA(dfa, w);
      const rows = [`<tr><td>start</td><td class="sym">·</td><td class="set">${esc(SL(n.sets[0]))}</td><td><strong>${d.path[0]}</strong></td></tr>`]
        .concat([...w].map((c, k) => `<tr><td>${k + 1}</td><td class="sym">${esc(c)}</td><td class="set">${esc(SL(n.sets[k + 1]))}</td><td><strong>${d.path[k + 1]}</strong></td></tr>`));
      const fin = `<div class="result"><span>NFA</span><span class="pill ${n.accepted ? 'yes' : 'no'}">${n.accepted ? '✓ accepts' : '✗ rejects'}</span><span>DFA</span><span class="pill ${d.accepted ? 'yes' : 'no'}">${d.accepted ? '✓ accepts' : '✗ rejects'}</span>` +
        `<span class="agree${n.accepted === d.accepted ? '' : ' bad'}">${n.accepted === d.accepted ? 'they agree!' : 'they disagree, this is a bug'}</span></div>`;
      out.innerHTML = `<div class="tt-wrap" style="margin-top:14px"><table class="tt run-table"><thead><tr><th>step</th><th>reads</th><th>NFA could be in</th><th>DFA is in</th></tr></thead><tbody>${rows.join('')}</tbody></table></div><div class="fin" hidden>${fin}</div>`;
      const trs = $$('tbody tr', out);
      let k = 0;
      const tick = () => {
        trs.forEach((tr, j) => { tr.classList.toggle('later', j > k); tr.classList.toggle('cur', j === k); });
        drawT(d.path[k], k ? `${d.path[k - 1]}>${d.path[k]}` : null);
        if (k >= trs.length - 1) { clearInterval(anim); $('.fin', out).hidden = false; }
        k++;
      };
      if (reduce) { k = trs.length - 1; tick(); } else { tick(); if (trs.length > 1) anim = setInterval(tick, 1180); }
    }
    $('#probeForm').addEventListener('submit', (e) => { e.preventDefault(); run($('#probe').value.trim()); });
    $('.quick').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { $('#probe').value = b.dataset.w; run(b.dataset.w); } });
    $('#exhBtn').addEventListener('click', () => {
      let count = 0, firstBad = null, layer = [''];
      const check = (w) => { count++; if (firstBad === null && Engine.runNFA(nfa, w).accepted !== Engine.runDFA(dfa, w).accepted) firstBad = w; };
      check('');
      for (let L = 1; L <= maxLen; L++) { layer = layer.flatMap((p) => dfa.alphabet.map((a) => p + a)); layer.forEach(check); }
      $('#exhOut').innerHTML = firstBad === null ? `<span class="agree">all ${count.toLocaleString()} strings agree ✓</span>` : `<span class="agree bad">mismatch on “${esc(firstBad)}”</span>`;
    });
    run($('#probe').value.trim());
  }

  /* ---------------- boot ---------------- */
  setStage(0);
  if (location.hash === '#lab') show('lab');
  onScroll();
})();
