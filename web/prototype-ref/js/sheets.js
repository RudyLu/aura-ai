// Bottom sheets (modals).
(function () {
  const A = window.AuraApp, T = window.AuraTopics, S = window.AuraStore, H = window.AuraHealth, D = window.AuraDiscovery;
  const { ui, E, btn } = A;
  const V = A.views;
  const st = () => A.st();
  const today = () => S.todayISO();

  const BARRIERS = ['Overtime', 'Plans changed', 'Logging was inconvenient', 'The step was too difficult', 'Felt unwell', 'Other'];
  const EXECUTION = ['Done', 'Partly done', 'Not done', 'Not sure'];
  const CHANGE = ['Not answered', 'Better', 'About the same', 'Worse', 'Not sure'];

  function answerOptions(topicId, choice, act) {
    const t = T.topic(topicId);
    const opt = (v, label) => `<button type="button" aria-pressed="${choice === v}" class="altanswer ${choice === v ? 'selected' : ''}" data-act="${act}" data-val="${v}">${E(label)}</button>`;
    return `${A.scaleSlider(topicId, choice, act === 'fb-answer' ? 'fb' : 'checkin')}<div class="altanswers" role="group" aria-label="Other answers">${opt('unknown', 'Not sure')}${opt('skipped', 'Skip today')}</div>${t.higherIsBetter ? '' : `<p class="soft center">${E(t.direction)}</p>`}`;
  }

  // ---------- check-in (create or correct) ----------
  function checkinSheet() {
    const o = S.observation(ui.m.obsId);
    const t = T.topic(o.topicId);
    const rec = ui.m.recId ? st().checkins.find(c => c.id === ui.m.recId) : null;
    if (ui.m.choice === undefined) ui.m.choice = rec ? (rec.status === 'recorded' ? String(rec.score) : rec.status) : null;
    const when = rec ? rec.occurredAt : (ui.m.date && ui.m.date !== today() ? `${ui.m.date}T${o.time}` : S.localDateTime());
    return `<p class="eyebrow">${E(t.name)} · ${rec ? 'Correct a record' : 'Check-in'}</p><h2>${E(t.question)}</h2><p class="timingline">${E(t.dateRule)}</p>${answerOptions(o.topicId, ui.m.choice, 'pick-answer')}
      <label class="inputlabel">When<input id="chk-time" type="datetime-local" value="${E(when)}" max="${S.localDateTime()}"></label>
      <label class="inputlabel">Note <small>Optional</small><input id="chk-note" value="${E(rec?.note || ui.m.note || '')}" placeholder="A late meeting, a workout, a coffee…"></label>
      ${rec?.source === 'plan feedback' ? '<p class="soft">This answer came from step feedback. Correcting it here updates both.</p>' : ''}
      ${btn(rec ? 'Save correction' : 'Save check-in', 'save-checkin')}${rec ? btn('Delete this record', 'delete-record', 'text danger', `data-kind="checkin" data-rec="${rec.id}"`) : ''}<p id="sheet-error" class="error" role="alert"></p>`;
  }

  // ---------- food & caffeine (create or correct) ----------
  // Prototype photo library: tapping a photo fills the fields below in order.
  const SAMPLE_PHOTOS = [
    { id: 'mocha', src: 'assets/food/iced-mocha.jpg', name: 'Iced mocha', note: 'Whipped cream, chocolate syrup', caffeine: true, drink: 'Latte or cappuccino', size: '1 tall glass' },
    { id: 'salad', src: 'assets/food/salad.jpg', name: 'Spinach salad', note: 'Avocado, eggs, tomatoes, Brussels sprouts', caffeine: false },
    { id: 'lasagna', src: 'assets/food/lasagna.jpg', name: 'Lasagna', note: 'Baked, with cheese', caffeine: false }
  ];
  function foodSheet() {
    const rec = ui.m.recId ? st().entries.find(e => e.id === ui.m.recId) : null;
    const photo = ui.m.photo || (rec && (rec.photoUrl || S.photos.get(rec.id)));
    if (ui.m.picking) {
      return `<p class="eyebrow">Food & drinks</p><h2>Choose a photo</h2>
        <div class="photogrid">${SAMPLE_PHOTOS.map(p => `<button type="button" class="photopick" data-act="pick-photo" data-val="${p.id}" aria-label="${E(p.name)}"><img src="${p.src}" alt=""></button>`).join('')}</div>
        <label class="filebutton">From this device<input type="file" id="photofile" accept="image/*"></label>
        ${btn('Cancel', 'photo-cancel', 'text')}`;
    }
    return `<p class="eyebrow">Food & drinks${rec ? ' · Correct a record' : ''}</p><h2>What did you have?</h2>
      ${photo ? `<button type="button" class="photoswap" data-act="photo-pick-open" aria-label="Change photo"><img class="foodpreview" src="${photo}" alt="Selected food photo"><span>Change</span></button>${ui.m.sampleFill ? '<p class="soft">Filled in from the photo. Check the details before saving.</p>' : ''}` : `<div class="photobuttons">${btn('Take a photo', 'photo-pick-open', 'filebutton')}${btn('Choose a photo', 'photo-pick-open', 'filebutton')}</div>`}
      <label class="inputlabel">Food or drink<input id="food-name" value="${E(rec?.name || ui.m.name || '')}" placeholder="e.g. Sandwich and iced latte"></label>
      <label class="inputlabel">When did you have it?<input id="food-time" type="datetime-local" value="${E(rec?.occurredAt || ui.m.time || S.localDateTime())}"></label>
      <label class="inputlabel">Notes <small>Optional</small><input id="food-note" value="${E(rec?.note || ui.m.note || '')}" placeholder="Anything you want to remember"></label>
      ${rec ? '' : `<label class="permission"><div><strong>Includes a caffeinated drink</strong></div><input id="food-caffeine" type="checkbox" ${ui.m.caffeine ? 'checked' : ''}></label>`}
      ${btn(rec ? 'Save correction' : 'Confirm and save', 'save-food')}${rec ? btn('Delete this record', 'delete-record', 'text danger', `data-kind="entry" data-rec="${rec.id}"`) : ''}<p id="sheet-error" class="error" role="alert"></p>`;
  }
  function caffeineSheet() {
    const rec = ui.m.recId ? st().entries.find(e => e.id === ui.m.recId) : null;
    const drinks = ['Coffee', 'Espresso', 'Latte or cappuccino', 'Black tea', 'Green tea', 'Energy drink', 'Other'];
    const when = rec?.occurredAt || ui.m.time || (ui.m.date && ui.m.date !== today() ? `${ui.m.date}T12:00` : S.localDateTime());
    return `<p class="eyebrow">Caffeine${rec ? ' · Correct a record' : ''}</p><h2>A little context<br>for your cup.</h2>
      <label class="inputlabel">Drink<select id="drink-type">${drinks.map(d => `<option ${(rec?.name || ui.m.drink) === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="inputlabel">Serving / size<input id="drink-size" value="${E(rec?.size || ui.m.size || '')}" placeholder="e.g. 1 cup, 250 ml, or 2 shots"></label>
      <label class="inputlabel">When did you drink it?<input id="drink-time" type="datetime-local" value="${E(when)}"></label>
      <label class="inputlabel">Caffeine amount <small>Optional, mg from a label</small><input id="drink-mg" type="number" min="0" max="2000" step="any" value="${rec?.mg ?? ''}" placeholder="Leave blank if unknown"></label>
      <label class="inputlabel">Note <small>Optional</small><input id="drink-note" value="${E(rec?.note || '')}"></label>
      
      ${btn(rec ? 'Save correction' : 'Save drink', 'save-drink')}${rec ? btn('Delete this record', 'delete-record', 'text danger', `data-kind="entry" data-rec="${rec.id}"`) : ''}<p id="sheet-error" class="error" role="alert"></p>`;
  }

  // ---------- add observation ----------
  function addObsSheet() {
    const active = S.activeObservations().map(o => o.topicId);
    const choices = T.TOPIC_IDS.filter(id => !active.includes(id));
    if (!ui.m.topicId || !choices.includes(ui.m.topicId)) ui.m.topicId = choices[0];
    const t = T.topic(ui.m.topicId);
    return `<p class="eyebrow">New observation</p><h2>Notice something else.</h2><p>Each one has its own question and time.</p><div class="options" role="radiogroup">${choices.map(id => A.option(E(T.topic(id).name), id === ui.m.topicId, 'pick-topic', id, E(T.topic(id).question))).join('')}</div>${A.scalePreview(ui.m.topicId)}<label class="inputlabel">Check-in time <small>${E(t.timing.label)}</small><input id="obs-time" type="time" value="${E(t.timing.defaultTime)}"></label>${btn('Add observation', 'save-obs')}`;
  }

  // ---------- data sources ----------
  function dataSheet() {
    const s = st();
    const on = s.dataSource === 'apple-health' && !!s.healthImport;
    const h = s.healthImport;
    const sw = (act, checked, label) => `<button type="button" class="switch" role="switch" aria-checked="${checked}" aria-label="${label}" data-act="${act}"><i></i></button>`;
    return `<p class="eyebrow">Data sources</p><h2>Sleep and movement</h2>
      <div class="synccard"><span class="synclabel">Apple Health<small>${on ? E(A.healthSummary(h)) + (h.via === 'simulated' ? ' · simulated' : '') : 'Off'}</small></span>${sw('health-toggle', on, 'Apple Health')}</div>
      ${on ? `<fieldset class="typepicker"><legend>Sharing</legend>${[['sleep', 'Sleep'], ['activity', 'Movement'], ['cycle', 'Period dates']].map(([k, t]) => `<label class="permission"><div><strong>${t}</strong></div><input type="checkbox" data-act="toggle-type" data-val="${k}" ${s.healthTypes[k] ? 'checked' : ''}></label>`).join('')}</fieldset>` : ''}
      <div class="synccard"><span class="synclabel">Sample history<small>Fictional check-ins, coffee, sleep and movement for demos</small></span>${sw('sample-toggle', s.dataSource === 'sample', 'Sample history')}</div>
      <details class="realimport"><summary>Use a real Health export</summary>${A.healthImportControls()}</details>
      ${h ? btn('Remove Apple Health data', 'clear-health', 'text danger') : ''}`;
  }

  function healthPermSheet() {
    const types = ui.ob ? ui.ob.types : st().healthTypes;
    return `<p class="eyebrow">Simulated permission · prototype</p><h2>Aura would like to read your health data</h2><p>Read only. You can change this any time.</p>
      <fieldset class="typepicker">${[['sleep', 'Sleep', 'Time asleep each night'], ['activity', 'Exercise minutes', 'Daily total'], ['cycle', 'Period dates', 'Dates only; no predictions']].map(([k, t, d]) => `<label class="permission"><div><strong>${t}</strong><small>${d}</small></div><input type="checkbox" id="perm-${k}" ${types[k] ? 'checked' : ''}></label>`).join('')}</fieldset>
      ${btn('Allow', 'health-allow')}${btn('Don’t allow', 'close', 'text')}
      <p class="soft">No device data is read here. Allowing loads 30 days of fictional records, labeled “simulated”.</p>`;
  }

  // ---------- plan preview & acceptance ----------
  // Step preview: what the step is, why, and how the next few days go.
  // The three phases are a timeline to read, not choices to pick.
  function previewSheet() {
    const d = ui.draft, t = T.topic(d.topicId);
    const f = d.fromFactor || '';
    const group = f.startsWith('movement') ? 'movement' : f === 'short-sleep' ? 'sleep' : f.startsWith('caffeine') ? 'alertness' : (T.CONCERNS[(st().profile.concerns || [])[0]] || {}).group || 'energy';
    const nDays = (String(d.days).match(/\d+/) || [7])[0];
    const when = [
      ['Today', `Keep your usual ${E(t.name.toLowerCase())} check-in.`],
      [`Next ${nDays} ${/night/.test(d.days) ? 'nights' : 'days'}`, E((d.step.split(/(?<=\.)\s+/).filter(x => !/as usual/i.test(x)).join(' ')) || d.step)],
      ['Then', 'Look back together and decide what’s next.']
    ];
    return `<div class="steptop"><span class="goaltile">${A.goalArt(group, 64)}</span>
        <p class="eyebrow">A small step for ${E(t.name.toLowerCase())}</p>
        <h2>${E(d.title)}</h2>
        <p class="stepmeta">${E(d.duration)} · ${E(d.days)}</p>
        <p class="steplede">${E(d.desc)}</p></div>
      ${d.why ? `<div class="stepwhy"><span class="eyebrow">Why this</span><p>${E(d.why)}.</p></div>` : ''}
      <ol class="steptimeline" aria-label="How it goes">${when.map(([k, v]) => `<li><span class="tldot" aria-hidden="true"></span><small>${k}</small><p>${v}</p></li>`).join('')}</ol>
      ${btn('Choose this step', 'open', 'primary', 'data-val="accept"')}${btn('Make it fit my week', 'adjust-chat', 'text')}
      <p class="soft center stepnote">A change in your score won’t prove what caused it, but it’s a good clue.</p>`;
  }

  function acceptSheet() {
    const d = ui.draft;
    const active = S.activeObservations();
    const target = ui.m.target || (active.find(o => o.topicId === d.topicId)?.id || `new:${d.topicId}`);
    ui.m.target = target;
    const opts = [...active.map(o => [o.id, T.topic(o.topicId).name]), ...T.TOPIC_IDS.filter(id => !active.some(o => o.topicId === id)).map(id => [`new:${id}`, `Start observing: ${T.topic(id).name}`])];
    const tid = target.startsWith('new:') ? target.slice(4) : S.observation(target).topicId;
    const t = T.topic(tid);
    const observe = d.kind === 'observe';
    return `<p class="eyebrow">${observe ? 'Observe only' : 'Accept a small step'}</p><h2>${observe ? 'Keep noticing, no change.' : 'Make the next step clear.'}</h2>
      <label class="inputlabel">Linked observation<select id="plan-obs" data-act="plan-obs">${opts.map(([v, l]) => `<option value="${v}" ${v === target ? 'selected' : ''}>${E(l)}</option>`).join('')}</select></label>
      ${observe ? '<p class="soft">No routine change. You will only answer your check-in.</p>' : `<label class="inputlabel">What you will do<textarea id="plan-step">${E(d.step)}</textarea></label>`}
      <label class="inputlabel">Start date<input id="plan-start" type="date" value="${today()}"></label><label class="inputlabel">Review date<input id="plan-review" type="date" value="${S.addDays(today(), d.fromFactor ? 3 : 6)}"></label>
      <div class="callout">You will answer: “${E(t.question)}”<br>${observe ? 'Feelings only, no execution log.' : 'Each feedback: what you did, this answer, and anything that got in the way.'}<br>A review date does not guarantee enough records to compare.</div>
      ${btn(observe ? 'Start observing' : 'Confirm and start', 'confirm-plan')}${btn('Keep as a suggestion', 'close', 'text')}<p id="sheet-error" role="alert" class="error"></p>`;
  }

  // ---------- step feedback (active plans only) ----------
  function feedbackSheet() {
    const p = S.plan(ui.fb.planId), t = T.topic(p.topicId), d = ui.fb.d, i = ui.fb.step;
    let b = `<p class="eyebrow">Step feedback · ${i + 1} of 3 · ${S.fmtDate(today())}</p><h2>${['What did you do?', t.question, 'What else was happening?'][i]}</h2><p>${E(p.title)}</p>`;
    if (i === 0) b += `<div class="scaleopts" role="radiogroup" aria-label="Execution">${EXECUTION.map(x => `<button type="button" role="radio" aria-checked="${d.execution === x}" class="scaleopt ${d.execution === x ? 'selected' : ''}" data-act="fb-exec" data-val="${x}"><span>${x}</span></button>`).join('')}</div>`;
    if (i === 1) b += `${answerOptions(p.topicId, d.answer, 'fb-answer')}<label class="inputlabel">Compared with before the step? <small>Optional</small><select id="fb-change">${CHANGE.map(x => `<option ${d.change === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`;
    if (i === 2) b += `<fieldset class="typepicker"><legend>Anything get in the way? <small>Optional</small></legend>${BARRIERS.map(x => `<label class="permission"><div><strong>${x}</strong></div><input type="checkbox" data-act="fb-barrier" data-val="${x}" ${(d.barriers || []).includes(x) ? 'checked' : ''}></label>`).join('')}</fieldset><label class="inputlabel">Other changes or a note<textarea id="fb-note" placeholder="Anything else to keep in context">${E(d.note || '')}</textarea></label>`;
    return b + btn(i === 2 ? 'Save feedback' : 'Continue', 'fb-next') + (i ? btn('Back', 'fb-back', 'text') : '') + '<p id="sheet-error" class="error" role="alert"></p>';
  }

  // ---------- review (context-aware) ----------
  // ---------- completion moments (check-in done, step progress) ----------
  // A flower whose petals fill one per day: filled of total.
  function flower(filled, total = 8) {
    const n = Math.max(5, Math.min(10, total));
    const petals = Array.from({ length: n }, (_, i) => {
      const on = i < filled;
      return `<ellipse cx="50" cy="22" rx="7.5" ry="15" transform="rotate(${(360 / n) * i} 50 50)" fill="${on ? 'url(#flw)' : '#ffffff26'}"/>`;
    }).join('');
    return `<svg class="flower" viewBox="0 0 100 100" width="104" height="104" aria-hidden="true"><defs><linearGradient id="flw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9b8"/><stop offset="1" stop-color="#eeb28b"/></linearGradient><radialGradient id="flc"><stop offset="0" stop-color="#ffe9d6"/><stop offset="1" stop-color="#eeb28b00"/></radialGradient></defs><circle cx="50" cy="50" r="40" fill="url(#flc)" opacity="${filled ? .25 : 0}"/>${petals}</svg>`;
  }
  // A row of day circles: state is 'on' | 'part' | 'miss' | '' (upcoming).
  const CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function dayCircles(days, stateOf) {
    return `<ol class="daycircles ${days.length > 7 ? 'tight' : ''}">${days.map(d => {
      const st_ = stateOf(d);
      const wd = new Date(d + 'T12:00').toLocaleDateString('en', { weekday: 'short' });
      return `<li class="${st_} ${d === today() ? 'istoday' : ''}" aria-label="${S.fmtDay(d)}: ${st_ === 'on' ? 'done' : st_ === 'part' ? 'partly' : st_ === 'miss' ? 'missed' : 'not yet'}"><i>${st_ === 'on' || st_ === 'part' ? CHECK : ''}</i><small>${wd}</small></li>`;
    }).join('')}</ol>`;
  }
  // Two big answer cards, as in a short reflection.
  const choiceCards = (q, a, b, hint = '') => `<section class="donepanel" aria-label="${E(q)}"><h2>${E(q)}</h2>${hint ? `<p class="donehint">${E(hint)}</p>` : ''}<div class="choicecards">${a}${b}</div>`;
  const choice = (label, act, val, filled, attrs = '') => `<button type="button" class="choicecard" data-act="${act}" data-val="${val}" ${attrs}><span class="cc ${filled ? 'fill' : ''}" aria-hidden="true"></span><strong>${E(label)}</strong></button>`;

  function doneSheet() {
    const s = st();
    const o = S.observation(ui.m.obsId), t = T.topic(o.topicId);
    const c = S.dayCheckin(o.id, today());
    let streak = 0; while (S.dayCheckin(o.id, S.addDays(today(), -streak))) streak++;
    const back = Math.min(Math.max(streak - 1, 0), 2);
    const days = S.dateRange(S.addDays(today(), -back), S.addDays(today(), 4 - back));
    const week = S.dateRange(S.addDays(today(), -6), today()).filter(d => S.dayCheckin(o.id, d)).length;
    const plan = S.currentPlans().find(p => p.observationId === o.id && p.status === 'active' && p.start <= today() && today() < p.review && !s.feedbacks.some(f => f.planId === p.id && f.date === today()));
    const caffeineToday = s.entries.some(e => e.kind === 'caffeine' && e.date === today());
    let panel;
    if (plan) panel = choiceCards('Did you do your step today?', choice('Not today', 'done-step', 'no', false), choice('Yes', 'done-step', 'yes', true), plan.title);
    else if (!caffeineToday && D.factorsFor(o.topicId).some(f => f.needs === 'caffeine')) panel = choiceCards('Any caffeine today?', choice('None', 'close', '', false), choice('Yes, add it', 'done-open', 'caffeine', true));
    else panel = choiceCards('Anything else from today?', choice('Food', 'done-open', 'food', false), choice('Caffeine', 'done-open', 'caffeine', false));
    return `<div class="donetop">${flower(week, 7)}
        <h1>${streak >= 2 ? 'Good job!' : 'Nice start!'}</h1>
        <p class="donesub">${c ? `${E(t.name)} · ${E(V.checkinStatus(c, o.topicId))}` : `You checked in on ${E(t.name.toLowerCase())}.`}</p>
        <div class="streakcard"><p>${streak ? `${streak} day streak` : 'This week'}</p>${dayCircles(days, d => d > today() ? '' : S.dayCheckin(o.id, d) ? 'on' : 'miss')}</div></div>
      ${panel}${btn('Skip & finish', 'close', 'text donefinish')}</section>`;
  }

  function reviewSheet() {
    const s = st();
    const p = S.plan(ui.m.planId);
    const t = T.topic(p.topicId);
    const obs = S.observation(p.observationId);
    const goal = T.GOALS.find(g => g.id === s.profile.goalId);
    const end = today() < p.review ? today() : p.review;
    const days = p.start <= end ? S.dateRange(p.start, end) : [];
    const fbs = s.feedbacks.filter(f => f.planId === p.id);
    const execCounts = EXECUTION.map(x => [x, fbs.filter(f => f.execution === x).length]);
    const daysWithFb = new Set(fbs.map(f => f.date));
    const dayRecs = days.map(d => ({ d, c: S.dayCheckin(p.observationId, d, { includeSample: false }), h: H.daily(s, d, today()) }));
    const scored = dayRecs.filter(x => x.c && x.c.status === 'recorded');
    const unsure = dayRecs.filter(x => x.c && x.c.status === 'unknown').length;
    const skipped = dayRecs.filter(x => x.c && x.c.status === 'skipped').length;
    const missing = dayRecs.filter(x => !x.c);
    const sleepDays = dayRecs.filter(x => x.h.sleep !== null).length;
    const changes = fbs.filter(f => f.change && f.change !== 'Not answered');
    const barriers = {};
    fbs.forEach(f => (f.barriers || []).forEach(b => { barriers[b] = (barriers[b] || 0) + 1; }));
    const notes = fbs.filter(f => f.note);
    const worse = changes.some(f => f.change === 'Worse') || fbs.some(f => (f.barriers || []).includes('Felt unwell'));
    const disc = D.analyze(s, obs, today());
    const mean = scored.length ? Math.round(scored.reduce((a, x) => a + x.c.score, 0) / scored.length * 10) / 10 : null;
    const sec = (title, inner) => `<section class="reviewsection"><h3>${title}</h3>${inner}</section>`;

    const done = fbs.filter(f => f.execution === 'Done').length, partly = fbs.filter(f => f.execution === 'Partly done').length, notDone = fbs.filter(f => f.execution === 'Not done').length;
    const noFb = days.filter(d => !daysWithFb.has(d)).length;
    const changeCounts = ['Better', 'About the same', 'Worse', 'Not sure'].map(x => [x, changes.filter(f => f.change === x).length]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
    const goals = (s.profile.concerns || []).map(c => T.CONCERNS[c]).filter(Boolean);
    const dayN = days.length, total = S.daysBetween(p.start, p.review) + 1;
    const card = (fig, unit, label, title, sub, attrs = '') => `<${attrs ? 'button type="button"' : 'article'} class="perk" ${attrs}><div class="perkfig"><b>${fig}</b>${unit ? `<small>${unit}</small>` : ''}</div><div class="perkbody"><p class="perklabel">${label}</p><h3>${title}</h3>${sub ? `<p class="perksub">${sub}</p>` : ''}</div>${attrs ? '<span class="perkgo" aria-hidden="true">›</span>' : ''}</${attrs ? 'button' : 'article'}>`;
    const topFind = disc.state === 'ready' ? D.findings(disc)[0] : null;
    const discTitle = topFind ? topFind.i.headline : disc.state === 'ready' ? 'No clear differences yet' : disc.state === 'insufficient' ? 'Not enough to compare yet' : `${disc.validDays} of ${disc.minDays} days collected`;

    // One sentence that says what happened, in plain words.
    const isReview = today() >= p.review;
    const ratio = dayN ? done / dayN : 0;
    const didLine = p.kind === 'observe' ? 'You kept noticing, with no routine change.'
      : !fbs.length ? 'No feedback yet. Tell Aura how it went whenever it fits.'
        : ratio >= 0.6 ? 'You kept it up on most days.' : ratio >= 0.3 ? 'You fit it in on some days.' : 'It was hard to fit in this time.';
    const topBarrier = Object.entries(barriers).sort((x, y) => y[1] - x[1])[0];
    const feltLine = (changeCounts.length ? ` Your ${E(t.construct.toLowerCase())} felt mostly ${E(changeCounts[0][0].toLowerCase())}.` : '') + (topBarrier ? ` ${E(topBarrier[0])} got in the way${topBarrier[1] > 1 ? ` ${topBarrier[1]} times` : ' once'}.` : '');
    // Day dots: one per day of the step.
    const dayDots = days.map(d => { const f = fbs.find(x => x.date === d); const c = f ? (f.execution === 'Done' ? 'on' : f.execution === 'Partly done' ? 'part' : 'miss') : 'none'; return `<li class="${c}" title="${S.fmtDate(d)}: ${f ? E(f.execution) : 'No feedback'}"></li>`; }).join('');
    const decided = p.status === 'stopped' || p.status === 'replaced';
    const fbState = d => { const f = fbs.find(x => x.date === d); return f ? (f.execution === 'Done' ? 'on' : f.execution === 'Partly done' ? 'part' : 'miss') : d < today() ? 'miss' : ''; };
    const allDays = S.dateRange(p.start, p.review);
    const left = total - dayN;
    return `<div class="donetop">${flower(p.kind === 'observe' ? scored.length : done + partly, Math.min(10, total))}
        <h1>${isReview ? 'Step complete' : left > 0 ? `${left} ${left === 1 ? 'day' : 'days'} to go` : 'Last day'}</h1>
        <p class="donesub">${E(p.title)}</p>
        <p class="reviewlede">${didLine}${feltLine}</p>
        ${p.kind === 'observe' ? '' : `<div class="streakcard"><p>${done} of ${total} days done</p>${dayCircles(allDays, fbState)}${mean === null ? '' : `<small class="streakfoot">Average ${E(t.construct.toLowerCase())} ${mean.toFixed(1)} / 5</small>`}</div>`}</div>
      ${isReview && topFind ? `<button type="button" class="reviewfind" ${topFind.i.step ? `data-act="disc-try" data-val="${topFind.f.id}"` : 'data-act="goexplore"'} data-obs="${obs.id}"><span class="eyebrow">From your records</span><strong>${E(topFind.i.headline)}</strong>${topFind.i.step ? `<small>Next idea: ${E(topFind.i.step.title)} ›</small>` : '<small>See in Explore ›</small>'}</button>` : ''}
      ${worse ? '<p class="callout warn">You reported feeling worse or unwell. Consider pausing this step, and talk with a health professional if it continues.</p>' : ''}
      ${decided ? `<p class="soft center">This version is ${V.PLAN_STATUS[p.status].toLowerCase()}. Its records stay in your history.</p>` : `${choiceCards(isReview ? 'What next?' : 'How’s the step going?', choice(isReview ? 'Adjust it' : 'Make it easier', 'decide', 'adjust', false), choice('Keep going', 'decide', 'continue', true))}
        <div class="donelinks">${btn('Just observe', 'decide', 'quiet', 'data-val="observe"')}<span aria-hidden="true">·</span>${btn('Stop the step', 'decide', 'quiet', 'data-val="stop"')}</div></section>${isReview ? '' : btn('Skip & finish', 'close', 'text donefinish')}`}
      <details class="limits small"><summary>What this can’t tell you</summary><ul class="notes"><li>${scored.length < D.MIN_DAYS ? `Only ${scored.length} scored ${scored.length === 1 ? 'day' : 'days'}; too few for a pattern.` : `${scored.length} scored days is still a small sample.`}</li><li>Scores shift with mood, expectations and timing.</li><li>Without a period off the step, a change can’t be credited to it.</li>${notes.length ? `<li>Your notes: ${notes.slice(-2).map(f => `${S.fmtDate(f.date)} “${E(f.note)}”`).join('; ')}</li>` : ''}</ul></details>`;
  }

  // Settings: grouped rows like a native settings screen.
  function settingsSheet() {
    const s = st();
    const goals = (s.profile.concerns || []).map(c => T.CONCERNS[c]).filter(Boolean);
    const obs = S.activeObservations();
    const row = (label, value, attrs, cls = '') => `<li><button type="button" class="setrow ${cls}" ${attrs}><span>${label}</span>${value ? `<b>${value}</b>` : ''}<i aria-hidden="true">›</i></button></li>`;
    const hasHistory = s.plans.length > 0;
    return `<h2 class="setttitle">Your settings</h2>
      <div class="setlabel"><span>Your goals</span>${btn('Edit', 'resetup', 'quiet', 'aria-label="Edit goals"')}</div>
      ${goals.length ? `<div class="goalcards">${goals.map(g => `<div class="goalcard">${A.goalArt(g.group, 64)}<span>${E(g.goal)}</span></div>`).join('')}</div>` : `<ul class="setlist">${row('Choose your goals', '', 'data-act="resetup"')}</ul>`}
      <p class="setlabel"><span>Your observations</span></p>
      <ul class="setlist">${obs.map(o => row(E(T.topic(o.topicId).name), E(o.time), `data-act="open" data-val="obsedit" data-obs="${o.id}"`)).join('')}${obs.length < T.TOPIC_IDS.length ? row('Add an observation', '', 'data-act="open" data-val="addobs"', 'add') : ''}</ul>
      <p class="setlabel"><span>Data</span></p>
      <ul class="setlist">${row('Apple Health', E(s.dataSource === 'apple-health' && s.healthImport ? (s.healthImport.via === 'simulated' ? 'Simulated' : 'Imported') : 'Off'), 'data-act="open" data-val="data"')}${row('Sample history', s.dataSource === 'sample' ? 'On' : 'Off', 'data-act="open" data-val="data"')}</ul>
      ${hasHistory ? `<p class="setlabel"><span>Your steps</span></p><ul class="setlist">${row('Steps and decisions', String(s.plans.length), 'data-act="open" data-val="history"')}</ul>` : ''}
      <p class="setlabel"><span>Privacy</span></p>
      <ul class="setlist"><li><div class="setrow"><span>Share anonymous usage data</span><button type="button" class="switch" role="switch" aria-checked="${!!(s.profile.consent && s.profile.consent.share)}" aria-label="Share anonymous usage data" data-act="share-toggle"><i></i></button></div></li>${row('Terms of Service', '', 'data-act="open" data-val="legal" data-doc="terms"')}${row('Privacy Policy', '', 'data-act="open" data-val="legal" data-doc="privacy"')}</ul>
      <p class="setlabel"><span>Prototype</span></p>
      <ul class="setlist">${row('Demo timeline', s.demo ? `Day ${s.demo.day}` : '', 'data-act="open" data-val="demo"')}${row('Full setup review', '', 'data-act="resetup"')}${row('About this prototype', '', 'data-act="open" data-val="about"')}</ul>`;
  }

  function obsEditSheet() {
    const o = S.observation(ui.m.obsId), t = T.topic(o.topicId);
    return `<p class="eyebrow">Observation</p><h2>${E(t.name)}</h2><p>“${E(t.question)}”</p>
      <label class="inputlabel">Check-in time <small>${E(t.timing.label)}</small><input id="obsedit-time" type="time" value="${E(o.time)}"></label>
      ${btn('Save', 'save-obsedit')}${S.activeObservations().length > 1 ? btn('Stop observing this', 'pause-obs', 'text danger') : ''}
      <p class="soft">Stopping keeps your records.</p>`;
  }

  // Placeholder legal copy for the prototype; final text comes from legal review.
  const LEGAL = {
    terms: ['Terms of Service', ['Aura helps you notice patterns in your own records. It does not give medical advice, diagnose or treat any condition.', 'You are responsible for what you choose to record and for decisions you make with it.', 'You can delete all your records at any time from Settings.']],
    privacy: ['Privacy Policy', ['Your check-ins, notes, photos and health data stay on this device in this prototype.', 'Apple Health data is read only, and only the types you allow.', 'Anonymous usage data is shared only if you turn it on, and never includes your records.']],
    health: ['Using your data', ['Aura uses your check-ins and, if you connect it, sleep, exercise minutes and period dates.', 'They are used only to show your records, charts and Discovery comparisons.', 'You can stop sharing any type, or remove imported data, in Settings › Data.']]
  };
  function legalSheet() {
    const [title, items] = LEGAL[ui.m.doc] || LEGAL.terms;
    return `<p class="eyebrow">Prototype placeholder · not final legal text</p><h2>${title}</h2><ul class="notes legal">${items.map(x => `<li>${E(x)}</li>`).join('')}</ul>${btn('Close', 'close', 'primary')}`;
  }

  function historySheet() {
    const s = st();
    const plans = [...s.plans].reverse();
    return `<p class="eyebrow">History</p><h2>Your decisions stay with you.</h2>${plans.map(p => `<article class="logentry"><div><strong>v${p.version} · ${E(p.title)}</strong><p>${E(T.topic(p.topicId).name)} · ${V.PLAN_STATUS[p.status]}</p><small>${S.fmtDate(p.start)} – ${S.fmtDate(p.review)} · ${s.feedbacks.filter(f => f.planId === p.id).length} feedback</small>${(p.history || []).map(h => `<small>${new Date(h.at).toLocaleString()} · ${V.PLAN_STATUS[h.status]}</small>`).join('')}${s.decisions.filter(d => d.planId === p.id).map(d => `<small>Decision: ${E(d.choice)}${d.reason ? ' · “' + E(d.reason) + '”' : ''}</small>`).join('')}${btn('Open review', 'open', 'quiet', `data-val="review" data-plan="${p.id}"`)}</div></article>`).join('') || '<p>No accepted steps yet.</p>'}`;
  }

  function aboutSheet() {
    return `<h2>Aura.ai</h2><p>Understand how you live.</p><div class="callout">This is a prototype. Aura’s replies are preset, not AI. Sample data is fictional and labeled. Apple Health data is only read from an export file you choose, on this device.</div><p class="soft">${S.storageOK() ? 'Your records are saved in this browser, so a refresh keeps them. Photos are kept only until you close or refresh the tab.' : 'This browser blocked storage, so records last only until refresh.'}</p>${btn('Demo timeline (day 1 · 4 · 10)', 'open', 'smallaction', 'data-val="demo"')}${btn('Edit setup', 'resetup', 'smallaction')}${btn('Delete all records and restart', 'reset', 'text danger')}`;
  }

  function modal() {
    const m = ui.modal;
    const body = m === 'checkin' ? checkinSheet() : m === 'food' ? foodSheet() : m === 'caffeine' ? caffeineSheet() : m === 'addobs' ? addObsSheet()
      : m === 'demo' ? A.demo.sheet() : m === 'settings' ? settingsSheet() : m === 'legal' ? legalSheet() : m === 'obsedit' ? obsEditSheet() : m === 'data' ? dataSheet() : m === 'healthperm' ? healthPermSheet() : m === 'preview' ? previewSheet() : m === 'accept' ? acceptSheet() : m === 'feedback' ? feedbackSheet()
        : m === 'review' ? reviewSheet() : m === 'done' ? doneSheet() : m === 'history' ? historySheet() : aboutSheet();
    const label = { checkin: 'Check-in', food: 'Food', caffeine: 'Caffeine', addobs: 'Add observation', demo: 'Demo timeline', settings: 'Settings', legal: 'Terms and privacy', obsedit: 'Observation', data: 'Data sources', healthperm: 'Health permission', preview: 'Suggested step', accept: 'Accept step', feedback: 'Step feedback', review: 'Review', done: 'Check-in saved', history: 'History', about: 'About' }[m] || m;
    return `<div class="overlay" data-act="backdrop"><section class="sheet ${['review', 'settings', 'done'].includes(m) ? 'fullsheet' : ''}" role="dialog" aria-modal="true" aria-label="${label}" tabindex="-1">${btn('×', 'close', 'close', 'aria-label="Close"')}${body}</section></div>`;
  }

  A.sheets = { modal, BARRIERS, EXECUTION, SAMPLE_PHOTOS };
})();
