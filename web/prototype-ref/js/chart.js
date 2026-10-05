// Stacked hairline panels on one shared date axis (adapted from lieflat
// Basics F2 Hairline Line). Each signal gets its own panel and its own
// labeled scale, so heights are never compared across signals.
(function (root) {
  const W = 360, LEFT = 30, RIGHT = 16, PANEL = 70, GAP = 28, TOP = 24;
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // series: [{ key, title, unit, min, max, ticks:[{v,label}], color, values:[n|null], marks:[null|'unknown'|'skipped'], note }]
  function panels(dates, series, selectedIndex) {
    const n = dates.length;
    const x = i => LEFT + (n === 1 ? 0 : i * (W - LEFT - RIGHT) / (n - 1));
    const H = TOP + series.length * (PANEL + GAP);
    let out = '';
    series.forEach((s, k) => {
      const y0 = TOP + k * (PANEL + GAP) + 16; // top of plot area
      const y = v => y0 + PANEL - 16 - (v - s.min) / (s.max - s.min) * (PANEL - 16);
      const base = y(s.min);
      out += `<g data-series="${s.key}"><text x="0" y="${y0 - 11}"><tspan class="ptitle">${E(s.title)}</tspan><tspan class="punit" dx="6">${E(s.unit)}</tspan></text>`;
      for (const t of s.ticks) {
        out += `<line x1="${LEFT}" x2="${W - RIGHT}" y1="${y(t.v)}" y2="${y(t.v)}" class="grid"/><text class="tick" x="${LEFT - 6}" y="${y(t.v) + 3}" text-anchor="end">${E(t.label)}</text>`;
      }
      let runs = [], run = [];
      s.values.forEach((v, i) => { if (v === null || v === undefined) { if (run.length) runs.push(run); run = []; } else run.push([x(i), y(v)]); });
      if (run.length) runs.push(run);
      const line = pts => pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
      for (const r of runs) {
        if (r.length > 1) out += `<path d="${line(r)} L ${r.at(-1)[0]} ${base} L ${r[0][0]} ${base} Z" fill="${s.color}" fill-opacity=".12"/><path d="${line(r)}" fill="none" stroke="${s.color}" stroke-width="1.75"/>`;
        out += r.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${p[0] === x(selectedIndex) ? 4 : 2.5}" fill="${s.color}"/>`).join('');
      }
      (s.marks || []).forEach((m, i) => {
        if (m === 'unknown') out += `<text class="mark" x="${x(i)}" y="${base - 4}" text-anchor="middle">?</text>`;
        if (m === 'skipped') out += `<text class="mark" x="${x(i)}" y="${base - 4}" text-anchor="middle">–</text>`;
      });
      if (s.values.every(v => v === null || v === undefined) && !(s.marks || []).some(Boolean)) {
        out += `<text class="empty" x="${(LEFT + W - RIGHT) / 2}" y="${y0 + PANEL / 2 - 4}" text-anchor="middle">${E(s.emptyText || 'No records')}</text>`;
      }
      out += '</g>';
    });
    const sx = x(selectedIndex);
    out += `<line x1="${sx}" x2="${sx}" y1="${TOP}" y2="${H - GAP + 6}" class="cursor"/>`;
    const label = series.map(s => `${s.title}, scale ${s.ticks[0].label} to ${s.ticks.at(-1).label}`).join('; ');
    return `<svg class="panelplot" viewBox="0 0 ${W} ${H - GAP + 10}" role="img" aria-label="${E(`Separate panels on a shared date axis: ${label}. Missing days are gaps; ? means not sure, – means skipped.`)}">${out}</svg>`;
  }

  root.AuraChart = { panels };
})(window);

