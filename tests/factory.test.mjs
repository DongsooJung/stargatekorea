import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, weekStartOf, monthBounds, monthInfo, rangeLabel, eventRangeLabel, eventsForRange, mdText, replaceMarker, refreshMonthPage, monthEventsBlock, weeklyArchiveBlock, weeklyPostFile, runFactory } from '../scripts/factory.mjs';
import { isExpiredPost } from '../build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const officialUrl = 'https://english.visitseoul.net/events/example/ENtest';
const event = { id: 'ENtest', title: 'A winter exhibition', url: officialUrl, startDate: '2026-11-16', endDate: '2026-11-20' };
const snapshot = { status: 'ok', lastSuccessAt: '2026-11-15T00:05:00.000Z', events: [event] };

test('weeks start on Monday and cross month and year boundaries safely', () => {
  assert.equal(weekStartOf('2026-11-15'), '2026-11-09');
  assert.equal(weekStartOf('2026-11-16'), '2026-11-16');
  assert.equal(weekStartOf('2026-11-22'), '2026-11-16');
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
  assert.equal(monthBounds('2026-11').end, '2026-11-30');
  assert.equal(monthBounds('2026-02').end, '2026-02-28');
  assert.equal(monthBounds('2028-02').end, '2028-02-29');
  assert.equal(monthInfo('2026-12').label, 'December');
  assert.equal(rangeLabel('2026-11-16', '2026-11-22'), 'November 16–22, 2026');
  assert.equal(rangeLabel('2026-11-30', '2026-12-06'), 'November 30 – December 6, 2026');
  assert.equal(rangeLabel('2026-12-28', '2027-01-03'), 'December 28, 2026 – January 3, 2027');
  assert.equal(eventRangeLabel('2026-11-16', '2026-11-20'), 'Nov 16 – Nov 20, 2026');
  assert.equal(eventRangeLabel('2026-11-20', '2026-11-20'), 'November 20, 2026');
});

test('only listings that overlap the requested window are selected', () => {
  const events = [
    { ...event, id: 'ongoing', startDate: '2026-09-18', endDate: '2026-11-29' },
    { ...event, id: 'ended', startDate: '2026-11-01', endDate: '2026-11-15' },
    { ...event, id: 'next', startDate: '2026-11-23' },
  ];
  assert.deepEqual(eventsForRange(events, '2026-11-16', '2026-11-22').map(item => item.id), ['ongoing']);
  assert.deepEqual(eventsForRange(events, '2026-11-09', '2026-11-15').map(item => item.id), ['ongoing', 'ended']);
});

test('external titles cannot break out of the generated markdown', () => {
  assert.equal(mdText('Art [SEOUL] *now*'), 'Art \\[SEOUL\\] \\*now\\*');
  const file = weeklyPostFile({ weekStart: '2026-11-16', events: [{ ...event, title: '[SEOUL] <b>x</b>' }], today: '2026-11-15' });
  assert.ok(file.includes('\\[SEOUL\\]'));
  assert.ok(!file.includes('<b>x</b>'));
  assert.ok(!file.includes('javascript:'));
});

test('a weekly roundup is dated, source-linked, deterministic and carries the offer', () => {
  const first = weeklyPostFile({ weekStart: '2026-11-16', events: snapshot.events, today: '2026-11-15' });
  const second = weeklyPostFile({ weekStart: '2026-11-16', events: snapshot.events, today: '2026-11-15' });
  assert.equal(first, second);
  assert.ok(first.includes('slug: "seoul-week-of-2026-11-16"'));
  assert.ok(first.includes('expires: "2026-11-22"'));
  assert.ok(first.includes('weekStart: "2026-11-16"'));
  assert.ok(first.includes('eventCount: 1'));
  assert.ok(first.includes(officialUrl));
  assert.ok(first.includes('/#plan'));
  assert.ok(first.includes('/books/'));
  assert.ok(first.includes('/custom-guide/'));
  assert.ok(first.includes('/seoul-weekly/'));
  // A future week is published early, and is titled so the date stays meaningful later.
  assert.ok(first.includes('Seoul Week of November 16–22, 2026'));
  const current = weeklyPostFile({ weekStart: '2026-11-16', events: snapshot.events, today: '2026-11-18' });
  assert.ok(current.includes('This Week in Seoul: November 16–22, 2026'));
  const empty = weeklyPostFile({ weekStart: '2026-11-23', events: [], today: '2026-11-22' });
  assert.ok(empty.includes('No official event listing is published for these dates'));
});

