// Date rules shared by the build and the browser. All calendar days use Korea time.
export const eventSource = { name: 'Visit Seoul · Seoul Tourism Organization', url: 'https://english.visitseoul.net/events' };
export const koreaDay = (now = new Date()) => new Date(new Date(now).getTime() + 9 * 3600000).toISOString().slice(0, 10);
export function validDay(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}
export function inWindow(item, today) {
  return validDay(item.showFrom) && validDay(item.showUntil) && item.showFrom <= today && today <= item.showUntil;
}
export function weekEvents(events, now = new Date()) {
  const today = koreaDay(now), last = koreaDay(new Date(new Date(now).getTime() + 6 * 86400000));
  return events.filter(item => validDay(item.startDate) && validDay(item.endDate) && item.startDate <= last && item.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title)).slice(0, 6);
}
export function isStale(lastSuccessAt, now = new Date()) {
  const time = Date.parse(lastSuccessAt);
  return !Number.isFinite(time) || time > new Date(now).getTime() + 300000 || new Date(now).getTime() - time > 48 * 3600000;
}
export function allowedEventUrl(value) {
  try { const url = new URL(value); return url.origin === 'https://english.visitseoul.net' && url.pathname.startsWith('/events/') && !url.username && !url.password && !url.search && !url.hash; } catch { return false; }
}
export function validateEvents(events) {
  if (!Array.isArray(events) || events.length > 100) throw new Error('Invalid event collection');
  const ids = new Set();
  for (const item of events) {
    if (!item || !/^[A-Za-z0-9_-]+$/.test(item.id) || ids.has(item.id) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 240 || !validDay(item.startDate) || !validDay(item.endDate) || item.endDate < item.startDate || !allowedEventUrl(item.url)) throw new Error('Invalid event record');
    ids.add(item.id);
  }
  return events;
}
