import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';
import { conversionNames } from '../static/conversions.mjs';
import {
  LABEL_STAGE,
  REVENUE_CHAIN,
  REVENUE_ENDPOINTS,
  STAGES,
  MIN_VIEWS,
  classifyLabel,
  stageCounts,
  revenueScore,
  topStage,
  pathVerdict,
  pathFinding,
  pathWatch,
  buildFunnel,
  sufficiency,
  revenuePriority,
} from '../scripts/revenue.mjs';
import { auditDist, auditEndpoints, bridgeFindings, revenueOfferFindings } from '../scripts/monetization-audit.mjs';
import { measure as measureRevenue } from '../scripts/measure-revenue.mjs';
import { qualifies } from '../scripts/strengthen-guide.mjs';
import { collectFindings, sortByRevenueImpact, withRevenueImpact } from '../scripts/self-improve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
before(() => build());

test('every conversion label of this site belongs to a money step', () => {
  const missing = [...conversionNames].filter(label => !LABEL_STAGE[label]);
  assert.deepEqual(missing, [], 'a label without a stage would vanish from the revenue report');
  const unknown = Object.keys(LABEL_STAGE).filter(label => !conversionNames.has(label));
  assert.deepEqual(unknown, [], 'a stage may only describe a label the site actually sends');
});

test('a click is placed on the money path and the score follows the step', () => {
  assert.equal(classifyLabel('page_plan_open'), 'activation');
  assert.equal(classifyLabel('book_view'), 'consideration');
  assert.equal(classifyLabel('book_checkout_open'), 'intent');
  assert.equal(classifyLabel('nothing_at_all'), null);
  const counts = stageCounts({ page_plan_open: 2, book_view: 1, book_checkout_open: 1 });
  assert.equal(counts.activation, 2);
  assert.equal(counts.consideration, 1);
  assert.equal(counts.intent, 1);
  assert.equal(counts.unclassified, 0);
  assert.equal(topStage({ book_view: 1, book_checkout_open: 1 }), 'intent');
  assert.ok(revenueScore({ book_checkout_open: 1 }) > revenueScore({ book_view: 1 }), 'a checkout is worth more than a look');
});

test('a label nobody classified is counted, never dropped', () => {
  const counts = stageCounts({ brand_new_label: 3 });
  assert.equal(counts.unclassified, 3);
  assert.equal(counts.unclassifiedLabels.brand_new_label, 3);
});

test('the money path ends outside this site, in the store and by email', () => {
  const order = STAGES.map(stage => stage.id);
  assert.deepEqual(order, ['attention', 'activation', 'consideration', 'intent', 'revenue']);
  const revenueStage = STAGES.find(stage => stage.id === 'revenue');
  assert.equal(revenueStage.external, true, 'the completed order cannot be measured here');
  assert.deepEqual(REVENUE_CHAIN, ['activation', 'consideration', 'intent', 'revenue']);
});

test('a page read often enough and never acted on is a revenue finding', () => {
  const path = { path: '/seoul-in-january/', kind: 'month', views: MIN_VIEWS, clicks: 0, stageClicks: stageCounts({}), verdict: 'read-not-acting' };
  const finding = pathFinding(path);
  assert.equal(finding.code, 'guide_read_not_acting');
  assert.equal(finding.target, '/seoul-in-january/');
  assert.equal(finding.stage, 'consideration');
  assert.ok(finding.revenueImpact > 0, 'a finding states what is at stake');
  assert.equal(pathWatch(path), null);
});

test('a page with too few reads is a watch item, not a defect', () => {
  const path = { path: '/seoul-in-february/', kind: 'month', views: MIN_VIEWS - 1, clicks: 0, stageClicks: stageCounts({}), verdict: 'read-not-acting' };
  assert.equal(pathFinding(path), null, 'one or two visits are not evidence');
  const watch = pathWatch(path);
  assert.equal(watch.target, '/seoul-in-february/');
  assert.match(watch.reason, /fewer than/);
});

