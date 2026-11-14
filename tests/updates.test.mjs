import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseVisitSeoul, refreshEvents } from '../scripts/refresh-events.mjs';
import { koreaDay, weekEvents, isStale, validateEvents, inWindow } from '../static/update-state.mjs';
import { updateVisibleDates } from '../static/updates.js';
import { renderUpdates } from '../updates.mjs';

const now = new Date('2026-11-14T05:00:00Z');
const event = { id: 'ENtest', title: 'A winter exhibition', url: 'https://english.visitseoul.net/events/example/ENtest', startDate: '2026-11-14', endDate: '2026-11-20' };
const snapshot = { schemaVersion: 1, status: 'ok', lastSuccessAt: now.toISOString(), events: [event] };
const fixture = `<a href="/events/example/ENtest" data-vs-content-id="ENtest"><span class="title">Art &amp; Seoul</span></a>
<script>listData.ENtest = { postSj: 'Not executed', startDt : '2026-11-14', endDt : '2026-11-20' };</script>`;
const notice = { id: 'notice', title: 'Travel notice', summary: 'Read before leaving.', approved: true, href: '/what-is-the-suneung/', showFrom: '2026-11-14', showUntil: '2026-11-19', checkedOn: '2026-11-14', sourceName: 'Korea.kr', sourceUrl: 'https://www.korea.kr/news/policyNewsView.do?newsId=148973935' };

test('official listing is parsed as inert text and incomplete layouts are rejected', () => {
  assert.equal(parseVisitSeoul(fixture)[0].title, 'Art & Seoul');
  assert.throws(() => parseVisitSeoul('<html>Temporary maintenance</html>'));
  assert.throws(() => parseVisitSeoul(fixture.replace('2026-11-20', '2026-02-30')));
  assert.throws(() => parseVisitSeoul(fixture.replace('2026-11-20', '2026-11-10')));
  assert.throws(() => parseVisitSeoul(fixture + fixture));
  const partial = fixture + '<a href="/events/other/ENmissing" data-vs-content-id="ENmissing"><span class="title">Other event</span></a>';
  assert.throws(() => parseVisitSeoul(partial));
});

test('failed or changed sources retain good records without refreshing their confirmation time', async () => {
  const later = new Date('2026-11-15T05:00:00Z');
  for (const fetchPage of [async () => { throw new Error('Network failed'); }, async () => '<html>Blocked</html>']) {
    const result = await refreshEvents(snapshot, fetchPage, later);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.lastSuccessAt, snapshot.lastSuccessAt);
    assert.equal(result.lastAttemptAt, later.toISOString());
    assert.deepEqual(result.events, snapshot.events);
  }
  const success = await refreshEvents(snapshot, async () => fixture, later);
  assert.equal(success.status, 'ok');
  assert.equal(success.lastSuccessAt, later.toISOString());
  assert.equal(success.events[0].title, 'Art & Seoul');
  const firstFailure = await refreshEvents(undefined, async () => { throw new Error(); }, later);
  assert.deepEqual(firstFailure.events, []);
  assert.equal(firstFailure.lastSuccessAt, null);
});

test('seven-day windows use Korea midnight, include overlapping events, and reject stale data', () => {
  assert.equal(koreaDay('2026-11-14T14:59:59Z'), '2026-11-14');
  assert.equal(koreaDay('2026-11-14T15:00:00Z'), '2026-11-15');
  const candidates = [
    { ...event, id: 'ongoing', startDate: '2026-10-01', endDate: '2026-11-14' },
    { ...event, id: 'ended', endDate: '2026-11-13' },
    { ...event, id: 'week-end', startDate: '2026-11-20' },
    { ...event, id: 'next-week', startDate: '2026-11-21', endDate: '2026-11-22' },
  ];
  assert.deepEqual(weekEvents(candidates, now).map(item => item.id), ['ongoing', 'week-end']);
  assert.equal(inWindow(notice, '2026-11-19'), true);
  assert.equal(inWindow(notice, '2026-11-20'), false);
  assert.equal(isStale('2026-11-12T05:00:00Z', now), false);
  assert.equal(isStale('2026-11-12T04:59:59Z', now), true);
  assert.equal(isStale(null, now), true);
});

test('public cards escape source text, reject foreign URLs, and show only approved current notices', () => {
  for (const url of ['javascript:alert(1)', 'https://evil.example/events/a', 'https://english.visitseoul.net@evil.example/events/a', 'https://english.visitseoul.net/events/a?token=secret']) {
    assert.throws(() => validateEvents([{ ...event, url }]));
  }
  const html = renderUpdates({ ...snapshot, events: [{ ...event, title: '<img src=x onerror=alert(1)>' }] }, [notice], now);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('data-travel-notice'));
  assert.ok(!renderUpdates(snapshot, [{ ...notice, approved: false }], now).includes('data-travel-notice'));
  const later = new Date('2026-11-20T05:00:00Z');
  const expired = renderUpdates(snapshot, [notice], later);
  assert.ok(!expired.includes('data-travel-notice'));
  assert.ok(!expired.includes('data-event-card'));
  assert.ok(expired.includes('needs a fresh check'));
  assert.equal(snapshot.lastSuccessAt, now.toISOString());
});

test('an already-open browser hides expired cards and notices even when a scheduled build is missed', () => {
  const card = { dataset: { start: '2026-11-14', end: '2026-11-14' }, hidden: false };
  const note = { dataset: { showFrom: '2026-11-14', showUntil: '2026-11-14' }, hidden: false };
  const elements = { '[data-events-empty]': { hidden: true }, '[data-update-health]': { textContent: '' }, '[data-notice-list]': { hidden: false } };
  const root = {
    dataset: { lastSuccess: now.toISOString() },
    querySelectorAll: selector => selector === '[data-event-card]' ? [card] : [note],
    querySelector: selector => elements[selector],
  };
  updateVisibleDates(root, new Date('2026-11-14T15:00:00Z'));
  assert.equal(card.hidden, true);
  assert.equal(note.hidden, true);
  assert.equal(elements['[data-events-empty]'].hidden, false);
  assert.equal(elements['[data-notice-list]'].hidden, true);
  updateVisibleDates(root, new Date('2026-11-17T00:00:00Z'));
  assert.match(elements['[data-update-health]'].textContent, /fresh check/);
});

test('production snapshot is valid and the daily job collects, checks and deploys in one workflow', () => {
  const production = JSON.parse(fs.readFileSync(new URL('../content/data/seoul-events.json', import.meta.url)));
  validateEvents(production.events);
  assert.ok(production.lastSuccessAt === null || Number.isFinite(Date.parse(production.lastSuccessAt)));
  const workflow = fs.readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(workflow, /cron: '17 23 \* \* \*'/);
  assert.ok(workflow.indexOf('npm run refresh:events') < workflow.indexOf('npm test'));
  assert.ok(workflow.indexOf('npm test') < workflow.indexOf('git push origin HEAD:main'));
});
