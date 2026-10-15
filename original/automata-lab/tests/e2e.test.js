/* End-to-end browser tests (Playwright, Chromium).
   Every NFA is entered through the real controls: typed into the textarea or
   drawn on the canvas with mouse clicks. Results are READ FROM THE PAGE
   (tables, diagram nodes and edges, step cards, tester output) and compared
   with the independent reference in tests/lib/reference.js. No test writes
   to the app's internal state.
   Run: node tests/e2e.test.js           (needs the `playwright` package)
        HEADED=1 node tests/e2e.test.js  to watch it */
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.error('playwright is not installed: npm i -D playwright (or set NODE_PATH to a global install)'); process.exit(2); }
const R = require('./lib/reference');
const { CASES, INVALID } = require('./lib/cases');
const T = require('./lib/tally')('e2e');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, '.e2e-index.html');
/* The published page is wrapped in a doctype/body by the host; mirror that. */
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
fs.writeFileSync(PAGE, /^\s*<!doctype/i.test(SRC) ? SRC : '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n' + SRC + '</body></html>');
const URL = 'file://' + PAGE;

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const unsub = (s) => s.replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)));
const parseSet = (txt) => { const t = unsub(txt.trim()).replace(/\s*\(dead\)$/, ''); if (t === '∅' || t === 'empty set') return []; return t.replace(/^\{|\}$/g, '').split(',').map((x) => x.trim()).filter(Boolean); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const scen = { pass: 0, fail: 0, list: [] };
const typedStrings = new Set();
let current = '';
async function scenario(name, fn) {
  current = name;
  const before = T.counts.fail;
  try { await fn(); } catch (e) { T.ok(`${name}: ran without throwing`, false, String(e && e.stack || e).slice(0, 500)); }
  const ok = T.counts.fail === before;
  scen[ok ? 'pass' : 'fail']++; scen.list.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

/* ---------- page helpers (only real clicks, typing and DOM reads) ---------- */
async function openLab(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 860 }, reducedMotion: opts.motion ? 'no-preference' : 'reduce' });
  const page = await ctx.newPage();
  if (opts.init) await page.addInitScript(...opts.init);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(URL + (opts.story ? '' : '#lab'));
  if (!opts.story) await page.waitForSelector('#nfaText', { state: 'visible' });
  return page;
}
async function typeNFA(page, text) {
  await page.click('#modeType');
  await page.fill('#nfaText', text);
  await sleep(350);
}
async function msgs(page) {
  return page.$$eval('#msgs .msg', (els) => els.map((e) => ({ cls: e.className, text: e.textContent, visible: !!(e.offsetWidth || e.offsetHeight) })));
}
async function readNFATable(page) {
  return page.evaluate(() => {
    const t = document.querySelector('#nfaTable');
    const syms = [...t.querySelectorAll('thead th')].slice(2).map((th) => th.textContent);
    const rows = [...t.querySelectorAll('tbody tr')].map((tr) => [...tr.cells].map((c) => c.textContent));
    return { syms, rows };
  });
}
async function readDFATable(page) {
  return page.evaluate(() => {
    const t = document.querySelector('#dfaTable');
    const syms = [...t.querySelectorAll('thead th')].slice(3).map((th) => th.textContent);
    const rows = [...t.querySelectorAll('tbody tr')].map((tr) => [...tr.cells].map((c) => c.textContent));
    return { syms, rows };
  });
}
async function readGraph(page, sel) {
  return page.evaluate((sel) => {
    const svg = document.querySelector(sel);
    return {
      nodes: [...svg.querySelectorAll('.node')].map((n) => n.dataset.node),
      accept: [...svg.querySelectorAll('.node.is-accept')].map((n) => n.dataset.node),
      starts: svg.querySelectorAll('.start-arrow').length,
      edges: [...svg.querySelectorAll('.edge')].map((g) => ({ from: g.dataset.from, to: g.dataset.to, label: g.querySelector('.edge-label text').textContent }))
    };
  }, sel);
}

/* ---------- stage checks ---------- */
async function checkStage2(page, spec, tag) {
  const eps = spec.trans.some((t) => t[1] === R.EPS);
  const { syms, rows } = await readNFATable(page);
  T.eq(`${tag}: NFA table columns = Σ${eps ? ' + ε' : ''}`, syms, [...spec.alphabet, ...(eps ? ['ε'] : [])]);
  T.eq(`${tag}: NFA table rows = states`, rows.map((r) => unsub(r[1])), spec.states);
  const bad = [];
  rows.forEach((r, i) => {
    const q = spec.states[i];
    const wantMk = (q === spec.start ? '→' : '') + (spec.accept.includes(q) ? '*' : '');
    if (r[0] !== wantMk) bad.push(`${q} marks “${r[0]}” want “${wantMk}”`);
    syms.forEach((a, j) => {
      const want = R.sortSet(spec.trans.filter(([s, x]) => s === q && x === a).map((t) => t[2]));
      const got = R.sortSet(parseSet(r[2 + j]));
      if (R.key(got) !== R.key(want)) bad.push(`δ(${q},${a}) shows ${r[2 + j]} want {${want}}`);
    });
  });
  T.eq(`${tag}: every NFA table cell matches the entered NFA`, bad, []);
  const g = await readGraph(page, '#s2Svg');
  T.eq(`${tag}: NFA diagram has one node per state`, g.nodes, spec.states);
  T.eq(`${tag}: NFA diagram marks the accepting states`, R.sortSet(g.accept), R.sortSet(spec.accept));
  const wantEdges = R.sortSet(spec.trans.map(([s, , d]) => `${s}>${d}`));
  T.eq(`${tag}: NFA diagram has exactly the transitions' arrows`, R.sortSet(g.edges.map((e) => `${e.from}>${e.to}`)), wantEdges);
  const lblBad = g.edges.filter((e) => R.key(e.label.split(',').map((x) => x.trim())) !== R.key(spec.trans.filter(([s, , d]) => s === e.from && d === e.to).map((t) => t[1])));
  T.eq(`${tag}: NFA arrow labels list the right symbols`, lblBad, []);
}

