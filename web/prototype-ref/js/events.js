// Interactions and Aura's preset replies.
(function () {
  const A = window.AuraApp, T = window.AuraTopics, S = window.AuraStore, H = window.AuraHealth;
  const { ui, $, val, render, toast } = A;
  const st = () => A.st();
  const today = () => S.todayISO();
  A.mount({ home: A.views.home, explore: A.views.explore, chat: A.views.chat, modal: A.sheets.modal });

  // Errors sit next to the field they concern; typed input stays in place.
  function err(msg, anchorSel) {
    document.querySelectorAll('.fielderror').forEach(x => x.remove());
    const anchor = anchorSel && $(anchorSel);
    if (!anchor) { const e = $('#sheet-error') || $('#ob-error'); if (e) e.textContent = msg; return; }
    const host = anchor.closest('label') || anchor;
    const p = document.createElement('p');
    p.className = 'error fielderror'; p.id = 'field-error'; p.setAttribute('role', 'alert'); p.textContent = msg;
    host.after(p);
    const target = anchor.matches('input,select,textarea') ? anchor : anchor.querySelector('button,input');
    if (target) { target.setAttribute('aria-describedby', 'field-error'); target.focus(); }
    p.scrollIntoView({ block: 'nearest' });
  }
  // Destructive actions ask for a second tap in place (no browser dialogs).
  function confirmTap(b, label) {
    if (b.dataset.armed === '1') return true;
    b.dataset.armed = '1';
    b.dataset.label = b.textContent;
    b.textContent = label;
    setTimeout(() => { if (b.isConnected) { b.dataset.armed = ''; b.textContent = b.dataset.label; } }, 4000);
    return false;
  }
  let seq = 0;
  const openModal = (name, data = {}) => {
    if (!ui.modal) ui.opener = ui.lastClicked;
    ui.modal = name; ui.m = data; ui.modalSeq = ++seq;
  };
  // Sheets opened from Settings return to Settings when they close.
  const close = () => {
    const back = ui.m && ui.m.back;
    if (back) { ui.modal = back; ui.m = {}; ui.modalSeq = ++seq; return; }
    if (ui.modal) ui.returnFocus = ui.opener; ui.modal = null; ui.m = {};
  };
  function ensureObservation(topicId) {
    let o = S.activeObservations().find(x => x.topicId === topicId);
    if (!o) {
      o = S.addObservation(topicId);
      if (st().dataSource === 'sample') A.seedSample(o);
      S.save();
      toast(`${T.topic(topicId).name} added to your observations`);
    }
    return o;
  }
  const focusTopic = () => (S.activeObservations()[0] || { topicId: 'evening-energy' }).topicId;

  // ---------- Aura preset replies (each draft names its observation) ----------
  function replyFor(text) {
    const t = text.toLowerCase();
    const s = st();
    if (/cocoa|difficult meeting|sofa|exhausted/.test(t)) {
      ui.cocoaOffer = true;
      return {
        text: 'That sounds like a demanding day. You don’t have to turn tonight into another task.\n\nWould you like to keep the cocoa and your evening energy in today’s record? We can revisit them when you have more space. One day doesn’t tell us what caused the tiredness.',
        draft: { topicId: 'evening-energy', kind: 'step', title: 'Answer tonight’s evening-energy check-in, or skip it', desc: 'Leave a little room for tonight. A moment to notice, not another task.', duration: '20 seconds', days: 'When you feel ready', step: 'If it feels useful, answer your evening energy check-in and add a short note about your day. You can skip and return later.' }
      };
    }
    if (/coffee|caffeine/.test(t)) {
      const topicId = focusTopic();
      const n = s.entries.filter(e => e.kind === 'caffeine' && e.source !== 'sample').length;
      return {
        text: `${n ? `You have ${n} caffeine ${n === 1 ? 'entry' : 'entries'}. ` : ''}Let’s notice when your drinks happen, alongside your ${T.topic(topicId).checkinName}. Log each drink with its time. No need to change anything yet.`, action: { type: 'caffeine' },
        draft: { topicId, kind: 'step', title: 'Log each caffeinated drink with its time', desc: 'Get to know your coffee rhythm before changing anything.', duration: '30 sec a day', days: 'For 7 days', step: `Log each caffeinated drink with the time you had it. Keep answering your ${T.topic(topicId).checkinName} as usual. No change to your intake.` }
      };
    }
    if (/exercise|workout|movement/.test(t)) {
      return {
        text: 'Let’s keep movement in the picture without adding a workout. On days you already move, notice your evening energy afterwards.',
        draft: { topicId: 'evening-energy', kind: 'step', title: 'Check your evening energy on days you move', desc: 'Notice the activity you already do. No new workout.', duration: '1 min', days: 'After your usual activity', step: 'On a day you already planned to move, note what you did. Answer your evening energy check-in as usual. Skip if no activity was planned.' }
      };
    }
    if (/cycle|period/.test(t)) {
      return { text: 'Period dates can be optional context alongside your check-ins. Dates alone can’t explain a change in how you feel. You can include them in your data sources.', action: { type: 'data' }, draft: null };
    }
    if (/late|busy|overtime|adjust/.test(t)) {
      const topicId = focusTopic();
      return {
        text: 'A busy week deserves a smaller step. How about answering just one check-in, on a day you choose, with no routine change?',
        draft: { topicId, kind: 'step', title: `Answer one ${T.topic(topicId).checkinName} this week`, desc: 'A gentler step for a busy week. Keep your goal, with more flexibility.', duration: '20 sec', days: 'One day you choose', step: `On one available day, answer your ${T.topic(topicId).checkinName} and add a short note about what the day was like.` }
      };
    }
    if (/worse|unwell/.test(t)) {
      return { text: 'Let’s pause the step rather than push harder. Keep a record of the change; persistent or concerning symptoms are something to discuss with a health professional.', draft: null };
    }
    if (/week|pattern|sleep|rested/.test(t)) {
      const src = H.sourceLabel(s.dataSource, s.healthImport);
      return {
        text: s.dataSource !== 'none'
          ? `Your ${src.toLowerCase()} shows different sleep lengths across the week. That is context, not a cause. To compare it with how you feel, a waking check-in helps: it asks how rested you feel after your main sleep.`
          : 'You haven’t connected sleep data yet. A waking check-in is a good start: it asks how rested you feel after your main sleep. You can add Apple Health whenever you like.',
        action: { type: 'data' },
        draft: { topicId: 'rested-waking', kind: 'step', title: 'Answer a waking check-in each morning', desc: 'Add how rested you feel to the sleep picture.', duration: '20 sec', days: 'Each morning for 7 days', step: 'Within an hour of waking, answer “How rested do you feel right now?”. No change to your routine.' }
      };
    }
    if (/same|better|reflect/.test(t)) {
      return { text: 'Thanks for separating what you did from how you felt. A few entries aren’t enough to judge an effect. You can keep observing, or simplify the next step.', draft: null };
    }
    return { text: 'Thanks for sharing. In this prototype I can help with a busy week, coffee timing, movement, or your recent sleep. Which would you like to start with?', draft: null };
  }

  function sendToAura(text) {
    if (ui.pending) return;
    st().messages.push({ role: 'user', text });
    ui.pending = true; ui.auraState = 'understanding'; ui.page = 'app'; ui.tab = 'aura'; close(); ui.cocoaOffer = false;
    S.save(); render();
    setTimeout(() => {
      const r = replyFor(text);
      st().messages.push({ role: 'guide', text: r.text, action: r.action || null });
      ui.draft = r.draft;
      ui.pending = false; ui.auraState = 'insight';
      S.save(); render();
      window.scrollTo(0, document.documentElement.scrollHeight);
      setTimeout(() => { ui.auraState = 'idle'; const el = $('.aura-chat'); if (el) el.dataset.auraState = 'idle'; }, 1600);
    }, 650);
  }

  // ---------- clicks ----------
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const a = b.dataset.act, v = b.dataset.val, s = st();
    if (!b.closest('.sheet')) ui.lastClicked = A.controlKey(b);
    if (a === 'backdrop') { if (e.target === b) { close(); render(); } return; }
    if (b.type === 'checkbox') return; // handled on change

    switch (a) {
      // navigation
      case 'home': if (ui.page === 'app') { ui.tab = 'today'; close(); } break;
      case 'tab': ui.page = 'app'; ui.tab = v; close(); break;
      case 'begin': A.startOnboarding(); break;
      case 'demo': openModal('demo'); break;
      case 'demo-load': {
        const mine = !s.demo && (s.checkins.some(c => c.source !== 'sample') || s.entries.some(e => e.source !== 'sample'));
        if (mine && !confirmTap(b, 'Tap again: replaces your records')) return;
        A.demo.build(+v); ui.returnFocus = null;
        toast(`Demo timeline: day ${v}`);
        window.scrollTo(0, 0);
        break;
      }
      case 'open': {
        const d = { obsId: b.dataset.obs, recId: b.dataset.rec, planId: b.dataset.plan, date: b.dataset.date, doc: b.dataset.doc };
        if (ui.modal === 'settings') d.back = 'settings';
        if (b.dataset.choice) d.choice = b.dataset.choice;
        if (v === 'checkin' && !d.recId && !b.closest('.obscard') && !b.closest('.plancard') && !b.closest('.activejourney')) d.date = ui.tab === 'explore' ? ui.explore.date : undefined;
        if (v === 'caffeine' && ui.tab === 'explore' && !d.recId) d.date = ui.explore.date;
        // Logging from Your day uses the time under the centre pin.
        if ((b.closest('.kindcards') || ui.modal === 'done') && ui.dayAt && ['food', 'caffeine'].includes(v)) d.time = `${today()}T${ui.dayAt.time}`;
        openModal(v, d);
        break;
      }
      case 'close': close(); break;
      case 'goals-toggle': ui.goalsOpen = !ui.goalsOpen; break;
      case 'disc-try': {
        // A finding's suggested step opens the usual step preview.
        const o = S.observation(b.dataset.obs);
        const D = window.AuraDiscovery;
        const r = D.analyze(st(), o, today());
        const f = r.factors.find(x => x.id === v);
        const i = f && D.insight(r, f);
        if (!i || !i.step) break;
        ui.draft = Object.assign({}, i.step);
        openModal('preview');
        break;
      }
      case 'goexplore':
        ui.page = 'app'; ui.tab = 'explore'; close();
        if (b.dataset.obs) ui.explore.obsId = b.dataset.obs;
        if (b.dataset.anchor) { render(); document.getElementById(b.dataset.anchor)?.scrollIntoView(); return; }
        break;

      // onboarding
      case 'ob-concern': ui.ob.concerns = ui.ob.concerns.includes(v) ? ui.ob.concerns.filter(x => x !== v) : [...ui.ob.concerns, v]; break;
      case 'ob-topic': {
        // Dots: glide to the card; the scroll handler updates the selection.
        const card = document.querySelector(`#topic-deck [data-topic="${v}"]`);
        const deck = $('#topic-deck');
        if (card && deck) { deck.scrollTo({ left: card.offsetLeft - (deck.clientWidth - card.clientWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); selectTopic(v); return; }
        ui.ob.topicId = v; ui.ob.time = null; break;
      }
      case 'ob-attempt': A.saveObFields(); ui.ob.attempts = v === 'Nothing yet' ? (ui.ob.attempts.includes(v) ? [] : [v]) : (ui.ob.attempts.includes(v) ? ui.ob.attempts.filter(x => x !== v) : [...ui.ob.attempts.filter(x => x !== 'Nothing yet'), v]); break;
      case 'ob-constraint': A.saveObFields(); ui.ob.constraint = v; break;
      case 'ob-data': ui.ob.data = v; break;
      case 'ob-edit': A.saveObFields(); ui.step = +v; ui.fromReview = true; break;
      case 'ob-back':
        A.saveObFields();
        if (ui.fromReview) { ui.step = A.OB_LAST; ui.fromReview = false; } else if (ui.step) ui.step--; else ui.page = 'splash';
        break;
      case 'ob-next':
        A.saveObFields();
        if (ui.step === 0 && !ui.ob.concerns.length) return err('Choose at least one.');
        if (ui.step === 1 && !ui.ob.topicId) return err('Choose an observation to continue.');
        if (ui.step === 2 && !ui.ob.time) ui.ob.time = T.topic(ui.ob.topicId).timing.defaultTime;
        if (ui.step === A.OB_LAST && !(ui.ob.consent.terms && ui.ob.consent.health)) return err('Agree to the terms and allow data use to start.', '.consents');
        if (ui.step === A.OB_LAST) A.finishOnboarding();
        else if (ui.fromReview) { ui.step = A.OB_LAST; ui.fromReview = false; }
        else ui.step++;
        window.scrollTo(0, 0);
        break;
      case 'health-bridge': A.runBridgeImport(); return;

      // check-ins
      case 'pick-answer': ui.m.choice = v; break;
      case 'done-open': openModal(v, {}); break;
      case 'done-step': {
        // Answer "did you do your step" from the completion screen; today's check-in is the feeling answer.
        const o = S.observation(ui.m.obsId);
        const p = S.currentPlans().find(x => x.observationId === o.id && x.status === 'active');
        const c = S.dayCheckin(o.id, today());
        if (!p || !c) { close(); break; }
        const fb = { id: S.uid('fb'), planId: p.id, planVersion: p.version, observationId: o.id, date: today(), at: new Date().toISOString(), execution: v === 'yes' ? 'Done' : 'Not done', answer: c.status === 'recorded' ? String(c.score) : c.status, score: c.score, change: 'Not answered', barriers: [], note: '' };
        s.feedbacks.push(fb); c.feedbackId = fb.id;
        S.save();
        openModal('review', { planId: p.id });
        break;
      }
      case 'quick-save': {
        // Save straight from Today: now, with the slider's answer.
        const o = S.observation(b.dataset.obs), v2 = (ui.quick || {})[o.id];
        if (!v2) return;
        S.saveCheckin({ observationId: o.id, topicId: o.topicId, occurredAt: S.localDateTime(), status: 'recorded', score: +v2, note: '' });
        delete ui.quick[o.id];
        openModal('done', { obsId: o.id });
        break;
      }
      case 'checkin-topic': { const o = ensureObservation(v); ui.cocoaOffer = false; openModal('checkin', { obsId: o.id, note: 'After a difficult meeting.' }); break; }
      case 'save-checkin': {
        const o = S.observation(ui.m.obsId), time = val('chk-time');
        if (!ui.m.choice) return err('Slide to answer, or choose “Not sure” or “Skip today”.', '.slider');
        if (!time) return err('Add when this was.', '#chk-time');
        if (time.slice(0, 16) > S.localDateTime()) return err('This time is in the future.', '#chk-time');
        const rec = ui.m.recId ? s.checkins.find(c => c.id === ui.m.recId) : null;
        const recorded = /^[1-5]$/.test(ui.m.choice);
        S.saveCheckin(Object.assign(rec ? { id: rec.id, source: rec.source, feedbackId: rec.feedbackId, createdAt: rec.createdAt } : {}, {
          observationId: o.id, topicId: o.topicId, occurredAt: time, status: recorded ? 'recorded' : ui.m.choice, score: recorded ? +ui.m.choice : null, note: val('chk-note').trim()
        }));
        if (rec && rec.feedbackId) { const f = s.feedbacks.find(x => x.id === rec.feedbackId); if (f) { f.answer = ui.m.choice; f.score = recorded ? +ui.m.choice : null; S.save(); } }
        if (!rec && time.slice(0, 10) === today()) { openModal('done', { obsId: o.id }); break; }
        toast(rec ? 'Correction saved' : 'Check-in saved');
        close();
        break;
      }
      case 'delete-record': {
        const kind = b.dataset.kind, id = b.dataset.rec;
        if (!confirmTap(b, 'Tap again to delete')) return;
        if (kind === 'checkin') { const c = s.checkins.find(x => x.id === id); if (c && c.feedbackId) { const f = s.feedbacks.find(x => x.id === c.feedbackId); if (f) { f.answer = null; f.score = null; } } }
        S.removeRecord(kind, id); toast('Record deleted'); close(); break;
      }

      // food & caffeine
      case 'save-food': {
        const name = val('food-name').trim(), time = val('food-time');
        if (!name) return err('Add a food or drink name.', '#food-name');
        if (!time) return err('Add when you had it.', '#food-time');
        const caffeine = $('#food-caffeine')?.checked;
        const pick = A.sheets.SAMPLE_PHOTOS.find(p => p.id === ui.m.sampleId);
        S.saveEntry({ id: ui.m.recId, kind: 'food', name, occurredAt: time, note: val('food-note').trim(), photoData: ui.m.photo });
        toast(ui.m.recId ? 'Correction saved' : `${name} saved`);
        if (caffeine) { openModal('caffeine', { time, drink: pick?.drink, size: pick?.size }); } else close();
        break;
      }
      case 'photo-pick-open': ui.m.picking = true; break;
      case 'photo-cancel': ui.m.picking = false; break;
      case 'pick-photo': {
        const p = A.sheets.SAMPLE_PHOTOS.find(x => x.id === v);
        Object.assign(ui.m, { picking: false, photo: p.src, sampleId: p.id, sampleFill: true, name: p.name, note: p.note, caffeine: p.caffeine });
        render();
        // Fill the fields in order, top to bottom, after the sheet is back.
        const fill = [['#food-name', p.name], ['#food-note', p.note]];
        fill.forEach(([sel, value]) => { const el = $(sel); if (el) el.value = value; });
        const cb = $('#food-caffeine'); if (cb) cb.checked = p.caffeine;
        return;
      }
      case 'save-drink': {
        const time = val('drink-time'), raw = val('drink-mg'), mg = raw === '' ? null : Number(raw);
        if (!time) return err('Add when you drank it.', '#drink-time');
        if (mg !== null && (!Number.isFinite(mg) || mg < 0 || mg > 2000)) return err('Enter 0–2000 mg, or leave it blank if unknown.', '#drink-mg');
        S.saveEntry({ id: ui.m.recId || undefined, kind: 'caffeine', name: val('drink-type'), size: val('drink-size').trim(), occurredAt: time, mg, note: val('drink-note').trim() });
        toast(ui.m.recId ? 'Correction saved' : 'Drink saved'); close(); break;
      }
      case 'cocoa': ui.cocoaOffer = false; openModal('food', { name: 'Hot cocoa', note: 'After a difficult meeting. Felt exhausted.' }); break;

      // observations & data
      case 'share-toggle': s.profile.consent = Object.assign({}, s.profile.consent, { share: !(s.profile.consent && s.profile.consent.share) }); S.save(); break;
      case 'save-obsedit': {
        const o = S.observation(ui.m.obsId), time = val('obsedit-time');
        if (!time) return err('Choose a time.', '#obsedit-time');
        o.time = time; S.save(); toast(`${T.topic(o.topicId).name} at ${time}`); close(); break;
      }
      case 'pause-obs': {
        if (!confirmTap(b, 'Tap again to stop observing')) return;
        const o = S.observation(ui.m.obsId); o.status = 'paused'; S.save(); toast(`Stopped observing ${T.topic(o.topicId).name.toLowerCase()}`); close(); break;
      }
      case 'pick-topic': ui.m.topicId = v; break;
      case 'save-obs': { const o = S.addObservation(ui.m.topicId, val('obs-time')); if (s.dataSource === 'sample') A.seedSample(o); S.save(); ui.explore.obsId = o.id; toast(`${T.topic(o.topicId).name} added`); close(); break; }
      case 'exp-obs': ui.explore.obsId = v; break;
      case 'exp-date': ui.explore.date = v; break;
      case 'exp-metric': ui.explore.metric = v; break;
      case 'exp-range-set': ui.explore.range = +v; break;
      case 'goal-remove': {
        const c = T.CONCERNS[v];
        s.profile.concerns = (s.profile.concerns || []).filter(x => x !== v); S.save();
        toast(`Removed “${c ? c.goal : 'goal'}”. Add it back in Settings.`);
        break;
      }
      case 'exp-goto': if (v < S.addDays(today(), -(ui.explore.range - 1))) ui.explore.range = 14; ui.explore.date = v; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
      case 'exp-range': ui.explore.range = ui.explore.range === 7 ? 14 : 7; break;
      case 'pick-source':
        if (v === 'apple-health' && !s.healthImport) { A.setDataSource('none'); render(); const e2 = $('#health-error'); if (e2) e2.textContent = 'Import export.xml first.'; return; }
        A.setDataSource(v); toast(v === 'sample' ? 'Sample data on, labeled “Sample”' : v === 'apple-health' ? 'Using Apple Health' : 'Sleep and movement off'); break;
      case 'health-toggle': {
        const on = (ui.ob ? ui.ob.data : s.dataSource) === 'apple-health' && !!s.healthImport;
        if (on) { if (ui.ob) ui.ob.data = 'none'; else A.setDataSource('none'); toast('Apple Health off'); break; }
        openModal('healthperm', { from: ui.modal === 'data' ? 'data' : null });
        break;
      }
      case 'health-allow': {
        const types = ui.ob ? ui.ob.types : s.healthTypes;
        for (const k of ['sleep', 'activity', 'cycle']) types[k] = !!document.getElementById('perm-' + k)?.checked;
        if (!types.sleep && !types.activity && !types.cycle) return err('Choose at least one, or tap Don’t allow.', '#perm-sleep');
        if (!s.healthImport || s.healthImport.via === 'simulated') s.healthImport = H.simulateAppleHealth(today());
        if (ui.ob) ui.ob.data = 'apple-health'; else { s.healthTypes = types; A.setDataSource('apple-health'); }
        S.save();
        const reopen = !ui.ob && ui.m.from === 'data';
        close(); if (reopen) openModal('data');
        toast('Apple Health connected (simulated)');
        break;
      }
      case 'sample-toggle':
        A.setDataSource(s.dataSource === 'sample' ? 'none' : 'sample');
        toast(s.dataSource === 'sample' ? 'Sample history on' : 'Sample history off');
        break;
      case 'clear-health': if (!confirmTap(b, 'Tap again to remove')) return; s.healthImport = null; if (s.dataSource === 'apple-health') A.setDataSource('none'); S.save(); break;

      // Aura & plans
      case 'prompt': sendToAura(v); return;
      case 'adjust-chat': sendToAura('Help me adjust for a busy week.'); return;
      case 'observe': ui.draft = { topicId: ui.draft?.topicId || focusTopic(), kind: 'observe', title: 'Keep checking in, with no routine change', desc: 'Observe at your pace.', duration: '20 sec', days: 'When it fits', step: '' }; openModal('accept'); break;
      case 'confirm-plan': {
        const start = val('plan-start'), review = val('plan-review'), step = ui.draft.kind === 'observe' ? 'No routine change. Answer the check-in when it fits.' : val('plan-step').trim();
        if (!step) return err('Describe what you will do.', '#plan-step');
        if (!start) return err('Add a start date.', '#plan-start');
        if (!review || review < start) return err('Choose a review date on or after the start.', '#plan-review');
        const target = val('plan-obs');
        const o = target.startsWith('new:') ? ensureObservation(target.slice(4)) : S.observation(target);
        const p = S.acceptPlan(ui.draft, { step, start, review, observationId: o.id, topicId: o.topicId });
        s.messages.push({ role: 'guide', action: { type: 'feedback', planId: p.id }, text: p.status === 'observing' ? `You’re observing ${T.topic(o.topicId).name.toLowerCase()} with no routine change. Answer your check-in when it fits.` : `Your step is saved and linked to ${T.topic(o.topicId).name.toLowerCase()}. When you’ve tried it, tell me how it went. What you did and how you felt are kept separate.` });
        ui.draft = null; close(); ui.returnFocus = null; S.save(); ui.page = 'app'; ui.tab = 'aura'; toast('Step saved');
        break;
      }
      case 'plan-obs': return;
      case 'feedback': {
        const p = S.plan(b.dataset.plan);
        const existing = s.feedbacks.find(f => f.planId === p.id && f.date === today());
        ui.fb = { planId: p.id, step: 0, d: existing ? Object.assign({}, existing) : {} };
        openModal('feedback', { planId: p.id });
        break;
      }
      case 'fb-exec': ui.fb.d.execution = v; break;
      case 'fb-answer': ui.fb.d.answer = v; break;
      case 'fb-back': if (ui.fb.step === 1) ui.fb.d.change = val('fb-change'); if (ui.fb.step === 2) ui.fb.d.note = val('fb-note'); ui.fb.step--; break;
      case 'fb-next': {
        const d = ui.fb.d;
        if (ui.fb.step === 0 && !d.execution) return err('Choose an answer, including Not sure.', '.scaleopts');
        if (ui.fb.step === 1) { if (!d.answer) return err('Slide to answer, or choose “Not sure” or “Skip today”.', '.slider'); d.change = val('fb-change'); }
        if (ui.fb.step < 2) { ui.fb.step++; break; }
        d.note = val('fb-note').trim();
        const p = S.plan(ui.fb.planId);
        const recorded = /^[1-5]$/.test(d.answer);
        const fb = Object.assign({}, d, { id: d.id || S.uid('fb'), planId: p.id, planVersion: p.version, observationId: p.observationId, date: d.date || today(), at: new Date().toISOString(), score: recorded ? +d.answer : null });
        s.feedbacks = s.feedbacks.filter(f => f.id !== fb.id).concat(fb);
        const linked = s.checkins.find(c => c.feedbackId === fb.id);
        S.saveCheckin({ id: linked?.id, createdAt: linked?.createdAt, observationId: p.observationId, topicId: p.topicId, source: 'plan feedback', feedbackId: fb.id, occurredAt: linked?.occurredAt || S.localDateTime(), status: recorded ? 'recorded' : d.answer, score: recorded ? +d.answer : null, note: fb.note });
        S.save();
        openModal('review', { planId: p.id });
        toast('Feedback saved');
        break;
      }
      case 'decide': {
        const p = S.plan(ui.m.planId), reason = val('decision-reason').trim();
        s.decisions.push({ id: S.uid('dec'), choice: v, reason, planId: p.id, version: p.version, at: new Date().toISOString() });
        if (v === 'adjust') { ui.draft = { topicId: p.topicId, kind: p.kind, lineageId: p.lineageId, title: p.title, desc: p.desc, duration: p.duration, days: p.days, step: p.step }; S.save(); openModal('accept', { target: p.observationId }); break; }
        if (v === 'stop') S.setPlanStatus(p, 'stopped');
        if (v === 'observe') { if (p.status !== 'observing') { S.setPlanStatus(p, 'observing'); p.kind = 'observe'; } }
        if (v === 'continue' && p.status !== 'active') { S.setPlanStatus(p, p.kind === 'observe' ? 'observing' : 'active'); }
        s.messages.push({ role: 'guide', action: v === 'stop' ? null : { type: 'feedback', planId: p.id }, text: v === 'stop' ? 'The step is stopped. Its history and your records are kept.' : v === 'observe' ? 'No step to do now. Keep answering your check-in when it fits.' : 'Continuing as planned. Add feedback whenever it fits.' });
        S.save(); close(); toast('Decision saved');
        break;
      }

      // about
      case 'resetup': close(); A.startOnboarding(); { const s2 = st(); const o = S.activeObservations()[0]; Object.assign(ui.ob, { consent: Object.assign({ terms: false, health: false, share: false }, s2.profile.consent || {}), concerns: s2.profile.concerns || [], rankedFor: (s2.profile.concerns || []).join(','), goalId: s2.profile.goalId, topicId: o?.topicId || null, time: o?.time || null, attempts: s2.profile.attempts || [], attemptsNote: s2.profile.attemptsNote || '', constraint: s2.profile.constraint, data: s2.dataSource, types: Object.assign({}, s2.healthTypes) }); ui.step = A.OB_LAST; } break;
      case 'reset': if (!confirmTap(b, 'Tap again to delete everything')) return; S.reset(); location.reload(); return;
      default: return;
    }
    render();
    if (!ui.modal && ['tab', 'begin', 'demo', 'goexplore', 'home', 'confirm-plan'].includes(a)) {
      // Aura opens at the latest message and the composer; other tabs at the top.
      if (ui.tab === 'aura' && ui.page === 'app' && st().messages.length) window.scrollTo(0, document.documentElement.scrollHeight);
      else window.scrollTo(0, 0);
    }
  });

  // Topic deck: the centered card is the selection. Updates in place so the
  // swipe isn't interrupted by a re-render.
  function selectTopic(id) {
    if (!ui.ob || ui.ob.topicId === id) return;
    ui.ob.topicId = id; ui.ob.time = null;
    document.querySelectorAll('.deckdot').forEach(d => d.setAttribute('aria-selected', String(d.dataset.val === id)));
    const cta = $('.deckcta'); if (cta) cta.textContent = `Observe ${T.topic(id).name.toLowerCase()}`;
  }
  document.addEventListener('scroll', e => {
    if (e.target.id !== 'topic-deck') return;
    const deck = e.target, mid = deck.scrollLeft + deck.clientWidth / 2;
    let best = null, dist = Infinity;
    deck.querySelectorAll('.topiccard').forEach(c => { const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid); if (d < dist) { dist = d; best = c; } });
    if (best) selectTopic(best.dataset.topic);
  }, true);
  document.addEventListener('keydown', e => {
    if (!e.target.closest || !e.target.closest('.deckdots') || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const ids = [...document.querySelectorAll('.deckdot')].map(d => d.dataset.val), i = ids.indexOf(ui.ob.topicId), j = Math.max(0, Math.min(ids.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
    document.querySelector(`.deckdot[data-val="${ids[j]}"]`)?.click();
    document.querySelector(`.deckdot[data-val="${ids[j]}"]`)?.focus();
  });

  // checkboxes & selects
  document.addEventListener('change', e => {
    const el = e.target, s = st();
    if (el.dataset.act === 'ob-consent') { ui.ob.consent[el.dataset.val] = el.checked; render(); return; }
    if (el.dataset.act === 'ob-type') { ui.ob.types[el.dataset.val] = el.checked; render(); return; }
    if (el.dataset.act === 'toggle-type') { s.healthTypes[el.dataset.val] = el.checked; S.save(); render(); return; }
    if (el.dataset.act === 'fb-barrier') { const list = ui.fb.d.barriers || []; ui.fb.d.barriers = el.checked ? [...list, el.dataset.val] : list.filter(x => x !== el.dataset.val); return; }
    if (el.id === 'plan-obs') { ui.m.target = el.value; render(); return; }
    if (el.id === 'health-file' && el.files[0]) { A.runHealthImport(el.files[0]); return; }
    if (['camera', 'photofile'].includes(el.id) && el.files[0]) {
      const f = el.files[0];
      if (!f.type.startsWith('image/') || f.size > 15 * 1024 * 1024) { err('Choose an image smaller than 15 MB.'); return; }
      const r = new FileReader();
      r.onload = () => { ui.m.photo = r.result; ui.m.picking = false; ui.m.sampleFill = false; render(); };
      r.readAsDataURL(f);
    }
  });

  document.addEventListener('scroll', e => {
    if (e.target.classList && e.target.classList.contains('daytl')) A.syncDayPin(e.target);
  }, true);

  document.addEventListener('submit', e => {
    if (e.target.id !== 'chat-form') return;
    e.preventDefault();
    const t = $('#message').value.trim();
    if (t) sendToAura(t);
  });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.act === 'scale-range') {
      // Update the read-back sentence in place so dragging stays smooth.
      const v = el.value, box = el.closest('.slider'), t = T.topic(box.dataset.topic);
      box.classList.add('set');
      box.querySelector('.slvalue').textContent = A.sentence(t, +v);
      el.parentElement.style.setProperty('--t', (v - 1) / 4);
      el.setAttribute('aria-valuetext', `${v}, ${t.labels[v - 1]}`);
      const ctx = el.dataset.ctx;
      if (ctx === 'checkin') { ui.m.choice = v; document.querySelectorAll('.altanswer').forEach(x => { x.classList.remove('selected'); x.setAttribute('aria-pressed', 'false'); }); }
      if (ctx === 'fb') { ui.fb.d.answer = v; document.querySelectorAll('.altanswer').forEach(x => { x.classList.remove('selected'); x.setAttribute('aria-pressed', 'false'); }); }
      if (ctx === 'quick') { ui.quick = ui.quick || {}; ui.quick[el.dataset.obs] = v; const btn = document.querySelector(`[data-act=quick-save][data-obs="${el.dataset.obs}"]`); if (btn) { btn.disabled = false; btn.removeAttribute('aria-disabled'); } const n = document.querySelector(`[data-act=open][data-val=checkin][data-obs="${el.dataset.obs}"].quicknote`); if (n) n.dataset.choice = v; }
      return;
    }
    if (el.id !== 'message' || ui.pending) return;
    ui.auraState = e.target.value ? 'listening' : 'idle';
    const orb = $('.aura-chat'); if (orb) orb.dataset.auraState = ui.auraState;
  });
  document.addEventListener('keydown', e => {
    if (e.target.id === 'message' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.form.requestSubmit(); return; }
    if (!ui.modal) return;
    if (e.key === 'Escape') { close(); render(); return; }
    if (e.key === 'Tab') {
      const f = [...document.querySelectorAll('.sheet button,.sheet input,.sheet select,.sheet textarea,.sheet summary')].filter(x => !x.disabled);
      if (e.shiftKey && (document.activeElement === f[0] || document.activeElement.classList.contains('sheet'))) { e.preventDefault(); f.at(-1)?.focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0]?.focus(); }
    }
  });

  // Hide the floating navigation while typing, so the phone keyboard and the
  // composer are never covered.
  document.addEventListener('focusin', e => { if (e.target.matches('main input, main textarea, .sheet input, .sheet textarea')) document.body.classList.add('typing'); });
  document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement || !document.activeElement.matches('input, textarea')) document.body.classList.remove('typing'); }, 0));

  render();
})();