// Overlaid signals with focus tabs (lieflat F2 hairline line, extended with
// translucent washes and a first-view reveal). Each signal keeps its own
// scale; when one is focused its scale is labeled on the plot.
(function (root) {
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // series: [{ key, label, color, unit, scale, ticks:[{v,label}], values:[n|null], marks:[null|'unknown'|'skipped'] }]
  function overlay(dates, series, selected, focus, selectedLabel) {
    const n = dates.length, base = 262, amp = 220;
    const x = i => 12 + (n === 1 ? 0 : i * 336 / (n - 1));
    const half = n === 1 ? 168 : 168 / (n - 1);
    // Date-only series (period days) are drawn as soft columns, not lines.
    const band = t => {
      const on = focus === 'all' || focus === t.key;
      return `<g data-series="${t.key}" opacity="${on ? 1 : 0.35}">${t.values.map((v, i) => v ? `<rect x="${Math.max(12, x(i) - half)}" y="22" width="${Math.min(348, x(i) + half) - Math.max(12, x(i) - half)}" height="${base - 22}" fill="${t.color}" fill-opacity="${focus === t.key ? 0.26 : 0.14}"/><circle cx="${x(i)}" cy="30" r="3" fill="${t.color}"/>` : '').join('')}</g>`;
    };
    const shape = t => {
      if (t.band) return band(t);
      const y = v => base - v / t.scale * amp;
      let runs = [], run = [];
      t.values.forEach((v, i) => { if (v === null || v === undefined) { if (run.length) runs.push(run); run = []; } else run.push([x(i), y(v)]); });
      if (run.length) runs.push(run);
      // Smooth joins keep exact sample positions without overshooting.
      const line = pts => pts.reduce((d, p, i) => i ? d + ` C ${(pts[i - 1][0] + p[0]) / 2} ${pts[i - 1][1]}, ${(pts[i - 1][0] + p[0]) / 2} ${p[1]}, ${p[0]} ${p[1]}` : `M ${p[0]} ${p[1]}`, '');
      const on = focus === 'all' || focus === t.key;
      let g = `<g data-series="${t.key}" opacity="${on ? 1 : 0.14}">`;
      for (const r of runs) {
        if (r.length > 1) g += `<path d="${line(r)} L ${r.at(-1)[0]} ${base} L ${r[0][0]} ${base} Z" fill="url(#wash-${t.key})"/><path d="${line(r)}" fill="none" stroke="${t.color}" stroke-width="2"/>`;
        g += r.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${p[0] === x(selected) ? 4 : 2}" fill="${t.color}"/>`).join('');
      }
      if (focus === t.key) (t.marks || []).forEach((m, i) => { if (m) g += `<text x="${x(i)}" y="${base - 6}" text-anchor="middle" fill="${t.color}" font-size="11">${m === 'unknown' ? '?' : '–'}</text>`; });
      return g + '</g>';
    };
    const f = series.find(s => s.key === focus && !s.band);
    const axis = f ? f.ticks.map(t => { const yy = base - t.v / f.scale * amp; return `<line x1="12" x2="348" y1="${yy}" y2="${yy}" stroke="#ffffff" stroke-opacity=".08"/><text x="14" y="${yy - 5}" fill="${f.color}" font-size="10" opacity=".9">${E(t.label)}</text>`; }).join('') : '';
    const sx = x(selected);
    return `<svg class="overlayplot" viewBox="0 0 360 292" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${E(series.map(s => `${s.label} ${s.unit}`).join(', '))} on a shared date axis. Each signal has its own scale; heights are not comparable across signals. Missing records are gaps.">
      <defs>${series.map(t => `<linearGradient id="wash-${t.key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${t.color}" stop-opacity=".48"/><stop offset="100%" stop-color="${t.color}" stop-opacity=".025"/></linearGradient>`).join('')}</defs>
      ${dates.map((d, i) => `<line x1="${x(i)}" x2="${x(i)}" y1="22" y2="${base}" stroke="#ffffff" stroke-opacity=".1"/>`).join('')}
      ${axis}
      ${series.filter(t => t.band).map(shape).join('')}${series.filter(t => !t.band && t.key !== focus).map(shape).join('')}${series.filter(t => !t.band && t.key === focus).map(shape).join('')}
      <line x1="${sx}" x2="${sx}" y1="18" y2="${base + 4}" stroke="#f6eedc" stroke-opacity=".7"/>
      <text x="${sx}" y="284" text-anchor="${selected === 0 ? 'start' : selected === n - 1 ? 'end' : 'middle'}" fill="#f6eedc" font-size="10">${E(selectedLabel)}</text>
    </svg>`;
  }
  root.AuraChart.overlay = overlay;
})(window);
