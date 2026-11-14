// Stargate Korea visitor counter — same Cloudflare analytics worker as stargateedu.co.kr,
// but the worker keeps www.stargatekorea.net visits in a separate store.
// One count per browser per Korea-time day; the visitor id is a random UUID kept in localStorage.
(() => {
  'use strict';

  const endpoint = 'https://stargate.stargate8225.workers.dev/api/analytics/';
  const allowedHosts = ['www.stargatekorea.net'];
  const prefix = 'stargateKoreaVisitorV1';

  const boxes = [...document.querySelectorAll('#visitor-summary, [data-visitor-stats]')];
  if (!boxes.length) return;
  // Local previews and other hosts must not write into the live counter.
  if (!allowedHosts.includes(window.location.hostname)) return;

  const store = {
    get(key) { try { return localStorage.getItem(`${prefix}:${key}`); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(`${prefix}:${key}`, value); } catch { /* storage blocked */ } },
  };

  function koreaDay() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const v = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${v.year}-${v.month}-${v.day}`;
  }

  function visitorId() {
    let id = store.get('visitorId');
    if (!id) {
      id = crypto.randomUUID();
      store.set('visitorId', id);
    }
    return id;
  }

  async function rpc(name, payload) {
    const res = await fetch(endpoint + name, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`${name}_${res.status}`);
    return res.json();
  }

  const fmt = (n) => Number(n || 0).toLocaleString('en-US');

  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shortDate = (d) => { const [, m, day] = d.split('-'); return `${Number(m)}/${Number(day)}`; };

  // Single-series bar chart: aggregate visitor counts per Korea-time day.
  function renderTrend(daily) {
    const wrap = document.querySelector('[data-visitor-trend]');
    const plot = document.querySelector('[data-visitor-chart]');
    if (!wrap || !plot) return;
    const rows = Array.isArray(daily) ? daily.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r?.date) && Number.isFinite(Number(r.visits))) : [];
    if (rows.length < 2) { wrap.hidden = true; return; }
    const W = 720, H = 200, top = 16, bottom = 26, left = 34, right = 8;
    const max = Math.max(1, ...rows.map((r) => Number(r.visits)));
    const step = Math.max(1, Math.ceil(max / 4));
    const yMax = step * Math.ceil(max / step);
    const innerW = W - left - right, innerH = H - top - bottom;
    const slot = innerW / rows.length, gap = 2, bw = Math.max(2, slot - gap);
    const y = (v) => top + innerH - (v / yMax) * innerH;
    let grid = '';
    for (let v = 0; v <= yMax; v += step) grid += `<line class="tg" x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}"/><text class="tl" x="${left - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    const labelEvery = Math.ceil(rows.length / 6);
    let bars = '', ticks = '';
    rows.forEach((r, i) => {
      const v = Number(r.visits), x = left + i * slot + gap / 2, h = Math.max(v ? 2 : 0, innerH * v / yMax), yy = top + innerH - h, rr = Math.min(4, bw / 2, h);
      const d = h ? `M${x},${top + innerH}V${yy + rr}Q${x},${yy} ${x + rr},${yy}H${x + bw - rr}Q${x + bw},${yy} ${x + bw},${yy + rr}V${top + innerH}Z` : '';
      bars += `<g class="tb" data-i="${i}"><rect class="hit" x="${left + i * slot}" y="${top}" width="${slot}" height="${innerH}"/>${d ? `<path d="${d}"/>` : ''}</g>`;
      if ((rows.length - 1 - i) % labelEvery === 0) ticks += `<text class="tl" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${shortDate(r.date)}</text>`;
    });
    plot.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily unique visitors for the last ${rows.length} days"><g>${grid}</g><line class="tx" x1="${left}" x2="${W - right}" y1="${top + innerH}" y2="${top + innerH}"/>${bars}${ticks}</svg><div class="trend-tip" role="status" hidden></div>`;
    const tip = plot.querySelector('.trend-tip'), svg = plot.querySelector('svg');
    const show = (g) => {
      const r = rows[Number(g.dataset.i)];
      plot.querySelectorAll('.tb.on').forEach((n) => n.classList.remove('on'));
      g.classList.add('on');
      tip.innerHTML = `<b>${fmt(r.visits)}</b> visitors<span>${esc(r.date)}</span>`;
      tip.hidden = false;
      const box = g.querySelector('.hit').getBoundingClientRect(), host = plot.getBoundingClientRect();
      tip.style.left = `${Math.min(Math.max(box.left - host.left + box.width / 2, 50), host.width - 50)}px`;
    };
    plot.querySelectorAll('.tb').forEach((g) => { g.addEventListener('pointerenter', () => show(g)); g.addEventListener('click', () => show(g)); });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; plot.querySelectorAll('.tb.on').forEach((n) => n.classList.remove('on')); });
    const period = rows.reduce((t, r) => t + Number(r.visits), 0);
    document.querySelectorAll('[data-visitor-period]').forEach((el) => { el.textContent = `${fmt(period)} visitor-days · ${shortDate(rows[0].date)}–${shortDate(rows.at(-1).date)}`; });
    const body = document.querySelector('[data-visitor-rows]');
    if (body) body.innerHTML = rows.slice().reverse().map((r) => `<tr><td>${esc(r.date)}</td><td>${fmt(r.visits)}</td></tr>`).join('');
    wrap.hidden = false;
  }

  async function run() {
    const day = koreaDay();
    try {
      if (!store.get(`counted:${day}`)) {
        await rpc('record_site_visit', { p_visitor_id: visitorId(), p_visit_date: day, p_path: window.location.pathname });
        store.set(`counted:${day}`, '1');
      }
      // Daily trend first; older workers only answer the summary, so fall back and keep the chart hidden.
      let stats;
      try { stats = await rpc('get_site_visit_daily', { p_days: 30 }); } catch { stats = await rpc('get_site_visit_summary', { p_days: 30 }); }
      renderTrend(stats.daily);
      if (!Number.isFinite(Number(stats.today)) || !Number.isFinite(Number(stats.total))) throw new Error('bad_summary');
      document.querySelectorAll('[data-visitor-today]').forEach((el) => { el.textContent = fmt(stats.today); });
      document.querySelectorAll('[data-visitor-total]').forEach((el) => { el.textContent = fmt(stats.total); });
      document.querySelectorAll('[data-visitor-day]').forEach((el) => { el.textContent = day; });
      boxes.forEach((box) => { box.title = `Unique visitors per day, counted in Korea time (${day})`; box.hidden = false; });
    } catch (error) {
      console.error('Visitor counter failed:', error);
      boxes.forEach((box) => { box.hidden = true; });
    }
  }

  run();
})();
