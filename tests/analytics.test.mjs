import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';
import { conversionPayload, pageViewPayload, linkTarget } from '../static/conversions.mjs';
import { monthIndexBlock } from '../travel.mjs';
import { verdict, mergeCandidate, actionFor, monthPaths, MERGE_MIN_VIEWS } from '../scripts/measure-guides.mjs';
import { guideFindings } from '../scripts/self-improve.mjs';
import { qualifies, selectGuides, markerFor, isStrengthened, MIN_VIEWS } from '../scripts/strengthen-guide.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
before(() => build());

const MONTHS = 12;

test('a click carries the destination it leads to, so the funnel can be read page by page', () => {
  globalThis.location = { href: 'https://www.stargatekorea.net/seoul-in-november/', origin: 'https://www.stargatekorea.net' };
  const link = (href) => ({ getAttribute: () => href, href: href.startsWith('/') ? `https://www.stargatekorea.net${href}` : href });
  assert.equal(linkTarget(link('/books/')), '/books/');
  assert.equal(linkTarget(link('/books/?utm=1#top')), '/books/', 'query and fragment are dropped');
  assert.equal(linkTarget(link('https://english.visitseoul.net/events/x/')), 'https://english.visitseoul.net/events/x/');
  assert.equal(linkTarget(link('mailto:ceo@stargateedu.co.kr')), null, 'a mail link has no page destination');
  assert.equal(linkTarget(link('#plan')), null);
  assert.equal(linkTarget(null), null);
});

test('a conversion payload keeps the page, the action and the destination', () => {
  const payload = conversionPayload('page_book_open', {
    event: 'e', visitor: 'v', session: 's', path: '/seoul-in-november/?preview=1', device: 'mobile', target: '/books/',
  });
  assert.equal(payload.p_event_type, 'click');
  assert.equal(payload.p_page_path, '/seoul-in-november/', 'the page path never carries a query');
  assert.equal(payload.p_element_label, 'page_book_open');
  assert.equal(payload.p_target_url, '/books/');
  assert.equal(conversionPayload('not_a_real_action', { event: 'e', visitor: 'v', session: 's', path: '/', device: 'desktop' }), null);
});

test('a page view is recorded with its own path and no destination', () => {
  const payload = pageViewPayload({ event: 'e', visitor: 'v', session: 's', path: '/seoul-in-march/', title: 'Seoul in March', device: 'desktop' });
  assert.equal(payload.p_event_type, 'page_view');
  assert.equal(payload.p_page_path, '/seoul-in-march/');
  assert.equal(payload.p_element_label, 'page_view');
  assert.equal(payload.p_target_url, null);
});

test('every month guide links to the other eleven, so the twelve guides form one cluster', () => {
  const files = fs.readdirSync(path.join(root, 'dist')).filter((name) => /^seoul-in-[a-z]+$/.test(name));
  assert.equal(files.length, MONTHS, 'all twelve month guides must be built');
  for (const name of files) {
    const html = fs.readFileSync(path.join(root, 'dist', name, 'index.html'), 'utf8');
    assert.equal((html.match(/class="month-link/g) ?? []).length, MONTHS, `${name} must link to all twelve months`);
    assert.equal((html.match(/month_guide_open/g) ?? []).length, MONTHS, `${name} must label its month links for measurement`);
    assert.ok(html.includes('aria-current="page"'), `${name} must mark the month it is`);
  }
});

test('pages that are not month guides do not carry the month index', () => {
  const files = ['index.html', 'seoul-starter', 'seoul-weekly', 'books'].map((name) =>
    name.endsWith('.html') ? path.join(root, 'dist', name) : path.join(root, 'dist', name, 'index.html')
  );
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(!html.includes('class="month-index"'), `${file} must not carry the month index`);
  }
});

test('the month index block lists every month once and marks the current one', () => {
  const block = monthIndexBlock('november', monthPaths().map((p) => ({ key: p.replace('/seoul-in-', '').replace('/', ''), label: 'X' })));
  assert.equal((block.match(/month-link/g) ?? []).length, MONTHS);
  assert.equal((block.match(/is-current/g) ?? []).length, 1);
  assert.ok(block.includes('/seoul-in-november/'));
});

test('a guide is merged only with evidence, and never without it', () => {
  assert.equal(mergeCandidate({ path: '/seoul-in-january/', views: 0, clicks: 0 }), null, 'no data is not a reason to merge');
  assert.equal(mergeCandidate({ path: '/seoul-in-january/', views: 5, clicks: 0 }), null, 'too few reads is not a reason to merge');
  assert.equal(mergeCandidate({ path: '/seoul-in-january/', views: MERGE_MIN_VIEWS, clicks: 0 }), '/seoul-in-january/');
  assert.equal(mergeCandidate({ path: '/seoul-in-january/', views: MERGE_MIN_VIEWS, clicks: 1 }), null, 'a guide that already converts is kept');
});

test('the measured state decides what happens next', () => {
  assert.equal(verdict(0, 0), 'no-data');
  assert.equal(verdict(10, 0), 'read-not-acting');
  assert.equal(verdict(0, 2), 'acting');
  assert.equal(verdict(10, 2), 'working');
  assert.equal(actionFor({ verdict: 'read-not-acting' }), 'strengthen-offer');
  assert.equal(actionFor({ verdict: 'no-data' }), 'collect-data');
  assert.equal(actionFor({ verdict: 'working' }), 'keep-separate');
});

test('only a guide that is read and never acted on becomes a finding', () => {
  const metrics = {
    guides: [
      { path: '/seoul-in-january/', verdict: 'no-data' },
      { path: '/seoul-in-february/', verdict: 'read-not-acting' },
      { path: '/seoul-in-march/', verdict: 'working' },
      { path: '/seoul-in-april/', verdict: 'acting' },
    ],
  };
  const findings = guideFindings(metrics);
  assert.equal(findings.length, 1, 'a guide with no reads is missing data, not a defect');
  assert.equal(findings[0].code, 'guide_read_not_acting');
  assert.equal(findings[0].target, '/seoul-in-february/');
  assert.deepEqual(guideFindings(null), []);
});

test('a guide qualifies only after several reads and no click at all', () => {
  assert.equal(qualifies({ views: 2, clicks: 0 }), false, 'two reads are not evidence');
  assert.equal(qualifies({ views: 3, clicks: 0 }), true);
  assert.equal(qualifies({ views: 9, clicks: 1 }), false, 'a guide that converts is left alone');
  assert.equal(qualifies({ views: 3, clicks: 0 }, 5), false, 'the threshold can be raised');
  assert.equal(qualifies(null), false);
});

test('a guide that already carries the marker is never rewritten twice', async () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const metrics = {
    guides: [
      { path: '/seoul-in-january/', views: 5, clicks: 0 },
      { path: '/seoul-in-february/', views: 4, clicks: 0 },
    ],
  };
  const file = path.join(root, 'content', 'pages', 'seoul-in-january.md');
  const original = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, `${original}\n${markerFor('2026-11-25')}\n`, 'utf8');
  try {
    const { candidates, done } = await selectGuides({ root, metrics });
    assert.equal(done.length, 1, 'the marked guide is skipped');
    assert.equal(done[0].path, '/seoul-in-january/');
    assert.equal(candidates.length, 1, 'the unmarked guide still needs work');
    assert.equal(candidates[0].path, '/seoul-in-february/');
  } finally {
    fs.writeFileSync(file, original, 'utf8');
  }
});
