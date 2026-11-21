import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';
import { auditDist, mainContent, EXCLUDED } from '../scripts/monetization-audit.mjs';
import { mergeFindings, needsOffer, runSelfImprovement } from '../scripts/self-improve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
before(() => build());

test('every page a visitor can land on offers a next step inside the content', () => {
  const report = auditDist();
  assert.ok(report.pages.length > 10, 'the site must actually be built');
  assert.deepEqual(report.missingOffer, [], 'these pages reach a visitor but never offer a next step');
});

test('an in-content offer is measurable, so the funnel can be compared page by page', () => {
  const report = auditDist();
  assert.deepEqual(report.unmeasured, [], 'offer links without a conversion label cannot be measured');
});

test('the audit ignores only legal pages, the offer page itself and the separate trip product', () => {
  const allowed = ['/404.html', '/privacy-policy/', '/disclosure/', '/contact/', '/about/', '/custom-guide/', '/campus-trips/', '/economy/some-report/'];
  for (const url of allowed) {
    assert.ok(EXCLUDED.some(pattern => pattern.test(url)), `${url} must be out of scope`);
  }
  for (const url of ['/seoul-in-january/', '/books/', '/travel-essentials/', '/category/travel-korea/']) {
    assert.ok(!EXCLUDED.some(pattern => pattern.test(url)), `${url} must stay in scope`);
  }
  const html = '<main><p>hello</p></main><footer><a href="/books/">book</a></footer>';
  assert.equal(mainContent(html).includes('/books/'), false, 'footer links must not count as an offer');
});

test('findings travel forward until they are fixed, and close when they are', () => {
  const previous = [{ code: 'missing_offer', target: '/x/', firstSeen: '2026-11-01', count: 2 }];
  const { open, closed } = mergeFindings(previous, [{ code: 'missing_offer', target: '/x/', firstSeen: '2026-11-02' }]);
  assert.equal(open.length, 1);
  assert.equal(open[0].count, 3, 'an unresolved finding keeps its age across iterations');
  assert.equal(open[0].firstSeen, '2026-11-01');
  assert.equal(closed.length, 0);
  const done = mergeFindings(previous, []);
  assert.equal(done.open.length, 0);
  assert.equal(done.closed.length, 1, 'a fixed finding is recorded as closed');
});

test('a generated page that loses its offer is repaired automatically', () => {
  assert.equal(needsOffer('text with [plan](/#plan)'), true);
  assert.equal(needsOffer('text with [guide](/books/) and [brief](/custom-guide/)'), false);
});

test('the improvement log records the rule, the data limitation and the streak', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const result = await runSelfImprovement({ today });
  assert.ok(result.iterations >= 1);
  const log = JSON.parse(fs.readFileSync(path.join(root, 'content', 'data', 'self-improvement.json'), 'utf8'));
  assert.match(log.rule, /next step/);
  assert.match(log.dataQuality, /one store per site/);
  const last = log.iterations.at(-1);
  assert.equal(last.pagesMissingOffer, 0);
  assert.ok(last.streak >= 1);
  assert.ok(Array.isArray(log.openFindings));
});
