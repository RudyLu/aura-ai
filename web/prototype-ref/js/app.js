// Aura.ai prototype: views and interactions.
// Depends on AuraTopics, AuraStore, AuraHealth, AuraDiscovery, AuraChart.
(function () {
  const T = window.AuraTopics, S = window.AuraStore, H = window.AuraHealth, D = window.AuraDiscovery;
  const app = document.querySelector('#app');
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const btn = (text, act, cls = 'primary', extra = '') => `<button type="button" class="${cls}" data-act="${act}" ${extra}>${text}</button>`;
  const $ = sel => document.querySelector(sel);
  const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };

  let st = S.load();
  const today = () => S.todayISO();

  // Transient interface state (not persisted).
  const ui = {
    page: st.onboarded ? 'app' : 'splash',
    tab: 'today',
    modal: null,
    m: {},              // modal data
    step: 0,            // onboarding step
    ob: null,           // onboarding draft
    fromReview: false,
    draft: null,        // Aura suggestion
    auraState: 'idle',
    pending: false,
    cocoaOffer: false,
    explore: { obsId: null, range: 7, date: null, metric: 'all' },
    fb: { step: 0, d: {} },
    importing: null,
    chartPlayed: false
  };

  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.h);
    toast.h = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- sample data (kept separate, removable) ----------
  function seedSample(obs) {
    const scores = H.SAMPLE_SCORES[obs.topicId];
    const t = T.topic(obs.topicId).timing.defaultTime;
    for (let n = 1; n <= 13; n++) {
      const date = S.addDays(today(), -n);
      if (st.checkins.some(c => c.source === 'sample' && c.observationId === obs.id && c.date === date)) continue;
      const score = scores[n];
      st.checkins.push({
        id: S.uid('smp'), observationId: obs.id, topicId: obs.topicId, source: 'sample',
        occurredAt: `${date}T${t}`, date, status: score === null ? 'unknown' : 'recorded', score, note: '', createdAt: new Date().toISOString()
      });
    }
    for (const n of H.SAMPLE_CAFFEINE_DAYS) {
      const date = S.addDays(today(), -n);
      if (st.entries.some(e => e.source === 'sample' && e.date === date)) continue;
      st.entries.push({ id: S.uid('smp'), source: 'sample', kind: 'caffeine', name: 'Coffee', size: '1 cup', mg: null, occurredAt: `${date}T${n % 3 ? '10:30' : '15:00'}`, date, note: '', createdAt: new Date().toISOString() });
    }
  }
  function setDataSource(src) {
    st.dataSource = src;
    if (src === 'sample') S.activeObservations().forEach(seedSample);
    else {
      st.checkins = st.checkins.filter(c => c.source !== 'sample');
      st.entries = st.entries.filter(e => e.source !== 'sample');
    }
    S.save();
  }

  // ---------- shell ----------
  const auraMark = (size = '', state = 'idle') => `<span class="live-aura ${size}" data-aura-state="${state}" aria-hidden="true"><span class="aura-atmosphere"></span><span class="aura-core"></span><span class="aura-ripple"></span></span>`;

  function shell(body) {
    const nav = ui.page === 'app' ? `<nav aria-label="Main navigation">${[['today', 'Today'], ['explore', 'Explore'], ['aura', 'Aura']].map(([id, t]) =>
      `<button type="button" data-act="tab" data-val="${id}" class="${ui.tab === id ? 'current' : ''}" ${ui.tab === id ? 'aria-current="page"' : ''}>${id === 'aura' ? '<span class="nav-aura" aria-hidden="true"></span>' : ''}${t}</button>`).join('')}</nav>` : '';
    return `<div class="phone">${body}${nav}</div>`;
  }

  // Identify a control so focus can return to it after a re-render.
  const controlKey = el => {
    if (!el || !el.dataset) return null;
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (!el.dataset.act) return null;
    return ['act', 'val', 'obs', 'rec', 'plan'].filter(k => el.dataset[k] !== undefined).map(k => `[data-${k}="${CSS.escape(el.dataset[k])}"]`).join('');
  };
  let lastModalSeq = null;

  function render() {
    // Keep unsent sheet input across re-renders of the same sheet.
    const sameSheet = ui.modal && ui.modalSeq === lastModalSeq;
    const saved = {};
    let focusKey = null, sheetScroll = 0;
    if (sameSheet) {
      document.querySelectorAll('.sheet input[id], .sheet textarea[id], .sheet select[id]').forEach(el => {
        if (el.type === 'file') return;
        saved[el.id] = el.type === 'checkbox' ? el.checked : el.value;
      });
      focusKey = controlKey(document.activeElement && document.activeElement.closest('.sheet') ? document.activeElement : null);
      sheetScroll = $('.sheet')?.scrollTop || 0;
    }
    let body;
    if (ui.page === 'splash') body = splash();
    else if (ui.page === 'onboarding') body = onboarding();
    else body = ui.tab === 'explore' ? explore() : ui.tab === 'aura' ? chat() : home();
    app.innerHTML = shell(body) + (ui.modal ? modal() : '');
    if (ui.modal) {
      for (const [id, v] of Object.entries(saved)) {
        const el = document.getElementById(id);
        if (!el || el.dataset.keep === 'fresh') continue;
        if (el.type === 'checkbox') el.checked = v; else el.value = v;
      }
      const sheet = $('.sheet');
      if (sameSheet) { sheet.scrollTop = sheetScroll; (focusKey && sheet.querySelector(focusKey) || sheet).focus({ preventScroll: true }); }
      else sheet?.focus();
      lastModalSeq = ui.modalSeq;
    } else {
      lastModalSeq = null;
      if (ui.returnFocus) { const el = document.querySelector(ui.returnFocus); ui.returnFocus = null; el?.focus(); }
    }
    // Goal tags: one line until "See all"; the button shows only when they overflow.
    const tags = $('#goaltags');
    if (tags) tags.parentElement.classList.toggle('overflows', tags.classList.contains('open') || tags.scrollHeight > tags.clientHeight + 2);
    // Your day: start the time strip near "now".
    // Your day: the centre pin marks the time to log at; start at the chosen time, or now.
    const tl = $('.daytl');
    if (tl) { tl.scrollLeft = ui.dayAt ? (ui.dayAt.h - +tl.dataset.h0) * +tl.dataset.px : +tl.dataset.now; syncDayPin(tl); }
    const plot = $('.overlayplot');
    if (plot && !ui.chartPlayed) { plot.classList.add('chart-enter'); ui.chartPlayed = true; }
    const deck = $('#topic-deck');
    if (deck && ui.ob) { const card = deck.querySelector(`[data-topic="${ui.ob.topicId}"]`); if (card) deck.scrollLeft = card.offsetLeft - (deck.clientWidth - card.clientWidth) / 2; }
    // Keep the selected date visible in the date strip.
    const selDate = $('.overlaydates .selected');
    if (selDate) { const strip = selDate.parentElement; strip.scrollLeft = selDate.offsetLeft - strip.offsetLeft - strip.clientWidth / 2 + selDate.clientWidth / 2; }
  }

  // Time under the centre pin of the Your day strip; null when it's now.
  function syncDayPin(tl) {
    const px = +tl.dataset.px, h0 = +tl.dataset.h0, now = +tl.dataset.now;
    const atNow = now - tl.scrollLeft < px / 12; // within 5 minutes
    let label = 'Now';
    if (atNow) ui.dayAt = null;
    else {
      const h = h0 + tl.scrollLeft / px;
      const mins = Math.round(h * 60 / 5) * 5;
      label = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      ui.dayAt = { h, time: label };
    }
    const wrap = tl.closest('.daytlwrap');
    wrap.querySelector('.tlpintime').textContent = label;
    wrap.classList.toggle('past', !atNow);
    const at = document.querySelector('.tlat'); if (at) at.textContent = atNow ? 'now' : label;
    tl.querySelectorAll('.tlitem').forEach(el => el.classList.toggle('near', Math.abs(parseFloat(el.style.left) - tl.scrollLeft) < 26));
  }

  // Mood faces for a 1–5 answer: flat colour, closed eyes, a simple line mouth.
  // mood runs bad→good; for "higher = sleepier" topics pass 6 - score.
  const FACE_COLORS = ['#8b93e8', '#b4a3ef', '#f3c5a2', '#f2a066', '#f6c945'];
  // Energy faces: the mochi's posture is its energy. Drained = melted into a puddle
  // with sleepy eyes and a yawn; full = standing tall, lifted off the ground, bright-eyed.
  const FACE_SHAPES = [ // left, right, top, bottom
    [0, 48, 22, 45], [1, 47, 16, 45], [3, 45, 11, 45], [4, 44, 7, 45], [5, 43, 4, 42]
  ];
  function moodFace(mood, size = 40) {
    const i = Math.max(1, Math.min(5, mood)) - 1, ink = '#2a2320';
    const [xl, xr, t, bt] = FACE_SHAPES[i];
    const mid = (t + bt) / 2 + 4;
    const body = `M${xl} ${mid}C${xl} ${t + 8} ${12} ${t} 24 ${t}S${xr} ${t + 8} ${xr} ${mid}C${xr} ${bt - 3} 36 ${bt} 24 ${bt}S${xl} ${bt - 3} ${xl} ${mid}Z`;
    const Y = t + (bt - t) * 0.52; // eye line
    const m = Y + 6.5;              // mouth line
    const L = 18.5, R = 29.5;
    const line = d => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    // One line-drawn language for every level, in the spirit of the sleepy one.
    const closedDown = `M${L - 3} ${Y - .6}q3 2.6 6 0M${R - 3} ${Y - .6}q3 2.6 6 0`; // ‿ ‿
    const closedUp = `M${L - 3} ${Y + .8}q3 -2.8 6 0M${R - 3} ${Y + .8}q3 -2.8 6 0`;  // ︵ ︵
    const parts = [
      // 1 drained: sleeping eyes, a small yawn, a "z"
      line(closedDown) + `<ellipse cx="24" cy="${m + .6}" rx="1.9" ry="2.3" fill="${ink}"/>` + `<path d="M37 ${t - 7}h4l-4 4h4" fill="none" stroke="#c9cdf5" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
      // 2 low: heavy flat lids, a small flat mouth, a sweat drop
      line(`M${L - 2.6} ${Y}h5.2M${R - 2.6} ${Y}h5.2M22 ${m}h4`) + `<path d="M${xr - 6} ${t + 5}q-2.6 3.8 0 5.4q2.6-1.6 0-5.4Z" fill="#e6ebff" opacity=".9"/>`,
      // 3 moderate: little dot eyes, a small smile
      `<circle cx="${L}" cy="${Y}" r="2.3" fill="${ink}"/><circle cx="${R}" cy="${Y}" r="2.3" fill="${ink}"/>` + line(`M22 ${m - .4}q2 1.6 4 0`),
      // 4 high: smiling eyes, a smile
      line(closedUp + `M21 ${m - .8}q3 2.8 6 0`),
      // 5 full: smiling eyes, open grin, sparks; lifted with a shadow below
      line(closedUp) + `<path d="M20.4 ${m - 1.6}h7.2q-.5 4.6-3.6 4.6T20.4 ${m - 1.6}Z" fill="${ink}"/><path d="M5 6l3 3M3 12h3.5M43 6l-3 3M45 12h-3.5" stroke="#fff3c4" stroke-width="1.8" stroke-linecap="round"/>`
    ][i];
    const blush = false ? `<ellipse cx="${xl + 7.5}" cy="${Y + 4}" rx="3" ry="1.9" fill="#ff7d6b" opacity=".35"/><ellipse cx="${xr - 7.5}" cy="${Y + 4}" rx="3" ry="1.9" fill="#ff7d6b" opacity=".35"/>` : '';
    const ground = i === 4 ? '<ellipse cx="24" cy="46.5" rx="12" ry="1.6" fill="#000" opacity=".28"/>' : '';
    return `<svg class="moodface" viewBox="0 0 48 48" width="${size}" height="${size}" style="overflow:visible" aria-hidden="true">${ground}<path d="${body}" fill="${FACE_COLORS[i]}"/>${blush}${parts}</svg>`;
  }
  const moodOf = (topicId, score) => T.topic(topicId).higherIsBetter ? score : 6 - score;

  // ---------- splash ----------
  // Aura.ai mark: an open halo with a spark where it ends, a glow that builds
  // one day at a time. No orb, so it never competes with the live Aura orb.
  let logoN = 0;
  function logoMark(size = 32) {
    const id = `lg${logoN++}`;
    return `<svg class="logomark" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}r" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7d93c4"/><stop offset=".55" stop-color="#d7b3a6"/><stop offset="1" stop-color="#eeb28b"/></linearGradient></defs><circle cx="32" cy="32" r="22" fill="none" stroke="url(#${id}r)" stroke-width="5" stroke-linecap="round" stroke-dasharray="118 139" transform="rotate(-36 32 32)"/><circle cx="49.8" cy="19.1" r="4.2" fill="#ffe6cc"/></svg>`;
  }
  const logoLockup = (size = 30) => `<span class="logolockup">${logoMark(size)}<span class="logotype">Aura<span>.ai</span></span></span>`;

  // Goal illustrations: one luminous object per goal group, drawn in SVG.
  let artN = 0;
  function goalArt(group, size = 80) {
    const id = `ga${artN++}`;
    const glow = `<filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>`;
    const shine = (cx, cy, r) => `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * .6}" fill="#fff" opacity=".55" filter="url(#${id}s)"/>`;
    const soft = `<filter id="${id}s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>`;
    const art = {
      // crescent moon with two small stars
      sleep: `<defs>${glow}${soft}<radialGradient id="${id}g" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff7ec"/><stop offset=".45" stop-color="#b9c4f5"/><stop offset="1" stop-color="#7a5fd0"/></radialGradient><mask id="${id}m"><rect width="100" height="100" fill="#fff"/><circle cx="62" cy="40" r="25" fill="#000"/></mask></defs>
        <circle cx="40" cy="58" r="20" fill="#9b8cf0" opacity=".5" filter="url(#${id}b)"/>
        <circle cx="48" cy="52" r="28" fill="url(#${id}g)" mask="url(#${id}m)"/>${shine(34, 42, 6)}
        <path d="M74 20l1.6 4.4 4.4 1.6-4.4 1.6L74 32l-1.6-4.4-4.4-1.6 4.4-1.6z" fill="#ffe7c7"/><circle cx="80" cy="44" r="1.6" fill="#fff" opacity=".8"/>`,
      // four-point spark
      alertness: `<defs>${glow}${soft}<radialGradient id="${id}g" cx=".45" cy=".35" r=".8"><stop offset="0" stop-color="#fffbe6"/><stop offset=".45" stop-color="#ffd46b"/><stop offset="1" stop-color="#f08a3c"/></radialGradient></defs>
        <circle cx="50" cy="52" r="24" fill="#ffb84d" opacity=".35" filter="url(#${id}b)"/>
        <path d="M50 14C53 38 58 45 82 50 58 55 53 62 50 88 47 62 42 55 18 50 42 45 47 38 50 14z" fill="url(#${id}g)"/>${shine(46, 40, 4)}
        <circle cx="76" cy="24" r="2" fill="#fff4d6"/>`,
      // flame-like teardrop
      energy: `<defs>${glow}${soft}<linearGradient id="${id}g" x1=".5" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="#ffd9a8"/><stop offset=".5" stop-color="#ff8a6a"/><stop offset="1" stop-color="#e2507a"/></linearGradient></defs>
        <ellipse cx="50" cy="62" rx="24" ry="22" fill="#ff7a6a" opacity=".4" filter="url(#${id}b)"/>
        <path d="M50 12C58 30 76 42 76 62a26 26 0 0 1-52 0c0-20 18-32 26-50z" fill="url(#${id}g)"/>
        <path d="M50 46c4 8 12 13 12 21a12 12 0 0 1-24 0c0-8 8-13 12-21z" fill="#fff1d6" opacity=".75"/>`,
      // planet with a tilted ring
      movement: `<defs>${glow}${soft}<radialGradient id="${id}g" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#e6fffa"/><stop offset=".45" stop-color="#6fd6e2"/><stop offset="1" stop-color="#3a62b8"/></radialGradient><mask id="${id}f"><rect x="0" y="54" width="100" height="50" fill="#fff" transform="rotate(-18 50 54)"/></mask></defs>
        <circle cx="50" cy="52" r="26" fill="#5ccfe0" opacity=".4" filter="url(#${id}b)"/>
        <ellipse cx="50" cy="54" rx="40" ry="11" fill="none" stroke="#cdeeff" stroke-opacity=".4" stroke-width="2.4" transform="rotate(-18 50 54)"/>
        <circle cx="50" cy="52" r="22" fill="url(#${id}g)"/>${shine(42, 42, 5)}
        <ellipse cx="50" cy="54" rx="40" ry="11" fill="none" stroke="#e6fbff" stroke-width="2.4" transform="rotate(-18 50 54)" mask="url(#${id}f)"/>
        <circle cx="87" cy="42" r="3.6" fill="#fff"/>`,
      // two overlapping bubbles
      mood: `<defs>${glow}${soft}<radialGradient id="${id}g" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff0f6"/><stop offset=".5" stop-color="#f6a3c4"/><stop offset="1" stop-color="#9a6be0"/></radialGradient><radialGradient id="${id}h" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#f2fffb"/><stop offset=".5" stop-color="#9fe0d8"/><stop offset="1" stop-color="#6a8de0"/></radialGradient></defs>
        <circle cx="50" cy="54" r="28" fill="#e79ad0" opacity=".38" filter="url(#${id}b)"/>
        <circle cx="62" cy="40" r="15" fill="url(#${id}h)" opacity=".95"/>
        <circle cx="44" cy="58" r="22" fill="url(#${id}g)"/>${shine(37, 49, 5)}${shine(58, 35, 3)}`
    }[group] || '';
    return `<svg class="goalart" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">${art}</svg>`;
  }

  function splash() {
    return `<section class="splash aura-splash"><div class="aura-opening">${auraMark('aura-large')}<p class="splashlogo"><span class="logotype">Aura<span>.ai</span></span></p><h1>Understand<br>how you live.</h1><p>Every life has a glow.<br>We help you see it.</p></div><div class="splashbottom">${btn('Get started', 'begin')}${btn('See a demo timeline', 'demo', 'text')}<small>Prototype. Records stay in this browser. Aura’s replies are preset.</small></div></section>`;
  }

  // ---------- onboarding: six screens ----------
  const OB_TITLES = ['What’s been getting in the way lately?', 'Your first observation.', 'When should Aura ask?', 'What have you tried so far?', 'What should a step work around?', 'Sync with Apple Health', 'Check your starting point.'];
  const OB_LAST = OB_TITLES.length - 1;
  const ATTEMPTS = ['An earlier bedtime', 'Less or earlier caffeine', 'More exercise', 'Short breaks or naps', 'Tracking with another app', 'Nothing yet'];
  const CONSTRAINTS = ['Keep it simple', 'Overtime and changing plans', 'Shift work', 'Family or caregiving'];

  function startOnboarding() {
    ui.ob = { consent: { terms: false, health: false, share: false }, concerns: [], goalId: null, topicId: null, time: null, attempts: [], attemptsNote: '', constraint: 'Keep it simple', data: 'none', types: { sleep: true, activity: true, cycle: true } };
    // Apple Health starts on (simulated in this prototype); the user can switch it off on its screen.
    if (!st.healthImport) { st.healthImport = H.simulateAppleHealth(today()); S.save(); }
    ui.ob.data = 'apple-health';
    ui.step = 0; ui.fromReview = false; ui.page = 'onboarding';
  }

  const option = (text, on, act, v, sub = '', type = 'radio') =>
    `<button type="button" class="option ${on ? 'selected' : ''}" data-act="${act}" data-val="${E(v)}" ${type === 'radio' ? `role="radio" aria-checked="${on}"` : `aria-pressed="${on}"`}><span>${text}${sub ? `<small class="optsub">${sub}</small>` : ''}</span></button>`;

  // 1–5 answer as one slider with a sentence that reads the answer back.
  // ctx says where the value lives: checkin sheet, step feedback, or Today.
  const sentence = (t, v) => { const l = t.labels[v - 1]; return (/^[A-Z][a-z]/.test(l) && !/^Not /.test(l) ? l.toLowerCase() : l.charAt(0).toLowerCase() + l.slice(1)) + '.'; };
  function scaleSlider(topicId, choice, ctx, attrs = '') {
    const t = T.topic(topicId);
    const set = /^[1-5]$/.test(String(choice));
    const v = set ? +choice : 3;
    return `<div class="slider ${set ? 'set' : ''}" data-topic="${topicId}">
      <p class="sllead">${E(t.lead || t.name)}</p>
      <p class="slvalue" aria-hidden="true">${set ? E(sentence(t, v)) : 'Slide to answer'}</p>
      <div class="sltrack" style="--t:${(v - 1) / 4}"><span class="slfill" aria-hidden="true"></span><input type="range" min="1" max="5" step="1" value="${v}" data-act="scale-range" data-ctx="${ctx}" ${attrs} aria-label="${E(t.question)}" aria-valuetext="${set ? `${v}, ${E(t.labels[v - 1])}` : 'Not answered'}"></div>
      <div class="slends" aria-hidden="true"><span>${E(t.labels[0])}</span><span>${E(t.labels[4])}</span></div>
    </div>`;
  }

  function scalePreview(topicId) {
    const t = T.topic(topicId);
    return `<ol class="scalepreview" aria-label="Answer scale">${t.labels.map((l, i) => `<li><b>${i + 1}</b>${E(l)}</li>`).join('')}</ol><p class="soft">${E(t.direction)} You can also answer “Not sure” or skip a day.</p>`;
  }

  function discoveryPreview(data, types, topicId) {
    const facs = D.factorsFor(topicId);
    const has = need => need === 'caffeine' ? true : (data !== 'none' && types[need]);
    return `<section class="discoverypreview"><p class="eyebrow">After ${D.MIN_DAYS} days of check-ins</p><p>Aura compares your days by:</p><ul class="factorlist">${facs.map(f => `<li class="${has(f.needs) ? 'on' : 'off'}"><span>${E(f.label)}</span>${has(f.needs) ? '' : `<small>Needs ${f.needs === 'sleep' ? 'sleep' : 'movement'} data</small>`}</li>`).join('')}</ul></section>`;
  }

  function onboarding() {
    const o = ui.ob, i = ui.step;
    let body = '';
    if (i === 0) body = `<p>Pick any that fit. Aura will suggest where to start.</p><div class="concerns">${T.CONCERN_GROUPS.map(g => `<fieldset class="concerngroup"><legend>${E(g.label)}</legend><div class="chips">${g.items.map(c => `<button type="button" class="chip" data-act="ob-concern" data-val="${c.id}" aria-pressed="${o.concerns.includes(c.id)}">${E(c.label)}</button>`).join('')}</div></fieldset>`).join('')}</div>`;
    if (i === 2) {
      const t = T.topic(o.topicId);
      body = `<p>${E(t.timing.hint)}</p><label class="inputlabel">Reminder time<input id="ob-time" type="time" value="${E(o.time || t.timing.defaultTime)}"></label><p class="soft">You can still check in at another time.</p>`;
    }
    if (i === 3) body = `<p>Pick any. Aura won’t suggest them again.</p><div class="options">${ATTEMPTS.map(a => option(E(a), o.attempts.includes(a), 'ob-attempt', a, '', 'check')).join('')}</div><label class="inputlabel">Anything to add? <small>Optional</small><input id="ob-attempt-note" value="${E(o.attemptsNote)}" placeholder="e.g. Tried no coffee after 3 pm for a week"></label>`;
    if (i === 4) body = `<p>Suggested steps will fit around it.</p><div class="options" role="radiogroup" aria-label="Constraint">${CONSTRAINTS.map(c => option(E(c), o.constraint === c, 'ob-constraint', c)).join('')}</div>`;
    if (i === OB_LAST) {
      const t = T.topic(o.topicId);
      const row = (label, value, step) => `<div class="reviewrow"><div><small>${label}</small><p>${value}</p></div>${btn('Edit', 'ob-edit', 'quiet', `data-val="${step}" aria-label="Edit ${label}"`)}</div>`;
      const dataText = o.data === 'apple-health' && st.healthImport ? H.sourceLabel('apple-health', st.healthImport) : 'Only my check-ins';
      body = `<p>Tap Edit to change anything.</p><div class="reviewlist">${row('Getting in the way', E(o.concerns.map(c => T.CONCERNS[c]?.label).filter(Boolean).join(', ') || 'Not answered'), 0)}${row('Observation', E(t.name), 1)}${row('Check-in time', E(o.time || t.timing.defaultTime), 2)}${row('Already tried', E(o.attempts.join(', ') || 'Not answered') + (o.attemptsNote ? `<br><span class="soft">${E(o.attemptsNote)}</span>` : ''), 3)}${row('Work around', E(o.constraint), 4)}${row('Data', E(dataText), 5)}</div>${discoveryPreview(o.data === 'apple-health' && !st.healthImport ? 'none' : o.data, o.types, o.topicId)}${consentBlock(o)}`;
    }
    if (i === 1) return topicDeck(o);
    if (i === 5) return syncScreen({ back: 'ob-back', next: 'ob-next', on: o.data === 'apple-health' && !!st.healthImport, step: true });
    const canNext = (i === 0 && o.concerns.length) || (i === 1 && o.topicId) || (i >= 2 && i < OB_LAST) || (i === OB_LAST && o.consent.terms && o.consent.health);
    const nextLabel = i === 0 && !ui.fromReview ? (o.concerns.length ? `Continue · ${o.concerns.length} selected` : 'Choose at least one') : i === OB_LAST ? 'Start observing' : ui.fromReview ? 'Back to review' : 'Continue';
    return `<main class="survey">${obHead(i)}<h1>${OB_TITLES[i]}</h1>${body}<div class="surveybottom">${btn(nextLabel, 'ob-next', 'primary', canNext ? '' : 'disabled aria-disabled="true"')}<p id="ob-error" class="error" role="alert"></p></div></main>`;
  }

  // Agreements before starting. Terms and health-data consent are required;
  // sharing anonymous usage data is optional and off by default.
  function consentBlock(o) {
    const c = o.consent;
    const box = (key, required, html) => `<label class="consent"><input type="checkbox" data-act="ob-consent" data-val="${key}" ${c[key] ? 'checked' : ''} ${required ? 'aria-required="true"' : ''}><span>${html}${required ? '' : ' <em>Optional</em>'}</span></label>`;
    return `<fieldset class="consents"><legend>Before you start</legend>
      ${box('terms', true, `I agree to the ${btn('Terms of Service', 'open', 'inlinelink', 'data-val="legal" data-doc="terms"')} and ${btn('Privacy Policy', 'open', 'inlinelink', 'data-val="legal" data-doc="privacy"')}.`)}
      ${box('health', true, `Aura may use my check-ins${o.data === 'apple-health' ? ' and Apple Health data' : ''} on this device. ${btn('What this means', 'open', 'inlinelink', 'data-val="legal" data-doc="health"')}`)}
      ${box('share', false, 'Share anonymous usage data. Never includes your records.')}
      <p class="soft">Aura is not a medical device and doesn’t diagnose or treat any condition.</p></fieldset>`;
  }

  function saveObFields() {
    if (!ui.ob) return;
    if (ui.step === 2 && $('#ob-time')) ui.ob.time = val('ob-time');
    if (ui.step === 3 && $('#ob-attempt-note')) ui.ob.attemptsNote = val('ob-attempt-note').trim();
  }

  function finishOnboarding() {
    const o = ui.ob;
    st.profile = { consent: Object.assign({ at: new Date().toISOString() }, o.consent), concerns: o.concerns, goalId: (T.GOALS.find(g => g.topicId === o.topicId) || {}).id || null, attempts: o.attempts, attemptsNote: o.attemptsNote, constraint: o.constraint, context: [] };
    st.healthTypes = Object.assign({}, o.types);
    const obs = S.addObservation(o.topicId, o.time);
    st.onboarded = true;
    setDataSource(o.data === 'apple-health' && !st.healthImport ? 'none' : o.data);
    if (o.data === 'apple-health' && !st.healthImport) toast('Apple Health not imported yet. You can import from Explore.');
    S.save();
    ui.page = 'app'; ui.tab = 'today'; ui.ob = null;
    ui.explore.obsId = obs.id;
  }

  // ---------- Apple Health import controls (onboarding + data sheet) ----------
  // Back, step count and progress bar: identical on every setup screen.
  const obHead = i => `<div class="obhead"><div class="steprow">${btn('Back', 'ob-back', 'quiet')}<span>${i + 1} of ${OB_LAST + 1}</span></div><div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${OB_LAST + 1}" aria-valuenow="${i + 1}" aria-label="Setup progress"><i style="width:${(i + 1) / (OB_LAST + 1) * 100}%"></i></div></div>`;

  // Setup step 2: one topic per card; swipe or use the dots.
  function topicDeck(o) {
    const ranked = T.rankTopics(o.concerns);
    const key = o.concerns.join(',');
    if (!o.topicId || o.rankedFor !== key) { o.topicId = ranked[0].id; o.rankedFor = key; }
    const order = ranked.map(r => r.id);
    const idx = order.indexOf(o.topicId);
    const t = T.topic(o.topicId);
    return `<main class="topicdeck">${obHead(1)}<p class="decklabel">Your first observation</p>
      <div class="deck" id="topic-deck" role="group" aria-roledescription="carousel" aria-label="Suggested observations">${ranked.map((r, k) => {
        const tt = T.topic(r.id);
        const tag = k === 0 && r.score ? 'Best match' : r.score ? 'Also fits' : 'Another option';
        return `<article class="topiccard" data-topic="${r.id}" role="group" aria-roledescription="slide" aria-label="${k + 1} of ${ranked.length}: ${E(tt.name)}, ${tag}">
          <div class="topicart art-${r.id}" aria-hidden="true"><span class="orb"></span><span class="haze"></span><span class="matchtag ${k === 0 && r.score ? 'best' : ''}">${tag}</span></div>
          <div class="topictext"><h1>${E(tt.name)}</h1>
          <p class="topicq">“${E(tt.question)}”</p>
          ${r.why.length ? `<p class="topicwhy">For <b>${r.why.map(E).join('</b> · <b>')}</b></p>` : ''}</div>
        </article>`;
      }).join('')}</div>
      <div class="deckdots" role="tablist" aria-label="Choose a topic">${order.map((id, k) => `<button type="button" role="tab" class="deckdot" data-act="ob-topic" data-val="${id}" aria-selected="${k === idx}" aria-label="${E(T.topic(id).name)}"></button>`).join('')}</div>
      <div class="deckbottom">${btn(`Observe ${E(t.name.toLowerCase())}`, 'ob-next', 'primary deckcta')}</div>
    </main>`;
  }

  const healthTile = () => `<div class="healthtile" aria-hidden="true"><svg viewBox="0 0 48 48" width="56" height="56"><defs><linearGradient id="heartg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6b8a"/><stop offset="1" stop-color="#ff2d55"/></linearGradient></defs><path d="M24 40.5S9 31.4 9 20.6A8.2 8.2 0 0 1 24 16a8.2 8.2 0 0 1 15 4.6C39 31.4 24 40.5 24 40.5z" fill="url(#heartg)"/></svg></div>`;

  // Full-screen "Sync with Apple Health" (setup step 5, and Explore › Manage).
  function syncScreen({ back, next, on, step }) {
    const h = st.healthImport;
    const sub = on && h ? healthSummary(h) : 'Sleep, movement and period dates';
    return `<main class="syncscreen">${step ? obHead(5) : ''}
      <div class="synchero"><h1>Sync with<br>Apple Health</h1><p>See sleep, movement and period dates next to your check-ins. Read only.</p></div>
      ${healthTile()}
      <div class="syncbottom">
        <div class="synccard"><span class="synclabel">Apple Health<small>${on ? (h && h.via === 'simulated' ? 'Connected · simulated' : 'Connected') : E(sub)}</small></span><button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="Apple Health" data-act="health-toggle"><i></i></button></div>
        ${on ? `<fieldset class="synctypes"><legend>Choose what to import</legend>${[['sleep', 'Sleep', 'Time asleep each night'], ['activity', 'Exercise minutes', 'Daily total'], ['cycle', 'Period dates', 'Dates only; no predictions']].map(([k, t, d]) => `<label class="permission"><div><strong>${t}</strong><small>${d}</small></div><input type="checkbox" data-act="${ui.ob ? 'ob-type' : 'toggle-type'}" data-val="${k}" ${(ui.ob ? ui.ob.types : st.healthTypes)[k] ? 'checked' : ''}></label>`).join('')}</fieldset>` : ''}
        ${btn(on ? 'Continue' : 'Continue without it', next, 'primary syncnext')}
        <details class="realimport"><summary>Use a real Health export instead</summary>${healthImportControls()}</details>
      </div></main>`;
  }

  function healthSummary(h) {
    const n = Object.keys(h.sleep).length, a = Object.values(h.activity).filter(v => v > 0).length;
    return `${n} nights of sleep · ${a} active days · ${h.cycle.length} period dates`;
  }
  function healthImportControls() {
    const h = st.healthImport;
    const status = ui.importing !== null
      ? `<p class="soft" role="status">Reading export… ${Math.round(ui.importing * 100)}%</p>`
      : h ? `<div class="callout"><strong>Imported ${new Date(h.importedAt).toLocaleDateString()}</strong><br>${E(healthSummary(h))}<br><small>${h.via === 'bridge' ? 'Via the Aura app bridge' : 'From ' + E(h.fileName) + ', read on this device'}</small></div>` : '';
    const bridge = H.bridge() ? btn(h ? 'Refresh from Apple Health' : 'Connect Apple Health', 'health-bridge', 'smallaction') : '';
    return `<div class="healthimport">${bridge}<label class="filebutton">${h ? 'Import a newer export.xml' : 'Choose export.xml'}<input type="file" id="health-file" accept=".xml,text/xml,application/xml"></label><details><summary>How to get export.xml</summary><p class="soft">On iPhone: Health › your profile picture › Export All Health Data. Unzip the file and choose <b>export.xml</b>. It is read in this browser; nothing is uploaded.</p></details>${status}<p id="health-error" class="error" role="alert"></p></div>`;
  }

  async function runHealthImport(file) {
    ui.importing = 0; render();
    try {
      let last = 0;
      const h = await H.importExportFile(file, p => { if (p - last > 0.05) { last = p; ui.importing = p; const el = $('[role=status]'); if (el) el.textContent = `Reading export… ${Math.round(p * 100)}%`; } });
      st.healthImport = h;
      ui.importing = null;
      if (ui.ob) ui.ob.data = 'apple-health'; else setDataSource('apple-health');
      S.save();
      render();
      toast('Apple Health records imported');
    } catch (err) {
      ui.importing = null; render();
      const e = $('#health-error'); if (e) e.textContent = err.message;
    }
  }
  async function runBridgeImport() {
    const types = Object.entries(ui.ob ? ui.ob.types : st.healthTypes).filter(([, v]) => v).map(([k]) => k);
    try {
      st.healthImport = await H.importFromBridge(types, S.addDays(today(), -60), today());
      if (ui.ob) ui.ob.data = 'apple-health'; else setDataSource('apple-health');
      S.save(); render(); toast('Apple Health connected');
    } catch (err) { const e = $('#health-error'); if (e) e.textContent = err.message; }
  }

  // Expose for the second half of the app.
  window.AuraApp = { syncDayPin, moodFace, moodOf, st: () => st, setSt: x => { st = x; }, ui, E, btn, $, val, render, controlKey, toast, auraMark, option, scalePreview, setDataSource, seedSample, startOnboarding, saveObFields, finishOnboarding, healthImportControls, healthSummary, syncScreen, runHealthImport, runBridgeImport, today, ATTEMPTS, CONSTRAINTS, OB_LAST, logoMark, logoLockup, goalArt, scaleSlider, sentence };
  let home, explore, chat, modal;
  window.AuraApp.mount = views => { ({ home, explore, chat, modal } = views); };
})();