/* Walk the conversion with Next (or the → key) and check each step card. */
async function walkSteps(page, spec, ref, tag, how = 'next') {
  const count = await page.textContent('#s3Body .pl-count');
  const N = +count.match(/of (\d+)/)[1];
  T.eq(`${tag}: number of steps = 2 + |DFA|·|Σ|`, N, 2 + ref.states.size * spec.alphabet.length);
  const covered = new Set(), seen = new Set(), bad = [];
  for (let i = 0; i < N; i++) {
    if (i) { if (how === 'key') { await page.locator('body').click({ position: { x: 5, y: 300 } }).catch(() => {}); await page.keyboard.press('ArrowRight'); } else await page.click('#s3Body [data-a="next"]'); }
    const card = await page.evaluate(() => {
      const toks = [...document.querySelectorAll('#s3Body .now-row .tok')].map((t) => ({ cls: t.className, id: t.querySelector('b').textContent, set: t.querySelector('span').textContent }));
      const kbd = document.querySelector('#s3Body .now-row kbd');
      const verdict = document.querySelector('#s3Body .now-row .verdict');
      return { toks, sym: kbd && kbd.textContent, verdict: verdict && verdict.textContent, count: document.querySelector('#s3Body .pl-count').textContent, dfaNodes: document.querySelectorAll('#s3Body .f-dfa .node').length };
    });
    if (!card.count.startsWith(`step ${i + 1} `)) bad.push(`counter shows “${card.count}” at step ${i + 1}`);
    if (i === 0) {
      const to = R.key(parseSet(card.toks[1].set));
      if (to !== ref.startKey) bad.push(`start subset shown {${card.toks[1].set}}`);
      seen.add(to);
    } else if (i < N - 1) {
      const from = R.key(parseSet(card.toks[0].set)), to = R.key(parseSet(card.toks[1].set));
      const want = ref.delta.get(from) && ref.delta.get(from).get(card.sym);
      if (want === undefined) bad.push(`step ${i + 1}: expanding a subset the reference never reaches`);
      else if (to !== want) bad.push(`step ${i + 1}: {${card.toks[0].set}} on ${card.sym} → {${card.toks[1].set}}, want {${(ref.states.get(want) || []).join(',')}}`);
      const k = from + '|' + card.sym;
      if (covered.has(k)) bad.push(`step ${i + 1} repeats ${k}`);
      covered.add(k);
      const isNew = !seen.has(to);
      if ((card.verdict === 'already known') === isNew) bad.push(`step ${i + 1}: verdict “${card.verdict}” but new=${isNew}`);
      seen.add(to);
    }
    if (i < N - 1 && card.dfaNodes !== seen.size) bad.push(`step ${i + 1}: DFA-so-far shows ${card.dfaNodes} states, ${seen.size} discovered`);
  }
  T.eq(`${tag}: every step card shows the correct subset transition`, bad, []);
  const s3 = await page.evaluate(() => ({
    head: [...document.querySelectorAll('#s3Body .c-t thead th.sym')].map((th) => th.textContent),
    labels: [...document.querySelectorAll('#s3Body .f-dfa .edge-label text')].flatMap((t) => t.textContent.split(',').map((x) => x.trim()))
  }));
  T.eq(`${tag}: the growing DFA table has exactly the columns Σ`, s3.head, spec.alphabet);
  T.eq(`${tag}: the growing DFA diagram uses only symbols of Σ`, s3.labels.filter((a) => !spec.alphabet.includes(a)), []);
  T.eq(`${tag}: steps cover every (subset, symbol) once`, covered.size, ref.states.size * spec.alphabet.length);
  T.ok(`${tag}: success message appears at the end`, await page.isVisible('#s3Body .pl-done'));
}

