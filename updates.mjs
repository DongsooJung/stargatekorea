import { eventSource, koreaDay, validDay, inWindow, weekEvents, isStale, validateEvents } from './static/update-state.mjs';

const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const dayLabel = day => new Date(day + 'T12:00:00+09:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Seoul' });
export function renderUpdates(snapshot, notices = [], now = new Date()) {
  validateEvents(snapshot.events);
  const today = koreaDay(now), stale = isStale(snapshot.lastSuccessAt, now), events = stale ? [] : weekEvents(snapshot.events, now);
  for (const item of notices) {
    if (!item.id || !item.title || !item.summary || !validDay(item.showFrom) || !validDay(item.showUntil) || item.showUntil < item.showFrom || !validDay(item.checkedOn) || !/^\/[a-z0-9-]+\/$/.test(item.href) || !/^https:\/\/(www\.)?(korea\.kr|moe\.go\.kr)\//.test(item.sourceUrl)) throw new Error('Invalid approved travel notice');
  }
  const activeNotices = notices.filter(item => item.approved === true && inWindow(item, today));
  const checkedLabel = snapshot.lastSuccessAt && Number.isFinite(Date.parse(snapshot.lastSuccessAt)) ? new Date(snapshot.lastSuccessAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }) + ' KST' : 'Not yet checked';
  return `<section class="wrap section seoul-updates" id="seoul-this-week" aria-labelledby="seoul-updates-title" data-seoul-updates data-last-success="${esc(snapshot.lastSuccessAt || '')}" data-source-status="${esc(snapshot.status)}">
  <div class="section-head split-head"><div><p class="eyebrow">A timely Seoul note</p><h2 id="seoul-updates-title">This week in Seoul.</h2></div><p class="lead">Officially listed events for the next seven days, plus practical dates to keep in mind.</p></div>
  <p class="small muted" data-update-health>${stale ? 'The event listing needs a fresh check. Use the official calendar below.' : snapshot.status !== 'ok' ? 'The latest listing check was unavailable. These dates are from the last successful check.' : 'Event dates come from the official Visit Seoul listing.'}</p>
  <div class="updates-grid" data-event-list>${events.map(item => `<article class="update-card" data-event-card data-start="${esc(item.startDate)}" data-end="${esc(item.endDate)}"><p class="eyebrow">Official event listing</p><h3><a href="${esc(item.url)}" rel="noopener">${esc(item.title)} ↗</a></h3><p class="event-dates"><time datetime="${esc(item.startDate)}">${dayLabel(item.startDate)}</time> – <time datetime="${esc(item.endDate)}">${dayLabel(item.endDate)}</time></p><p class="small muted">Source: Visit Seoul</p></article>`).join('')}</div>
  <p class="small muted" data-events-empty${events.length ? ' hidden' : ''}>No current event suggestions are available here. Browse the official calendar for your dates.</p>
  <div class="travel-notices" data-notice-list${activeNotices.length ? '' : ' hidden'}><h3>Before you set out</h3>${activeNotices.map(item => `<article class="travel-notice" data-travel-notice data-show-from="${esc(item.showFrom)}" data-show-until="${esc(item.showUntil)}"><div><h4><a href="${esc(item.href)}">${esc(item.title)} →</a></h4><p>${esc(item.summary)}</p><p class="small muted">Applies through ${dayLabel(item.showUntil)} · Checked ${dayLabel(item.checkedOn)} · <a href="${esc(item.sourceUrl)}" rel="noopener">${esc(item.sourceName)}</a></p></div></article>`).join('')}</div>
  <div class="updates-foot"><p class="small muted">Listing last checked: <time data-listing-checked>${esc(checkedLabel)}</time>. Dates can change; confirm hours, admission and any booking directly with the organizer.</p><a class="text-link" href="${eventSource.url}" rel="noopener">Official Seoul event calendar ↗</a></div>
  <script type="module" src="/updates.js?v=20261114"></script>
  </section>`;
}
