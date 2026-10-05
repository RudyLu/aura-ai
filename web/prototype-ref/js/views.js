// Screens: Today, Explore, Aura.
(function () {
  const A = window.AuraApp, T = window.AuraTopics, S = window.AuraStore, H = window.AuraHealth, D = window.AuraDiscovery, C = window.AuraChart;
  const { ui, E, btn } = A;
  const st = () => A.st();
  const today = () => S.todayISO();
  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

  // ---------- shared pieces ----------
  // "3/5 · Moderate", "Not sure", "Skipped" — never a bare number.
  function checkinStatus(c, topicId) {
    if (!c) return null;
    if (c.status === 'recorded') return `${c.score}/5 · ${T.topic(topicId).labels[c.score - 1]}`;
    return c.status === 'unknown' ? 'Not sure' : 'Skipped';
  }
  const sourceTag = r => r.source === 'sample' ? '<span class="badge sample">Sample</span>' : r.source === 'plan feedback' ? '<span class="badge">From step feedback</span>' : '';
  const STATE_COPY = { collecting: 'Collecting', insufficient: 'Not enough to compare', ready: 'Ready to review' };
  const FACTOR_COPY = { insufficient: 'Not enough days', 'no-difference': 'No clear difference', difference: 'Difference in your records' };
  const PLAN_STATUS = { active: 'Current step', observing: 'Observing only', stopped: 'Stopped', replaced: 'Replaced by a newer version' };
  const reviewOn = p => (today() >= p.review ? 'Review due' : `Review on ${S.fmtDate(p.review)}`);
  const timeOf = iso => iso.slice(11, 16);

  function meter(n, of, label) {
    const pct = Math.min(100, Math.round(n / of * 100));
    return `<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="${of}" aria-valuenow="${Math.min(n, of)}" aria-label="${E(label)}"><i style="width:${pct}%"></i></div>`;
  }

  // Data readiness: what is there, what is missing, what to record next.
  function readiness(obs) {
    const s = st();
    const r = D.analyze(s, obs, today());
    const t = T.topic(obs.topicId);
    const caffeineDays = new Set(s.entries.filter(e => e.kind === 'caffeine' && (e.source !== 'sample' || s.dataSource === 'sample')).map(e => e.date)).size;
    const sleepOn = s.dataSource !== 'none' && s.healthTypes.sleep;
    const left = Math.max(0, r.minDays - r.validDays);
    const ready = r.factors.filter(f => f.state !== 'insufficient').length;
    const title = r.state === 'collecting' ? `Building your ${t.name.toLowerCase()} picture` : r.state === 'insufficient' ? 'Not enough to compare yet' : `${plural(ready, 'comparison')} ready`;
    const lead = r.state === 'ready' ? 'Averages from your records, not causes.'
      : r.state === 'insufficient' ? 'Keep logging caffeine and check-ins so each comparison has days on both sides.'
        : r.validDays === 0 ? 'Your first check-in starts the picture.'
          : r.validDays === 1 ? `Your first check-in is saved. ${r.minDays - 1} more days to go.`
            : `${r.validDays} of ${r.minDays} days recorded.`;
    const have = [`${plural(r.validDays, 'day')} with a check-in`, `${plural(caffeineDays, 'day')} with caffeine logged`, sleepOn ? `Sleep from ${H.sourceLabel(s.dataSource, s.healthImport).toLowerCase()}` : null].filter(Boolean);
    const need = [left ? `${plural(left, 'more day')} with a ${t.timing.label.toLowerCase()} check-in` : null, sleepOn ? null : 'Sleep data (optional)'].filter(Boolean);
    return { r, t, title, lead, have, need };
  }

  function readinessBlock(obs) {
    const { r, t, title, lead } = readiness(obs);
    return `<div class="dischead"><strong>${E(title)}</strong></div>${r.state === 'collecting' ? meter(r.validDays, r.minDays, `${t.name}: ${r.validDays} of ${r.minDays} days`) : ''}<p class="disclead">${E(lead)}</p>`;
  }

  // Discovery hero: the observation over the last two weeks, cut by a line at
  // the best day, with what that day held. Descriptive only.
  function bestDayHero(obs) {
    const s = st();
    const t = T.topic(obs.topicId);
    const end = today();
    const dates = S.dateRange(S.addDays(end, -13), end);
    const withSample = s.dataSource === 'sample';
    const vals = dates.map(d => { const c = S.dayCheckin(obs.id, d, { includeSample: withSample }); return c && c.status === 'recorded' ? c.score : null; });
    const scored = vals.map((v, i) => [v, i]).filter(([v]) => v !== null);
    if (scored.length < 2) return '';
    const best = scored.reduce((a, b) => (t.higherIsBetter ? b[0] >= a[0] : b[0] <= a[0]) ? b : a);
    const bi = best[1], bd = dates[bi];
    const W = 320, Hh = 132, base = 118, top = 26;
    const x = i => 8 + i * (W - 16) / (dates.length - 1);
    const y = v => base - (v / 5) * (base - top);
    // smooth area through scored days
    const pts = scored.map(([v, i]) => [x(i), y(v)]);
    const line = pts.reduce((d, p, i) => i ? d + ` C ${(pts[i - 1][0] + p[0]) / 2} ${pts[i - 1][1]}, ${(pts[i - 1][0] + p[0]) / 2} ${p[1]}, ${p[0]} ${p[1]}` : `M ${p[0]} ${p[1]}`, '');
    const area = `${line} L ${pts.at(-1)[0]} ${base} L ${pts[0][0]} ${base} Z`;
    const bx = x(bi);
    // what the best day held
    const h = H.daily(s, bd, end);
    const chk = S.dayCheckin(obs.id, bd, { includeSample: withSample });
    const drinks = s.entries.filter(e => e.date === bd && e.kind === 'caffeine' && (e.source !== 'sample' || withSample));
    const before = drinks.filter(e => e.occurredAt < chk.occurredAt);
    const food = s.entries.filter(e => e.date === bd && e.kind === 'food' && (e.source !== 'sample' || withSample));
    const tags = [
      h.sleep !== null ? ['sleep', `Sleep ${h.sleep} h`] : null,
      ['caffeine', drinks.length ? `Caffeine ×${drinks.length}${before.length ? ' · last ' + before.at(-1).occurredAt.slice(11, 16) : ''}` : 'No caffeine'],
      h.activity !== null ? ['move', h.activity ? `Movement ${h.activity} min` : 'No exercise'] : null,
      food.length ? ['food', food.map(f => f.name).join(', ')] : null,
      h.cycle ? ['cycle', 'Period day'] : null
    ].filter(Boolean);
    const label = t.higherIsBetter ? `Highest ${t.construct.toLowerCase()}` : `Least ${t.construct.toLowerCase()}`;
    return `<div class="besthero">
      <div class="bestplot">
        <ul class="besttags" aria-label="On ${S.fmtDate(bd)}">${tags.map(([k, v]) => `<li class="tag-${k}">${E(v)}</li>`).join('')}</ul>
        <svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="${E(`${t.name} over the last 14 days. ${label} on ${S.fmtDate(bd)}: ${chk.score} of 5.`)}">
          <defs><linearGradient id="bestwash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffba79" stop-opacity=".75"/><stop offset=".55" stop-color="#9b7fe0" stop-opacity=".35"/><stop offset="1" stop-color="#9b7fe0" stop-opacity="0"/></linearGradient></defs>
          ${dates.map((d, i) => `<line x1="${x(i)}" x2="${x(i)}" y1="${top - 8}" y2="${base}" stroke="#ffffff" stroke-opacity=".07"/>`).join('')}
          <path d="${area}" fill="url(#bestwash)"/><path d="${line}" fill="none" stroke="#ffba79" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
          <line x1="${bx}" x2="${bx}" y1="${top - 12}" y2="${base}" stroke="#ffffff" stroke-width="3" vector-effect="non-scaling-stroke"/>
        </svg>
        <span class="bestmark" style="left:${(bx / W * 100).toFixed(2)}%"></span>
      </div>
      <div class="bestaxis"><span>${S.fmtDate(dates[0])}</span><span>Today</span></div>
      <p class="bestline"><span class="eyebrow">${E(label)} · ${S.fmtDay(bd)}</span><strong>${E(checkinStatus(chk, obs.topicId))}</strong></p>
      ${btn('See this day', 'exp-goto', 'quiet bestgo', `data-val="${bd}"`)}
    </div>`;
  }

  function discoveryDetail(obs) {
    const s = st();
    const { r, have, need } = readiness(obs);
    const unavailable = f => f.needs !== 'caffeine' && (s.dataSource === 'none' || !s.healthTypes[f.needs]);
    const shown = r.factors.filter(f => !unavailable(f));
    if (r.state === 'collecting') {
      // Before there is enough data: a short checklist instead of the full breakdown.
      const t = T.topic(obs.topicId);
      const caffeineDays = new Set(s.entries.filter(e => e.kind === 'caffeine' && (e.source !== 'sample' || s.dataSource === 'sample')).map(e => e.date)).size;
      const sleepOn = s.dataSource !== 'none' && s.healthTypes.sleep;
      const item = (done, text) => `<li class="${done ? 'done' : ''}"><span aria-hidden="true">${done ? '✓' : '○'}</span>${E(text)}${done ? '<span class="sr-only"> (done)</span>' : ''}</li>`;
      return `${bestDayHero(obs)}${readinessBlock(obs)}<details class="limits"><summary>What Discovery needs</summary><ul class="needlist">
        ${item(r.validDays >= r.minDays, `Answer your ${t.name.toLowerCase()} check-in on ${r.minDays} days (${r.validDays} so far)`)}
        ${item(caffeineDays > 0, 'Caffeine logged with its time')}
        ${item(sleepOn, 'Sleep data connected (optional)')}
      </ul></details>`;
    }
    if (r.state === 'ready') {
      const t = T.topic(obs.topicId);
      const found = D.findings(r).filter(x => !unavailable(x.f));
      const bars = f => `<div class="cmpbars">${[0, 1].map(k => `<div class="${k === D.insight(r, f)?.better ? 'win' : ''}"><span>${E(f.groups[k])}</span><i style="--w:${(f.means[k] / 5 * 100).toFixed(0)}%"></i><b>${f.means[k]}</b><small>${plural(f.n[k], 'day')}</small></div>`).join('')}</div>`;
      const tryBtn = (i, cls = 'primary') => i.step ? btn(`Try: ${E(i.step.title)}`, 'disc-try', cls, `data-val="${i.step.fromFactor}" data-obs="${obs.id}"`) : '';
      const top = found[0];
      const topCard = top ? `<article class="finding">
          <p class="eyebrow">What your records show</p>
          <h3>${E(top.i.headline)}</h3>
          ${bars(top.f)}
          ${top.i.step ? `<div class="tryit"><p class="eyebrow">Something small to try</p><strong>${E(top.i.step.title)}</strong><p>${E(top.i.step.desc)}</p>${btn('Try it', 'disc-try', 'primary', `data-val="${top.i.step.fromFactor}" data-obs="${obs.id}"`)}</div>` : '<p class="soft">Nothing to change yet. Keep checking in.</p>'}
        </article>` : `<article class="finding"><p class="eyebrow">What your records show</p><h3>No clear differences yet</h3><p class="soft">Your ${E(t.name.toLowerCase())} looks similar across the days compared. More days will make this clearer.</p></article>`;
      const rest = shown.filter(f => f !== top?.f);
      return `${bestDayHero(obs)}${topCard}
        ${rest.length ? `<details class="limits"><summary>More comparisons (${rest.length})</summary><ul class="factors">${rest.map(f => {
          const i = D.insight(r, f);
          return `<li><div class="factorhead"><strong>${E(i ? i.headline : f.label)}</strong><span class="statechip small ${f.state}">${FACTOR_COPY[f.state]}</span></div>${f.state === 'insufficient' ? `<p>${f.n[0]} vs ${f.n[1]} days so far · needs ${r.minGroup} on each side</p>` : bars(f)}${i && i.step ? tryBtn(i, 'quiet') : ''}</li>`;
        }).join('')}</ul></details>` : ''}
        <p class="soft findnote">Based on ${plural(r.validDays, 'day')} with a check-in. Averages show what went together, not what caused it. A small step is how you find out.${r.usedSample ? ' Includes sample records.' : ''}</p>`;
    }
    return `${bestDayHero(obs)}${readinessBlock(obs)}<details class="limits"><summary>What Discovery needs</summary>
      <dl class="havemiss"><div><dt>Have</dt><dd>${have.map(E).join(' · ')}</dd></div>${need.length ? `<div><dt>Still needed</dt><dd>${need.map(E).join(' · ')}</dd></div>` : ''}</dl>
      <p class="soft">Only days with a 1–5 answer count, with at least ${r.minGroup} days on each side of a comparison.</p></details>`;
  }

  // ---------- Today ----------
  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  // One row per item; the focus item is shown in the "Next" card instead.
  function obsRow(o) {
    const t = T.topic(o.topicId);
    const c = S.dayCheckin(o.id, today());
    if (c) return `<li class="row done"><span class="check" aria-hidden="true">✓</span><span class="rowtext"><strong>${E(t.name)}</strong><small>${E(checkinStatus(c, o.topicId))}</small></span>${btn('Edit', 'open', 'quiet', `data-val="checkin" data-obs="${o.id}" data-rec="${c.id}" aria-label="Edit ${E(t.name)} check-in"`)}</li>`;
    return `<li class="row"><span class="dot" aria-hidden="true"></span><span class="rowtext"><strong>${E(t.name)}</strong><small>${E(o.time)}</small></span>${btn('Check in', 'open', 'smallaction', `data-val="checkin" data-obs="${o.id}"`)}</li>`;
  }
  function planRow(p) {
    const t = T.topic(p.topicId);
    const done = st().feedbacks.some(f => f.planId === p.id && f.date === today());
    const action = today() >= p.review
      ? btn('Review', 'open', 'smallaction', `data-val="review" data-plan="${p.id}"`)
      : p.status === 'active'
        ? btn(done ? 'Edit' : 'How did it go?', 'feedback', done ? 'quiet' : 'smallaction', `data-plan="${p.id}"`)
        : btn('Details', 'open', 'quiet', `data-val="review" data-plan="${p.id}"`);
    return `<li class="row step"><span class="dot step" aria-hidden="true"></span><button type="button" class="rowtext linkish" data-act="open" data-val="review" data-plan="${p.id}"><strong>${E(p.title)}</strong><small>${p.status === 'observing' ? 'Observing only' : done ? 'Feedback added' : 'Your step'} · ${E(reviewOn(p))}</small></button>${action}</li>`;
  }

  // Decide the single most useful thing to do now.
  function nextUp() {
    const obs = S.activeObservations();
    const now = new Date().toTimeString().slice(0, 5);
    const pending = obs.filter(o => !S.dayCheckin(o.id, today())).sort((a, b) => a.time.localeCompare(b.time));
    const due = pending.filter(o => o.time <= now);
    if (due.length) return { kind: 'checkin', obs: due[0] };
    const p = S.currentPlans().find(x => x.status === 'active' && x.start <= today() && !st().feedbacks.some(f => f.planId === x.id && f.date === today()));
    if (p) return { kind: 'plan', plan: p };
    if (pending.length) return { kind: 'later', obs: pending[0] };
    return { kind: 'done' };
  }

  // Tap a number to open the check-in with that answer picked.
  function quickScale(o) {
    const v = (ui.quick || {})[o.id];
    return `${A.scaleSlider(o.topicId, v, 'quick', `data-obs="${o.id}"`)}<div class="quickactions">${btn('Save check-in', 'quick-save', 'primary', `data-obs="${o.id}" ${v ? '' : 'disabled aria-disabled="true"'}`)}${btn('Add a note', 'open', 'text quicknote', `data-val="checkin" data-obs="${o.id}" ${v ? `data-choice="${v}"` : ''}`)}</div>`;
  }


  // Today hero: the week as dots on an arc around where the observation is
  // heading, then the one thing to do now underneath.
  function ringHero(o) {
    const days = S.dateRange(S.addDays(today(), -6), today());
    const t = T.topic(o.topicId);
    const r = D.analyze(st(), o, today());
    const cx = 160, cy = 168, R = 132;
    const start0 = (o.createdAt || '').slice(0, 10);
    const dots = days.map((d, i) => {
      const a = (198 + i * (144 / 6)) * Math.PI / 180;
      const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      const lx = cx + (R + 26) * Math.cos(a), ly = cy + (R + 26) * Math.sin(a);
      const c = S.dayCheckin(o.id, d);
      const cls = c ? (c.status === 'recorded' ? `on s${c.score}` : 'meh') : d < start0 ? 'pre' : 'empty';
      const lab = c ? checkinStatus(c, o.topicId) : 'No check-in';
      const wd = new Date(d + 'T12:00').toLocaleDateString('en', { weekday: 'narrow' });
      return `<g class="rdot ${cls} ${d === today() ? 'now' : ''}"><title>${S.fmtDay(d)}: ${E(lab)}</title>${d === today() ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="17" class="nowring"/>` : ''}<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12"/>${c && c.status === 'recorded' ? `<text x="${x.toFixed(1)}" y="${(y + 4.5).toFixed(1)}">${c.score}</text>` : ''}<text class="wd" x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}">${wd}</text></g>`;
    }).join('');
    const found = r.state === 'ready' ? D.findings(r).length : 0;
    const center = r.state !== 'ready'
      ? `<b>${r.validDays}<small>/${r.minDays}</small></b><span>days to your first findings</span>`
      : found ? `<b>${found}</b><span>${found === 1 ? 'finding' : 'findings'} from your records</span>` : `<b>${r.validDays}</b><span>days recorded</span>`;
    return `<div class="ringhero" role="group" aria-label="${E(t.name)}, last 7 days">
      <svg viewBox="0 -14 320 200" aria-hidden="true"><path d="M ${(cx + R * Math.cos(198 * Math.PI / 180)).toFixed(1)} ${(cy + R * Math.sin(198 * Math.PI / 180)).toFixed(1)} A ${R} ${R} 0 0 1 ${(cx + R * Math.cos(342 * Math.PI / 180)).toFixed(1)} ${(cy + R * Math.sin(342 * Math.PI / 180)).toFixed(1)}" class="rtrack"/>${dots}</svg>
      <div class="ringcenter"><p class="eyebrow">${E(t.name)}</p>${center}${r.state === 'ready' ? `<button type="button" class="ringlink" data-act="tab" data-val="explore">See in Explore ›</button>` : ''}</div>
    </div>`;
  }

  function nextCard(n) {
    const obs = S.activeObservations();
    let o, action;
    if (n.kind === 'checkin' || n.kind === 'later') {
      o = n.obs;
      const t = T.topic(o.topicId);
      action = `<p class="eyebrow">${n.kind === 'checkin' ? 'Now' : `Later today · ${E(o.time)}`}</p><h2 id="h-next">${E(t.question)}</h2>${quickScale(o)}`;
    } else if (n.kind === 'plan') {
      const p = n.plan;
      o = S.observation(p.observationId) || obs[0];
      const days = S.dateRange(p.start, p.review);
      const fbDays = new Set(st().feedbacks.filter(f => f.planId === p.id).map(f => f.date));
      const dayN = Math.min(days.length, days.indexOf(today()) + 1 || days.length);
      action = `<p class="eyebrow">Your step · ${today() >= p.review ? 'Review day' : `Day ${dayN} of ${days.length}`}</p><h2 id="h-next">${E(p.title)}</h2>
        <ol class="stepdots" aria-label="${fbDays.size} of ${days.length} days with feedback">${days.map(d => `<li class="${fbDays.has(d) ? 'on' : ''} ${d === today() ? 'now' : ''}"></li>`).join('')}</ol>
        ${today() >= p.review ? btn('Review your step', 'open', 'primary', `data-val="review" data-plan="${p.id}"`) : btn('How did it go today?', 'feedback', 'primary', `data-plan="${p.id}"`)}`;
    } else {
      o = obs[0];
      const next = o ? [...obs].sort((a, b) => a.time.localeCompare(b.time))[0] : null;
      action = `<div class="donerow">${A.auraMark('aura-small')}<div><h2 id="h-next">All done for today.</h2>${next ? `<p class="herosub">Next: ${E(T.topic(next.topicId).name.toLowerCase())}, tomorrow at ${E(next.time)}</p>` : ''}</div></div>`;
    }
    return `<section class="todayhero" aria-labelledby="h-next">${o ? ringHero(o) : ''}<div class="heroaction">${action}</div></section>`;
  }

  // Log your day: big, friendly entry points, then today's records as tiles.
  const LOG_ART = {
    food: `<svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true"><defs><linearGradient id="lgfood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc59a"/><stop offset="1" stop-color="#e2607a"/></linearGradient></defs><path d="M22 14c-3 4 3 6 0 10M32 11c-3 4 3 6 0 10M42 14c-3 4 3 6 0 10" fill="none" stroke="#ffe6d0" stroke-width="2.4" stroke-linecap="round" opacity=".7"/><path d="M8 32h48a24 24 0 0 1-48 0z" fill="url(#lgfood)"/><ellipse cx="32" cy="32" rx="24" ry="4.5" fill="#fff1e2"/><ellipse cx="25" cy="31" rx="5" ry="2" fill="#7fcf8a"/><ellipse cx="38" cy="31.5" rx="6" ry="2.2" fill="#ffb07a"/></svg>`,
    caffeine: `<svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true"><defs><linearGradient id="lgcup" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dcc0"/><stop offset="1" stop-color="#b9774f"/></linearGradient></defs><path d="M24 10c-3 4 3 6 0 10M34 8c-3 4 3 6 0 10" fill="none" stroke="#ffe6d0" stroke-width="2.4" stroke-linecap="round" opacity=".7"/><path d="M46 30h3a7 7 0 0 1 0 14h-4" fill="none" stroke="#e7b48c" stroke-width="4"/><path d="M14 24h34v14a15 15 0 0 1-15 15h-4a15 15 0 0 1-15-15z" fill="url(#lgcup)"/><ellipse cx="31" cy="24" rx="17" ry="3.5" fill="#6b3f2a"/><ellipse cx="31" cy="56" rx="22" ry="3.5" fill="#ffffff26"/></svg>`
  };
  // Your day: a time-of-day strip with everything logged today, and one card
  // per kind of entry that sums it up and adds another.
  function logSection(s) {
    const recs = dayRecords(s, today());
    const H0 = 5, H1 = 24, PX = 46; // 05:00 to midnight, px per hour
    const xOf = iso => { const [h, m] = iso.slice(11, 16).split(':').map(Number); return Math.max(0, (h + m / 60 - H0)) * PX; };
    const now = new Date(); const nowX = Math.max(0, (now.getHours() + now.getMinutes() / 60 - H0) * PX);
    const rows = [];
    const items = recs.map(x => {
      const left = xOf(x.r.occurredAt);
      let row = 0; while (rows[row] !== undefined && left - rows[row] < 38) row++;
      rows[row] = left;
      const r = x.r;
      let face, label, act;
      if (x.kind === 'checkin') {
        const tt = T.topic(r.topicId);
        face = `<span class="tlface score s${r.score || 0} ${r.status !== 'recorded' ? 'meh' : ''}">${r.status === 'recorded' ? r.score : '–'}</span>`;
        label = tt.name; act = `data-act="open" data-val="checkin" data-obs="${r.observationId}" data-rec="${r.id}"`;
      } else {
        const img = r.photoUrl || (r.hasPhoto && S.photos.get(r.id));
        face = `<span class="tlface ${r.kind}">${img ? `<img src="${img}" alt="">` : LOG_ART[r.kind]}</span>`;
        label = r.name; act = `data-act="open" data-val="${r.kind}" data-rec="${r.id}"`;
      }
      return `<button type="button" class="tlitem" style="left:${left}px;top:${row * 50}px" ${act} aria-label="${E(label)} at ${timeOf(r.occurredAt)}, edit">${face}<small>${timeOf(r.occurredAt)}</small></button>`;
    }).join('');
    const ticks = [6, 9, 12, 15, 18, 21].filter(h => (h - H0) * PX < nowX - 30).map(h => `<span class="tltick" style="left:${(h - H0) * PX}px">${String(h).padStart(2, '0')}:00</span>`).join('');
    const height = rows.length ? rows.length * 50 : 18;
    const food = recs.filter(x => x.kind === 'entry' && x.r.kind === 'food').map(x => x.r);
    const drinks = recs.filter(x => x.kind === 'entry' && x.r.kind === 'caffeine').map(x => x.r);
    const card = (kind, title, body, sub) => `<button type="button" class="kindcard ${kind}" data-act="open" data-val="${kind}"><span class="kindtitle">${title}</span><span class="kindbody">${body}</span><span class="kindsub">${sub}</span><span class="kindadd" aria-hidden="true">＋</span></button>`;
    const foodBody = food.length ? `<span class="thumbs">${food.slice(-3).map(f => { const img = f.photoUrl || (f.hasPhoto && S.photos.get(f.id)); return img ? `<img src="${img}" alt="">` : `<i>${LOG_ART.food}</i>`; }).join('')}</span>` : LOG_ART.food;
    const cupBody = drinks.length ? `<span class="cups">${drinks.map(() => '<i></i>').join('')}</span>` : LOG_ART.caffeine;
    return `<section class="logday" aria-labelledby="h-log"><div class="sechead"><h2 id="h-log">Your day</h2>${recs.length ? `<small>${plural(recs.length, 'entry', 'entries')}</small>` : ''}</div>
      <div class="daytlwrap"><div class="daytl" data-now="${nowX}" data-px="${PX}" data-h0="${H0}"><div class="tlinner" style="width:${Math.ceil(nowX)}px;height:${height + 34}px">${ticks}${items}</div></div>
        <div class="tlpin" aria-hidden="true"><span class="tlpinline"></span><b class="tlpintime">Now</b></div></div>
      <p class="tlhint" aria-live="polite">Slide the day to pick a time · logging at <b class="tlat">now</b></p>
      ${recs.length ? '' : '<p class="soft logempty">Nothing yet today. Add a meal or a coffee below.</p>'}
      <div class="kindcards">
        ${card('food', 'Food', foodBody, food.length ? `${plural(food.length, 'meal')} today` : 'Add a meal')}
        ${card('caffeine', 'Caffeine', cupBody, drinks.length ? `${plural(drinks.length, 'drink')} · last ${timeOf(drinks.at(-1).occurredAt)}` : 'Add a drink')}
        <button type="button" class="kindcard aura" data-act="tab" data-val="aura"><span class="kindtitle">Aura</span><span class="kindbody">${A.auraMark('aura-small')}</span><span class="kindsub">Talk it through</span></button>
      </div>
    </section>`;
  }


  function planCard(p) {
    const t = T.topic(p.topicId);
    const done = st().feedbacks.some(f => f.planId === p.id && f.date === today());
    const primary = p.status === 'active'
      ? btn(done ? 'Edit today’s feedback' : 'How did it go?', 'feedback', 'smallaction', `data-plan="${p.id}"`)
      : btn(`Check in: ${t.name}`, 'open', 'smallaction', `data-val="checkin" data-obs="${p.observationId}"`);
    return `<article class="plancard compact ${p.status}"><span class="eyebrow">${PLAN_STATUS[p.status]} · ${E(reviewOn(p))}</span><h3>${E(p.title)}</h3><div class="obsactions">${primary}${btn('Details', 'open', 'quiet', `data-val="review" data-plan="${p.id}"`)}</div></article>`;
  }

  // Records for one day (check-ins, food, caffeine), oldest first, with Edit.
  function dayRecords(s, day) {
    const withSample = s.dataSource === 'sample';
    return [
      ...s.checkins.filter(c => c.date === day && (c.source !== 'sample' || withSample)).map(c => ({ kind: 'checkin', at: c.occurredAt, r: c })),
      ...s.entries.filter(e => e.date === day && (e.source !== 'sample' || withSample)).map(e => ({ kind: 'entry', at: e.occurredAt, r: e }))
    ].sort((a, b) => a.at.localeCompare(b.at));
  }
  const recordRow = ({ kind, r }) => {
    const editable = r.source !== 'sample';
    if (kind === 'checkin') {
      const tt = T.topic(r.topicId);
      return `<article class="recordrow"><div><strong>${E(tt.name)}</strong><small>${timeOf(r.occurredAt)} · ${E(checkinStatus(r, r.topicId))} ${sourceTag(r)}${r.editedAt ? ' <span class="badge">Edited</span>' : ''}</small>${r.note ? `<p>${E(r.note)}</p>` : ''}</div>${editable ? btn('Edit', 'open', 'quiet', `data-val="checkin" data-obs="${r.observationId}" data-rec="${r.id}" aria-label="Edit ${E(tt.name)} check-in at ${timeOf(r.occurredAt)}"`) : ''}</article>`;
    }
    const extra = r.kind === 'caffeine' && r.mg !== null && r.mg !== undefined ? ` · ${E(r.mg)} mg` : '';
    return `<article class="recordrow">${r.photoUrl || (r.hasPhoto && S.photos.get(r.id)) ? `<img src="${r.photoUrl || S.photos.get(r.id)}" alt="Photo for ${E(r.name)}">` : ''}<div><strong>${E(r.name)}</strong><small>${timeOf(r.occurredAt)} · ${r.kind === 'caffeine' ? 'Caffeine' : 'Food'}${extra} ${sourceTag(r)}${r.editedAt ? ' <span class="badge">Edited</span>' : ''}</small>${r.size || r.note ? `<p>${E([r.size, r.note].filter(Boolean).join(' · '))}</p>` : ''}</div>${editable ? btn('Edit', 'open', 'quiet', `data-val="${r.kind}" data-rec="${r.id}" aria-label="Edit ${E(r.name)}"`) : ''}</article>`;
  };

  // Top of Today: the goals the user chose in setup, in place of a slogan.
  function goalHeader(s) {
    const goals = (s.profile.concerns || []).map(c => T.CONCERNS[c]).filter(Boolean);
    const gear = `<button type="button" class="gear" data-act="open" data-val="settings" aria-label="Settings"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>`;
    if (!goals.length) return `<div class="greeting goalhead"><div class="goaltop"><p>${greeting()}, Alex</p>${gear}</div><h1>Make room<br>for yourself.</h1></div>`;
    const more = goals.slice(1);
    const moreText = more.length ? `<span class="morelabel">Also working on</span><ul class="goaltags ${ui.goalsOpen ? 'open' : 'clamp'}" id="goaltags">${more.map(g => `<li>#${E(g.goal.charAt(0).toLowerCase() + g.goal.slice(1))}<button type="button" data-act="goal-remove" data-val="${g.id}" aria-label="Remove goal: ${E(g.goal)}">×</button></li>`).join('')}</ul><button type="button" class="seeall" data-act="goals-toggle" aria-controls="goaltags" aria-expanded="${!!ui.goalsOpen}">${ui.goalsOpen ? 'Show less' : `See all (${more.length})`}</button>` : '';
    return `<div class="greeting goalhead"><div class="goaltop"><p>${greeting()}, Alex</p>${gear}</div><div class="goalmain"><span class="goaltile">${A.goalArt(goals[0].group, 64)}</span><div><p class="goallabel">Your main goal</p><h1>${E(goals[0].goal)}</h1></div></div>${moreText ? `<div class="moregoals">${moreText}</div>` : ''}</div>`;
  }

  // A short read-out of setup on Today, with the way back in to change it.
  function setupCard(s, obs) {
    const concerns = (s.profile.concerns || []).map(c => T.CONCERNS[c]?.label).filter(Boolean);
    const rows = [
      ['Observing', obs.map(o => `${T.topic(o.topicId).name} · ${o.time}`).join(', ') || 'Nothing yet'],
      ['Data', H.sourceLabel(s.dataSource, s.healthImport)]
    ].filter(Boolean);
    return `<section class="setupcard" aria-labelledby="h-setup"><div class="setuphead"><h2 id="h-setup">Your setup</h2>${btn('Edit', 'resetup', 'quiet', 'aria-label="Edit your setup"')}</div><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${E(v)}</dd></div>`).join('')}</dl></section>`;
  }

  // Today: the strongest finding across observations, with its step.
  function findingCard(obs) {
    const s = st();
    const taken = new Set(s.plans.map(p => p.fromFactor).filter(Boolean));
    for (const o of obs) {
      const r = D.analyze(s, o, today());
      if (r.state !== 'ready') continue;
      const top = D.findings(r).find(x => x.i.step && !taken.has(x.f.id) && (x.f.needs === 'caffeine' || (s.dataSource !== 'none' && s.healthTypes[x.f.needs])));
      if (!top) continue;
      return `<section class="todayfinding" aria-labelledby="h-find"><p class="eyebrow">From your records</p><h2 id="h-find">${E(top.i.headline)}</h2><div class="findrow"><span><small>Something to try</small>${E(top.i.step.title)}</span>${btn('Try it', 'disc-try', 'smallaction', `data-val="${top.f.id}" data-obs="${o.id}"`)}</div></section>`;
    }
    return '';
  }

  function home() {
    const s = st();
    const obs = S.activeObservations();
    const plans = S.currentPlans();
    const n = nextUp();
    const focusObs = n.obs ? n.obs.id : null, focusPlan = n.plan ? n.plan.id : null;
    // Answered check-ins move to Today's log; this list is only what's still to do.
    const rows = [...obs.filter(o => o.id !== focusObs && !S.dayCheckin(o.id, today())).map(obsRow), ...plans.filter(p => p.id !== focusPlan).map(planRow)];
    const stopped = s.plans.some(p => p.status === 'stopped');
    return `<main class="today">${s.demo ? `<button type="button" class="demochip" data-act="open" data-val="demo">Demo timeline · Day ${s.demo.day} <span>Change</span></button>` : ''}${goalHeader(s)}
      ${nextCard(n)}
      ${logSection(s)}
      ${rows.length ? `<section aria-labelledby="h-today"><h2 class="listhead" id="h-today">Still to do</h2><ul class="rows">${rows.join('')}</ul></section>` : ''}
      ${findingCard(obs)}
    </main>`;
  }

  // ---------- Explore ----------
  function exploreObs() {
    const obs = S.activeObservations();
    if (!obs.find(o => o.id === ui.explore.obsId)) ui.explore.obsId = obs[0]?.id || null;
    return obs.find(o => o.id === ui.explore.obsId) || null;
  }

  function explore() {
    const s = st();
    const o = exploreObs();
    const obs = S.activeObservations();
    const end = today();
    const dates = S.dateRange(S.addDays(end, -(ui.explore.range - 1)), end);
    if (!dates.includes(ui.explore.date)) ui.explore.date = end;
    const day = ui.explore.date;
    const sel = dates.indexOf(day);
    const t = o ? T.topic(o.topicId) : null;
    const withSample = s.dataSource === 'sample';
    const hd = dates.map(d => H.daily(s, d, end));
    const src = H.sourceLabel(s.dataSource, s.healthImport);
    const sleepOn = s.dataSource !== 'none' && s.healthTypes.sleep, moveOn = s.dataSource !== 'none' && s.healthTypes.activity;
    const series = [];
    let dayChk = null;
    if (o) {
      const chk = dates.map(d => S.dayCheckin(o.id, d, { includeSample: withSample }));
      dayChk = chk[sel];
      series.push({
        key: 'feeling', title: t.name, unit: `1–5 · ${t.higherIsBetter ? 'higher = more' : 'higher = sleepier'}`, min: 1, max: 5, color: '#ffba79',
        ticks: [{ v: 1, label: '1' }, { v: 3, label: '3' }, { v: 5, label: '5' }],
        values: chk.map(c => c && c.status === 'recorded' ? c.score : null),
        marks: chk.map(c => c && c.status !== 'recorded' ? c.status : null),
        emptyText: 'No check-ins in this range'
      });
    }
    series.push({ key: 'sleep', title: 'Sleep', unit: 'hours asleep · 0–10', min: 0, max: 10, color: '#b49aff', ticks: [{ v: 0, label: '0' }, { v: 5, label: '5' }, { v: 10, label: '10' }], values: hd.map(x => x.sleep), emptyText: sleepOn ? 'No sleep records' : 'Sleep not connected' });
    series.push({ key: 'activity', title: 'Movement', unit: 'exercise min · 0–60+', min: 0, max: 60, color: '#66cddd', ticks: [{ v: 0, label: '0' }, { v: 30, label: '30' }, { v: 60, label: '60+' }], values: hd.map(x => x.activity === null ? null : Math.min(60, x.activity)), emptyText: moveOn ? 'No movement records' : 'Movement not connected' });

    const dayH = hd[sel];
    const recs = dayRecords(s, day);


    const needCheckin = o && !dayChk && day <= end;
    const focus = ui.explore.metric || 'all';
    const srcName = H.sourceLabel(s.dataSource, s.healthImport);
    const ov = [];
    if (o) {
      const chk = dates.map(d => S.dayCheckin(o.id, d, { includeSample: withSample }));
      ov.push({ key: 'feeling', label: t.name, color: '#ffba79', unit: `1–5, ${t.higherIsBetter ? 'higher = more' : 'higher = sleepier'}`, scale: 5,
        ticks: [{ v: 1, label: `1 ${t.labels[0]}` }, { v: 3, label: `3 ${t.labels[2]}` }, { v: 5, label: `5 ${t.labels[4]}` }],
        values: chk.map(c => c && c.status === 'recorded' ? c.score : null), marks: chk.map(c => c && c.status !== 'recorded' ? c.status : null),
        reading: checkinStatus(dayChk, o.topicId) || 'No check-in', source: dayChk ? (dayChk.source === 'sample' ? 'Sample' : 'Your check-in') : '' });
    }
    ov.push({ key: 'sleep', label: 'Sleep', color: '#b49aff', unit: '0–10 hours', scale: 10, ticks: [{ v: 0, label: '0 h' }, { v: 5, label: '5 h' }, { v: 10, label: '10 h' }], values: hd.map(x => x.sleep), reading: dayH.sleep === null ? 'No record' : dayH.sleep + ' h', source: srcName });
    ov.push({ key: 'activity', label: 'Movement', color: '#66cddd', unit: '0–60 minutes', scale: 60, ticks: [{ v: 0, label: '0 min' }, { v: 30, label: '30 min' }, { v: 60, label: '60+ min' }], values: hd.map(x => x.activity === null ? null : Math.min(60, x.activity)), reading: dayH.activity === null ? 'No record' : dayH.activity + ' min', source: srcName });
    if (s.dataSource !== 'none' && s.healthTypes.cycle) ov.push({ key: 'cycle', band: true, label: 'Period', color: '#f29bb5', unit: 'dates only, no phase prediction', values: hd.map(x => !!x.cycle), reading: dayH.cycle ? 'Recorded' : '—', source: srcName });
    const focusSeries = ov.find(x => x.key === focus);
    const srcLine = H.sourceLabel(s.dataSource, s.healthImport);
    return `<main class="explore-full"><div class="pagehead"><h1>Explore</h1></div>
      <div class="obschips" role="tablist" aria-label="Observation">${obs.map(x => `<button type="button" role="tab" aria-selected="${x.id === ui.explore.obsId}" data-act="exp-obs" data-val="${x.id}">${E(T.topic(x.topicId).name)}</button>`).join('')}${S.activeObservations().length < T.TOPIC_IDS.length ? btn('＋', 'open', 'chipadd', 'data-val="addobs" aria-label="Add an observation"') : ''}</div>
      <section class="focuschart layeredchart" aria-label="Timeline">
        ${focusSeries ? `<p class="chartintro">${E(focusSeries.label)} · ${E(focusSeries.unit)}</p>` : ''}
        <div class="overlaytabs" aria-label="Highlight a signal">${[{ key: 'all', label: 'All signals', color: '#fff' }, ...ov].map(x => `<button type="button" data-act="exp-metric" data-val="${x.key}" aria-pressed="${focus === x.key}" style="--signal:${x.color}"><i></i>${E(x.label)}</button>`).join('')}</div>
        <div class="dateaxis overlaydates">${dates.map(d => `<button type="button" data-act="exp-date" data-val="${d}" class="${d === day ? 'selected' : ''}" aria-pressed="${d === day}" aria-label="${S.fmtDay(d)}"><small>${new Date(d + 'T12:00').toLocaleDateString('en', { weekday: 'short' })}</small>${d.slice(8)}</button>`).join('')}</div>
        ${C.overlay(dates, ov, sel, focus, day === end ? 'TODAY' : day.slice(5))}
        <div class="rangeseg" role="group" aria-label="Days shown">${[7, 14].map(n => `<button type="button" data-act="exp-range-set" data-val="${n}" aria-pressed="${ui.explore.range === n}">${n} days</button>`).join('')}</div>
      </section>
      <section class="chart-details"><p class="readingdate">${S.fmtDay(day)}${day === end ? ' · Today' : ''}</p>
        <div class="signalreadings ${ov.length > 3 ? 'four' : ''}">${ov.map(x => `<div style="--signal:${x.color};opacity:${focus === 'all' || focus === x.key ? 1 : 0.45}"><span><i></i>${E(x.label)}</span><strong>${E(x.reading)}</strong>${x.source === 'Sample' ? '<small>Sample</small>' : ''}</div>`).join('')}</div>
        ${needCheckin ? btn(`Check in for ${day === end ? 'today' : S.fmtDate(day)}`, 'open', 'smallaction wide', `data-val="checkin" data-obs="${o.id}" data-date="${day}"`) : ''}
        <details class="chartscales"><summary>How to read this</summary><ul class="notes"><li>Each signal has its own scale${o ? `: ${E(t.name)} 1–5` : ''}, sleep 0–10 h, movement 0–60 min.</li><li>Pink columns are period dates.</li><li>Curves moving together don’t mean they’re related.</li></ul></details>
      </section>
      ${o ? `<section class="discovery" aria-label="Discovery">${discoveryDetail(o)}</section>` : ''}
      ${day === end ? '' : `<div class="sectionlabel" id="records"><h2>${S.fmtDate(day)} records</h2>${btn('＋ Caffeine', 'open', 'quiet', `data-val="caffeine" data-date="${day}"`)}</div>
      <div class="dayevents">${recs.map(recordRow).join('') || '<p class="soft">Nothing recorded.</p>'}${dayH.cycle ? `<article class="recordrow"><div><strong>Period date recorded</strong><small>${E(src)} · date only</small></div></article>` : ''}</div>`}
      <div class="srcrow"><span>Sleep & movement · <b>${srcLine}</b></span>${btn('Manage', 'open', 'quiet', 'data-val="data"')}</div>
    </main>`;
  }


  // ---------- Aura ----------
  function messageAction(m) {
    if (!m.action) return '';
    const a = m.action;
    if (a.type === 'feedback') {
      const p = S.plan(a.planId);
      if (!p || !['active', 'observing'].includes(p.status)) return '';
      return p.status === 'active' ? btn('How did it go?', 'feedback', 'smallaction msgaction', `data-plan="${p.id}"`) : btn(`Check in: ${E(T.topic(p.topicId).name)}`, 'open', 'smallaction msgaction', `data-val="checkin" data-obs="${p.observationId}"`);
    }
    if (a.type === 'data') return btn('Manage data sources', 'open', 'smallaction msgaction', 'data-val="data"');
    if (a.type === 'caffeine') return btn('＋ Log a drink', 'open', 'smallaction msgaction', 'data-val="caffeine"');
    if (a.type === 'checkin') {
      const o = S.activeObservations().find(x => x.topicId === a.topicId);
      return o ? btn(`Check in: ${E(T.topic(a.topicId).name)}`, 'open', 'smallaction msgaction', `data-val="checkin" data-obs="${o.id}"`) : '';
    }
    return '';
  }

  function suggestions() {
    const s = st();
    const plans = S.currentPlans();
    if (plans.length) {
      const p = plans[0];
      return [['Review my step', 'open', `data-val="review" data-plan="${p.id}"`], ['Add context', 'open', 'data-val="food"'], ['Change my step', 'prompt', 'data-val="Help me adjust my step for a busy week."']];
    }
    if (!s.messages.length) return [['A hard day, a hot cocoa, and no energy', 'prompt', 'data-val="I had a difficult meeting, bought a hot cocoa, and fell asleep on the sofa. I feel exhausted."'], ['Help me explore my coffee habit', 'prompt', 'data-val="Help me explore my coffee habit"'], ['Help me understand my week', 'prompt', 'data-val="Help me understand my week"']];
    if (ui.draft) return [];
    return [['I’m working late this week', 'prompt', 'data-val="I’m working late this week"'], ['I want energy for exercise', 'prompt', 'data-val="I want energy for exercise"']];
  }

  function chat() {
    const s = st();
    const plans = S.currentPlans();
    const panel = plans.map(planCard).join('');
    const d = ui.draft;
    const draft = d ? `<div class="draft"><span class="eyebrow">A suggestion, not a commitment · ${E(T.topic(d.topicId).name)}</span><h3>${E(d.title)}</h3><p>${E(d.desc)}</p><div class="tags"><span>${E(d.duration)}</span><span>${E(d.days)}</span></div>${btn('See this small step', 'open', 'primary', 'data-val="preview"')}${btn('Just observe for now', 'observe', 'text')}</div>` : '';
    const offer = ui.cocoaOffer && !ui.pending ? `<div class="aura-log-offer"><p>Keep one detail from your day?</p>${btn('Record the cocoa', 'cocoa', 'smallaction')}${btn('Check in: Evening energy', 'checkin-topic', 'smallaction', 'data-val="evening-energy"')}</div>` : '';
    const sug = suggestions();
    return `<main class="chatpage"><div class="chatheading">${A.auraMark('aura-chat', ui.auraState)}<div><h2>Aura</h2><small>${ui.pending ? 'Taking a moment to understand…' : 'A little space to think together.'}</small></div></div>${panel}
      <div class="messages" aria-live="polite"><div class="bubble guide"><span class="speaker">Aura</span>Hi, I’m Aura. Tell me about your day, and we’ll make sense of it together.</div>${s.messages.map(m => `<div class="bubble ${m.role}">${m.role === 'guide' ? '<span class="speaker">Aura</span>' : ''}${E(m.text).replace(/\n/g, '<br>')}${messageAction(m)}</div>`).join('')}${draft}</div>
      ${ui.pending ? '<p class="aura-understanding" role="status">Aura is putting your words in context.</p>' : ''}${offer}
      ${sug.length ? `<div class="suggestions">${sug.map(([l, act, attrs]) => `<button type="button" data-act="${act}" ${attrs}>${E(l)}</button>`).join('')}</div>` : ''}
      <div class="chatdock"><form id="chat-form" class="composer"><label class="sr-only" for="message">Message Aura</label><textarea id="message" placeholder="What has today felt like?" rows="1" required></textarea><button aria-label="Send message" type="submit">↑</button></form><small class="footnote">Preset replies for this prototype. Not medical advice.</small></div></main>`;
  }

  A.views = { home, explore, chat, checkinStatus, sourceTag, discoverySummary: (o, compact) => compact ? readinessBlock(o) : discoveryDetail(o), PLAN_STATUS, FACTOR_COPY, meter, reviewOn };
})();