async function checkStage4(page, spec, ref, tag) {
  const { syms, rows } = await readDFATable(page);
  T.eq(`${tag}: DFA table columns = Σ`, syms, spec.alphabet);
  const badge = await page.textContent('#verified summary').catch(() => 'missing');
  T.ok(`${tag}: the in-app verifier reports 10 of 10 checks passed`, /independently verified\s*10 of 10 correctness checks passed/.test(badge), badge);
  T.ok(`${tag}: no verification failure is shown`, !(await page.isVisible('#verifyFail')));
  const idSet = new Map(rows.map((r) => [r[1], R.key(parseSet(r[2]))]));
  T.eq(`${tag}: DFA table subsets = reachable subsets`, R.sortSet([...idSet.values()]), R.sortSet([...ref.states.keys()]));
  T.eq(`${tag}: no subset appears twice`, idSet.size, rows.length);
  const bad = [];
  for (const r of rows) {
    const k = idSet.get(r[1]);
    const wantMk = (k === ref.startKey ? '→' : '') + (ref.accepting.has(k) ? '*' : '');
    if (r[0] !== wantMk) bad.push(`${r[1]} marks “${r[0]}” want “${wantMk}”`);
    syms.forEach((a, j) => { if (!idSet.has(r[3 + j])) bad.push(`${r[1]},${a} → unknown “${r[3 + j]}”`); else if (idSet.get(r[3 + j]) !== ref.delta.get(k).get(a)) bad.push(`δ(${r[1]},${a}) = ${r[3 + j]} is wrong`); });
  }
  T.eq(`${tag}: every DFA table cell, start mark and accept mark is correct`, bad, []);
  const facts = await page.$$eval('#s4Body .facts4 b', (bs) => bs.map((b) => b.textContent));
  T.eq(`${tag}: summary counts DFA states`, +facts[0], ref.states.size);
  T.eq(`${tag}: summary counts accepting states`, +facts[1], ref.accepting.size);
  T.eq(`${tag}: summary says whether ∅ is reachable`, facts[2], ref.states.has('') ? 'yes' : 'no');
  const g = await readGraph(page, '#s4Svg');
  T.eq(`${tag}: final diagram has one node per table row`, R.sortSet(g.nodes), R.sortSet(rows.map((r) => r[1])));
  T.eq(`${tag}: final diagram has one start arrow`, g.starts, 1);
  T.eq(`${tag}: final diagram double-circles exactly the accepting rows`, R.sortSet(g.accept), R.sortSet(rows.filter((r) => r[0].includes('*')).map((r) => r[1])));
  const fromDiagram = new Map();
  for (const e of g.edges) for (const a of e.label.split(',').map((x) => x.trim())) fromDiagram.set(`${e.from}|${a}`, e.to);
  const dBad = [];
  for (const r of rows) syms.forEach((a, j) => { if (fromDiagram.get(`${r[1]}|${a}`) !== r[3 + j]) dBad.push(`${r[1]},${a}`); });
  T.eq(`${tag}: final diagram arrows match the DFA table exactly`, dBad, []);
  T.eq(`${tag}: diagram has no extra arrows`, fromDiagram.size, rows.length * syms.length);
  return { rows, idSet };
}

function pickStrings(spec, ref, n = 10) {
  const all = R.allStrings(spec.alphabet, 4);
  const acc = all.filter((w) => R.nfaAccepts(spec, w)), rej = all.filter((w) => !R.nfaAccepts(spec, w));
  const out = new Set(['', ...spec.alphabet]);
  for (const w of [...acc.slice(-4), ...rej.slice(-4), ...acc.slice(0, 2), ...rej.slice(0, 2)]) { if (out.size >= n) break; out.add(w); }
  out.add(spec.alphabet.join('').repeat(3));
  return [...out];
}
async function testStrings(page, spec, ref, idSet, tag) {
  await page.click('#testerBox summary');
  await page.waitForSelector('#probe', { state: 'visible' });
  const bad = [];
  for (const w of pickStrings(spec, ref)) {
    typedStrings.add(tag.split(' ')[0] + '|' + w);
    await page.fill('#probe', w);
    await page.press('#probe', 'Enter');
    await page.waitForSelector('#probeOut .fin:not([hidden])', { timeout: 15000 });
    const out = await page.evaluate(() => ({
      pills: [...document.querySelectorAll('#probeOut .pill')].map((p) => p.textContent),
      agree: document.querySelector('#probeOut .agree').textContent,
      rows: [...document.querySelectorAll('#probeOut tbody tr')].map((tr) => [...tr.cells].map((c) => c.textContent))
    }));
    const want = R.nfaAccepts(spec, w), wantTxt = want ? '✓ accepts' : '✗ rejects';
    if (out.pills[0] !== wantTxt) bad.push(`“${w}”: NFA shows ${out.pills[0]}, want ${wantTxt}`);
    if (out.pills[1] !== wantTxt) bad.push(`“${w}”: DFA shows ${out.pills[1]}, want ${wantTxt}`);
    if (out.agree !== 'they agree!') bad.push(`“${w}”: ${out.agree}`);
    const sets = R.nfaSets(spec, w);
    if (out.rows.length !== w.length + 1) bad.push(`“${w}”: ${out.rows.length} rows`);
    out.rows.forEach((r, i) => {
      if (R.key(parseSet(r[2])) !== R.key(sets[i])) bad.push(`“${w}” step ${i}: NFA set ${r[2]} want {${sets[i]}}`);
      if (idSet.get(r[3]) !== R.key(sets[i])) bad.push(`“${w}” step ${i}: DFA state ${r[3]} is not the subset {${sets[i]}}`);
    });
  }
  T.eq(`${tag}: tester results, NFA closures per symbol and DFA path all correct`, bad, []);
  T.ok(`${tag}: tester names exactly Σ`, (await page.textContent('label[for="probe"]')).includes(`Σ = {${spec.alphabet.join(', ')}}`));
  const other = ['%', 'Z', '9', 'q'].find((ch) => !spec.alphabet.includes(ch));
  await page.fill('#probe', spec.alphabet[0] + other);
  await page.press('#probe', 'Enter');
  T.ok(`${tag}: a symbol outside Σ shows an error`, await page.isVisible('#probeOut .msg.err'));
  await page.click('#exhBtn');
  T.ok(`${tag}: “check every string” reports agreement`, /agree ✓/.test(await page.textContent('#exhOut')), await page.textContent('#exhOut'));
}