test('a visitor who used the free plan and never looked at a paid offer is a stalled funnel', () => {
  const path = {
    path: '/', kind: 'funnel', views: 4, clicks: 1,
    stageClicks: stageCounts({ route_generated: 1 }), verdict: 'activated',
  };
  const finding = pathFinding(path);
  assert.equal(finding.code, 'revenue_stalled_after_free');
  assert.equal(finding.stage, 'consideration');
  const working = { ...path, stageClicks: stageCounts({ book_sample_download: 1 }), verdict: 'consideration' };
  assert.equal(pathFinding(working), null, 'a page that already reaches the paid offer is left alone');
});

test('the ranking puts the money at stake first and keeps unread pages at the end', () => {
  const high = revenuePriority({ views: 10, stage: 'intent' });
  const low = revenuePriority({ views: 10, stage: 'consideration' });
  const unread = revenuePriority({ views: 0, stage: 'consideration' });
  assert.ok(high > low, 'a purchase step outranks a look at the offer');
  assert.ok(low > unread, 'more readers outrank fewer readers');
  assert.ok(unread > 0, 'a page without readers is still ranked, not dropped');
  const sorted = sortByRevenueImpact([
    { code: 'a', target: '/a/', revenueImpact: 1 },
    { code: 'b', target: '/b/', revenueImpact: 9 },
    { code: 'c', target: '/c/', revenueImpact: 5 },
  ]);
  assert.deepEqual(sorted.map(item => item.target), ['/b/', '/c/', '/a/']);
});

test('the end of the funnel exists and measures the step it owes', () => {
  const report = auditDist();
  const { endpoints, findings } = auditEndpoints(report.pages);
  assert.deepEqual(findings, [], `the money path must be complete: ${JSON.stringify(findings)}`);
  for (const endpoint of REVENUE_ENDPOINTS) {
    const row = endpoints.find(item => item.url === endpoint.url);
    assert.ok(row, `${endpoint.url} must be audited`);
    assert.equal(row.exists, true, `${endpoint.url} must exist`);
    assert.equal(row.hasStage, true, `${endpoint.url} must measure a ${endpoint.stage} step`);
  }
});

test('a link to a funnel page that does not exist is a broken bridge, not an offer', () => {
  const pages = [
    { url: '/seoul-in-january/', excluded: false, linkedEndpoints: ['/books/'], hasOffer: true, revenueReady: true, paidLabelStage: true },
    { url: '/seoul-in-february/', excluded: false, linkedEndpoints: [], hasOffer: true, revenueReady: true, paidLabelStage: true },
  ];
  const findings = bridgeFindings(pages);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'revenue_bridge_broken');
  assert.equal(findings[0].target, '/seoul-in-january/');
  assert.equal(findings[0].detail, '/books/');
});

test('a page that offers only the free plan cannot move a visitor toward money', () => {
  const pages = [
    { url: '/free-only/', excluded: false, hasOffer: true, revenueReady: false, paidLabelStage: false },
    { url: '/paid-unmeasured/', excluded: false, hasOffer: true, revenueReady: true, paidLabelStage: false },
    { url: '/paid-measured/', excluded: false, hasOffer: true, revenueReady: true, paidLabelStage: true },
    { url: '/legal/', excluded: true, hasOffer: false, revenueReady: false, paidLabelStage: false },
  ];
  const findings = revenueOfferFindings(pages);
  const codes = findings.map(item => `${item.code}:${item.target}`);
  assert.deepEqual(codes, ['revenue_offer_missing:/free-only/', 'revenue_offer_unmeasured:/paid-unmeasured/']);
});

test('a guide that only led to another guide is still a guide to strengthen', () => {
  assert.equal(qualifies({ views: 4, clicks: 1, labels: { month_guide_open: 1 } }), true, 'a click to another guide is not money');
  assert.equal(qualifies({ views: 4, clicks: 1, labels: { book_view: 1 } }), false, 'a click on the paid offer is money');
  assert.equal(qualifies({ views: 4, clicks: 1, labels: { book_checkout_open: 1 } }), false, 'a checkout is money');
  assert.equal(qualifies({ views: 4, clicks: 1, labels: { month_guide_open: 1, book_sample_download: 1 } }), false);
});

