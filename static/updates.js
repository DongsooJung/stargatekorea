import { koreaDay, inWindow, isStale } from './update-state.mjs';

// Recheck at load and when returning to a long-open tab, even if a scheduled build was missed.
export function updateVisibleDates(root, now = new Date()) {
  const today = koreaDay(now), last = koreaDay(new Date(new Date(now).getTime() + 6 * 86400000));
  const stale = isStale(root.dataset.lastSuccess, now);
  let visible = 0;
  for (const card of root.querySelectorAll('[data-event-card]')) {
    card.hidden = stale || card.dataset.end < today || card.dataset.start > last;
    if (!card.hidden) visible++;
  }
  root.querySelector('[data-events-empty]').hidden = visible > 0;
  if (stale) root.querySelector('[data-update-health]').textContent = 'The event listing needs a fresh check. Use the official calendar below.';
  let notices = 0;
  for (const notice of root.querySelectorAll('[data-travel-notice]')) {
    notice.hidden = !inWindow({ showFrom: notice.dataset.showFrom, showUntil: notice.dataset.showUntil }, today);
    if (!notice.hidden) notices++;
  }
  root.querySelector('[data-notice-list]').hidden = notices === 0;
}
if (typeof document !== 'undefined') {
  const root = document.querySelector('[data-seoul-updates]');
  if (root) {
    const refresh = () => updateVisibleDates(root);
    refresh();
    setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  }
}