/* Full journey for a typed NFA. */
async function journey(browser, c, opts = {}) {
  const tag = `${c.id} ${c.title}`;
  const page = await openLab(browser, opts);
  const text = c.text || R.toText(c.spec, opts.style || 0);
  await typeNFA(page, text);
  const m = await msgs(page);
  T.ok(`${tag}: input accepted with a ✓ message`, m.some((x) => /okay/.test(x.cls)) && !m.some((x) => /err/.test(x.cls)), m);
  const pv = await readGraph(page, '#previewSvg');
  T.eq(`${tag}: preview draws every state`, pv.nodes, c.spec.states);
  T.eq(`${tag}: preview draws exactly the transitions' arrows`, R.sortSet(pv.edges.map((e) => `${e.from}>${e.to}`)), R.sortSet(c.spec.trans.map(([s, , d]) => `${s}>${d}`)));
  T.ok(`${tag}: Continue is enabled`, !(await page.isDisabled('#toTable')));
  await page.click('#toTable');
  await page.waitForSelector('#s2:not([hidden])');
  await checkStage2(page, c.spec, tag);
  await page.click('#toConvert');
  await page.waitForSelector('#s3:not([hidden])');
  const ref = R.subsetConstruction(c.spec);
  if (opts.skip) await page.click('#s3Body [data-a="skip"]');
  else {
    await walkSteps(page, c.spec, ref, tag, opts.keys ? 'key' : 'next');
    await page.click('#s3Body [data-a="final"]');
  }
  await page.waitForSelector('#s4:not([hidden])');
  const { idSet, rows } = await checkStage4(page, c.spec, ref, tag);
  if (!opts.noStrings) await testStrings(page, c.spec, ref, idSet, tag);
  if (opts.viewport) T.ok(`${tag}: no horizontal page overflow`, (await page.evaluate(() => document.documentElement.scrollWidth)) <= opts.viewport.width, await page.evaluate(() => document.documentElement.scrollWidth));
  T.eq(`${tag}: no script errors`, page.errors, []);
  return { page, rows };
}

/* ---------- drawing helpers ---------- */
/* mouse clicks need the canvas on screen (Playwright's mouse does not scroll) */
async function onScreen(page) { await page.locator('#edSvg').scrollIntoViewIfNeeded(); }
async function svgPoint(page, fx, fy) {
  await onScreen(page);
  const b = await page.locator('#edSvg').boundingBox();
  return [b.x + b.width * fx, b.y + b.height * fy];
}
async function nodeAt(page, id) {
  await onScreen(page);
  const b = await page.locator(`#edSvg .node[data-node="${id}"] .node-c`).boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
}
async function edgeMid(page, from, to) {
  await onScreen(page);
  return page.evaluate(([from, to]) => {
    const p = document.querySelector(`#edSvg .edge[data-edge="${from}>${to}"] .edge-path`);
    const pt = p.getPointAtLength(p.getTotalLength() * .35), m = p.getScreenCTM();
    return [pt.x * m.a + pt.y * m.c + m.e, pt.x * m.b + pt.y * m.d + m.f];
  }, [from, to]);
}
async function tool(page, t) { await page.click(`[data-tool="${t}"]`); }
async function addStates(page, spots) { await tool(page, 'state'); for (const [x, y] of spots) { const p = await svgPoint(page, x, y); await page.mouse.click(...p); } }
async function drawEdge(page, from, to, syms) {
  await tool(page, 'edge');
  await page.mouse.click(...(await nodeAt(page, from)));
  await page.mouse.click(...(await nodeAt(page, to)));
  await page.fill('#edSyms', syms);
  await page.press('#edSyms', 'Enter');
}
async function selectNode(page, id) { await tool(page, 'move'); await page.mouse.click(...(await nodeAt(page, id))); await page.waitForSelector('#edName'); }
const textNow = (page) => page.inputValue('#nfaText');

