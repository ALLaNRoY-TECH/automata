/* Automata Lab — the cast.
   Six students drawn from one shared construction (same head, torso, limb
   geometry and light direction), so they read as one designed family.
   Each maps to one part of the formal definition M = (Q, Σ, δ, q₀, F), plus ε.
   drawStudent(spec) returns SVG markup for a 240×512 figure (feet at y≈500). */

(function (global) {
  const P = {
    ink: '#302F2A', char: '#46443d', graph: '#6b675d', steel: '#8b8676',
    fog: '#B8A58A', bone: '#E7DCC8', paper: '#F5F0E6', white: '#FFFCF5',
    forest: '#526B52', brass: '#AD8954', terra: '#B8735C', sage: '#DCE4D5',
    cobalt: '#AD8954', hairBrown: '#3b2d23', olive: '#7d7458'
  };

  const SKIN = {
    s1: '#e3cfba', s2: '#d4b597', s3: '#c09a7b', s4: '#a47d60', s5: '#86624a', s6: '#6a4c39'
  };

  const TORSO = 'M80,142 C96,134 144,134 160,142 C166,146 168,156 167,166 L162,304 C140,310 100,310 78,304 L73,166 C72,156 74,146 80,142 Z';

  const ARMS = {
    downL: [[84, 152], [76, 226], [80, 292]],
    downR: [[156, 152], [164, 226], [160, 292]],
    bookL: [[84, 152], [78, 228], [122, 238]],
    cardR: [[156, 152], [176, 214], [178, 156]],
    pointR: [[156, 152], [190, 198], [218, 170]],
    waveR: [[156, 152], [192, 172], [200, 110]],
    crossR: [[156, 152], [160, 230], [98, 222]],
    crossL: [[84, 152], [80, 232], [144, 230]],
    pocketL: [[84, 152], [77, 222], [96, 268]],
    pocketR: [[156, 152], [163, 222], [144, 268]]
  };

  const LEGS = {
    stand: { L: [[104, 300], [102, 400], [100, 482]], R: [[136, 300], [138, 400], [140, 482]] },
    easy: { L: [[104, 300], [98, 400], [92, 482]], R: [[136, 300], [138, 400], [142, 482]] },
    wide: { L: [[102, 300], [94, 400], [86, 482]], R: [[138, 300], [146, 400], [154, 482]] }
  };

  const pl = (pts) => pts.map((p) => p.join(',')).join(' ');
  const limb = (pts, color, w) =>
    `<polyline points="${pl(pts)}" fill="none" stroke="${P.ink}" stroke-width="${w + 3.4}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<polyline points="${pl(pts)}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const end = (pts) => pts[pts.length - 1];

  function hand(pts, skin, r = 10) {
    const [x, y] = end(pts);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${skin}"/>`;
  }

  function shoes(legs, color, sole) {
    const l = end(legs.L), r = end(legs.R);
    return `<rect x="${l[0] - 24}" y="${l[1] - 2}" width="36" height="17" rx="8.5" fill="${color}"/>` +
      `<rect x="${r[0] - 12}" y="${r[1] - 2}" width="36" height="17" rx="8.5" fill="${color}"/>` +
      (sole ? `<rect x="${l[0] - 24}" y="${l[1] + 10}" width="36" height="5" rx="2.5" fill="${sole}"/>` +
        `<rect x="${r[0] - 12}" y="${r[1] + 10}" width="36" height="5" rx="2.5" fill="${sole}"/>` : '');
  }

  /* ---------- hair ---------- */
  const HAIR = {
    crop: (c) => ({
      front: `<path d="M88,88 C83,52 100,38 122,38 C146,38 159,54 153,88 C151,74 147,66 139,61 C124,67 106,65 96,58 C92,67 90,77 88,88 Z" fill="${c}"/>`
    }),
    long: (c) => ({
      back: `<path d="M84,74 C82,42 102,32 120,32 C140,32 160,44 157,76 L162,150 L78,150 Z" fill="${c}"/>`,
      front: `<path d="M88,80 C88,48 106,40 122,40 C143,40 155,52 154,80 C147,66 134,59 121,59 C108,62 96,67 88,80 Z" fill="${c}"/>` +
        `<path d="M89,72 C84,100 82,140 80,190 C88,196 98,195 104,190 C100,150 98,112 99,86 Z" fill="${c}"/>` +
        `<path d="M152,72 C157,100 159,140 161,190 C153,196 143,195 137,190 C141,150 143,112 142,86 Z" fill="${c}"/>`
    }),
    curls: (c) => ({
      front: [[94, 62, 13], [104, 47, 14], [119, 40, 15], [135, 43, 15], [148, 55, 13], [112, 56, 13], [129, 56, 13], [89, 76, 9], [153, 72, 10], [121, 30, 12], [106, 33, 10], [138, 31, 10]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('')
    }),
    bun: (c) => ({
      back: `<circle cx="121" cy="27" r="17" fill="${c}"/><rect x="111" y="40" width="20" height="6" rx="3" fill="${P.fog}"/>`,
      front: `<path d="M89,84 C86,51 104,41 121,41 C141,41 157,53 152,84 C148,67 136,57 121,56 C105,57 94,67 89,84 Z" fill="${c}"/>` +
        `<path d="M90,78 C88,92 89,104 92,112" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`
    }),
    quiff: (c) => ({
      front: `<path d="M88,86 C83,52 96,30 126,27 C150,26 163,44 156,72 L153,86 C151,72 145,63 136,60 C121,57 103,62 93,73 Z" fill="${c}"/>` +
        `<path d="M90,90 C92,119 106,127 120,127 C134,127 148,119 150,90 C147,105 136,113 120,113 C104,113 93,105 90,90 Z" fill="${c}"/>` +
        `<path d="M109,100 Q120,95 131,100 Q120,103 109,100 Z" fill="${c}"/>`
    }),
    beanie: (c) => ({
      front: `<path d="M86,78 C84,36 104,23 120,23 C138,23 157,36 154,78 Z" fill="${P.forest}"/>` +
        `<rect x="84" y="62" width="72" height="19" rx="5" fill="#3f5540"/>` +
        `<path d="M96,30 L96,62 M108,25 L108,62 M120,23 L120,62 M132,25 L132,62 M144,30 L144,62" stroke="#3f5540" stroke-width="1.6" fill="none"/>` +
        `<path d="M88,82 C88,90 89,96 91,100 M152,82 C152,90 151,96 149,100" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"/>`
    })
  };

  /* ---------- outfits: torso + sleeves + legs ---------- */
  const OUTFIT = {
    cardigan: { sleeve: P.forest, leg: '#5b5446', legW: 30, shoe: P.ink, torso: (s) =>
      `<path d="${TORSO}" fill="${P.forest}"/>` +
      `<path d="M106,137 L120,214 L134,137 Z" fill="${P.white}"/>` +
      `<path d="M105,136 L113,154 L120,141 Z M135,136 L127,154 L120,141 Z" fill="${P.bone}"/>` +
      `<path d="M106,138 L120,216 L134,138" fill="none" stroke="${P.ink}" stroke-width="2"/>` +
      `<circle cx="120" cy="236" r="2.6" fill="${P.fog}"/><circle cx="120" cy="258" r="2.6" fill="${P.fog}"/><circle cx="120" cy="280" r="2.6" fill="${P.fog}"/>` +
      `<path d="M120,216 L120,304" stroke="${P.ink}" stroke-width="1.6"/>` +
      `<rect x="78" y="292" width="84" height="13" rx="4" fill="${P.ink}" opacity=".45"/>` },
    coat: { sleeve: P.fog, leg: P.ink, legW: 18, shoe: P.ink, torso: (s) =>
      `<path d="${TORSO}" fill="${P.fog}"/>` +
      `<path d="M76,298 L164,298 L172,394 C140,400 100,400 68,394 Z" fill="${P.fog}"/>` +
      `<rect x="107" y="138" width="26" height="260" fill="${P.ink}"/>` +
      `<rect x="104" y="119" width="32" height="30" rx="9" fill="${P.ink}"/>` +
      `<path d="M107,140 L96,196 L107,206 M133,140 L144,196 L133,206" fill="none" stroke="#8a765c" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<path d="M84,250 L100,250 M140,250 L156,250" stroke="#8a765c" stroke-width="2"/>` },
    hoodie: { sleeve: P.bone, leg: P.char, legW: 32, shoe: P.white, sole: P.ink, torso: (s) =>
      `<path d="M90,146 C88,116 152,116 150,146 Z" fill="#d3c3a6"/>` +
      `<path d="M78,140 C96,130 144,130 162,140 C170,146 172,158 171,168 L166,300 C142,308 98,308 74,300 L69,168 C68,158 70,146 78,140 Z" fill="${P.bone}"/>` +
      `<path d="M102,140 C108,152 132,152 138,140" fill="none" stroke="#b9a685" stroke-width="2.5"/>` +
      `<path d="M112,148 L110,192 M128,148 L130,192" stroke="${P.graph}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M94,238 L146,238 L154,280 L86,280 Z" fill="none" stroke="#b9a685" stroke-width="2.2" stroke-linejoin="round"/>` +
      `<rect x="74" y="290" width="92" height="15" rx="5" fill="#d3c3a6"/>` },
    blazer: { sleeve: P.char, leg: P.bone, legW: 40, shoe: P.ink, torso: (s) =>
      `<path d="${TORSO}" fill="${P.char}"/>` +
      `<path d="M106,137 L120,190 L134,137 Z" fill="${P.sage}"/>` +
      `<path d="M105,137 L120,192 L111,200 L96,152 Z M135,137 L120,192 L129,200 L144,152 Z" fill="#5c594f"/>` +
      `<path d="M120,192 L120,304" stroke="${P.char}" stroke-width="1.6"/>` +
      `<circle cx="125" cy="248" r="2.6" fill="${P.graph}"/>` +
      `<path d="M88,262 L108,262 M132,262 L152,262" stroke="${P.char}" stroke-width="2.2"/>` },
    denim: { sleeve: P.terra, leg: '#4b4a44', legW: 31, shoe: P.ink, torso: (s) =>
      `<path d="${TORSO}" fill="${P.terra}"/>` +
      `<path d="M106,138 Q120,151 134,138 L130,304 L110,304 Z" fill="${P.white}"/>` +
      `<path d="M100,134 L118,146 L106,166 L90,146 Z M140,134 L122,146 L134,166 L150,146 Z" fill="#97594a"/>` +
      `<rect x="86" y="182" width="20" height="22" rx="2" fill="none" stroke="#97594a" stroke-width="2"/>` +
      `<rect x="134" y="182" width="20" height="22" rx="2" fill="none" stroke="#97594a" stroke-width="2"/>` +
      `<path d="M74,286 L166,286" stroke="#97594a" stroke-width="2.2"/>` },
    bomber: { sleeve: '#9c7c4c', leg: '#5b5446', legW: 30, shoe: P.white, sole: P.graph, torso: (s) =>
      `<path d="${TORSO}" fill="#9c7c4c"/>` +
      `<path d="M102,134 C108,146 132,146 138,134 L136,128 C128,136 112,136 104,128 Z" fill="#7a6140"/>` +
      `<rect x="104" y="124" width="32" height="12" rx="5" fill="#7a6140"/>` +
      `<path d="M120,142 L120,292" stroke="#d9c39a" stroke-width="2"/>` +
      `<rect x="77" y="288" width="86" height="18" rx="5" fill="#7a6140"/>` +
      `<path d="M86,214 L100,206 M154,214 L140,206" stroke="${P.ink}" stroke-width="2.4" stroke-linecap="round"/>` }
  };

  function face(spec) {
    const k = spec.skinTone;
    const brow = {
      calm: 'M100,73 Q108,70 115,72 M125,72 Q132,70 140,73',
      sharp: 'M100,74 L115,70 M125,70 L140,74',
      lifted: 'M100,71 Q108,66 115,70 M125,70 Q132,66 140,71',
      soft: 'M101,74 Q108,72 115,74 M125,74 Q132,72 139,74'
    }[spec.brow || 'calm'];
    const mouth = {
      smile: 'M111,104 Q120,111 129,104',
      neutral: 'M113,105 Q120,107 127,105',
      smirk: 'M112,106 Q122,108 129,101',
      open: 'M112,103 Q120,113 128,103 Z'
    }[spec.mouth || 'neutral'];
    const mouthFill = spec.mouth === 'open' ? P.ink : 'none';
    return `<g class="eyes"><ellipse cx="108" cy="85" rx="3.2" ry="4.1" fill="${P.ink}"/><ellipse cx="132" cy="85" rx="3.2" ry="4.1" fill="${P.ink}"/></g>` +
      `<path d="${brow}" fill="none" stroke="${P.ink}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M120,88 Q124,96 118,98" fill="none" stroke="${k}" stroke-width="2.4" stroke-linecap="round" style="filter:brightness(.72)"/>` +
      `<path d="${mouth}" fill="${mouthFill}" stroke="${P.ink}" stroke-width="2.4" stroke-linecap="round"/>`;
  }

  function badge(sym) {
    return `<g class="sym-pin"><circle cx="140" cy="184" r="11.5" fill="${P.cobalt}"/>` +
      `<text x="140" y="188.5" text-anchor="middle" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="13" fill="${P.ink}">${sym}</text></g>`;
  }

  const PROPS = {
    book: () => `<g transform="rotate(-9 128 226)"><rect x="104" y="196" width="48" height="60" rx="3" fill="${P.white}"/>` +
      `<rect x="104" y="196" width="7" height="60" fill="${P.ink}"/>` +
      `<text x="132" y="234" text-anchor="middle" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="20" fill="${P.ink}">Q</text></g>`,
    card: () => `<g transform="rotate(6 178 116)"><rect x="150" y="94" width="58" height="42" rx="3" fill="${P.white}"/>` +
      `<text x="179" y="122" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="17" font-weight="500" fill="${P.ink}">0 1</text></g>`,
    finger: () => `<path d="M224,166 L236,158" stroke="var(--fig-skin)" stroke-width="7" stroke-linecap="round"/>`
  };

  function drawStudent(s) {
    const o = OUTFIT[s.outfit];
    const hair = HAIR[s.hair](s.hairColor || P.ink);
    const legs = LEGS[s.legs || 'stand'];
    const skin = s.skinTone;
    const armBack = s.armBack || ARMS.downL;
    const armFront = s.armFront || ARMS.downR;

    let body = '';
    body += hair.back || '';
    // legs
    if (s.outfit === 'coat') {
      body += limb([[106, 380], legs.L[1], legs.L[2]], P.ink, o.legW) + limb([[134, 380], legs.R[1], legs.R[2]], P.ink, o.legW);
    } else {
      body += limb(legs.L, o.leg, o.legW) + limb(legs.R, o.leg, o.legW);
    }
    body += shoes(legs, o.shoe, o.sole);
    // neck
    body += `<rect x="109" y="104" width="22" height="40" rx="6" fill="${skin}"/><rect x="109" y="106" width="22" height="12" fill="${P.ink}" opacity=".16"/>`;
    body += o.torso(s);
    // arms
    const sleeve = o.sleeve;
    const isCross = s.pose === 'cross';
    body += limb(armBack, sleeve, 24);
    if (s.pose !== 'pockets') body += hand(armBack, skin);
    if (s.prop === 'book') body += PROPS.book() + hand(armBack, skin, 10.5);
    body += limb(armFront, sleeve, 24);
    if (s.prop === 'card') body += PROPS.card();
    if (s.pose !== 'pockets') body += hand(armFront, skin, s.pose === 'wave' ? 11 : 10);
    if (s.pose === 'point') body += PROPS.finger().replace('var(--fig-skin)', skin);
    if (!isCross || true) body += badge(s.symbol);
    if (s.hair === 'long') body += ''; // front strands drawn with head
    // head
    let head = '';
    head += `<ellipse cx="89" cy="86" rx="6" ry="9" fill="${skin}"/><ellipse cx="151" cy="86" rx="6" ry="9" fill="${skin}"/>`;
    head += `<ellipse cx="120" cy="80" rx="31" ry="37" fill="${skin}"/>`;
    head += face(s);
    head += hair.front;
    if (s.glasses) {
      head += `<circle cx="108" cy="85" r="9.5" fill="none" stroke="${P.ink}" stroke-width="2.3"/>` +
        `<circle cx="132" cy="85" r="9.5" fill="none" stroke="${P.ink}" stroke-width="2.3"/>` +
        `<path d="M117.5,84 L122.5,84 M98.5,83 L91,81 M141.5,83 L149,81" stroke="${P.ink}" stroke-width="2.3" fill="none"/>`;
    }
    if (s.earring) head += `<circle cx="150" cy="99" r="2.6" fill="${P.cobalt}"/>`;
    body += `<g transform="rotate(${s.tilt || 0} 120 116)">${head}</g>`;

    const sc = s.scale || 1;
    const fig = `<g transform="translate(${120 - 120 * sc} ${500 - 500 * sc}) scale(${sc})">${body}</g>`;
    // one consistent light: from upper left; shadow side cast as a masked ink copy
    return `<ellipse cx="120" cy="503" rx="64" ry="6" fill="${P.fog}" opacity=".55"/>` +
      `<g class="fig-body">${fig}</g>` +
      `<g class="fig-shade" mask="url(#al-shade)" opacity=".5">${fig}</g>`;
  }

  /* Shared SVG defs: the shadow side is pencil hatching, masked to the right
     of a diagonal terminator so every figure is lit from the upper left. */
  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    <pattern id="al-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
      <rect width="5" height="5" fill="#302F2A" fill-opacity=".18"/><line x1="0" y1="0" x2="0" y2="5" stroke="#302F2A" stroke-width="1.3" stroke-opacity=".55"/>
    </pattern>
    <linearGradient id="al-shade-g" x1="0" y1="0" x2="1" y2=".28">
      <stop offset=".57" stop-color="#000"/><stop offset=".6" stop-color="#fff"/>
    </linearGradient>
    <mask id="al-shade" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#al-shade-g)"/></mask>
    <filter id="al-pencil" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="al-pencil-wide" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs></svg>`;

  const CAST = [
    { id: 'allan', name: 'Allan', symbol: 'Q', role: 'the set of states', gender: 'm',
      line: 'Counts everything twice. Trusts only finite sets.',
      note: 'how many places can we be?',
      why: 'Q is a finite list of places the machine can be. Allan keeps the list.',
      def: 'Q = {q₀, q₁, q₂}', group: 0,
      skinTone: SKIN.s4, hair: 'crop', hairColor: P.ink, outfit: 'cardigan', glasses: true, prop: 'book',
      armBack: ARMS.bookL, armFront: ARMS.downR, brow: 'calm', mouth: 'neutral', tilt: 0, scale: .98 },
    { id: 'aaditya', name: 'Aaditya', symbol: 'Σ', role: 'the input alphabet', gender: 'm',
      line: 'Speaks fluently in exactly two symbols.',
      note: 'only 0 and 1, please',
      why: 'Σ is the set of symbols the machine can read. Aaditya hands them out.',
      def: 'Σ = {0, 1}', group: 0,
      skinTone: SKIN.s5, hair: 'quiff', hairColor: P.ink, outfit: 'denim', prop: 'card',
      armBack: ARMS.downL, armFront: ARMS.cardR, brow: 'lifted', mouth: 'smile', tilt: -3, scale: 1.01 },
    { id: 'pranet', name: 'Pranet', symbol: 'δ', role: 'the transition function', gender: 'm',
      line: 'Always knows where you go next. Sometimes it is several places.',
      note: 'that way! and that way!',
      why: 'δ says where each state goes on each symbol. In an NFA it can name several places.',
      def: 'δ : Q × (Σ ∪ {ε}) → 𝒫(Q)', group: 1,
      skinTone: SKIN.s6, hair: 'curls', hairColor: P.ink, outfit: 'hoodie', pose: 'point',
      armBack: ARMS.downL, armFront: ARMS.pointR, brow: 'sharp', mouth: 'open', tilt: 3, legs: 'easy', scale: 1.03 },
    { id: 'neha', name: 'Neha', symbol: 'ε', role: 'the empty move', gender: 'f',
      line: 'Moves without saying a word.',
      note: 'no symbol needed',
      why: 'An ε-move changes state without reading anything. Neha is the reason we take ε-closures.',
      def: 'ε-closure(S): every state reachable from S on ε alone', group: 1,
      skinTone: SKIN.s2, hair: 'bun', hairColor: P.hairBrown, outfit: 'blazer', pose: 'pockets', earring: true,
      armBack: ARMS.pocketL, armFront: ARMS.pocketR, brow: 'soft', mouth: 'smirk', tilt: 4, legs: 'easy', scale: .97 },
    { id: 'abhinesh', name: 'Abhinesh', symbol: 'q₀', role: 'the start state', gender: 'm',
      line: 'First one in. Every computation starts with him.',
      note: 'everyone starts here',
      why: 'q₀ is where every run begins. Abhinesh is always first through the door.',
      def: 'q₀ ∈ Q', group: 2,
      skinTone: SKIN.s3, hair: 'beanie', hairColor: P.ink, outfit: 'bomber', pose: 'wave',
      armBack: ARMS.downL, armFront: ARMS.waveR, brow: 'lifted', mouth: 'smile', tilt: -2, legs: 'wide', scale: 1 },
    { id: 'haritha', name: 'Haritha', symbol: 'F', role: 'the accepting states', gender: 'f',
      line: 'Says yes rarely, and only at the very end.',
      note: 'finish here and you win',
      why: 'F is the set of accepting states. End a string inside F and Haritha says yes.',
      def: 'F ⊆ Q, here F = {q₂}', group: 2,
      skinTone: SKIN.s1, hair: 'long', hairColor: P.hairBrown, outfit: 'coat', pose: 'cross',
      armBack: ARMS.crossR, armFront: ARMS.crossL, brow: 'sharp', mouth: 'neutral', tilt: 0, scale: .99 }
  ];

  global.AL = global.AL || {};
  global.AL.cast = CAST;
  global.AL.palette = P;
  global.AL.figureDefs = DEFS;
  global.AL.drawStudent = drawStudent;
  /* Full figure as a standalone <svg>; crop:'bust' frames head and shoulders. */
  global.AL.figureSVG = function (c, opts = {}) {
    const vb = opts.crop === 'bust' ? '58 4 124 152' : '0 0 240 512';
    const label = `${c.name}, ${c.symbol}, ${c.role}`;
    return `<svg class="fig ${opts.crop === 'bust' ? 'is-bust ' : ''}${opts.cls || ''}" viewBox="${vb}" role="img" aria-label="${label}" preserveAspectRatio="xMidYMax meet">${drawStudent(c)}</svg>`;
  };
})(window);