test('monthly guide blocks refresh only inside the marker and never touch the editorial text', () => {
  const page = `---\ntitle: "Seoul in November"\nslug: seoul-in-november\nupdated: 2026-01-01T09:00:00+09:00\n---\n\nEditorial intro.\n\n<!-- factory:month-events -->\nold block\n<!-- /factory:month-events -->\n\nEditorial ending.\n`;
  const inner = monthEventsBlock(snapshot.events, '2026-11');
  assert.ok(inner.includes(officialUrl));
  const next = refreshMonthPage(page, inner, '2026-11-15');
  assert.ok(next.includes('Editorial intro.'));
  assert.ok(next.includes('Editorial ending.'));
  assert.ok(next.includes('updated: "2026-11-15T09:00:00+09:00"'));
  assert.ok(!next.includes('old block'));
  assert.equal(refreshMonthPage(next, inner, '2026-11-16'), null, 'an unchanged block must not rewrite the page');
  assert.equal(refreshMonthPage(page.replace(/<!-- factory:month-events -->[\s\S]*?<!-- \/factory:month-events -->/, 'nothing'), inner, '2026-11-15'), null);
  const empty = monthEventsBlock([], '2027-01');
  assert.ok(empty.includes('not published in our source yet'));
});

test('the weekly archive lists every roundup and marks past weeks', () => {
  const block = weeklyArchiveBlock([{ slug: 'seoul-week-of-2026-11-16', weekStart: '2026-11-16', weekEnd: '2026-11-22', eventCount: 3 }], '2026-11-15');
  assert.ok(block.includes('/seoul-week-of-2026-11-16/'));
  assert.ok(block.includes('3 official listings'));
  const past = weeklyArchiveBlock([{ slug: 'seoul-week-of-2026-11-09', weekStart: '2026-11-09', weekEnd: '2026-11-15', eventCount: 1 }], '2026-11-20');
  assert.ok(past.includes('past week'));
  assert.ok(past.includes('1 official listing'));
});

test('a roundup stops being promoted once its week has passed', () => {
  assert.equal(isExpiredPost({ expires: '2026-11-22' }, '2026-11-22'), false);
  assert.equal(isExpiredPost({ expires: '2026-11-22' }, '2026-11-23'), true);
  assert.equal(isExpiredPost({}, '2026-11-23'), false);
});

test('the factory writes dated pages, refreshes the guides and changes nothing on a second run', async () => {
  const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'stargate-factory-'));
  fs.mkdirSync(path.join(tree, 'content', 'posts'), { recursive: true });
  fs.mkdirSync(path.join(tree, 'content', 'pages'), { recursive: true });
  fs.writeFileSync(path.join(tree, 'content', 'pages', 'seoul-in-november.md'), '---\ntitle: "Seoul in November"\nslug: seoul-in-november\nupdated: 2026-01-01T09:00:00+09:00\n---\n\nIntro.\n\n<!-- factory:month-events -->\nold\n<!-- /factory:month-events -->\n', 'utf8');
  fs.writeFileSync(path.join(tree, 'content', 'pages', 'seoul-weekly.md'), '---\ntitle: "Weekly Seoul Listings"\nslug: seoul-weekly\nupdated: 2026-01-01T09:00:00+09:00\n---\n\n<!-- factory:weekly-archive -->\nold\n<!-- /factory:weekly-archive -->\n', 'utf8');

  const result = await runFactory({ root: tree, snapshot, today: '2026-11-15' });
  const files = result.changed.map(item => item.file).sort();
  assert.ok(files.includes('content/posts/seoul-week-of-2026-11-09.md'), 'the current week is always published');
  assert.ok(files.includes('content/posts/seoul-week-of-2026-11-16.md'), 'a week with listings is published early');
  assert.ok(!files.includes('content/posts/seoul-week-of-2026-11-23.md'), 'a week without listings is not published');
  assert.ok(files.includes('content/pages/seoul-in-november.md'));
  assert.ok(files.includes('content/pages/seoul-weekly.md'));

  const post = fs.readFileSync(path.join(tree, 'content', 'posts', 'seoul-week-of-2026-11-16.md'), 'utf8');
  assert.ok(post.includes(officialUrl));
  assert.ok(post.includes('updated: "2026-11-15T09:00:00+09:00"'));
  const archive = fs.readFileSync(path.join(tree, 'content', 'pages', 'seoul-weekly.md'), 'utf8');
  assert.ok(archive.includes('/seoul-week-of-2026-11-16/'));

  const second = await runFactory({ root: tree, snapshot, today: '2026-11-15' });
  assert.deepEqual(second.changed, [], 'a second run on the same data must not change any file');
  fs.rmSync(tree, { recursive: true, force: true });
});

test('the deploy workflow refreshes, generates, tests and submits before it publishes', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'deploy.yml'), 'utf8');
  assert.ok(workflow.indexOf('npm run refresh:events') < workflow.indexOf('npm run factory'));
  assert.ok(workflow.indexOf('npm run factory') < workflow.indexOf('npm test'));
  assert.ok(workflow.indexOf('npm test') < workflow.indexOf('git push origin HEAD:main'));
  assert.match(workflow, /cron: '17 23 \* \* \*'/);
  assert.ok(workflow.includes('submit-indexnow.mjs'));
  const key = fs.readFileSync(path.join(root, 'static', 'indexnow-key.txt'), 'utf8').trim();
  assert.match(key, /^[A-Za-z0-9-]{8,64}$/);
});
