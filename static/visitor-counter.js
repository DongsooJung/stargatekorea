// Stargate Korea visitor counter — same Cloudflare analytics worker as stargateedu.co.kr,
// but the worker keeps www.stargatekorea.net visits in a separate store.
// One count per browser per Korea-time day; the visitor id is a random UUID kept in localStorage.
(() => {
  'use strict';

  const endpoint = 'https://stargate.stargate8225.workers.dev/api/analytics/';
  const allowedHosts = ['www.stargatekorea.net'];
  const prefix = 'stargateKoreaVisitorV1';

  const box = document.getElementById('visitor-summary');
  const todayEl = document.getElementById('visitor-today-count');
  const totalEl = document.getElementById('visitor-total-count');
  if (!box || !todayEl || !totalEl) return;
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

  async function run() {
    const day = koreaDay();
    try {
      if (!store.get(`counted:${day}`)) {
        await rpc('record_site_visit', { p_visitor_id: visitorId(), p_visit_date: day, p_path: window.location.pathname });
        store.set(`counted:${day}`, '1');
      }
      const stats = await rpc('get_site_visit_summary', { p_days: 30 });
      todayEl.textContent = fmt(stats.today);
      totalEl.textContent = fmt(stats.total);
      box.title = `Unique visitors per day, counted in Korea time (${day})`;
      box.hidden = false;
    } catch (error) {
      console.error('Visitor counter failed:', error);
      box.hidden = true;
    }
  }

  run();
})();
