// Data model and persistence. Observations are independent: every record
// points to the observation it belongs to, and nothing depends on a single
// "current topic". State is saved to this browser's localStorage so a refresh
// keeps your records; photos stay in memory only (see README).
(function (root) {
  const KEY = 'aura.prototype.v2';

  // ---------- dates (local time, YYYY-MM-DD / YYYY-MM-DDTHH:MM) ----------
  const pad = n => String(n).padStart(2, '0');
  const localDateTime = (d = new Date()) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const todayISO = (now = new Date()) => localDateTime(now).slice(0, 10);
  const addDays = (iso, n) => {
    const d = new Date(iso + 'T12:00');
    d.setDate(d.getDate() + n);
    return localDateTime(d).slice(0, 10);
  };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);
  const dateRange = (from, to) => {
    const out = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
    return out;
  };
  const fmtDate = iso => new Date(iso + 'T12:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
  const fmtDay = iso => new Date(iso + 'T12:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });

  // Drop undefined keys so they never overwrite defaults (e.g. a new record's id).
  const defined = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  let counter = 0;
  const uid = p => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const blank = () => ({
    v: 2,
    onboarded: false,
    profile: { goalId: null, attempts: [], attemptsNote: '', context: [], constraint: 'Keep it simple' },
    observations: [],
    checkins: [],
    entries: [],
    plans: [],
    feedbacks: [],
    decisions: [],
    messages: [],
    dataSource: 'none', // 'none' | 'sample' | 'apple-health'
    healthTypes: { sleep: true, activity: true, cycle: true },
    healthImport: null
  });

  // Photos are kept in memory for this tab only; records keep a reference id.
  const photos = new Map();

  let state = blank();
  let storageOK = true;

  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.v === 2) state = Object.assign(blank(), parsed);
      }
    } catch (e) {
      storageOK = false;
    }
    return state;
  }

  function save() {
    try {
      root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(state));
      storageOK = true;
    } catch (e) {
      storageOK = false;
    }
  }

  function reset() {
    state = blank();
    photos.clear();
    try { root.localStorage && root.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    return state;
  }

  const get = () => state;
  const set = next => { state = next; return state; };

  // ---------- observations ----------
  function addObservation(topicId, time) {
    const existing = state.observations.find(o => o.topicId === topicId);
    if (existing) {
      existing.status = 'active';
      if (time) existing.time = time;
      save();
      return existing;
    }
    const T = root.AuraTopics || require('./topics.js');
    const o = { id: uid('obs'), topicId, time: time || T.topic(topicId).timing.defaultTime, status: 'active', createdAt: new Date().toISOString() };
    state.observations.push(o);
    save();
    return o;
  }
  const observation = id => state.observations.find(o => o.id === id);
  const activeObservations = () => state.observations.filter(o => o.status === 'active');

  // ---------- check-ins ----------
  // status: 'recorded' (score 1–5) | 'unknown' (answered "not sure") | 'skipped'
  function saveCheckin(fields) {
    const occurredAt = fields.occurredAt || localDateTime();
    const record = Object.assign({
      id: uid('chk'),
      source: 'check-in',
      note: '',
      createdAt: new Date().toISOString()
    }, defined(fields), { occurredAt, date: occurredAt.slice(0, 10) });
    if (record.status !== 'recorded') record.score = null;
    const i = state.checkins.findIndex(c => c.id === record.id);
    if (i >= 0) state.checkins[i] = Object.assign({}, state.checkins[i], record, { editedAt: new Date().toISOString() });
    else state.checkins.push(record);
    save();
    return record;
  }
  const checkinsFor = obsId => state.checkins.filter(c => c.observationId === obsId);
  // Latest check-in for an observation on a date (by occurredAt, then creation).
  function dayCheckin(obsId, date, { includeSample = true } = {}) {
    return state.checkins
      .filter(c => c.observationId === obsId && c.date === date && (includeSample || c.source !== 'sample'))
      .sort((a, b) => (a.occurredAt + a.createdAt).localeCompare(b.occurredAt + b.createdAt))
      .at(-1) || null;
  }

  // ---------- food & caffeine ----------
  function saveEntry(fields) {
    const occurredAt = fields.occurredAt;
    const rec = Object.assign({ id: uid('ent'), createdAt: new Date().toISOString(), note: '' }, defined(fields), { date: occurredAt.slice(0, 10) });
    if (rec.photoData) {
      // Bundled sample photos are kept by path; a photo from the device stays in memory only.
      if (rec.photoData.startsWith('data:')) { photos.set(rec.id, rec.photoData); rec.hasPhoto = true; } else rec.photoUrl = rec.photoData;
      delete rec.photoData;
    }
    const i = state.entries.findIndex(e => e.id === rec.id);
    if (i >= 0) state.entries[i] = Object.assign({}, state.entries[i], rec, { editedAt: new Date().toISOString() });
    else state.entries.push(rec);
    save();
    return rec;
  }

  function removeRecord(kind, id) {
    const list = kind === 'checkin' ? 'checkins' : 'entries';
    state[list] = state[list].filter(r => r.id !== id);
    photos.delete(id);
    save();
  }

  // ---------- plans ----------
  // status: 'active' (doing a step) | 'observing' (feelings only) | 'stopped' | 'replaced'
  function acceptPlan(draft, fields) {
    const lineageId = draft.lineageId || uid('lin');
    const prior = state.plans.filter(p => p.lineageId === lineageId);
    prior.forEach(p => { if (p.status !== 'stopped' && p.status !== 'replaced') setPlanStatus(p, 'replaced'); });
    // One current plan per observation: an older current plan for the same observation is replaced.
    state.plans.filter(p => p.observationId === fields.observationId && ['active', 'observing'].includes(p.status))
      .forEach(p => setPlanStatus(p, 'replaced'));
    const plan = {
      id: uid('plan'),
      lineageId,
      version: prior.length + 1,
      title: draft.title,
      desc: draft.desc,
      duration: draft.duration,
      days: draft.days,
      kind: draft.kind || 'step', // 'step' or 'observe'
      fromFactor: draft.fromFactor || null, // set when the step came from a Discovery finding
      step: fields.step,
      start: fields.start,
      review: fields.review,
      observationId: fields.observationId,
      topicId: fields.topicId,
      acceptedAt: new Date().toISOString(),
      status: draft.kind === 'observe' ? 'observing' : 'active',
      history: []
    };
    plan.history.push({ status: plan.status, at: plan.acceptedAt });
    state.plans.push(plan);
    save();
    return plan;
  }
  function setPlanStatus(plan, status) {
    plan.status = status;
    plan.history = plan.history || [];
    plan.history.push({ status, at: new Date().toISOString() });
    save();
  }
  const plan = id => state.plans.find(p => p.id === id);
  const currentPlans = () => state.plans.filter(p => ['active', 'observing'].includes(p.status));
  const currentPlanFor = obsId => currentPlans().find(p => p.observationId === obsId) || null;

  const api = {
    KEY, load, save, reset, get, set, uid, photos,
    storageOK: () => storageOK,
    localDateTime, todayISO, addDays, daysBetween, dateRange, fmtDate, fmtDay,
    addObservation, observation, activeObservations,
    saveCheckin, checkinsFor, dayCheckin,
    saveEntry, removeRecord,
    acceptPlan, setPlanStatus, plan, currentPlans, currentPlanFor
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AuraStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