test('the revenue report reuses the guide clicks and never counts one twice', async () => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stargate-revenue-'));
  try {
    await fs.promises.mkdir(path.join(dir, 'content', 'data'), { recursive: true });
    await fs.promises.writeFile(path.join(dir, 'content', 'data', 'guide-metrics.json'), JSON.stringify({
      updatedAt: '2026-11-22T00:00:00.000Z',
      windowDays: 30,
      guides: [{ path: '/seoul-in-january/', kind: 'month', views: 4, clicks: 1, labels: { book_view: 1 } }],
      funnel: [{ path: '/', kind: 'funnel', views: 2, clicks: 1, labels: { book_checkout_open: 1 } }],
    }));
    const report = await measureRevenue(dir);
    assert.equal(report.paths.length, 2);
    assert.equal(report.totals.clicks, 2, 'each click is counted once');
    assert.equal(report.totals.considerationClicks, 1);
    assert.equal(report.totals.revenueIntentClicks, 1);
    assert.equal(report.paths[0].verdict, 'consideration');
    assert.equal(report.paths[1].verdict, 'intent');
    assert.ok(report.funnel.conversion.length >= 3, 'the funnel reports the step between every pair of stages');
    assert.equal(report.funnel.steps.find(step => step.id === 'revenue').clicks, 0, 'the order happens outside this site');
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

test('the report says what the data can and cannot settle', () => {
  const empty = { totals: { pathsWithReads: 0, revenueIntentClicks: 0 } };
  const thin = sufficiency(empty);
  assert.equal(thin.canRank, false);
  assert.equal(thin.moneyStepsMeasured, false);
  assert.equal(thin.rankBasis, 'none');
  assert.match(thin.reason, /Not enough traffic to rank/);

  const usable = sufficiency({ totals: { pathsWithReads: 1, revenueIntentClicks: 0 } });
  assert.equal(usable.canRank, true);
  assert.equal(usable.moneyStepsMeasured, false);
  assert.equal(usable.provisional, true, 'an order without money steps is provisional, not settled');
  assert.equal(usable.rankBasis, 'traffic-only');
  assert.match(usable.reason, /PROVISIONAL/);

  const early = sufficiency({ totals: { pathsWithReads: 2, revenueIntentClicks: 0, considerationClicks: 3 } });
  assert.equal(early.rankBasis, 'early-funnel-clicks');
  assert.equal(early.provisional, true);

  const paid = sufficiency({ totals: { pathsWithReads: 4, revenueIntentClicks: 2 } });
  assert.equal(paid.canRank, true);
  assert.equal(paid.moneyStepsMeasured, true);
  assert.equal(paid.provisional, false);
  assert.equal(paid.rankBasis, 'money-steps');
  assert.match(paid.reason, /settled by measured money steps/);
});

test('the improvement log ranks the findings by money', () => {
  const report = { missingOffer: [], unmeasured: [], revenueFindings: [] };
  const revenue = {
    paths: [{ path: '/seoul-in-january/', views: 12 }],
    findings: [{ code: 'guide_read_not_acting', target: '/seoul-in-january/', stage: 'consideration' }],
  };
  const findings = collectFindings(report, null, revenue);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].stage, 'consideration');
  assert.ok(findings[0].revenueImpact > 0);
  const scored = withRevenueImpact([{ code: 'x', target: '/seoul-in-january/' }], revenue);
  assert.ok(scored[0].revenueImpact > 0, 'a finding without a stage still states what it risks');
});

test('a path that reached money is never a finding', () => {
  const path = { path: '/books/', kind: 'funnel', views: 9, clicks: 3, stageClicks: stageCounts({ book_checkout_open: 3 }), verdict: 'intent' };
  assert.equal(pathFinding(path), null);
  assert.equal(pathWatch(path), null);
  assert.equal(pathVerdict(path), 'intent');
});