/* ================= run ================= */
(async () => {
  const browser = await chromium.launch({ headless: !process.env.HEADED });

  // 1. every hand-specified NFA, typed into the real textarea, stepped with Next
  for (const c of CASES) await scenario(`typed ${c.id}: ${c.title}`, async () => { const { page } = await journey(browser, c, { style: CASES.indexOf(c) % 5 }); await page.context().close(); });

  // 2. same mathematics whether the user steps, uses the keyboard, plays, or skips
  await scenario('B5 skip-to-result gives the same DFA table as stepping', async () => {
    const c = CASES.find((x) => x.id === 'B5');
    const a = await journey(browser, c, { noStrings: true }), b = await journey(browser, c, { noStrings: true, skip: true });
    T.eq('B5: stepped and skipped DFA tables are identical', a.rows, b.rows);
    await a.page.context().close(); await b.page.context().close();
  });
  await scenario('E3 stepped with the → key', async () => { const { page } = await journey(browser, CASES.find((x) => x.id === 'E3'), { keys: true, noStrings: true }); await page.context().close(); });
  await scenario('Play, Pause, Previous, Reset and Play-to-the-end', async () => {
    const c = CASES.find((x) => x.id === 'C3');
    const page = await openLab(browser, { motion: true });
    await typeNFA(page, R.toText(c.spec)); await page.click('#toTable'); await page.click('#toConvert');
    const step = async () => +((await page.textContent('#s3Body .pl-count')).match(/step (\d+)/)[1]);
    await page.click('#s3Body [data-a="play"]'); await sleep(7000); // autoplay moves one step every 3.1 s
    const s1 = await step();
    T.ok('Play advances on its own', s1 >= 2, s1);
    await page.click('#s3Body [data-a="play"]'); const s2 = await step(); await sleep(5000);
    T.eq('Pause stops advancing', await step(), s2);
    await page.click('#s3Body [data-a="prev"]'); T.eq('Previous goes back one step', await step(), s2 - 1);
    await page.click('#s3Body [data-a="reset"]'); T.eq('Reset returns to step 1', await step(), 1);
    T.ok('Previous is disabled on step 1', await page.isDisabled('#s3Body [data-a="prev"]'));
    await page.click('#s3Body [data-a="play"]');
    await page.waitForSelector('#s3Body .pl-done:not([hidden])', { timeout: 60000 });
    T.ok('Play runs to the end and shows the success message', /complete: 3 states/.test(await page.textContent('#s3Body .pl-done')));
    await page.click('#s3Body [data-a="final"]');
    await checkStage4(page, c.spec, R.subsetConstruction(c.spec), 'C3 after Play');
    T.eq('no script errors', page.errors, []);
    await page.context().close();
  });

  // 3. malformed input is blocked with a visible message
  await scenario('malformed inputs are rejected with visible messages', async () => {
    const page = await openLab(browser);
    for (const x of INVALID) {
      await typeNFA(page, x.text);
      const m = await msgs(page);
      T.ok(`${x.id} ${x.title}: Continue is disabled`, await page.isDisabled('#toTable'));
      T.ok(`${x.id} ${x.title}: visible error mentions “${x.err}”`, m.some((e) => /err/.test(e.cls) && e.visible && e.text.includes(x.err)), m.map((e) => e.text));
    }
    T.eq('no script errors', page.errors, []);
    await page.context().close();
  });

  // 4. workflow: repeated conversions, editing after conversion, text ↔ drawing
  await scenario('repeated conversion and editing after conversion', async () => {
    const A2 = CASES.find((x) => x.id === 'A2'), B1 = CASES.find((x) => x.id === 'B1');
    const page = await openLab(browser);
    await typeNFA(page, R.toText(A2.spec)); await page.click('#toTable'); await page.click('#toConvert'); await page.click('#s3Body [data-a="skip"]');
    await checkStage4(page, A2.spec, R.subsetConstruction(A2.spec), 'first conversion (A2)');
    await page.click('#another');
    T.ok('Try another NFA returns to step 1', await page.isVisible('#s1'));
    await typeNFA(page, R.toText(B1.spec));
    T.ok('editing disables the later steps', await page.isDisabled('#stepper [data-s="2"]') && await page.isDisabled('#stepper [data-s="4"]'));
    await page.click('#toTable'); await checkStage2(page, B1.spec, 'second NFA (B1)');
    await page.click('#toConvert'); await page.click('#s3Body [data-a="skip"]');
    await checkStage4(page, B1.spec, R.subsetConstruction(B1.spec), 'second conversion (B1)');
    await page.click('#stepper [data-s="1"]'); await page.click('#stepper [data-s="4"]');
    T.ok('stepper navigates between finished stages', await page.isVisible('#s4'));
    T.eq('no script errors', page.errors, []);
    await page.context().close();
  });
  await scenario('switching text → drawing → text keeps the same NFA', async () => {
    const c = CASES.find((x) => x.id === 'E5');
    const page = await openLab(browser);
    await typeNFA(page, R.toText(c.spec));
    await page.click('#modeDraw');
    T.eq('drawing shows every state', R.sortSet((await readGraph(page, '#edSvg')).nodes), R.sortSet(c.spec.states));
    T.eq('drawing shows every arrow', R.sortSet((await readGraph(page, '#edSvg')).edges.map((e) => `${e.from}>${e.to}`)), R.sortSet(c.spec.trans.map(([s, , d]) => `${s}>${d}`)));
    await page.click('#modeType');
    await page.click('#toTable'); await checkStage2(page, c.spec, 'E5 after a round trip');
    T.eq('no script errors', page.errors, []);
    await page.context().close();
  });

  // 5. the real drawing canvas
  await scenario('drawing: “ends with ab” with a loop, rename and accepting state', async () => {
    const page = await openLab(browser);
    await page.click('#modeType'); await page.click('#clearBtn'); await page.click('#modeDraw');
    await page.fill('#edAlpha', 'a, b'); await page.press('#edAlpha', 'Enter');
    await addStates(page, [[.25, .5], [.5, .5], [.75, .5]]);
    T.eq('three clicks add three states', (await readGraph(page, '#edSvg')).nodes, ['q0', 'q1', 'q2']);
    await drawEdge(page, 'q0', 'q0', 'a, b');
    await drawEdge(page, 'q0', 'q1', 'a');
    await drawEdge(page, 'q1', 'q2', 'b');
    await selectNode(page, 'q2'); await page.check('#edAcc');
    await selectNode(page, 'q2'); await page.fill('#edName', 'final'); await page.press('#edName', 'Enter');
    const spec = { states: ['q0', 'q1', 'final'], alphabet: ['a', 'b'], start: 'q0', accept: ['final'], trans: [['q0', 'a', 'q0'], ['q0', 'b', 'q0'], ['q0', 'a', 'q1'], ['q1', 'b', 'final']] };
    T.ok('the drawn NFA is accepted', (await msgs(page)).some((m) => /okay/.test(m.cls)));
    await page.click('#toTable'); await checkStage2(page, spec, 'drawn ends-with-ab');
    const ref = R.subsetConstruction(spec);
    await page.click('#toConvert'); await walkSteps(page, spec, ref, 'drawn ends-with-ab'); await page.click('#s3Body [data-a="final"]');
    const { idSet } = await checkStage4(page, spec, ref, 'drawn ends-with-ab');
    await testStrings(page, spec, ref, idSet, 'DRAW1 drawn ends-with-ab');
    T.eq('no script errors', page.errors, []);
    await page.context().close();
  });
  await scenario('drawing: nondeterminism, ε, erase, undo, edit, rename, start', async () => {
    const page = await openLab(browser);
    await page.click('#modeType'); await page.click('#clearBtn'); await page.click('#modeDraw');
    await page.fill('#edAlpha', '0, 1'); await page.press('#edAlpha', 'Enter');
    await addStates(page, [[.22, .3], [.55, .25], [.6, .75]]);
    await drawEdge(page, 'q0', 'q1', '0');
    await drawEdge(page, 'q0', 'q2', '0');
    await drawEdge(page, 'q1', 'q2', '1');
    await drawEdge(page, 'q2', 'q2', '0, 1');
    await drawEdge(page, 'q1', 'q0', 'eps');
    let t = await textNow(page);
    T.ok('two arrows on 0 become one nondeterministic transition', /^q0, 0 -> q1, q2$/m.test(t), t);
    T.ok('ε arrow is in the model', /^q1, eps -> q0$/m.test(t), t);
    await tool(page, 'delete'); await page.mouse.click(...(await edgeMid(page, 'q1', 'q2')));
    t = await textNow(page);
    T.ok('erased arrow leaves the model', !/^q1, 1 -> q2$/m.test(t), t);
    await page.click('#undoBtn');
    t = await textNow(page);
    T.ok('Undo restores the erased arrow', /^q1, 1 -> q2$/m.test(t), t);
    await tool(page, 'move'); await page.mouse.click(...(await edgeMid(page, 'q2', 'q2')));
    await page.fill('#edSyms', '1'); await page.press('#edSyms', 'Enter');
    t = await textNow(page);
    T.ok('editing a loop’s symbols updates the model', /^q2, 1 -> q2$/m.test(t) && !/^q2, 0 -> q2$/m.test(t), t);
    await selectNode(page, 'q1'); await page.fill('#edName', 'mid'); await page.press('#edName', 'Enter');
    t = await textNow(page);
    T.ok('renaming keeps every transition', /^q0, 0 -> mid, q2$/m.test(t) && /^mid, 1 -> q2$/m.test(t) && /^mid, eps -> q0$/m.test(t), t);
    await selectNode(page, 'q2'); await page.fill('#edName', 'none'); await page.press('#edName', 'Enter');
    T.ok('a reserved name is refused with a message', /reserved/.test(await page.textContent('#edTip')));
    await selectNode(page, 'q2'); await page.check('#edStart');
    T.ok('start can move to another state', /^Start: q2$/m.test(await textNow(page)));
    await page.click('#undoBtn');
    T.ok('Undo restores the start state', /^Start: q0$/m.test(await textNow(page)));
    await selectNode(page, 'q2'); await page.check('#edAcc');
    const spec = { states: ['q0', 'mid', 'q2'], alphabet: ['0', '1'], start: 'q0', accept: ['q2'], trans: [['q0', '0', 'mid'], ['q0', '0', 'q2'], ['mid', '1', 'q2'], ['q2', '1', 'q2'], ['mid', 'ε', 'q0']] };
    await page.click('#toTable'); await checkStage2(page, spec, 'drawn NFA');
    const ref = R.subsetConstruction(spec);
    await page.click('#toConvert'); await walkSteps(page, spec, ref, 'drawn NFA'); await page.click('#s3Body [data-a="final"]');
    const drawn = await checkStage4(page, spec, ref, 'drawn NFA');
    await testStrings(page, spec, ref, drawn.idSet, 'DRAW2 drawn NFA');
    // the same NFA typed as text gives the identical DFA table
    const page2 = await openLab(browser);
    await typeNFA(page2, R.toText(spec)); await page2.click('#toTable'); await page2.click('#toConvert'); await page2.click('#s3Body [data-a="skip"]');
    const typed = await checkStage4(page2, spec, ref, 'same NFA typed');
    T.eq('drawn and typed versions give identical DFA tables', drawn.rows, typed.rows);
    T.eq('no script errors', [...page.errors, ...page2.errors], []);
    await page.context().close(); await page2.context().close();
  });

  // 5b. the alphabet is the user's declaration and nothing else (regressions for the drawing-editor leak)
  const alphaLine = async (page) => ((await textNow(page)).match(/^Alphabet:(.*)$/m) || [, ''])[1].split(',').map((x) => x.trim()).filter(Boolean);
  await scenario('regression: a drawing never inherits 0 and 1 from the previous example', async () => {
    const page = await openLab(browser);
    T.eq('the default example has Σ = {0, 1}', await alphaLine(page), ['0', '1']);
    await page.click('#modeDraw');
    await tool(page, 'delete');
    for (const q of ['q0', 'q1', 'q2']) await page.mouse.click(...(await nodeAt(page, q)));
    T.eq('erasing every state leaves no states', (await readGraph(page, '#edSvg')).nodes, []);
    await addStates(page, [[.3, .5], [.65, .5]]);
    await drawEdge(page, 'q0', 'q1', 'a');
    T.ok('an arrow symbol outside Σ is refused with a message', /“a” is not in the alphabet \{0, 1\}/.test(await page.textContent('#edTip')), await page.textContent('#edTip'));
    T.eq('Σ is not silently expanded', await alphaLine(page), ['0', '1']);
    T.ok('the refused arrow is not in the NFA', !/^q0, a -> /m.test(await textNow(page)));
    await page.fill('#edAlpha', 'a, b'); await page.press('#edAlpha', 'Enter');
    T.eq('declaring Σ = {a, b} replaces {0, 1}', await alphaLine(page), ['a', 'b']);
    await drawEdge(page, 'q0', 'q1', 'a');
    await drawEdge(page, 'q1', 'q1', 'a, b');
    await selectNode(page, 'q1'); await page.check('#edAcc');
    const spec = { states: ['q0', 'q1'], alphabet: ['a', 'b'], start: 'q0', accept: ['q1'], trans: [['q0', 'a', 'q1'], ['q1', 'a', 'q1'], ['q1', 'b', 'q1']] };
    T.eq('the text shows Σ = {a, b} exactly', await alphaLine(page), ['a', 'b']);
    await page.click('#toTable'); await checkStage2(page, spec, 'drawn {a,b}');
    const ref = R.subsetConstruction(spec);
    await page.click('#toConvert'); await walkSteps(page, spec, ref, 'drawn {a,b}'); await page.click('#s3Body [data-a="final"]');
    const { idSet } = await checkStage4(page, spec, ref, 'drawn {a,b}');
    await testStrings(page, spec, ref, idSet, 'DRAW3 drawn {a,b}');
    T.eq('no script errors', page.errors, []);
    await page.context().close();
  });
  await scenario('regression: a new arrow is a draft until its symbols are typed', async () => {
    const page = await openLab(browser);
    await page.click('#modeDraw'); await page.click('#edBlank');
    T.eq('Blank page empties Σ', await page.inputValue('#edAlpha'), '');
    T.eq('Blank page empties the text', (await textNow(page)).trim().split('\n').map((l) => l.trim()), ['States:', 'Alphabet:', 'Start:', 'Accepting:', 'Transitions:']);
    await addStates(page, [[.3, .5], [.65, .5]]);
    await drawEdge(page, 'q0', 'q1', 'x');
    T.ok('with Σ empty an arrow symbol is refused', /Alphabet box is empty/.test(await page.textContent('#edTip')));
    T.eq('no symbol was invented for Σ', await alphaLine(page), []);
    T.ok('no transition was invented', !/->/.test(await textNow(page)), await textNow(page));
    await page.fill('#edAlpha', 'x'); await page.press('#edAlpha', 'Enter');
    await tool(page, 'edge'); await page.mouse.click(...(await nodeAt(page, 'q0'))); await page.mouse.click(...(await nodeAt(page, 'q1')));
    T.ok('the draft arrow is drawn', await page.isVisible('#edSvg .edge.draft'));
    T.ok('the draft is not in the NFA', !/->/.test(await textNow(page)));
    await tool(page, 'move');
    T.eq('leaving it unlabelled discards it', (await readGraph(page, '#edSvg')).edges, []);
    T.ok('still no transition in the text', !/->/.test(await textNow(page)));
    T.eq('no script errors', page.errors, []);
    await page.context().close();
  });
  await scenario('regression: a symbol still on an arrow cannot be dropped from Σ', async () => {
    const page = await openLab(browser);
    await page.click('#modeDraw');
    const before = await textNow(page);
    await page.fill('#edAlpha', '1'); await page.press('#edAlpha', 'Enter');
    T.ok('the change is refused with the arrow named', /“0” is still used on the arrow q0 → q0/.test(await page.textContent('#edTip')), await page.textContent('#edTip'));
    T.eq('the NFA is unchanged', await textNow(page), before);
    await page.fill('#edAlpha', '0, 1, 2'); await page.press('#edAlpha', 'Enter');
    T.eq('adding an unused symbol keeps it in Σ', await alphaLine(page), ['0', '1', '2']);
    await page.click('#modeType'); await page.click('#toTable');
    const { syms } = await readNFATable(page);
    T.eq('the unused symbol keeps its column in the NFA table', syms, ['0', '1', '2']);
    await page.click('#toConvert'); await page.click('#s3Body [data-a="skip"]');
    const d = await readDFATable(page);
    T.eq('and in the DFA table', d.syms, ['0', '1', '2']);
    T.ok('its moves go to the dead state ∅', d.rows.every((r) => r[5] === '∅'), d.rows);
    T.eq('no script errors', page.errors, []);
    await page.context().close();
  });
  await scenario('regression: switching examples replaces the whole automaton', async () => {
    const page = await openLab(browser);
    const exs = await page.$$eval('#examples .ex', (bs) => bs.map((b) => b.dataset.p));
    const bad = [];
    let prevAlpha = null;
    for (const id of [...exs, ...exs.slice().reverse()]) {
      await page.click('#modeEx'); await page.click(`#examples .ex[data-p="${id}"]`); await sleep(300);
      const text = await textNow(page);
      const want = text.match(/^Alphabet:(.*)$/m)[1].split(',').map((x) => x.trim());
      await page.click('#modeDraw');
      const box = (await page.inputValue('#edAlpha')).split(',').map((x) => x.trim());
      if (R.key(box) !== R.key(want)) bad.push(`${id}: drawing Σ {${box}} want {${want}}`);
      const states = text.match(/^States:(.*)$/m)[1].split(',').map((x) => x.trim());
      const g = await readGraph(page, '#edSvg');
      if (R.key(g.nodes) !== R.key(states)) bad.push(`${id}: drawing shows {${g.nodes}} want {${states}}`);
      await page.click('#undoBtn');
      if ((await textNow(page)) !== text) bad.push(`${id}: Undo brought back the previous problem`);
      await page.click('#modeType'); await page.click('#toTable');
      const { syms } = await readNFATable(page);
      if (R.key(syms.filter((a) => a !== 'ε')) !== R.key(want)) bad.push(`${id}: NFA table columns {${syms}} want {${want}}`);
      await page.click('#toConvert'); await page.click('#s3Body [data-a="skip"]');
      const d = await readDFATable(page);
      if (R.key(d.syms) !== R.key(want)) bad.push(`${id}: DFA table columns {${d.syms}} want {${want}} (previous {${prevAlpha}})`);
      prevAlpha = want;
      await page.click('#another');
    }
    T.eq('every example, in both orders, shows only its own Σ in the drawing and both tables', bad, []);
    T.eq('no script errors', page.errors, []);
    await page.context().close();
  });
  await scenario('regression: repeated conversions with different alphabets stay separate', async () => {
    const page = await openLab(browser);
    const ids = ['A4', 'D3', 'D2', 'B3', 'E2', 'C2'];
    for (const id of ids) {
      const c = CASES.find((x) => x.id === id);
      await typeNFA(page, R.toText(c.spec, ids.indexOf(id) % 5));
      await page.click('#toTable'); await checkStage2(page, c.spec, `${id} in sequence`);
      const ref = R.subsetConstruction(c.spec);
      await page.click('#toConvert'); await page.click('#s3Body [data-a="skip"]');
      const { idSet } = await checkStage4(page, c.spec, ref, `${id} in sequence`);
      if (id === 'D2' || id === 'C2') await testStrings(page, c.spec, ref, idSet, `SEQ${id} in sequence`);
      await page.click('#another');
    }
    T.eq('no script errors', page.errors, []);
    await page.context().close();
  });

  // 5c. fault injection: a wrong result must never be shown as correct
  const sabotage = (what) => (w) => {
    window.AL = new Proxy({}, { set(t, k, v) {
      if (k === 'Engine' && w === 'engine') { const orig = v.subsetConstruction; v.subsetConstruction = (n) => { const r = orig(n); if (r.dfa) r.dfa.states[0].accept = !r.dfa.states[0].accept; return r; }; }
      if (k === 'Render' && w === 'diagram') { const orig = v.dfaModel; v.dfaModel = (...a) => { const m = orig(...a); if (!a[1]) m.edges.pop(); return m; }; }
      t[k] = v; return true;
    } });
  };
  await scenario('fault injection: a corrupted conversion is blocked, not shown', async () => {
    const page = await openLab(browser, { init: [sabotage('engine'), 'engine'] });
    const c = CASES.find((x) => x.id === 'B3');
    await typeNFA(page, R.toText(c.spec)); await page.click('#toTable');
    T.ok('the failure message is shown', await page.isVisible('#verifyFail'));
    T.ok('it names the accepting-state check', /Accepting states/.test(await page.textContent('#verifyFail')), await page.textContent('#verifyFail'));
    T.ok('the lab stays on step 1', await page.isVisible('#s1') && !(await page.isVisible('#s2')));
    T.ok('the later steps stay locked', await page.isDisabled('#stepper [data-s="2"]'));
    T.ok('diagnostic details are kept on the page', /"checks"/.test(await page.textContent('#verifyFail pre')));
    await page.context().close();
  });
  await scenario('fault injection: a diagram that disagrees with the table is not labelled correct', async () => {
    const page = await openLab(browser, { init: [sabotage('diagram'), 'diagram'] });
    const c = CASES.find((x) => x.id === 'B1');
    await typeNFA(page, R.toText(c.spec)); await page.click('#toTable'); await page.click('#toConvert'); await page.click('#s3Body [data-a="skip"]');
    T.ok('stage 4 shows the failure', await page.isVisible('#s4 #verifyFail'));
    T.ok('it names the diagram check', /drawn diagram/.test(await page.textContent('#s4 #verifyFail')));
    T.ok('no “verified” badge', !(await page.isVisible('#verified')));
    T.ok('the wrong diagram is hidden', !(await page.isVisible('#s4Frame')));
    await page.context().close();
  });

  // 6. the full story → lab path with motion on, phone layout, reload
  await scenario('story → Enter the lab → convert (motion on)', async () => {
    const page = await openLab(browser, { story: true, motion: true });
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector('#enter').scrollIntoView());
    await page.click('#enterBtn');
    await page.waitForSelector('#s1', { state: 'visible', timeout: 5000 });
    T.ok('the lab opens on step 1', await page.isVisible('#s1Title'));
    const c = CASES.find((x) => x.id === 'D4');
    await typeNFA(page, R.toText(c.spec)); await page.click('#toTable'); await page.click('#toConvert'); await page.click('#s3Body [data-a="skip"]');
    await page.waitForTimeout(1500);
    const ref = R.subsetConstruction(c.spec);
    const { idSet } = await checkStage4(page, c.spec, ref, 'D4 with motion');
    await testStrings(page, c.spec, ref, idSet, 'D4m with motion');
    T.eq('no script errors', page.errors, []);
    await page.context().close();
  });
  for (const id of ['E6', 'D5']) await scenario(`phone width 390px: ${id}`, async () => { const { page } = await journey(browser, CASES.find((x) => x.id === id), { viewport: { width: 390, height: 844 } }); await page.context().close(); });
  await scenario('phone width: error message is visible', async () => {
    const page = await openLab(browser, { viewport: { width: 390, height: 844 } });
    await typeNFA(page, INVALID[4].text);
    T.ok('error visible on a phone', (await msgs(page)).some((m) => /err/.test(m.cls) && m.visible));
    await page.context().close();
  });
  await scenario('reload: the lab starts cleanly (no saved state by design)', async () => {
    const page = await openLab(browser);
    await typeNFA(page, R.toText(CASES[0].spec));
    await page.reload(); await page.waitForSelector('#nfaText', { state: 'visible' });
    T.ok('after reload step 1 is shown with Continue enabled', await page.isVisible('#s1') && !(await page.isDisabled('#toTable')));
    T.eq('no script errors', page.errors, []);
    await page.context().close();
  });

  await browser.close();
  fs.unlinkSync(PAGE);
  T.note(`scenarios: ${scen.pass} passed, ${scen.fail} failed`);
  T.note(`distinct strings typed into the tester: ${typedStrings.size}`);
  T.done({ scenarios: scen, typedStrings: typedStrings.size, nfasTyped: CASES.length });
})();
